import type { FrequencyGroup, FrequencyItem, FrequencyItemKind, Lang } from './types.ts'
import { uid } from './utils.ts'

export type WordGroupCreationType = 'group' | 'alias' | 'multi-alias' | 'plain'

export interface ParsedPastedFrequency {
  items: Array<Omit<FrequencyItem, 'id'>>
  groupAlias?: string
  maxCount?: number
  invalidRegexes: string[]
}

const REGEX_EXPR = /^\/(.+)\/([a-z]*)$/

export function isRegexPatternValid(pattern: string): boolean {
  if (!pattern) return true
  try {
    new RegExp(pattern, 'i')
    return true
  } catch {
    return false
  }
}

export function detectWordGroupType(group: FrequencyGroup): WordGroupCreationType {
  if (group.groupAlias.trim()) return 'group'
  const active = group.items.filter((i) => i.kind !== 'exclude' && i.pattern.trim())
  const aliasCount = active.filter((i) => i.alias.trim().length > 0).length
  if (aliasCount >= 2) return 'multi-alias'
  if (aliasCount === 1 || (active.length === 1 && active[0].isRegex)) return 'alias'
  return 'plain'
}

export function createEmptyGroupByType(type: WordGroupCreationType): FrequencyGroup {
  if (type === 'group') {
    return {
      id: uid('fg'),
      groupAlias: '',
      items: [
        {
          id: uid('fi'),
          kind: 'normal',
          pattern: '',
          isRegex: false,
          regexFlags: '',
          alias: '',
        },
      ],
    }
  }
  if (type === 'alias') {
    return {
      id: uid('fg'),
      groupAlias: '',
      items: [
        {
          id: uid('fi'),
          kind: 'normal',
          pattern: '',
          isRegex: true,
          regexFlags: '',
          alias: '',
        },
      ],
    }
  }
  if (type === 'multi-alias') {
    return {
      id: uid('fg'),
      groupAlias: '',
      items: [
        {
          id: uid('fi'),
          kind: 'normal',
          pattern: '',
          isRegex: true,
          regexFlags: '',
          alias: '',
        },
        {
          id: uid('fi'),
          kind: 'normal',
          pattern: '',
          isRegex: true,
          regexFlags: '',
          alias: '',
        },
      ],
    }
  }
  return {
    id: uid('fg'),
    groupAlias: '',
    items: [
      {
        id: uid('fi'),
        kind: 'normal',
        pattern: '',
        isRegex: false,
        regexFlags: '',
        alias: '',
      },
    ],
  }
}

/**
 * Generates the precision 3-step prompt for DeepSeek / ChatGPT / Claude to craft
 * a clean TrendRadar Python regex line (`/termA|termB|\bWord\b/ => Alias`).
 */
import { toTemplateLang } from '../i18n/languages.ts'

export function buildAiRegexPrompt(rawTopic: string, lang: Lang): string {
  const tplLang = toTemplateLang(lang)
  const topic = rawTopic.trim() || (tplLang === 'en' ? 'NVIDIA' : '胖东来')
  if (tplLang === 'en') {
    return [
      `I am configuring TrendRadar, a news aggregation tool, and need a Python regular expression to track news about [${topic}].`,
      '',
      'Please complete the following steps and output ONLY the final single line:',
      '',
      'Step 1: Precision Keyword Selection',
      `List high-signal terms tightly bound to [${topic}]:`,
      '1. Core brand: full name, common short name, ticker symbol, aliases.',
      '2. Key leadership: top executive or iconic founder only.',
      '3. Exclusive products: highly distinctive flagship products.',
      '4. Core subsidiaries / studios directly owned by the brand.',
      '',
      'Step 2: Strict Cleanup & Deduplication',
      '1. Shortest-match deduplication: remove longer phrases already covered by a shorter core word.',
      '2. Exclude unrelated companies: never include competitors or partners.',
      '3. Exclude generic buzzwords: never include broad industry terms (e.g. AI, tech, cloud, finance).',
      '',
      'Step 3: Build the Regex Line',
      '1. Wrap every English word with word boundaries \\b (e.g. \\bWord\\b).',
      '2. Join all terms with |.',
      '',
      'Required output format:',
      `/TermA|TermB|\\bEnglishWord\\b/ => ${topic}`,
      '',
      'Strict output rule:',
      '- Output ONLY that single line. No explanation, no markdown code block.',
    ].join('\n')
  }

  return [
    `我正在配置一个新闻聚合系统（TrendRadar），需要通过 Python 正则表达式抓取关于【${topic}】的新闻。`,
    '',
    '请帮我完成以下步骤，并最终只输出一行正则表达式字符串：',
    '',
    '第一步：【精准关键词筛选】',
    `请列出与【${topic}】强绑定的核心词汇：`,
    '1. 核心品牌：包括中文全称、简称、股票代码、别名。',
    '2. 核心人物：仅限最高决策层或极具代表性的创始人。',
    '3. 独家产品：必须是具有极高辨识度的独家产品名。',
    '4. 核心工作室/子品牌：强相关的下属机构。',
    '',
    '第二步：【严格清洗与过滤】（请严格执行）',
    '1. 包含关系去重（最短匹配原则）：',
    '   - 中文：如果列表里已经有了核心短词（如“腾讯”），请删除所有包含该短词的长词（如“腾讯云”、“腾讯视频”统统不要，因为它们会被短词命中）。',
    '   - 英文：如果有了 \\bKeyword\\b，就不要再出现 Keyword。',
    '2. 彻底排除无关公司：',
    '   - 绝对不要包含：该品牌的竞争对手、合作伙伴（如非隶属公司）。',
    '3. 彻底排除通用黑话：',
    '   - 绝对不要包含：行业通用词（如“互联网”、“大厂”、“新质生产力”、“人工智能”、“元宇宙”、“金融科技”等）。',
    '',
    '第三步：【构建 Python 正则】',
    '将清洗后的词汇合并，格式要求如下：',
    '1. 英文处理：所有英文单词必须前后加 \\b（例如 \\bWord\\b），严禁出现没有边界符的英文单词。',
    '2. 连接符：用 | 连接。',
    '',
    '最终输出示例格式：',
    `/词A|词B|\\bEnglishWord\\b/ => ${topic}`,
    '',
    '输出要求：',
    '- 只要这一行正则表达式，不要任何解释，不要代码块。',
  ].join('\n')
}

function parseSingleExpression(rawExpr: string): {
  pattern: string
  isRegex: boolean
  regexFlags: string
  alias: string
} {
  let expr = rawExpr.trim()
  let alias = ''
  const arrowParts = expr.split(/\s*=>\s*/)
  if (arrowParts.length > 1) {
    expr = arrowParts[0].trim()
    alias = arrowParts.slice(1).join(' => ').trim()
  }
  // Strip wrapping backticks if user copied inline code from AI chat
  if (expr.startsWith('`') && expr.endsWith('`') && expr.length >= 2) {
    expr = expr.slice(1, -1).trim()
  }
  const rxMatch = expr.match(REGEX_EXPR)
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

/**
 * Parses raw text pasted from AI chat or frequency_words.txt snippets.
 * Handles code fences, bullets, [GroupAlias], @limit, +required, !exclude,
 * and `/pattern/flags => alias` expressions cleanly.
 */
export function parsePastedFrequencyLines(raw: string): ParsedPastedFrequency {
  const items: Array<Omit<FrequencyItem, 'id'>> = []
  const invalidRegexes: string[] = []
  let groupAlias: string | undefined
  let maxCount: number | undefined

  const cleaned = raw.replace(/\r\n?/g, '\n')
  for (const rawLine of cleaned.split('\n')) {
    let line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith('```')) continue
    // Strip common markdown list prefixes like "- ", "* ", "1. "
    line = line.replace(/^(?:[-*•]|\d+[.)])\s+/, '').trim()
    if (line.startsWith('`') && line.endsWith('`') && line.length >= 2) {
      line = line.slice(1, -1).trim()
    }
    if (!line) continue

    const upper = line.toUpperCase()
    if (upper === '[GLOBAL_FILTER]' || upper === '[WORD_GROUPS]') continue

    if (line.startsWith('[') && line.endsWith(']') && line.length > 2) {
      groupAlias = line.slice(1, -1).trim()
      continue
    }
    if (line.startsWith('@')) {
      const n = Number.parseInt(line.slice(1).trim(), 10)
      if (Number.isFinite(n) && n > 0) maxCount = n
      continue
    }

    let kind: FrequencyItemKind = 'normal'
    if (line.startsWith('+')) {
      kind = 'required'
      line = line.slice(1).trim()
    } else if (line.startsWith('!')) {
      kind = 'exclude'
      line = line.slice(1).trim()
    }

    const parsed = parseSingleExpression(line)
    if (!parsed.pattern) continue

    if (parsed.isRegex && !isRegexPatternValid(parsed.pattern)) {
      invalidRegexes.push(parsed.pattern)
    }

    items.push({
      kind,
      pattern: parsed.pattern,
      isRegex: parsed.isRegex,
      regexFlags: parsed.regexFlags,
      alias: kind === 'exclude' ? '' : parsed.alias,
    })
  }

  return { items, groupAlias, maxCount, invalidRegexes }
}

export function formatGroupPreviewLines(group: FrequencyGroup): string[] {
  const lines: string[] = []
  if (group.groupAlias.trim()) {
    lines.push(`[${group.groupAlias.trim()}]`)
  }
  for (const item of group.items) {
    const p = item.pattern.trim()
    if (!p) continue
    const core = item.isRegex ? `/${p}/${item.regexFlags || ''}` : p
    const withAlias =
      item.kind !== 'exclude' && item.alias.trim()
        ? `${core} => ${item.alias.trim()}`
        : core
    if (item.kind === 'required') lines.push(`+${withAlias}`)
    else if (item.kind === 'exclude') lines.push(`!${withAlias}`)
    else lines.push(withAlias)
  }
  if (group.maxCount && group.maxCount > 0) {
    lines.push(`@${Math.floor(group.maxCount)}`)
  }
  return lines
}
