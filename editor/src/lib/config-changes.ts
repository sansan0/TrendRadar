import { isMap, isNode, isScalar, isSeq } from 'yaml'
import { isSensitiveField } from './exporter.ts'
import { explainTextChange } from './text-change-impact.ts'
import { getTextSections } from './text-sections.ts'
import type { ConfigFileKey, Lang } from './types.ts'
import { tr } from '../i18n/translate.ts'
import { describeFieldTitle, explainFieldChange } from './yaml-change-impact.ts'
import { getInObject, getYamlNode, parseYamlSafe, setYamlValues, type YamlPath } from './yaml-doc.ts'
import { getFieldReferences, getYamlFieldTree } from './yaml-fields.ts'

interface EditRange {
  oldStart: number
  newStart: number
  removed: number
  added: number
}

// Trim the shared ends first. For very large imported files one exact middle
// range bounds the memory use while still retaining every changed line.
function editRanges(before: string[], after: string[]): EditRange[] {
  let start = 0
  let endA = before.length
  let endB = after.length
  while (start < endA && start < endB && before[start] === after[start]) start++
  while (endA > start && endB > start && before[endA - 1] === after[endB - 1]) {
    endA--
    endB--
  }
  const rows = endA - start
  const cols = endB - start
  if (!rows && !cols) return []
  if (!rows || !cols || rows * cols > 1_000_000) {
    return [{ oldStart: start, newStart: start, removed: rows, added: cols }]
  }
  const width = cols + 1
  const lengths = new Uint32Array((rows + 1) * width)
  for (let a = rows - 1; a >= 0; a--) {
    for (let b = cols - 1; b >= 0; b--) {
      const pos = a * width + b
      lengths[pos] = before[start + a] === after[start + b]
        ? 1 + lengths[pos + width + 1]
        : Math.max(lengths[pos + width], lengths[pos + 1])
    }
  }
  const ranges: EditRange[] = []
  let a = 0
  let b = 0
  while (a < rows || b < cols) {
    if (a < rows && b < cols && before[start + a] === after[start + b]) {
      a++
      b++
      continue
    }
    const oldStart = a
    const newStart = b
    do {
      const pos = a * width + b
      if (a < rows && (b === cols || lengths[pos + width] >= lengths[pos + 1])) a++
      else b++
    } while ((a < rows || b < cols) && !(a < rows && b < cols && before[start + a] === after[start + b]))
    ranges.push({ oldStart: start + oldStart, newStart: start + newStart, removed: a - oldStart, added: b - newStart })
  }
  return ranges
}

export type ChangeKind = 'added' | 'removed' | 'changed'

export interface FieldChange {
  kind: ChangeKind
  path: YamlPath
  originalPath: YamlPath
  before?: string
  after?: string
  beforeDisplay?: string
  afterDisplay?: string
  title?: string
  range?: EditRange
  isReorder?: boolean
}

export interface TextChange extends EditRange {
  kind: ChangeKind
  before: string[]
  after: string[]
}

export type FileChanges =
  | { type: 'yaml'; items: (FieldChange & { effect: string })[] }
  | { type: 'text'; items: (TextChange & { effect: string })[] }
  | { type: 'invalid'; line?: number }

const normalize = (raw: string) => raw.replace(/\r\n?/g, '\n')

export function differsFromTemplate(initial: string, current: string): boolean {
  return initial !== current && normalize(initial) !== normalize(current)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function displayValue(file: ConfigFileKey, path: YamlPath, value: unknown, aliases: Map<string, YamlPath>, ancestors = new Set<object>()): unknown {
  if (isSensitiveField(file, path)) return value === '' || value == null ? value : '••••••'
  const followed = new Set<string>()
  for (let i = 1; aliases.size && i <= path.length; i++) {
    const prefix = JSON.stringify(path.slice(0, i))
    const anchor = aliases.get(prefix)
    if (!anchor || followed.has(prefix)) continue
    followed.add(prefix)
    path = [...anchor, ...path.slice(i)]
    if (isSensitiveField(file, path)) return value === '' || value == null ? value : '••••••'
    i = 0
  }
  if (value === null || typeof value !== 'object') return value
  if (ancestors.has(value)) return '*'
  const seen = new Set(ancestors).add(value)
  if (Array.isArray(value)) return value.map((item, i) => displayValue(file, [...path, i], item, aliases, seen))
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, displayValue(file, [...path, key], item, aliases, seen)]))
}

function formatReadableValue(val: unknown, lang: Lang): string | undefined {
  if (val === undefined) return undefined
  if (val === null) return 'null'
  if (typeof val === 'boolean') {
    return val
      ? tr(lang, '开启 (true)', 'Enabled (true)')
      : tr(lang, '关闭 (false)', 'Disabled (false)')
  }
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') {
    if (val === '') return tr(lang, '（未填写）', '(empty)')
    return val
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return tr(lang, '（空列表）', '(empty list)')
    if (val.every((x) => typeof x === 'string' || typeof x === 'number')) {
      return val.map(String).join(' → ')
    }
    return val.map((item) => {
      if (isRecord(item) && (typeof item.name === 'string' || typeof item.id === 'string')) {
        return item.name && item.id && item.name !== item.id ? `${item.name} (${item.id})` : String(item.name || item.id)
      }
      return JSON.stringify(item)
    }).join('\n')
  }
  if (isRecord(val)) {
    if (typeof val.name === 'string' || typeof val.id === 'string') {
      const head = val.name && val.id && val.name !== val.id ? `${val.name} (${val.id})` : String(val.name || val.id)
      const extras = Object.entries(val)
        .filter(([k]) => k !== 'name' && k !== 'id')
        .map(([k, v]) => `${k}: ${String(v)}`)
      return extras.length ? `${head} · ${extras.join(', ')}` : head
    }
    return Object.entries(val).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n')
  }
  return String(val)
}

function listKey(item: unknown): string {
  if (isRecord(item)) return typeof item.id === 'string' && item.id ? `id:${item.id}` : 'map'
  if (Array.isArray(item)) return 'list'
  return `${typeof item}:${String(item)}`
}

function hasUniqueKeys(keys: string[]): boolean {
  if (keys.some((k) => k === 'map' || k === 'list')) return false
  return new Set(keys).size === keys.length
}

function isPurePermutation(beforeKeys: string[], afterKeys: string[]): boolean {
  if (beforeKeys.length !== afterKeys.length || beforeKeys.length < 2) return false
  if (!hasUniqueKeys(beforeKeys) || !hasUniqueKeys(afterKeys)) return false
  if (beforeKeys.every((k, i) => k === afterKeys[i])) return false
  const setA = new Set(beforeKeys)
  return afterKeys.every((k) => setA.has(k))
}

function summarizeOrderList(list: unknown[]): string {
  return list.map((item) => {
    if (isRecord(item)) return String(item.name || item.id || '?')
    return String(item)
  }).join(' → ')
}

function rangeKind(range: EditRange): ChangeKind {
  return range.added === 0 ? 'removed' : range.removed === 0 ? 'added' : 'changed'
}

export function compareTemplate(file: ConfigFileKey, initial: string, current: string, lang: Lang = 'zh'): FileChanges {
  if (!file.endsWith('.yaml')) {
    const before = normalize(initial).split('\n')
    const after = normalize(current).split('\n')
    const beforeSections = getTextSections(file, initial)
    const afterSections = getTextSections(file, current)
    return { type: 'text', items: editRanges(before, after).map((range) => {
      const change = {
        ...range,
        kind: rangeKind(range),
        before: before.slice(range.oldStart, range.oldStart + range.removed),
        after: after.slice(range.newStart, range.newStart + range.added),
      }
      return { ...change, effect: explainTextChange(file, change, beforeSections, afterSections, lang) }
    }) }
  }
  const base = parseYamlSafe(initial)
  const edited = parseYamlSafe(current)
  if (!edited.doc || !base.doc) return { type: 'invalid', line: edited.error?.line }
  const items: FieldChange[] = []
  const baseTree = getYamlFieldTree(base.doc)
  const baseAliases = getFieldReferences(baseTree).targets
  const currentAliases = getFieldReferences(getYamlFieldTree(edited.doc)).targets
  const visited = new Set<object>()
  function walk(before: unknown, after: unknown, originalPath: YamlPath, path: YamlPath) {
    if (Object.is(before, after)) return
    const bothContainers = typeof before === 'object' && before !== null && typeof after === 'object' && after === after && after !== null
    if (bothContainers && visited.has(after)) return
    if (bothContainers) visited.add(after)
    if (Array.isArray(before) && Array.isArray(after)) {
      const beforeKeys = before.map(listKey)
      const afterKeys = after.map(listKey)
      if (isPurePermutation(beforeKeys, afterKeys)) {
        const beforeSummary = summarizeOrderList(before)
        const afterSummary = summarizeOrderList(after)
        items.push({
          kind: 'changed',
          isReorder: true,
          path,
          originalPath,
          before: JSON.stringify(before.map((v, i) => displayValue(file, [...originalPath, i], v, baseAliases)), null, 2),
          after: JSON.stringify(after.map((v, i) => displayValue(file, [...path, i], v, currentAliases)), null, 2),
          beforeDisplay: beforeSummary,
          afterDisplay: afterSummary,
        })
        const oldIdxByKey = new Map(beforeKeys.map((k, idx) => [k, idx]))
        afterKeys.forEach((k, newIdx) => {
          const oldIdx = oldIdxByKey.get(k)
          if (oldIdx !== undefined) {
            walk(before[oldIdx], after[newIdx], [...originalPath, oldIdx], [...path, newIdx])
          }
        })
      } else {
        let oldIndex = 0
        let newIndex = 0
        const matchedUntil = (end: number) => {
          while (oldIndex < end) {
            walk(before[oldIndex], after[newIndex], [...originalPath, oldIndex], [...path, newIndex])
            oldIndex++
            newIndex++
          }
        }
        for (const range of editRanges(beforeKeys, afterKeys)) {
          matchedUntil(range.oldStart)
          const allKeyedRecords =
            range.removed > 0 &&
            range.added > 0 &&
            beforeKeys.slice(oldIndex, oldIndex + range.removed).every((k) => k.startsWith('id:')) &&
            afterKeys.slice(newIndex, newIndex + range.added).every((k) => k.startsWith('id:'))

          if (range.removed === range.added && !allKeyedRecords) {
            matchedUntil(oldIndex + range.removed)
          } else if (allKeyedRecords) {
            const getMaskedSlice = (list: unknown[], start: number, count: number, parent: YamlPath, aliases: Map<string, YamlPath>) => {
              if (!count) return undefined
              const slice = list.slice(start, start + count).map((v, i) => displayValue(file, [...parent, start + i], v, aliases))
              return count === 1 ? slice[0] : slice
            }
            const beforeVal = getMaskedSlice(before, oldIndex, range.removed, originalPath, baseAliases)
            const afterVal = getMaskedSlice(after, newIndex, range.added, path, currentAliases)
            items.push({
              kind: 'removed',
              originalPath: [...originalPath, oldIndex],
              path: [...path, newIndex],
              range: { oldStart: range.oldStart, newStart: range.newStart, removed: range.removed, added: 0 },
              before: beforeVal === undefined ? undefined : JSON.stringify(beforeVal, null, 2),
              beforeDisplay: formatReadableValue(beforeVal, lang),
            })
            items.push({
              kind: 'added',
              originalPath: [...originalPath, oldIndex + range.removed],
              path: [...path, newIndex],
              range: { oldStart: range.oldStart + range.removed, newStart: range.newStart, removed: 0, added: range.added },
              after: afterVal === undefined ? undefined : JSON.stringify(afterVal, null, 2),
              afterDisplay: formatReadableValue(afterVal, lang),
            })
            oldIndex += range.removed
            newIndex += range.added
          } else {
            const originalItem = [...originalPath, oldIndex]
            const currentItem = [...path, newIndex]
            const getMaskedSlice = (list: unknown[], start: number, count: number, parent: YamlPath, aliases: Map<string, YamlPath>) => {
              if (!count) return undefined
              const slice = list.slice(start, start + count).map((v, i) => displayValue(file, [...parent, start + i], v, aliases))
              return count === 1 ? slice[0] : slice
            }
            const beforeVal = getMaskedSlice(before, oldIndex, range.removed, originalPath, baseAliases)
            const afterVal = getMaskedSlice(after, newIndex, range.added, path, currentAliases)
            items.push({
              kind: rangeKind(range),
              originalPath: originalItem,
              path: currentItem,
              range,
              before: beforeVal === undefined ? undefined : JSON.stringify(beforeVal, null, 2),
              after: afterVal === undefined ? undefined : JSON.stringify(afterVal, null, 2),
              beforeDisplay: formatReadableValue(beforeVal, lang),
              afterDisplay: formatReadableValue(afterVal, lang),
            })
            oldIndex += range.removed
            newIndex += range.added
          }
        }
        matchedUntil(before.length)
      }
    } else if (isRecord(before) && isRecord(after)) {
      for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        walk(Object.hasOwn(before, key) ? before[key] : undefined, Object.hasOwn(after, key) ? after[key] : undefined,
          [...originalPath, key], [...path, key])
      }
    } else {
      const maskedBefore = displayValue(file, originalPath, before, baseAliases)
      const maskedAfter = displayValue(file, path, after, currentAliases)
      const isSourceEnabledAddedFalse =
        file === 'config.yaml' &&
        before === undefined &&
        after === false &&
        path.length === 4 &&
        path[3] === 'enabled' &&
        ((path[0] === 'platforms' && path[1] === 'sources') || (path[0] === 'rss' && path[1] === 'feeds'))

      items.push({
        kind: isSourceEnabledAddedFalse ? 'changed' : before === undefined ? 'added' : after === undefined ? 'removed' : 'changed',
        path,
        originalPath,
        before: before === undefined
          ? (isSourceEnabledAddedFalse ? 'true' : undefined)
          : JSON.stringify(maskedBefore, null, 2),
        after: after === undefined ? undefined : JSON.stringify(maskedAfter, null, 2),
        beforeDisplay: isSourceEnabledAddedFalse
          ? formatReadableValue(true, lang)
          : formatReadableValue(maskedBefore, lang),
        afterDisplay: formatReadableValue(maskedAfter, lang),
      })
    }
    if (bothContainers) visited.delete(after)
  }
  walk(base.data, edited.data, [], [])
  return {
    type: 'yaml',
    items: items.map((item) => ({
      ...item,
      title: describeFieldTitle(file, item.path, item.originalPath, base.data, edited.data, lang, item.isReorder),
      effect: explainFieldChange(file, item, baseTree, edited.data, lang),
    })),
  }
}

export function restoreTextChange(current: string, change: TextChange): string {
  const endings = current.match(/\r\n|\r|\n/g) ?? []
  const lines = current.split(/\r\n|\r|\n/).map((text, index) => ({ text, ending: endings[index] }))
  const ending = endings[change.newStart] ?? endings[change.newStart - 1] ?? endings[0] ?? '\n'
  lines.splice(change.newStart, change.added, ...change.before.map((text) => ({ text, ending })))
  return lines.map((line, index) => line.text + (index === lines.length - 1 ? '' : line.ending ?? ending)).join('')
}

function yamlNodeListKey(node: unknown): string {
  if (isMap(node)) {
    const idPair = node.items.find((p) => isScalar(p.key) && String(p.key.value ?? '') === 'id')
    if (idPair && isScalar(idPair.value) && idPair.value.value) {
      return `id:${String(idPair.value.value)}`
    }
    return 'map'
  }
  if (isScalar(node)) return `${typeof node.value}:${String(node.value)}`
  return 'other'
}

export function restoreFieldChange(initial: string, current: string, change: FieldChange): string {
  if (!change.path.length) return initial
  const base = parseYamlSafe(initial)
  if (change.isReorder) {
    const edited = parseYamlSafe(current)
    if (!base.doc || !edited.doc) return current
    const currentList = getYamlNode(edited.doc, change.path)
    const baseList = getYamlNode(base.doc, change.originalPath)
    if (!isSeq(currentList) || !isSeq(baseList)) return current
    const byKey = new Map<string, unknown>()
    for (const item of currentList.items) {
      byKey.set(yamlNodeListKey(item), item)
    }
    const reordered = baseList.items.map((bItem) => byKey.get(yamlNodeListKey(bItem))).filter((x) => x !== undefined)
    if (reordered.length === currentList.items.length) {
      currentList.items = reordered as typeof currentList.items
      try {
        const next = edited.doc.toString({ lineWidth: 0, indent: 2 })
        return parseYamlSafe(next).error ? current : next
      } catch {
        return current
      }
    }
    return current
  }

  const { range } = change
  if (!range) {
    const baseVal = getInObject(base.data, change.originalPath, undefined)
    const patch = change.kind === 'added' || baseVal === undefined
      ? { path: change.path, remove: true }
      : { path: change.path, value: baseVal }
    return setYamlValues(current, [patch])
  }
  const edited = parseYamlSafe(current)
  if (!base.doc || !edited.doc) return current
  const currentList = getYamlNode(edited.doc, change.path.slice(0, -1))
  const baseList = getYamlNode(base.doc, change.originalPath.slice(0, -1))
  if (!isSeq(currentList) || !isSeq(baseList)) return current
  const entries = baseList.items.slice(range.oldStart, range.oldStart + range.removed).map((n) => isNode(n) ? n.clone() : n)
  currentList.items.splice(range.newStart, range.added, ...entries)
  try {
    const next = edited.doc.toString({ lineWidth: 0 })
    return parseYamlSafe(next).error ? current : next
  } catch {
    return current
  }
}
