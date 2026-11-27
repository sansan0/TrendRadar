import type { TextChange } from './config-changes.ts'
import type { TextSection } from './text-sections.ts'
import type { ConfigFileKey, Lang } from './types.ts'
import { tr } from '../i18n/translate.ts'

const effects = {
  frequencySection: ['区域标记决定后续规则用于全局排除还是词组匹配。', 'Section markers assign the following rules to global exclusions or keyword groups.'],
  frequencyGlobal: ['全局排除规则会先筛掉命中的新闻标题，再匹配词组。', 'Global exclusions screen out matching headlines before keyword groups are evaluated.'],
  frequencyIgnored: ['关键词全局过滤区只读取普通词和正则表达式，这类带前缀的行会被跳过。', 'The global keyword filter reads plain terms and regular expressions and skips these prefixed lines.'],
  word: ['标题命中组内任一普通词或正则表达式，就能满足该组的普通词条件。', 'A headline satisfies the ordinary-term condition by matching any plain term or regular expression in the group.'],
  required: ['标题须同时满足组内所有必含词才能进入该组。', 'A headline must match every required term to qualify for the group.'],
  excluded: ['组内定义的排除词会在词组匹配前过滤命中的标题。', 'Exclusions defined in groups filter matching headlines before group matching.'],
  name: ['词组名称用于标识报告中该组的匹配结果。', 'The group name identifies its matching results in the report.'],
  wordName: ['没有单独命名词组时，报告会用词条别名组成显示名称。', 'For a group without its own name, term aliases supply the display name in the report.'],
  groupLimit: ['词组的条数上限决定该组在报告中最多展示多少条新闻。', 'The group limit caps how many matching stories appear in the report.'],
  invalidGroupLimit: ['词组条数上限只接受正整数，这行会被跳过。', 'A group limit must be a positive integer. This line is skipped.'],
  searchSection: ['区域标记决定后续内容是所有主题共用的屏蔽规则，还是单独的搜索任务。', 'Section markers distinguish exclusions shared by all topics from individual search tasks.'],
  globalWord: ['所有搜索主题都会过滤标题或摘要命中全局排除词的结果。', 'Every search topic filters results whose titles or snippets match a global exclusion term.'],
  globalSite: ['全局屏蔽域名会从所有搜索主题中排除相应网站的结果。', 'Globally blocked domains exclude those sites from every search topic.'],
  query: ['查询词决定该主题会检索哪些内容，同一主题的多条查询会合并结果。', 'Queries determine what the topic searches for. Results from its queries are combined.'],
  topicName: ['段首的主题名称用于标识搜索任务，并作为该主题的展示标题。', 'A heading at the start of a topic identifies the search task and supplies its display name.'],
  topicWord: ['该主题会过滤标题或摘要命中本主题排除词的结果。', 'This topic filters results whose titles or snippets match its own exclusion terms.'],
  topicSite: ['本主题屏蔽的域名只会从这个主题中排除相应网站。', 'A topic-level domain block excludes the site from this topic.'],
  topicLimit: ['这个主题可单独限制最终展示的结果条数。', 'This topic can override the limit on the number of results shown.'],
  ignoredTopicLimit: ['搜索主题的条数上限只接受正整数，这条设置会被跳过。', 'A topic result limit must be a positive integer. This setting is skipped.'],
  freshness: ['这个主题可单独限制搜索结果的发布时间范围。', 'This topic can override the publication-age limit for search results.'],
  unlimitedAge: ['该主题取消了搜索结果的发布时间限制。', 'This topic has no publication-age limit on search results.'],
  provider: ['这个主题可单独指定执行查询的搜索引擎。', 'This topic can select its own search provider.'],
} as const

type Effect = keyof typeof effects

const removedEffects: Partial<Record<Effect, readonly [string, string]>> = {
  frequencyGlobal: ['删除的全局排除规则不再拦截命中它的标题，这些标题仍按其余规则匹配。', 'The removed global rule no longer blocks matching headlines. The remaining rules still apply.'],
  excluded: ['删除的排除词不再参与标题过滤。', 'The removed exclusion no longer filters headlines.'],
  word: ['删除的词不再作为该组的普通匹配条件。', 'The removed term no longer supplies an ordinary match for this group.'],
  required: ['删除的必含词不再是进入该组的条件。', 'Headlines no longer need the removed term to qualify for this group.'],
  name: ['删除别名后，报告使用其余规则确定显示名称。', 'The report derives its display name from the remaining rules after the alias is removed.'],
  wordName: ['删除词条别名后，没有单独命名的词组会用关键词本身组成显示名称。', 'When a term alias is removed, a group without a name uses the keyword itself in its display name.'],
  groupLimit: ['词组若没有其他条数设置，将使用报告的每组条数上限。', 'Without another limit in the group, the per-group report limit applies.'],
  globalWord: ['删除的排除词不再统一过滤所有搜索主题，各主题仍应用自己的排除规则。', 'The removed term no longer filters every search topic. Each topic still applies its own exclusions.'],
  globalSite: ['该域名不再被这条全局规则屏蔽，各主题仍应用自己的屏蔽规则。', 'This global rule no longer blocks the domain. Individual topics still apply their own blocks.'],
  query: ['删除的查询不再为该主题检索结果，没有查询词的主题会被跳过。', 'The removed query stops supplying results to the topic. A topic without queries is skipped.'],
  topicName: ['主题没有显式名称时，展示标题取自第一条查询。', 'A topic without an explicit name takes its display title from the first query.'],
  topicWord: ['本主题不再应用这条排除词，搜索文件的全局排除仍然生效。', 'The topic no longer applies this term. Global search exclusions still apply.'],
  topicSite: ['本主题不再屏蔽这条规则指定的网站，仍沿用全局域名屏蔽。', 'The topic no longer blocks sites under this rule. Global domain blocks still apply.'],
  topicLimit: ['主题若没有其他条数设置，将使用全局每主题结果上限。', 'Without another topic-specific limit, the global result limit per topic applies.'],
  freshness: ['主题若没有其他时效设置，将使用全局搜索时效。', 'Without another topic-specific age limit, the global search freshness setting applies.'],
  provider: ['主题若没有其他引擎设置，将使用全局搜索引擎。', 'Without another provider set for the topic, the global search provider is used.'],
}

function sectionAt(sections: TextSection[], line: number) {
  return sections.find((section) => section.firstLine <= line && section.lastLine >= line)
}

function rules(lines: string[]) {
  return lines.map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
}

function same(a: string[], b: string[]) {
  return a.length === b.length && a.every((line, i) => line === b[i])
}

// A blank line between active rules can split a task or keyword group. Blanks
// at EOF, inside global exclusions or next to a section marker do not do that.
function activeBoundary(sections: TextSection[], start: number, length: number) {
  const left = sectionAt(sections, start)
  const right = sectionAt(sections, start + length + 1)
  if (!left || !right || left.kind !== right.kind || (left.kind !== 'words' && left.kind !== 'search')) return null
  if ([left, right].some((section) => /^(WORD_GROUPS|SEARCH_TOPICS)$/i.test(section.title))) return null
  return left !== right
}

function classifyRule(line: string, section: TextSection | undefined, frequency: boolean): Effect[] {
  const isHeading = line.startsWith('[') && line.endsWith(']') && section?.title === line.slice(1, -1)
  if (frequency) {
    if (/^\[(GLOBAL_FILTER|WORD_GROUPS)\]$/i.test(line)) return ['frequencySection']
    if (section?.kind === 'filter') return [/^[!+@]/.test(line) ? 'frequencyIgnored' : 'frequencyGlobal']
    if (isHeading) return ['name']
    if (line.startsWith('@')) return [/^@\s*\+?\d+$/.test(line) && Number(line.slice(1)) > 0 ? 'groupLimit' : 'invalidGroupLimit']
    if (line.startsWith('!')) return ['excluded']
    const match: Effect = line.startsWith('+') ? 'required' : 'word'
    return line.includes('=>') ? [match, 'wordName'] : [match]
  }
  if (/^\[(GLOBAL_FILTER|SEARCH_TOPICS)\]$/i.test(line)) return ['searchSection']
  const blockedSite = /^-site:\s*\S+$/i.test(line)
  if (section?.kind === 'filter') return [blockedSite ? 'globalSite' : 'globalWord']
  if (isHeading) return ['topicName']
  if (blockedSite) return ['topicSite']
  if (line.startsWith('!')) return ['topicWord']
  if (/^@provider:\s*\S+$/i.test(line)) return ['provider']
  if (/^@\d+$/.test(line)) return [Number(line.slice(1)) > 0 ? 'topicLimit' : 'ignoredTopicLimit']
  if (/^~\d+d$/i.test(line)) return [Number(line.slice(1, -1)) > 0 ? 'freshness' : 'unlimitedAge']
  return ['query']
}

function explainRules(frequency: boolean, change: TextChange, before: TextSection[], after: TextSection[], lang: Lang): string {
  const isCjk = lang === 'zh' || lang === 'zh-TW' || lang === 'ja'
  const pick = (pair: readonly [string, string]) => tr(lang, pair[0], pair[1])
  const oldRules = rules(change.before)
  const newRules = rules(change.after)
  if (same(oldRules, newRules)) {
    const previousSection = sectionAt(before, change.oldStart + change.removed + 1)?.kind
    const nextSection = sectionAt(after, change.newStart + change.added + 1)?.kind
    const groupKind = frequency ? 'words' : 'search'
    if ((previousSection === 'filter' && nextSection === groupKind) || (previousSection === groupKind && nextSection === 'filter')) {
      return pick(effects[frequency ? 'frequencySection' : 'searchSection'])
    }
    const previous = activeBoundary(before, change.oldStart, change.removed)
    const current = activeBoundary(after, change.newStart, change.added)
    if (previous !== null && current !== null && previous !== current) {
      if (frequency) return current
        ? tr(lang, '新增的空行将相邻规则分成两个独立匹配的词组。', 'The blank line splits adjacent rules into two separately matched keyword groups.')
        : tr(lang, '移除空行后，相邻规则会合并到同一个匹配词组。', 'Removing the blank line combines the rules into one keyword group.')
      return current
        ? tr(lang, '新增的空行将相邻查询分成两个独立的搜索任务。', 'The blank line splits the adjacent queries into two search tasks.')
        : tr(lang, '移除空行后，相邻查询归入同一个搜索主题并合并结果。', 'Removing the blank line groups the queries in one topic and combines their results.')
    }
    return tr(lang, '此次调整只涉及注释或排版，读取到的规则保持一致。', 'Only comments or formatting changed. The same rules are read.')
  }
  const collect = (lines: string[], start: number, sections: TextSection[]) => {
    const found = new Set<Effect>()
    lines.forEach((raw, i) => {
      const line = raw.trim()
      if (line && !line.startsWith('#')) {
        classifyRule(line, sectionAt(sections, start + i + 1), frequency).forEach((effect) => found.add(effect))
      }
    })
    return found
  }
  const previous = collect(change.before, change.oldStart, before)
  const current = collect(change.after, change.newStart, after)
  const found = new Set([...previous, ...current])
  // Changing only the display alias keeps the original matching expression.
  if (frequency && same(oldRules.map((s) => s.split('=>', 1)[0].trim()), newRules.map((s) => s.split('=>', 1)[0].trim()))) {
    if (found.has('wordName')) {
      found.delete('word')
      found.delete('required')
    } else if (found.has('frequencyGlobal') || found.has('excluded')) {
      return tr(
        lang,
        '排除规则只用别名左侧的表达式过滤标题，此次调整保留了原有的匹配条件。',
        'Exclusions filter headlines using the expression before the alias. This edit preserves the matching condition.',
      )
    }
  }
  const introduction = frequency
    ? tr(lang, '使用这份关键词文件时，', 'When this keyword file is used, ')
    : tr(lang, '使用这份搜索任务文件时，', 'When this search file is used, ')
  const details = [...found].flatMap((key) => {
    // A different age directive in the same edit already explains the effective override.
    if (!current.has(key) && (key === 'freshness' || key === 'unlimitedAge') && (current.has('freshness') || current.has('unlimitedAge'))) return []
    const removed = removedEffects[key === 'unlimitedAge' ? 'freshness' : key]
    return [pick(current.has(key) ? effects[key] : removed ?? effects[key])]
  }).join(isCjk ? '' : ' ')
  return introduction + (lang === 'en' ? details.charAt(0).toLowerCase() + details.slice(1) : details)
}

function promptRoles(sections: TextSection[], start: number, count: number) {
  if (!count) return []
  // The runtime sends the whole file as the user prompt when either role is missing.
  const hasBoth = ['system', 'user'].every((role) => sections.some((section) => section.kind === role))
  if (!hasBoth) return ['user']
  return sections.filter((section) => section.firstLine <= start + count && section.lastLine > start)
    .map((section) => section.kind)
}

export function explainTextChange(file: ConfigFileKey, change: TextChange, before: TextSection[], after: TextSection[], lang: Lang): string {
  const isCjk = lang === 'zh' || lang === 'zh-TW' || lang === 'ja'
  if (file === 'frequency_words.txt' || file === 'search_queries.txt') {
    return explainRules(file === 'frequency_words.txt', change, before, after, lang)
  }
  if (file === 'ai_interests.txt') {
    if (same(rules(change.before), rules(change.after))) {
      return tr(
        lang,
        '标签变更检测会忽略注释、空行及行首尾空白。AI 筛选采用此文件时，模型仍可读取完整的兴趣说明。',
        'Tag-change detection ignores comments, blank lines and surrounding whitespace. AI filtering still receives the full interest description when using this file.',
      )
    }
    return tr(
      lang,
      'AI 筛选采用此文件时，会依据这份兴趣描述提取或更新标签，并据此判断新闻标题是否符合关注方向。',
      'When AI filtering uses this file, it extracts or updates topic tags from these interests and uses them to classify headlines.',
    )
  }
  const analysis = file === 'ai_analysis_prompt.txt'
  if (!analysis && file !== 'ai_translation_prompt.txt') return ''
  const prefix = analysis
    ? tr(lang, 'AI 分析采用此模板时，', 'When AI analysis uses this template, ')
    : tr(lang, 'AI 翻译采用此模板时，', 'When AI translation uses this template, ')
  const markers = (lines: string[]) => lines.map((line) => line.trim()).filter((line) => /^\[(system|user)\]$/.test(line))
  if (!same(markers(change.before), markers(change.after))) {
    return prefix + tr(
      lang,
      '分段标记决定哪些内容作为系统指令、哪些作为本次请求。缺少其中一个标记时，整份文件会作为用户提示词。',
      'the markers separate system instructions from the user request. With either marker missing, the whole file becomes the user prompt.',
    )
  }
  const roles = new Set([...promptRoles(before, change.oldStart, change.removed), ...promptRoles(after, change.newStart, change.added)])
  if (!roles.has('system') && !roles.has('user')) {
    return tr(lang, '这段文字位于提示词正文之前，作为文件说明保留。', 'This text precedes the prompt and serves as a file note.')
  }
  if ([...change.before, ...change.after].every((line) => !line.trim())) {
    return prefix + tr(
      lang,
      '正文措辞保持一致，段落之间的空行用于调整段落间距。',
      'the wording stays the same. Blank lines between paragraphs control their spacing.',
    )
  }
  const messages: string[] = []
  if (roles.has('system')) messages.push(analysis
    ? tr(lang, '系统指令影响模型分析新闻的角度和报告写法。', 'system instructions shape the analysis approach and report format.')
    : tr(lang, '系统指令影响译文的措辞、风格和输出格式。', 'system instructions shape the wording, style and format of translations.'))
  if (roles.has('user')) messages.push(analysis
    ? tr(lang, '用户提示词组织本次报告的数据和分析要求，模板中的内容占位符会填入相应新闻资料。', 'the user prompt supplies the report data and analysis request. Content placeholders are filled with the corresponding news.')
    : tr(lang, '用户提示词组织每批翻译请求，内容和目标语言占位符会填入待译原文和配置的语言。', 'the user prompt builds each translation request. The content and target-language placeholders receive the source text and configured language.'))
  return prefix + messages.map((message, i) => !isCjk && i > 0 ? message.charAt(0).toUpperCase() + message.slice(1) : message).join(isCjk ? '' : ' ')
}
