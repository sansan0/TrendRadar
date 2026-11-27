import type { SearchQueriesDoc, SearchTopic } from './types.ts'
import { uid } from './utils.ts'

const DEFAULT_HEADER = `# ═══════════════════════════════════════════════════════════════
#                TrendRadar 联网搜索任务配置文件
#                         Version: 1.0.0
# ═══════════════════════════════════════════════════════════════
# 可视化配置编辑器地址: https://sansan0.github.io/TrendRadar/
`

function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
}

export function parseSearchQueries(content: string): SearchQueriesDoc {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')

  const headerLines: string[] = []
  let bodyStartIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed === '' || trimmed.startsWith('#')) {
      headerLines.push(lines[i])
      bodyStartIdx = i + 1
    } else {
      break
    }
  }

  let headerComments = headerLines.join('\n').trimEnd()
  if (!headerComments) {
    headerComments = DEFAULT_HEADER.trimEnd()
  }

  const body = lines.slice(bodyStartIdx).join('\n')
  const blocks = body.split(/\n\s*\n/)

  let section: 'GLOBAL_FILTER' | 'SEARCH_TOPICS' = 'SEARCH_TOPICS'
  const globalExcludeWords: string[] = []
  const globalExcludeSites: string[] = []
  const topics: SearchTopic[] = []

  for (const rawBlock of blocks) {
    const contentLines = rawBlock
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))

    if (contentLines.length === 0) continue

    const firstUpper = contentLines[0].toUpperCase()
    if (firstUpper === '[GLOBAL_FILTER]') {
      section = 'GLOBAL_FILTER'
      contentLines.shift()
      if (contentLines.length === 0) continue
    } else if (firstUpper === '[SEARCH_TOPICS]') {
      section = 'SEARCH_TOPICS'
      contentLines.shift()
      if (contentLines.length === 0) continue
    }

    if (section === 'GLOBAL_FILTER') {
      for (const line of contentLines) {
        if (line.toLowerCase().startsWith('-site:')) {
          const dom = normalizeDomain(line.slice(6))
          if (dom && !globalExcludeSites.includes(dom)) globalExcludeSites.push(dom)
        } else {
          const word = line.startsWith('!') ? line.slice(1).trim() : line.trim()
          if (word && !globalExcludeWords.includes(word)) globalExcludeWords.push(word)
        }
      }
      continue
    }

    const topic: SearchTopic = {
      id: uid('st'),
      name: '',
      queries: [],
      excludeWords: [],
      excludeSites: [],
    }

    const workLines = [...contentLines]
    const first = workLines[0]
    if (
      first &&
      first.startsWith('[') &&
      first.endsWith(']') &&
      first.toUpperCase() !== '[GLOBAL_FILTER]' &&
      first.toUpperCase() !== '[SEARCH_TOPICS]'
    ) {
      topic.name = first.slice(1, -1).trim()
      workLines.shift()
    }

    for (const line of workLines) {
      if (line.toLowerCase().startsWith('-site:')) {
        const dom = normalizeDomain(line.slice(6))
        if (dom) topic.excludeSites.push(dom)
      } else if (line.startsWith('!')) {
        const w = line.slice(1).trim()
        if (w) topic.excludeWords.push(w)
      } else if (line.toLowerCase().startsWith('@provider:')) {
        const prov = line.slice(10).trim()
        if (prov) topic.provider = prov
      } else if (/^@\d+$/.test(line)) {
        const n = Number.parseInt(line.slice(1), 10)
        if (n > 0) topic.maxItems = n
      } else if (/^~\d+d$/i.test(line)) {
        const n = Number.parseInt(line.slice(1, -1), 10)
        if (n >= 0) topic.freshnessDays = n
      } else {
        topic.queries.push(line)
      }
    }

    if (topic.queries.length > 0 || topic.name) {
      topics.push(topic)
    }
  }

  return {
    headerComments,
    globalExcludeWords,
    globalExcludeSites,
    topics,
  }
}

export function serializeSearchQueries(doc: SearchQueriesDoc): string {
  const parts: string[] = []
  parts.push((doc.headerComments || DEFAULT_HEADER).trimEnd())
  parts.push('')

  if (doc.globalExcludeWords.length > 0 || doc.globalExcludeSites.length > 0) {
    parts.push('[GLOBAL_FILTER]')
    for (const w of doc.globalExcludeWords) {
      if (w.trim()) parts.push(w.trim())
    }
    for (const s of doc.globalExcludeSites) {
      const dom = normalizeDomain(s)
      if (dom) parts.push(`-site:${dom}`)
    }
    parts.push('')
  }

  parts.push('[SEARCH_TOPICS]')
  parts.push('')

  for (const topic of doc.topics) {
    const lines: string[] = []
    if (topic.name.trim()) {
      lines.push(`[${topic.name.trim()}]`)
    }
    for (const q of topic.queries) {
      if (q.trim()) lines.push(q.trim())
    }
    for (const w of topic.excludeWords) {
      if (w.trim()) lines.push(`!${w.trim()}`)
    }
    for (const s of topic.excludeSites) {
      const dom = normalizeDomain(s)
      if (dom) lines.push(`-site:${dom}`)
    }
    if (topic.maxItems !== undefined && topic.maxItems > 0) {
      lines.push(`@${Math.floor(topic.maxItems)}`)
    }
    if (topic.freshnessDays !== undefined && topic.freshnessDays >= 0) {
      lines.push(`~${Math.floor(topic.freshnessDays)}d`)
    }
    if (topic.provider && topic.provider.trim()) {
      lines.push(`@provider:${topic.provider.trim()}`)
    }
    if (lines.length > 0) {
      parts.push(lines.join('\n'))
      parts.push('')
    }
  }

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

export function deriveTopicTitle(topic: SearchTopic): string {
  if (topic.name.trim()) return topic.name.trim()
  const first = (topic.queries[0] || '')
    .replace(/\b(?:site|after|before|filetype|inurl|intitle):[^\s]+/gi, '')
    .trim()
  return first ? (first.length > 28 ? `${first.slice(0, 28)}…` : first) : '(未命名搜索主题)'
}
