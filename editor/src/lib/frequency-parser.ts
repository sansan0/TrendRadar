import type { FrequencyDoc, FrequencyGroup, FrequencyItem, GlobalFilterEntry } from './types.ts'
import { uid } from './utils.ts'

const DEFAULT_HEADER = `# ═══════════════════════════════════════════════════════════════
#                    TrendRadar 频率词配置文件
#                         Version: 1.1.0
# ═══════════════════════════════════════════════════════════════
# 可视化配置编辑器地址: https://sansan0.github.io/TrendRadar/
`

const REGEX_SYNTAX = /^\/(.+)\/([a-z]*)$/

function parseWordExpression(rawWord: string): {
  pattern: string
  isRegex: boolean
  regexFlags: string
  alias: string
} {
  let expr = rawWord.trim()
  let alias = ''
  const arrowParts = expr.split(/\s*=>\s*/)
  if (arrowParts.length > 1) {
    expr = arrowParts[0].trim()
    alias = arrowParts.slice(1).join(' => ').trim()
  }
  const rxMatch = expr.match(REGEX_SYNTAX)
  if (rxMatch) {
    return {
      pattern: rxMatch[1],
      isRegex: true,
      regexFlags: rxMatch[2] || '',
      alias,
    }
  }
  return {
    pattern: expr,
    isRegex: false,
    regexFlags: '',
    alias,
  }
}

function serializeWordExpression(item: {
  pattern: string
  isRegex: boolean
  regexFlags: string
  alias?: string
}): string {
  const core = item.isRegex
    ? `/${item.pattern}/${item.regexFlags || ''}`
    : item.pattern.trim()
  if (item.alias && item.alias.trim()) {
    return `${core} => ${item.alias.trim()}`
  }
  return core
}

export function parseFrequencyWords(content: string): FrequencyDoc {
  const normalized = content.replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n')

  // Capture leading header comments up to first section marker or rule line
  const headerLines: string[] = []
  let bodyStartIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (
      trimmed === '' ||
      trimmed.startsWith('#')
    ) {
      headerLines.push(lines[i])
      bodyStartIdx = i + 1
    } else {
      break
    }
  }

  // Preserve full leading tutorial/reference comments so visual edits do not wipe them
  let headerComments = headerLines.join('\n').trimEnd()
  if (!headerComments) {
    headerComments = DEFAULT_HEADER.trimEnd()
  }

  const body = lines.slice(bodyStartIdx).join('\n')
  // Match core/frequency.py: only consecutive newlines separate keyword groups.
  const blocks = body.split('\n\n')

  let section: 'GLOBAL_FILTER' | 'WORD_GROUPS' = 'WORD_GROUPS'
  const globalFilters: GlobalFilterEntry[] = []
  const groups: FrequencyGroup[] = []
  let pendingSectionComment: string | undefined

  for (const rawBlock of blocks) {
    const rawLines = rawBlock.split('\n').map((l) => l.trim()).filter(Boolean)
    if (rawLines.length === 0) continue

    const commentLines: string[] = []
    const contentLines: string[] = []
    for (const l of rawLines) {
      if (l.startsWith('#')) {
        commentLines.push(l)
      } else {
        contentLines.push(l)
      }
    }

    if (contentLines.length === 0) {
      // Capture meaningful section headings (skip decorative lines)
      const label = commentLines
        .map((c) => c.replace(/^#+\s*/, '').trim())
        .find((c) => c && !/^[═─┌┐└┘│\s-]+$/.test(c))
      if (label && !label.includes('全局过滤区') && !label.includes('词组定义区')) {
        pendingSectionComment = label
      }
      continue
    }

    // Check section markers
    const firstUpper = contentLines[0].toUpperCase()
    if (firstUpper === '[GLOBAL_FILTER]') {
      section = 'GLOBAL_FILTER'
      contentLines.shift()
      if (contentLines.length === 0) continue
    } else if (firstUpper === '[WORD_GROUPS]') {
      section = 'WORD_GROUPS'
      contentLines.shift()
      if (contentLines.length === 0) continue
    }

    if (section === 'GLOBAL_FILTER') {
      for (const line of contentLines) {
        if (line.startsWith('!') || line.startsWith('+') || line.startsWith('@')) continue
        const parsed = parseWordExpression(line)
        if (!parsed.pattern) continue
        globalFilters.push({
          id: uid('gf'),
          pattern: parsed.pattern,
          isRegex: parsed.isRegex,
          regexFlags: parsed.regexFlags,
        })
      }
      continue
    }

    // WORD_GROUPS block
    let groupAlias = ''
    let maxCount: number | undefined
    const items: FrequencyItem[] = []

    const startLines = [...contentLines]
    const first = startLines[0]
    if (
      first &&
      first.startsWith('[') &&
      first.endsWith(']') &&
      first.toUpperCase() !== '[GLOBAL_FILTER]' &&
      first.toUpperCase() !== '[WORD_GROUPS]'
    ) {
      groupAlias = first.slice(1, -1).trim()
      startLines.shift()
    }

    for (const line of startLines) {
      if (line.startsWith('@')) {
        const n = Number.parseInt(line.slice(1).trim(), 10)
        if (Number.isFinite(n) && n > 0) {
          maxCount = n
        }
        continue
      }
      if (line.startsWith('!')) {
        const parsed = parseWordExpression(line.slice(1))
        if (parsed.pattern) {
          items.push({
            id: uid('fi'),
            kind: 'exclude',
            ...parsed,
          })
        }
        continue
      }
      if (line.startsWith('+')) {
        const parsed = parseWordExpression(line.slice(1))
        if (parsed.pattern) {
          items.push({
            id: uid('fi'),
            kind: 'required',
            ...parsed,
          })
        }
        continue
      }
      const parsed = parseWordExpression(line)
      if (parsed.pattern) {
        items.push({
          id: uid('fi'),
          kind: 'normal',
          ...parsed,
        })
      }
    }

    if (items.length > 0 || groupAlias) {
      groups.push({
        id: uid('fg'),
        groupAlias,
        items,
        maxCount,
        sectionComment: pendingSectionComment,
      })
      pendingSectionComment = undefined
    }
  }

  return {
    headerComments,
    globalFilters,
    groups,
  }
}

export function serializeFrequencyWords(doc: FrequencyDoc): string {
  const parts: string[] = []
  parts.push((doc.headerComments || DEFAULT_HEADER).trimEnd())
  parts.push('')

  if (doc.globalFilters.length > 0) {
    parts.push('[GLOBAL_FILTER]')
    for (const gf of doc.globalFilters) {
      if (!gf.pattern.trim()) continue
      parts.push(serializeWordExpression(gf))
    }
    parts.push('')
  }

  parts.push('[WORD_GROUPS]')
  parts.push('')

  for (const group of doc.groups) {
    const lines: string[] = []
    if (group.sectionComment) {
      lines.push(`# ${group.sectionComment}`)
    }
    if (group.groupAlias.trim()) {
      lines.push(`[${group.groupAlias.trim()}]`)
    }
    for (const item of group.items) {
      if (!item.pattern.trim()) continue
      const expr = serializeWordExpression(item)
      if (item.kind === 'required') lines.push(`+${expr}`)
      else if (item.kind === 'exclude') lines.push(`!${expr}`)
      else lines.push(expr)
    }
    if (group.maxCount && group.maxCount > 0) {
      lines.push(`@${Math.floor(group.maxCount)}`)
    }
    if (lines.length > 0) {
      parts.push(lines.join('\n'))
      parts.push('')
    }
  }

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

export function getGroupDisplayName(group: FrequencyGroup): string {
  if (group.groupAlias.trim()) return group.groupAlias.trim()
  const active = group.items.filter((i) => i.kind !== 'exclude' && i.pattern.trim())
  if (active.length === 0) return '(未命名词组)'
  return active.map((i) => i.alias.trim() || i.pattern.trim()).join(' / ')
}

export interface FrequencyRegexWarning {
  pattern: string
  error: string
}

export interface TitleMatchResult {
  title: string
  status: 'matched' | 'filtered_global' | 'filtered_exclude' | 'unmatched'
  matchedGroupName?: string
  matchedGroupIndex?: number
  matchedRule?: string
  filteredBy?: string
}

function compileEntry(
  pattern: string,
  isRegex: boolean,
  warnings: FrequencyRegexWarning[],
): { test: (lowerTitle: string) => boolean; label: string } {
  if (isRegex) {
    try {
      const rx = new RegExp(pattern, 'i')
      return {
        test: (lowerTitle) => rx.test(lowerTitle),
        label: `/${pattern}/`,
      }
    } catch (e) {
      warnings.push({
        pattern,
        error: e instanceof Error ? e.message : String(e),
      })
      const lit = pattern.toLowerCase()
      return {
        test: (lowerTitle) => lowerTitle.includes(lit),
        label: `${pattern} (invalid regex → literal)`,
      }
    }
  }
  const lit = pattern.toLowerCase()
  return {
    test: (lowerTitle) => lowerTitle.includes(lit),
    label: pattern,
  }
}

/**
 * Mirrors trendradar/core/frequency.py + analyzer.py matching behavior:
 * 1. Global filters reject first
 * 2. All `!exclude` words across the file reject globally (when groups exist)
 * 3. First-match-wins across groups in order: (ALL +required) AND (ANY normal)
 */
export function testTitlesAgainstFrequency(
  doc: FrequencyDoc,
  titles: string[],
): { results: TitleMatchResult[]; regexWarnings: FrequencyRegexWarning[] } {
  const regexWarnings: FrequencyRegexWarning[] = []

  const globalMatchers = doc.globalFilters
    .filter((g) => g.pattern.trim())
    .map((g) => compileEntry(g.pattern, g.isRegex, regexWarnings))

  const allExcludes: Array<{ test: (t: string) => boolean; label: string }> = []
  const validGroups: Array<{
    index: number
    name: string
    required: Array<{ test: (t: string) => boolean; label: string }>
    normal: Array<{ test: (t: string) => boolean; label: string }>
  }> = []

  doc.groups.forEach((group, idx) => {
    const req: Array<{ test: (t: string) => boolean; label: string }> = []
    const norm: Array<{ test: (t: string) => boolean; label: string }> = []
    for (const item of group.items) {
      if (!item.pattern.trim()) continue
      const compiled = compileEntry(item.pattern, item.isRegex, regexWarnings)
      if (item.kind === 'exclude') allExcludes.push(compiled)
      else if (item.kind === 'required') req.push(compiled)
      else norm.push(compiled)
    }
    if (req.length > 0 || norm.length > 0) {
      validGroups.push({
        index: idx,
        name: getGroupDisplayName(group),
        required: req,
        normal: norm,
      })
    }
  })

  const results: TitleMatchResult[] = titles
    .map((t) => t.trim())
    .filter(Boolean)
    .map((title) => {
      const lower = title.toLowerCase()

      for (const gm of globalMatchers) {
        if (gm.test(lower)) {
          return {
            title,
            status: 'filtered_global' as const,
            filteredBy: gm.label,
          }
        }
      }

      if (validGroups.length === 0) {
        return {
          title,
          status: 'matched' as const,
          matchedGroupName: 'ALL (空词库全量模式)',
          matchedRule: '*',
        }
      }

      for (const ex of allExcludes) {
        if (ex.test(lower)) {
          return {
            title,
            status: 'filtered_exclude' as const,
            filteredBy: `!${ex.label}`,
          }
        }
      }

      for (const grp of validGroups) {
        const reqOk = grp.required.every((r) => r.test(lower))
        if (!reqOk) continue
        if (grp.normal.length === 0) {
          return {
            title,
            status: 'matched' as const,
            matchedGroupName: grp.name,
            matchedGroupIndex: grp.index,
            matchedRule: grp.required.map((r) => `+${r.label}`).join(' & '),
          }
        }
        const hitNorm = grp.normal.find((n) => n.test(lower))
        if (hitNorm) {
          return {
            title,
            status: 'matched' as const,
            matchedGroupName: grp.name,
            matchedGroupIndex: grp.index,
            matchedRule:
              grp.required.length > 0
                ? `${grp.required.map((r) => `+${r.label}`).join(' & ')} & ${hitNorm.label}`
                : hitNorm.label,
          }
        }
      }

      return {
        title,
        status: 'unmatched' as const,
      }
    })

  return { results, regexWarnings }
}
