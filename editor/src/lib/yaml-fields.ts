import { isAlias, isMap, isNode, isScalar, isSeq, type Document } from 'yaml'
import type { YamlPath } from './yaml-doc.ts'

export interface YamlField {
  path: YamlPath
  name: string
  comment: string
  kind: 'map' | 'list' | 'scalar' | 'alias'
  value?: unknown
  children: YamlField[]
  anchor?: string
}

/**
 * Read the actual YAML tree. Keep mapping keys as strings (including weekdays)
 * and sequence indices as numbers, as in the editor's source-position index.
 */
function readField(node: unknown, path: YamlPath, before?: string | null): YamlField {
  const isCollection = isMap(node) || isSeq(node)
  const comment = (isNode(node) && !isCollection && node.comment) || before || ''
  const key = path.at(-1)
  const field: YamlField = {
    path,
    name: typeof key === 'number' ? `[${key}]` : String(key ?? ''),
    comment: comment.split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !/^[=═─━\s-]+$/.test(line))
      .join('\n'),
    kind: 'scalar',
    children: [],
  }
  if (isNode(node) && 'anchor' in node && node.anchor) field.anchor = node.anchor

  if (isMap(node)) {
    field.kind = 'map'
    const children = new Map<string, YamlField>()
    for (const [index, pair] of node.items.entries()) {
      if (!isScalar(pair.key)) continue
      const name = String(pair.key.value ?? '')
      const lead = pair.key.commentBefore || (index === 0 ? node.commentBefore : undefined)
      children.set(name, readField(pair.value, [...path, name], lead))
    }
    field.children = [...children.values()]
  } else if (isSeq(node)) {
    field.kind = 'list'
    field.children = node.items.map((item, index) => readField(item, [...path, index]))
  } else if (isAlias(node)) {
    field.kind = 'alias'
    field.value = node.source
  } else {
    field.value = isScalar(node) ? node.value : null
  }
  return field
}

export function getYamlFieldTree(doc: Document): YamlField {
  return readField(doc.contents, [])
}

export function formatFieldPath(path: YamlPath): string {
  return path.map((part, index) => {
    if (typeof part === 'number') return `[${part}]`
    if (!/^[A-Za-z_][\w-]*$/.test(part)) return `[${JSON.stringify(part)}]`
    return index === 0 ? part : `.${part}`
  }).join('')
}

export function getFieldReferences(tree: YamlField | null) {
  const anchors = new Map<string, YamlPath>()
  const targets = new Map<string, YamlPath>()
  const referenced = new Set<string>()
  function visit(field: YamlField) {
    if (field.anchor) anchors.set(field.anchor, field.path)
    if (field.kind === 'alias') {
      const anchor = anchors.get(String(field.value))
      if (anchor) {
        targets.set(JSON.stringify(field.path), anchor)
        // A subtree may be removed when its aliases are removed along with it.
        for (let depth = 1; depth <= anchor.length; depth++) {
          const parent = anchor.slice(0, depth)
          if (!parent.every((part, i) => part === field.path[i])) {
            referenced.add(JSON.stringify(parent))
          }
        }
      }
    }
    field.children.forEach(visit)
  }
  if (tree) visit(tree)
  return { targets, referenced }
}
