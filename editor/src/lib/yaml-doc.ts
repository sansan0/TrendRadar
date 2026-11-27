import {
  Document,
  isAlias,
  isMap,
  isNode,
  isScalar,
  isSeq,
  LineCounter,
  parseDocument,
  Scalar,
  YAMLMap,
  YAMLSeq,
} from 'yaml'
import type { YamlParseError } from './types.ts'

export type YamlPath = Array<string | number>

export interface YamlParseResult<T = Record<string, unknown>> {
  doc: Document | null
  data: T | null
  error: YamlParseError | null
}

export function parseYamlSafe<T = Record<string, unknown>>(raw: string): YamlParseResult<T> {
  try {
    const doc = parseDocument(raw, {
      keepSourceTokens: true,
      prettyErrors: true,
      strict: false,
    })
    if (doc.errors && doc.errors.length > 0) {
      const first = doc.errors[0]
      const pos = first.linePos?.[0]
      return {
        doc: null,
        data: null,
        error: {
          message: first.message,
          line: pos?.line,
          col: pos?.col,
        },
      }
    }
    const data = (doc.toJS() ?? {}) as T
    return { doc, data, error: null }
  } catch (err) {
    return {
      doc: null,
      data: null,
      error: {
        message: err instanceof Error ? err.message : String(err),
      },
    }
  }
}

/** The two application configuration files require a mapping at their root. */
export function parseConfigYaml(raw: string): YamlParseResult {
  const parsed = parseYamlSafe(raw)
  if (parsed.doc?.contents != null && !isMap(parsed.doc.contents)) {
    return { doc: null, data: null, error: { message: '配置文件最外层必须是键值映射（mapping）。', line: 1, col: 1 } }
  }
  return parsed
}

export function getInObject<T>(
  obj: unknown,
  path: YamlPath,
  fallback: T,
): T {
  let curr: unknown = obj
  for (const seg of path) {
    if (curr === null || curr === undefined || typeof curr !== 'object') {
      return fallback
    }
    curr = (curr as Record<string | number, unknown>)[seg]
  }
  return (curr === undefined ? fallback : curr) as T
}

export function getYamlValue<T>(raw: string, path: YamlPath, fallback: T): T {
  const { data } = parseYamlSafe(raw)
  if (!data) return fallback
  return getInObject(data, path, fallback)
}

function createStyledNode(doc: Document, value: unknown) {
  if (typeof value === 'string') {
    const scalar = new Scalar(value)
    scalar.type = Scalar.QUOTE_DOUBLE
    return scalar
  }
  return doc.createNode(value)
}

function pathToNode(node: unknown, target: unknown): unknown[] | undefined {
  if (node === target) return []
  if (isMap(node)) {
    for (const pair of node.items) {
      const rest = pathToNode(pair.value, target)
      if (rest) return [pair.key, ...rest]
    }
  } else if (isSeq(node)) {
    for (let i = 0; i < node.items.length; i++) {
      const rest = pathToNode(node.items[i], target)
      if (rest) return [i, ...rest]
    }
  }
}

/** Translate JS object keys to stored keys, and edits inside aliases to their definition. */
function resolveDataPath(doc: Document, path: YamlPath, remove: boolean): unknown[] {
  let node: unknown = doc.contents
  let resolved: unknown[] = []
  for (const [index, part] of path.entries()) {
    let key: unknown = part
    if (isMap(node) && typeof part === 'string') {
      // If two scalar keys stringify alike, toJS() exposes the last one's value.
      for (let i = node.items.length - 1; i >= 0; i--) {
        const candidate = node.items[i].key
        if (isScalar(candidate) && String(candidate.value ?? '') === part) {
          key = candidate.value
          break
        }
      }
    }
    node = isMap(node) || isSeq(node) ? node.get(key, true) : undefined
    resolved.push(key)
    if (isAlias(node) && (!remove || index < path.length - 1)) {
      const target = node.resolve(doc)
      if (target) {
        resolved = pathToNode(doc.contents, target) ?? resolved
        node = target
      }
    }
  }
  return resolved
}

export function getYamlNode(doc: Document, path: YamlPath) {
  return doc.getIn(resolveDataPath(doc, path, true), true)
}

function setPathPreservingComments(doc: Document, path: unknown[], value: unknown) {
  if (path.length === 0) return

  if (!isMap(doc.contents) && !isSeq(doc.contents)) {
    doc.contents = typeof path[0] === 'number' ? new YAMLSeq() : new YAMLMap()
  }

  let current: YAMLMap | YAMLSeq = doc.contents
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]
    const next: unknown = current.get(key, true)
    if (!isMap(next) && !isSeq(next)) {
      const collection = typeof path[i + 1] === 'number' ? new YAMLSeq() : new YAMLMap()
      current.set(key, collection)
      current = collection
    } else {
      current = next
    }
  }

  const lastKey = path[path.length - 1]
  const existing = current.get(lastKey, true)
  if (isScalar(existing) && (typeof value !== 'object' || value === null)) {
    if (typeof value !== typeof existing.value || (value === null) !== (existing.value === null)) {
      existing.tag = undefined
    }
    existing.value = value
    if (typeof value === 'string' && !existing.type) {
      existing.type = Scalar.QUOTE_DOUBLE
    }
    return
  }
  const replacement = createStyledNode(doc, value)
  if (isNode(existing)) {
    replacement.comment = existing.comment
    replacement.commentBefore = existing.commentBefore
    replacement.spaceBefore = existing.spaceBefore
    if ('anchor' in existing && existing.anchor) replacement.anchor = existing.anchor
  }
  current.set(lastKey, replacement)
}

export function setYamlValue(raw: string, path: YamlPath, value: unknown): string {
  return setYamlValues(raw, [{ path, value }])
}

export interface YamlPatch {
  path: YamlPath
  value?: unknown
  remove?: boolean
}

function renderInlineScalar(doc: Document, node: Scalar, value: unknown): string | undefined {
  if (
    !node.range || node.range[0] === node.range[1] || node.tag ||
    node.type === Scalar.BLOCK_FOLDED || node.type === Scalar.BLOCK_LITERAL
  ) return

  const scalar = new Scalar(value)
  if (typeof value === 'string') {
    scalar.type = /[\r\n]/.test(value) ? Scalar.QUOTE_DOUBLE : node.type
  }
  const fragment = new Document(scalar)
  fragment.schema = doc.schema
  const text = fragment.toString({ collectionStyle: 'flow', doubleQuotedAsJSON: true, lineWidth: 0 }).trimEnd()
  if (!/[\r\n]/.test(text)) return text
}

export function setYamlValues(raw: string, patches: YamlPatch[]): string {
  const { doc, error } = parseYamlSafe(raw)
  if (!doc || error) {
    return raw
  }
  // Existing scalar fields can be replaced at their original offsets. Preserve unrelated
  // formatting, CRLFs, flow layouts, and the position of the opposite editor's cursor.
  const replacements = new Map<number, { end: number; text: string }>()
  let scalarEditsOnly = true
  for (const patch of patches) {
    if (patch.path.length === 0) continue
    const path = resolveDataPath(doc, patch.path, !!patch.remove)
    if (patch.remove) {
      if (doc.hasIn(path)) {
        doc.deleteIn(path)
        scalarEditsOnly = false
      }
      continue
    }

    const existing = doc.getIn(path, true)
    if (isScalar(existing) && Object.is(existing.value, patch.value)) continue
    const primitive = patch.value === null || ['string', 'number', 'boolean'].includes(typeof patch.value)
    const replacement = scalarEditsOnly && isScalar(existing) && primitive
      ? renderInlineScalar(doc, existing, patch.value)
      : undefined
    if (replacement !== undefined && isScalar(existing) && existing.range) {
      replacements.set(existing.range[0], { end: existing.range[1], text: replacement })
    } else {
      scalarEditsOnly = false
    }
    setPathPreservingComments(doc, path, patch.value)
  }
  if (scalarEditsOnly) {
    let result = raw
    for (const [start, edit] of [...replacements].sort(([a], [b]) => b - a)) {
      result = result.slice(0, start) + edit.text + result.slice(edit.end)
    }
    return result
  }
  try {
    return doc.toString({ lineWidth: 0, indent: 2, singleQuote: false })
  } catch {
    // A structural edit can remove an anchor still referenced elsewhere.
    return raw
  }
}

export function deleteYamlKey(raw: string, path: YamlPath): string {
  return setYamlValues(raw, [{ path, remove: true }])
}

export interface YamlSourceIndex {
  /** Source lines and columns are one-based. Map keys use their JS object spelling. */
  pathAt(line: number, column?: number): YamlPath
  positionAt(path: YamlPath): { line: number; column: number }
  lineAt(path: YamlPath): number
}

interface SourceSpan {
  path: YamlPath
  start: number
  end: number
  leaf: boolean
  parent?: SourceSpan
}

export function buildYamlSourceIndex(raw: string, doc: Document | null): YamlSourceIndex {
  const counter = new LineCounter()
  counter.addNewLine(0)
  for (const newline of raw.matchAll(/\r\n|[\n\r]/g)) {
    counter.addNewLine(newline.index! + newline[0].length)
  }

  const spans: SourceSpan[] = []
  const offsets = new Map<string, number>()

  function visit(node: unknown, path: YamlPath, start: number, end: number, parent?: SourceSpan) {
    const span = { path, start, end, parent, leaf: !isMap(node) && !isSeq(node) }
    if (path.length) {
      spans.push(span)
      offsets.set(JSON.stringify(path.map(String)), start)
    }

    if (isMap(node)) {
      for (const pair of node.items) {
        if (!isScalar(pair.key) || !pair.key.range) continue
        const key = String(pair.key.value ?? '')
        const valueEnd = isNode(pair.value) && pair.value.range ? pair.value.range[2] : pair.key.range[2]
        visit(pair.value, [...path, key], pair.key.range[0], valueEnd, span)
      }
    } else if (isSeq(node)) {
      const items = node.srcToken?.type === 'block-seq' ? node.srcToken.items : undefined
      node.items.forEach((item, index) => {
        if (!isNode(item) || !item.range) return
        // The dash belongs to the item; its first property may share this line.
        const dash = items?.[index]?.start.find((token) => token.type === 'seq-item-ind')
        visit(item, [...path, index], dash?.offset ?? item.range[0], item.range[2], span)
      })
    }
  }

  if (doc?.contents?.range) visit(doc.contents, [], doc.contents.range[0], doc.contents.range[2])

  function positionAt(path: YamlPath) {
    const keys = path.map(String)
    while (keys.length > 0) {
      const offset = offsets.get(JSON.stringify(keys))
      if (offset !== undefined) {
        const { line, col } = counter.linePos(offset)
        return { line, column: col }
      }
      keys.pop()
    }
    return { line: 1, column: 1 }
  }

  function pathAt(line: number, column = 1): YamlPath {
    const row = Math.max(0, Math.min(line - 1, counter.lineStarts.length - 1))
    const start = counter.lineStarts[row]
    const text = raw.slice(start, counter.lineStarts[row + 1]).replace(/[\r\n]+$/, '')
    const indent = text.search(/\S/)
    const offset = start + Math.max(0, Math.min(text.length - 1, Math.max(column - 1, indent)))
    let lo = 0
    let hi = spans.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (spans[mid].start <= offset) lo = mid + 1
      else hi = mid
    }

    const previous = spans[lo - 1]
    let owner: SourceSpan | undefined = previous
    while (owner && offset >= owner.end) owner = owner.parent
    // Comments inside a scalar's range belong to that field, including the aligned
    // continuation lines in config.yaml. Section headings introduce the next entry.
    if (!owner?.leaf && (indent < 0 || text[indent] === '#')) {
      return spans[lo]?.path ?? previous?.path ?? []
    }
    return owner?.path ?? previous?.path ?? spans[lo]?.path ?? []
  }

  return { pathAt, positionAt, lineAt: (path) => positionAt(path).line }
}

export function findYamlPathLine(raw: string, path: YamlPath): number {
  return buildYamlSourceIndex(raw, parseYamlSafe(raw).doc).lineAt(path)
}
