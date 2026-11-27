import { isMap, isScalar, type Document } from 'yaml'
import type { ConfigFileKey, Lang, SectionId, SourcesSubTab } from './types.ts'
import type { YamlPath } from './yaml-doc.ts'
import { tr } from '../i18n/translate.ts'

export type YamlFile = Extract<ConfigFileKey, `${string}.yaml`>
export type SourceTarget =
  | { file: YamlFile; path: YamlPath }
  | { file: ConfigFileKey; line: number; column?: number }

export interface FeatureLocation {
  section: SectionId
  anchor?: string
  tab?: SourcesSubTab
  channel?: string
  filterMode?: 'keyword' | 'ai'
  timelineTab?: 'default' | 'periods' | 'week'
}

interface Chapter extends FeatureLocation {
  zh: string
  en: string
}

const configChapters = new Map<string, Chapter>(Object.entries({
  app: { zh: '基础设置', en: 'App settings', section: 'storage', anchor: 'pro-anchor-app' },
  schedule: { zh: '定时调度', en: 'Schedule', section: 'push', anchor: 'pro-anchor-timeline' },
  platforms: { zh: '热榜平台', en: 'Hotlist platforms', section: 'sources', tab: 'hotlist', anchor: 'pro-anchor-hotlist' },
  rss: { zh: 'RSS 订阅', en: 'RSS feeds', section: 'sources', tab: 'rss', anchor: 'pro-anchor-rss' },
  web_search: { zh: '联网搜索', en: 'Web search', section: 'sources', tab: 'search', anchor: 'pro-anchor-search' },
  report: { zh: '报告模式', en: 'Report', section: 'report', anchor: 'pro-anchor-report' },
  filter: { zh: '筛选策略', en: 'Filter', section: 'filter' },
  ai_filter: { zh: 'AI 智能筛选', en: 'AI filtering', section: 'filter', filterMode: 'ai', anchor: 'pro-anchor-ai-interests' },
  display: { zh: '展示区域', en: 'Display regions', section: 'report', anchor: 'pro-anchor-display' },
  notification: { zh: '通知渠道', en: 'Notifications', section: 'push', anchor: 'pro-anchor-notification' },
  storage: { zh: '数据存储', en: 'Storage', section: 'storage', anchor: 'pro-anchor-storage' },
  ai: { zh: 'AI 模型', en: 'AI model', section: 'ai', anchor: 'pro-anchor-ai-model' },
  ai_analysis: { zh: 'AI 分析', en: 'AI analysis', section: 'ai', anchor: 'pro-anchor-ai-analysis' },
  ai_translation: { zh: 'AI 翻译', en: 'AI translation', section: 'ai', anchor: 'pro-anchor-ai-translation' },
  advanced: { zh: '高级设置', en: 'Advanced settings', section: 'storage', anchor: 'pro-anchor-advanced' },
} satisfies Record<string, Chapter>))

export function isYamlFile(file: ConfigFileKey): file is YamlFile {
  return file === 'config.yaml' || file === 'timeline.yaml'
}

export function fileStart(file: ConfigFileKey): SourceTarget {
  return isYamlFile(file) ? { file, path: [] } : { file, line: 1 }
}

export function yamlChapters(doc: Document | null): string[] {
  if (!isMap(doc?.contents)) return []
  return [...new Set(doc.contents.items.flatMap(({ key }) => isScalar(key) ? [String(key.value ?? '')] : []))]
}

export function chapterLabel(file: YamlFile, key: string, lang: Lang): string {
  if (file === 'timeline.yaml') {
    if (key === 'presets') return tr(lang, '调度预设', 'Schedule presets')
    if (key === 'custom') return tr(lang, '自定义调度', 'Custom schedule')
  }
  const ch = file === 'config.yaml' ? configChapters.get(key) : undefined
  return ch ? tr(lang, ch.zh, ch.en) : key
}

const SEARCH_FUNNEL_ADV_KEYS = new Set([
  'fetch_count',
  'dedup_days',
  'min_authority',
  'allow_unknown_authority',
  'need_content',
  'queries_file',
])

const AI_MODEL_ADV_KEYS = new Set([
  'timeout',
  'temperature',
  'max_tokens',
  'num_retries',
  'fallback_models',
  'extra_params',
])

const AI_ANALYSIS_SCOPE_KEYS = new Set([
  'mode',
  'include_rss',
  'include_web_search',
  'search_summary_max_chars',
  'include_standalone',
  'include_rank_timeline',
])

export function featureForSource(file: ConfigFileKey, path: YamlPath): FeatureLocation | undefined {
  switch (file) {
    case 'config.yaml': {
      const root = String(path[0] ?? '')
      const sub = String(path[1] ?? '')
      if (root === 'platforms' && sub === 'api_url') {
        return { section: 'sources', tab: 'hotlist', anchor: 'pro-anchor-crawler-network' }
      }
      if (root === 'web_search') {
        if (SEARCH_FUNNEL_ADV_KEYS.has(sub) || (sub === 'providers' && path[3] === 'localization')) {
          return { section: 'sources', tab: 'search', anchor: 'pro-anchor-search-network' }
        }
        return { section: 'sources', tab: 'search', anchor: 'pro-anchor-search' }
      }
      if (root === 'filter') {
        if (sub === 'priority_sort_enabled') {
          return { section: 'filter', filterMode: 'ai', anchor: 'pro-anchor-ai-interests' }
        }
        return { section: 'filter' }
      }
      if (root === 'ai_filter') {
        const adv = sub && sub !== 'min_score'
        return {
          section: 'filter',
          filterMode: 'ai',
          anchor: adv ? 'pro-anchor-ai-filter-advanced' : 'pro-anchor-ai-interests',
        }
      }
      if (root === 'display' && sub === 'standalone') {
        return { section: 'report', anchor: 'pro-anchor-standalone' }
      }
      if (root === 'notification' && sub === 'channels' && typeof path[2] === 'string') {
        return { section: 'push', anchor: 'pro-anchor-notification', channel: path[2] }
      }
      if (root === 'storage' && (sub === 'remote' || sub === 'pull')) {
        return { section: 'storage', anchor: 'pro-anchor-storage-remote' }
      }
      if (root === 'ai') {
        if (sub === 'api_base') return { section: 'ai', anchor: 'pro-anchor-ai-relay' }
        if (AI_MODEL_ADV_KEYS.has(sub)) return { section: 'ai', anchor: 'pro-anchor-ai-advanced' }
      }
      if (root === 'ai_analysis') {
        if (sub === 'prompt_file') return { section: 'ai', anchor: 'pro-anchor-ai-analysis-prompt' }
        if (AI_ANALYSIS_SCOPE_KEYS.has(sub)) return { section: 'ai', anchor: 'pro-anchor-ai-analysis-scope' }
      }
      if (root === 'ai_translation' && (sub === 'batch_size' || sub === 'batch_interval' || sub === 'prompt_file')) {
        return { section: 'ai', anchor: 'pro-anchor-ai-translation-prompt' }
      }
      if (root === 'advanced') {
        switch (sub) {
          case 'crawler': return { section: 'sources', tab: 'hotlist', anchor: 'pro-anchor-crawler-network' }
          case 'rss': return { section: 'sources', tab: 'rss', anchor: 'pro-anchor-rss-network' }
          case 'web_search': return { section: 'sources', tab: 'search', anchor: 'pro-anchor-search-network' }
          case 'weight': return { section: 'report', anchor: 'pro-anchor-weight' }
        }
      }
      return configChapters.get(root)
    }
    case 'frequency_words.txt': return { section: 'filter', filterMode: 'keyword', anchor: 'pro-anchor-frequency' }
    case 'ai_interests.txt': return { section: 'filter', filterMode: 'ai', anchor: 'pro-anchor-ai-interests' }
    case 'search_queries.txt': return { section: 'sources', tab: 'search', anchor: 'pro-anchor-search-queries' }
    case 'ai_analysis_prompt.txt': return { section: 'ai', anchor: 'pro-anchor-ai-analysis-prompt' }
    case 'ai_translation_prompt.txt': return { section: 'ai', anchor: 'pro-anchor-ai-translation-prompt' }
    case 'timeline.yaml': {
      const nested = path[0] === 'presets' ? path.slice(2) : path[0] === 'custom' ? path.slice(1) : []
      const area = String(nested[0] ?? '')
      if (area === 'default') {
        return { section: 'push', anchor: 'pro-anchor-timeline-orchestrator', timelineTab: 'default' }
      }
      if (area === 'periods') {
        return { section: 'push', anchor: 'pro-anchor-timeline-orchestrator', timelineTab: 'periods' }
      }
      if (area === 'day_plans' || area === 'week_map' || area === 'overlap') {
        return { section: 'push', anchor: 'pro-anchor-timeline-orchestrator', timelineTab: 'week' }
      }
      return { section: 'push', anchor: 'pro-anchor-timeline' }
    }
  }
}

export function sourceForFeature(section: SectionId, tab: SourcesSubTab): SourceTarget {
  const key: Record<SectionId, string> = {
    onboarding: 'app', sources: { hotlist: 'platforms', rss: 'rss', search: 'web_search' }[tab],
    filter: 'filter', ai: 'ai', report: 'report', push: 'notification', storage: 'app',
  }
  return { file: 'config.yaml', path: [key[section]] }
}
