import type { Lang, PlatformSource } from './types'
import type { YamlPatch } from './yaml-doc'
import { toTemplateLang } from '../i18n/languages'
import { tr } from '../i18n/translate'

export interface PresetPlatformItem extends PlatformSource {
  nameEn: string
  category: 'general' | 'finance' | 'tech_social'
}

export const OFFICIAL_PLATFORMS: PresetPlatformItem[] = [
  { id: 'toutiao', name: '今日头条', nameEn: 'Toutiao', expected_domain: 'toutiao.com', category: 'general' },
  { id: 'baidu', name: '百度热搜', nameEn: 'Baidu Hot', expected_domain: 'baidu.com', category: 'general' },
  { id: 'wallstreetcn-hot', name: '华尔街见闻', nameEn: 'WallStreetCN', expected_domain: 'wallstreetcn.com', category: 'finance' },
  { id: 'thepaper', name: '澎湃新闻', nameEn: 'The Paper', expected_domain: 'thepaper.cn', category: 'general' },
  { id: 'bilibili-hot-search', name: 'bilibili 热搜', nameEn: 'Bilibili Hot', expected_domain: 'bilibili.com', category: 'tech_social' },
  { id: 'cls-hot', name: '财联社热门', nameEn: 'CLS Hot', expected_domain: 'cls.cn', category: 'finance' },
  { id: 'ifeng', name: '凤凰网', nameEn: 'iFeng', expected_domain: 'ifeng.com', category: 'general' },
  { id: 'tieba', name: '贴吧', nameEn: 'Tieba', expected_domain: 'baidu.com', category: 'tech_social' },
  { id: 'weibo', name: '微博', nameEn: 'Weibo', expected_domain: 'weibo.com', category: 'tech_social' },
  { id: 'douyin', name: '抖音', nameEn: 'Douyin', expected_domain: 'douyin.com', category: 'tech_social' },
  { id: 'zhihu', name: '知乎', nameEn: 'Zhihu', expected_domain: 'zhihu.com', category: 'tech_social' },
]

export interface RssInspirationItem {
  id: string
  nameZh: string
  nameEn: string
  url: string
  tagZh: string
  tagEn: string
  maxAgeDays?: number
}

export const RSS_INSPIRATIONS: RssInspirationItem[] = [
  {
    id: 'hacker-news',
    nameZh: 'Hacker News 首页',
    nameEn: 'Hacker News Frontpage',
    url: 'https://hnrss.org/frontpage',
    tagZh: '全球科技',
    tagEn: 'Global Tech',
    maxAgeDays: 2,
  },
  {
    id: 'ruanyifeng',
    nameZh: '阮一峰的网络日志',
    nameEn: 'Ruanyifeng Blog',
    url: 'http://www.ruanyifeng.com/blog/atom.xml',
    tagZh: '技术周刊',
    tagEn: 'Tech Weekly',
    maxAgeDays: 7,
  },
  {
    id: 'yahoo-finance',
    nameZh: '雅虎财经',
    nameEn: 'Yahoo Finance',
    url: 'https://finance.yahoo.com/news/rssindex',
    tagZh: '全球财经',
    tagEn: 'Finance',
    maxAgeDays: 1,
  },
  {
    id: 'bing-ai',
    nameZh: 'Bing 新闻：人工智能',
    nameEn: 'Bing News: AI',
    url: 'https://www.bing.com/news/search?q=人工智能&format=RSS',
    tagZh: '关键词订阅',
    tagEn: 'Keyword RSS',
    maxAgeDays: 2,
  },
  {
    id: 'bing-tech',
    nameZh: 'Bing 新闻：科技与编程',
    nameEn: 'Bing News: Tech & Dev',
    url: 'https://www.bing.com/news/search?q=科技+编程&format=RSS',
    tagZh: '关键词订阅',
    tagEn: 'Keyword RSS',
    maxAgeDays: 2,
  },
  {
    id: 'bing-gold',
    nameZh: 'Bing 新闻：黄金与宏观财经',
    nameEn: 'Bing News: Gold & Macro',
    url: 'https://www.bing.com/news/search?q=黄金价格+走势&format=RSS',
    tagZh: '关键词订阅',
    tagEn: 'Keyword RSS',
    maxAgeDays: 2,
  },
]

export interface AiProviderPreset {
  id: string
  name: string
  model: string
  apiBase: string
  hintZh: string
  hintEn: string
  isRelay?: boolean
}

export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    model: 'deepseek/deepseek-v4-flash',
    apiBase: '',
    hintZh: '官方直连高性价比，可与联网搜索复用同一 Key（推荐）',
    hintEn: 'Cost-effective official API; shares key with DeepSeek Web Search',
  },
  {
    id: 'ollama',
    name: 'Ollama (本地模型)',
    model: 'ollama/qwen2.5:14b',
    apiBase: 'http://localhost:11434',
    hintZh: '完全本地离线运行，零云端 API 费用',
    hintEn: '100% local inference with zero cloud API cost',
  },
  {
    id: 'relay',
    name: 'API 中转站 (OpenAI 兼容)',
    model: 'openai/deepseek-chat',
    apiBase: 'https://your-relay.example.com/v1',
    hintZh: '自动添加 openai/ 前缀兼容第三方网关或聚合中转',
    hintEn: 'Uses openai/ prefix for OpenAI-compatible third-party relays',
    isRelay: true,
  },
]

export interface ScenarioPreset {
  id: string
  badgeZh: string
  badgeEn: string
  titleZh: string
  titleEn: string
  descZh: string
  descEn: string
  highlightsZh: string[]
  highlightsEn: string[]
  patches: YamlPatch[]
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'daily_briefing',
    badgeZh: '推荐新手',
    badgeEn: 'Recommended',
    titleZh: '每日早晚热点简报',
    titleEn: 'Morning & Evening Briefing',
    descZh: '热榜 + RSS 混合采集，关键词零成本筛选，搭配 AI 深度分析与早晚定时汇总推送。',
    descEn: 'Hotlists + RSS with zero-cost keyword filtering, AI analysis, and morning/evening schedule.',
    highlightsZh: ['11 大热榜 + RSS', '关键词精准筛选', 'AI 分析简报', '早晚汇总调度'],
    highlightsEn: ['Hotlists + RSS', 'Keyword Filter', 'AI Briefing', 'Morning/Evening Schedule'],
    patches: [
      { path: ['platforms', 'enabled'], value: true },
      { path: ['rss', 'enabled'], value: true },
      { path: ['web_search', 'enabled'], value: false },
      { path: ['filter', 'method'], value: 'keyword' },
      { path: ['ai_analysis', 'enabled'], value: true },
      { path: ['display', 'regions', 'ai_analysis'], value: true },
      { path: ['schedule', 'enabled'], value: true },
      { path: ['schedule', 'preset'], value: 'morning_evening' },
    ],
  },
  {
    id: 'ai_tech_radar',
    badgeZh: 'AI 驱动',
    badgeEn: 'AI Powered',
    titleZh: 'AI 科技深度追踪',
    titleEn: 'AI & Tech Deep Tracker',
    descZh: '用自然语言描述兴趣让 AI 智能挑新闻，自动翻译外文 RSS 并输出高密度深度研判。',
    descEn: 'Natural-language AI interest filtering with automatic RSS translation and deep analysis.',
    highlightsZh: ['AI 智能筛选', '外文 RSS 自动翻译', 'AI 深度分析', '办公三段式推送'],
    highlightsEn: ['AI Smart Filter', 'Auto RSS Translation', 'Deep AI Insights', 'Office Hours Schedule'],
    patches: [
      { path: ['platforms', 'enabled'], value: true },
      { path: ['rss', 'enabled'], value: true },
      { path: ['filter', 'method'], value: 'ai' },
      { path: ['ai_analysis', 'enabled'], value: true },
      { path: ['ai_analysis', 'include_rss'], value: true },
      { path: ['ai_translation', 'enabled'], value: true },
      { path: ['ai_translation', 'scope', 'rss'], value: true },
      { path: ['display', 'regions', 'ai_analysis'], value: true },
      { path: ['schedule', 'enabled'], value: true },
      { path: ['schedule', 'preset'], value: 'office_hours' },
    ],
  },
  {
    id: 'web_search_intel',
    badgeZh: '专题情报',
    badgeEn: 'Topic Intel',
    titleZh: '全网定向政策 / 行业情报',
    titleEn: 'Targeted Web Search Intel',
    descZh: '开启定时联网搜索主动追踪政策与行业动向，经质量漏斗过滤后由 AI 输出专题研判。',
    descEn: 'Scheduled web search with quality funnel and dedicated AI topic insights.',
    highlightsZh: ['定时联网搜索', '质量分 + 权威度漏斗', 'AI 专题研判', '去重不刷屏'],
    highlightsEn: ['Scheduled Web Search', 'Quality Funnel', 'AI Topic Insights', '7-day Dedup'],
    patches: [
      { path: ['platforms', 'enabled'], value: true },
      { path: ['web_search', 'enabled'], value: true },
      { path: ['web_search', 'min_score'], value: 0.5 },
      { path: ['display', 'regions', 'web_search'], value: true },
      { path: ['ai_analysis', 'enabled'], value: true },
      { path: ['ai_analysis', 'include_web_search'], value: true },
      { path: ['display', 'regions', 'ai_analysis'], value: true },
    ],
  },
  {
    id: 'minimal_zero_cost',
    badgeZh: '零 API 费用',
    badgeEn: 'Zero Cost',
    titleZh: '极简纯热榜增量监控',
    titleEn: 'Minimal Zero-Cost Monitor',
    descZh: '不依赖任何大模型 API Key，仅抓热榜 + 关键词匹配，有新增立即增量推送。',
    descEn: 'No LLM API key required. Pure hotlist + keyword matching with incremental push.',
    highlightsZh: ['无需 AI Key', '增量监控零重复', '极速低资源占用', '随时可再开启 AI'],
    highlightsEn: ['No AI Key Needed', 'Incremental Mode', 'Ultra Lightweight', 'Upgrade Anytime'],
    patches: [
      { path: ['platforms', 'enabled'], value: true },
      { path: ['rss', 'enabled'], value: false },
      { path: ['web_search', 'enabled'], value: false },
      { path: ['filter', 'method'], value: 'keyword' },
      { path: ['report', 'mode'], value: 'incremental' },
      { path: ['ai_analysis', 'enabled'], value: false },
      { path: ['ai_translation', 'enabled'], value: false },
      { path: ['display', 'regions', 'ai_analysis'], value: false },
      { path: ['schedule', 'enabled'], value: false },
    ],
  },
]

export const COMMON_TIMEZONES = [
  { value: 'Asia/Shanghai', labelZh: '北京时间 (Asia/Shanghai · UTC+8)', labelEn: 'Beijing / Shanghai (UTC+8)' },
  { value: 'Asia/Hong_Kong', labelZh: '香港时间 (Asia/Hong_Kong · UTC+8)', labelEn: 'Hong Kong (UTC+8)' },
  { value: 'Asia/Taipei', labelZh: '台北时间 (Asia/Taipei · UTC+8)', labelEn: 'Taipei (UTC+8)' },
  { value: 'Asia/Singapore', labelZh: '新加坡时间 (Asia/Singapore · UTC+8)', labelEn: 'Singapore (UTC+8)' },
  { value: 'Asia/Tokyo', labelZh: '东京时间 (Asia/Tokyo · UTC+9)', labelEn: 'Tokyo (UTC+9)' },
  { value: 'Asia/Seoul', labelZh: '首尔时间 (Asia/Seoul · UTC+9)', labelEn: 'Seoul (UTC+9)' },
  { value: 'Europe/London', labelZh: '伦敦时间 (Europe/London · UTC+0/+1)', labelEn: 'London (UTC+0/+1)' },
  { value: 'Europe/Berlin', labelZh: '柏林时间 (Europe/Berlin · UTC+1/+2)', labelEn: 'Berlin (UTC+1/+2)' },
  { value: 'America/New_York', labelZh: '美东时间 (America/New_York · UTC-5/-4)', labelEn: 'New York (UTC-5/-4)' },
  { value: 'America/Los_Angeles', labelZh: '美西时间 (America/Los_Angeles · UTC-8/-7)', labelEn: 'Los Angeles (UTC-8/-7)' },
  { value: 'Australia/Sydney', labelZh: '悉尼时间 (Australia/Sydney · UTC+10/+11)', labelEn: 'Sydney (UTC+10/+11)' },
  { value: 'UTC', labelZh: '协调世界时 (UTC)', labelEn: 'UTC' },
]

export const OFFICIAL_SITE_URL = 'https://trendradar.sandev.cc'
export const SANDEV_URL = 'https://sandev.cc'
export const SANFRAME_URL = 'https://ocr.sandev.cc'
export const GITHUB_REPO_URL = 'https://github.com/sansan0/TrendRadar'
export const GITHUB_PROFILE_URL = 'https://github.com/sansan0'
export const MAO_MAP_REPO_URL = 'https://github.com/sansan0/mao-map'
export const MAO_MAP_SITE_URL = 'https://sansan0.github.io/mao-map/'
export const X_PROFILE_URL = 'https://x.com/heysandev'

export function getOfficialDocUrl(slug: string, lang: Lang): string {
  const prefix = toTemplateLang(lang) === 'en' ? '/en' : '/zh'
  return `${OFFICIAL_SITE_URL}${prefix}/docs/${slug}/`
}

export function getPersonalSupportUrl(lang: Lang): string {
  const prefix = toTemplateLang(lang) === 'en' ? '/en' : '/zh'
  return `${OFFICIAL_SITE_URL}${prefix}/credits/#personal-support`
}

/* ============================================================================
 * Built-in Official Display Name / Description Bilingual Resolvers
 * Ensures YAML-backed cards (timeline presets/periods, platforms, RSS feeds,
 * default keyword/search groups) always match the active UI language unless
 * the user explicitly entered their own custom text.
 * ========================================================================== */

export const BUILTIN_TIMELINE_PRESET_META: Record<
  string,
  { nameZh: string; nameEn: string; descZh: string; descEn: string }
> = {
  always_on: {
    nameZh: '全天监控',
    nameEn: 'Always-on Monitoring',
    descZh: '全天候监控，有新增立即推送。适合重度用户。',
    descEn: 'Monitors all day; pushes immediately on anything new. For power users.',
  },
  morning_evening: {
    nameZh: '早晚汇总',
    nameEn: 'Morning/Evening Summary',
    descZh: '全天推送 + 晚间当日汇总。适合大多数人。',
    descEn: 'Push all day + an evening same-day summary. For most people.',
  },
  office_hours: {
    nameZh: '办公时间',
    nameEn: 'Office Hours',
    descZh: '工作日三段式推送（到岗→午间→收工），周末增量自由推送。',
    descEn: 'Three-block workday push (onboarding → noon → wrap-up); free incremental on weekends.',
  },
  night_owl: {
    nameZh: '夜猫子模式',
    nameEn: 'Night Owl',
    descZh: '午后速览 + 深夜全天汇总。适合夜间工作者、海外时差用户。',
    descEn: 'Afternoon brief + late-night full-day summary. For night workers and international users.',
  },
  custom: {
    nameZh: '自定义',
    nameEn: 'Custom',
    descZh: '完全自由定义时间段、日计划和周映射。',
    descEn: 'Freely define periods, day plans, and the week map.',
  },
}

export const BUILTIN_TIMELINE_PERIOD_NAMES: Record<string, [zh: string, en: string]> = {
  evening_summary: ['晚间汇总', 'Evening Summary'],
  morning_briefing: ['到岗速览', 'Morning Briefing'],
  noon_update: ['午间热点', 'Noon Hot'],
  closing_summary: ['收工汇总', 'Wrap-up Summary'],
  weekend_free: ['周末自由', 'Weekend Free'],
  afternoon_peek: ['午后速览', 'Afternoon Brief'],
  late_night: ['深夜汇总', 'Late-night Summary'],
  deep_quiet: ['深夜静默', 'Late-night Quiet'],
  weekday_morning: ['工作日早间', 'Workday Morning'],
  weekend_morning: ['周末早间', 'Weekend Morning'],
}

export function getLocalizedTimelinePresetName(
  presetKey: string,
  rawName: string | undefined,
  lang: Lang,
): string {
  const meta = BUILTIN_TIMELINE_PRESET_META[presetKey]
  const trimmed = (rawName ?? '').trim()
  if (meta && (!trimmed || trimmed === meta.nameZh || trimmed === meta.nameEn)) {
    return tr(lang, meta.nameZh, meta.nameEn)
  }
  return trimmed || presetKey
}

export function getLocalizedTimelinePresetDesc(
  presetKey: string,
  rawDesc: string | undefined,
  lang: Lang,
): string {
  const meta = BUILTIN_TIMELINE_PRESET_META[presetKey]
  const trimmed = (rawDesc ?? '').trim()
  if (meta && (!trimmed || trimmed === meta.descZh || trimmed === meta.descEn)) {
    return tr(lang, meta.descZh, meta.descEn)
  }
  return trimmed
}

export function getLocalizedTimelinePeriodName(
  periodKey: string,
  rawName: string | undefined,
  lang: Lang,
): string {
  const pair = BUILTIN_TIMELINE_PERIOD_NAMES[periodKey]
  const trimmed = (rawName ?? '').trim()
  if (pair && (!trimmed || trimmed === pair[0] || trimmed === pair[1] || trimmed === periodKey)) {
    return tr(lang, pair[0], pair[1])
  }
  return trimmed || periodKey
}

export function getLocalizedPlatformName(
  id: string,
  rawName: string | undefined,
  lang: Lang,
): string {
  const preset = OFFICIAL_PLATFORMS.find((p) => p.id === id)
  const trimmed = (rawName ?? '').trim()
  if (preset && (!trimmed || trimmed === preset.name || trimmed === preset.nameEn)) {
    return tr(lang, preset.name, preset.nameEn)
  }
  return trimmed || id
}

const BUILTIN_RSS_NAMES: Record<string, { zh: string; en: string; aliases: string[] }> = {
  'hacker-news': {
    zh: 'Hacker News',
    en: 'Hacker News',
    aliases: ['Hacker News', 'Hacker News 首页', 'Hacker News Frontpage'],
  },
  ruanyifeng: {
    zh: '阮一峰的网络日志',
    en: "Ruan Yi Feng's Blog",
    aliases: ['阮一峰的网络日志', "Ruan Yi Feng's Blog", 'Ruanyifeng Blog'],
  },
  'yahoo-finance': {
    zh: '雅虎财经',
    en: 'Yahoo Finance',
    aliases: ['雅虎财经', 'Yahoo Finance'],
  },
}

export function getLocalizedRssFeedName(
  id: string,
  rawName: string | undefined,
  lang: Lang,
): string {
  const trimmed = (rawName ?? '').trim()
  const builtin = BUILTIN_RSS_NAMES[id]
  if (builtin && (!trimmed || builtin.aliases.includes(trimmed))) {
    if (trimmed === 'Hacker News 首页' || trimmed === 'Hacker News Frontpage') {
      return tr(lang, 'Hacker News 首页', 'Hacker News Frontpage')
    }
    return tr(lang, builtin.zh, builtin.en)
  }
  const insp = RSS_INSPIRATIONS.find((x) => x.id === id)
  if (insp && (!trimmed || trimmed === insp.nameZh || trimmed === insp.nameEn)) {
    return tr(lang, insp.nameZh, insp.nameEn)
  }
  return trimmed || id
}

export function getLocalizedKeywordGroupName(rawName: string, lang: Lang): string {
  if (rawName === '(未命名词组)') {
    return tr(lang, '(未命名词组)', '(Untitled Group)')
  }
  if (rawName === 'ALL (空词库全量模式)') {
    return tr(lang, 'ALL（空词库全量模式）', 'ALL (Allow-All Mode)')
  }
  const tpl = AI_GROUP_ALIAS_PAIRS[rawName]
  if (tpl) return tr(lang, tpl[0], tpl[1])
  return rawName
}

const AI_GROUP_ALIAS_PAIRS: Record<string, [string, string]> = {
  'AI 大模型': ['AI 大模型', 'AI Models'],
  'AI Models': ['AI 大模型', 'AI Models'],
  华为芯片: ['华为芯片', 'Huawei Chips'],
  'Huawei Chips': ['华为芯片', 'Huawei Chips'],
  智能汽车: ['智能汽车', 'Smart EV'],
  'Smart EV': ['智能汽车', 'Smart EV'],
  宏观财经: ['宏观财经', 'Macro Finance'],
  'Macro Finance': ['宏观财经', 'Macro Finance'],
}

const BUILTIN_SEARCH_TOPIC_TITLES: Record<string, [string, string]> = {
  人工智能产业政策: ['人工智能产业政策', 'AI Policy & Regulation'],
  'AI Policy & Regulation': ['人工智能产业政策', 'AI Policy & Regulation'],
  开源大模型发布动态: ['开源大模型发布动态', 'Open Source AI Releases'],
  'Open Source AI Releases': ['开源大模型发布动态', 'Open Source AI Releases'],
}

export function getLocalizedSearchTopicTitle(rawTitle: string, lang: Lang): string {
  if (rawTitle === '(未命名搜索主题)') {
    return tr(lang, '(未命名搜索主题)', '(Untitled Topic)')
  }
  const pair = BUILTIN_SEARCH_TOPIC_TITLES[rawTitle]
  if (pair) return tr(lang, pair[0], pair[1])
  return rawTitle
}
