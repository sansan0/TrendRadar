export type Lang = 'zh' | 'zh-TW' | 'en' | 'de' | 'ja' | 'ko' | 'ru' | 'tr'
export type TemplateLang = 'zh' | 'en'
export type ThemeMode = 'light' | 'dark'
export type DeployMode = 'github_actions' | 'docker' | 'local'
export type SourceViewMode = 'closed' | 'drawer' | 'split'
export type WorkspaceMode = 'guided' | 'pro'
export type SourcesSubTab = 'hotlist' | 'rss' | 'search'

export type SectionId =
  | 'onboarding'
  | 'sources'
  | 'filter'
  | 'ai'
  | 'report'
  | 'push'
  | 'storage'

export type ConfigFileKey =
  | 'config.yaml'
  | 'timeline.yaml'
  | 'frequency_words.txt'
  | 'search_queries.txt'
  | 'ai_interests.txt'
  | 'ai_analysis_prompt.txt'
  | 'ai_translation_prompt.txt'

export const ALL_CONFIG_FILES: ConfigFileKey[] = [
  'config.yaml',
  'frequency_words.txt',
  'search_queries.txt',
  'timeline.yaml',
  'ai_interests.txt',
  'ai_analysis_prompt.txt',
  'ai_translation_prompt.txt',
]

export type ConfigFilesMap = Record<ConfigFileKey, string>

export interface PlatformSource {
  id: string
  name: string
  expected_domain?: string
  enabled?: boolean
}

export interface RssFeed {
  id: string
  name: string
  url: string
  enabled?: boolean
  max_age_days?: number
  max_items?: number
}

export type RegionKey =
  | 'new_items'
  | 'hotlist'
  | 'rss'
  | 'web_search'
  | 'standalone'
  | 'ai_analysis'

export const ALL_REGIONS: RegionKey[] = [
  'new_items',
  'hotlist',
  'rss',
  'web_search',
  'standalone',
  'ai_analysis',
]

export type FrequencyItemKind = 'normal' | 'required' | 'exclude'

export interface FrequencyItem {
  id: string
  kind: FrequencyItemKind
  pattern: string
  isRegex: boolean
  regexFlags: string
  alias: string
}

export interface FrequencyGroup {
  id: string
  groupAlias: string
  items: FrequencyItem[]
  maxCount?: number
  sectionComment?: string
}

export interface GlobalFilterEntry {
  id: string
  pattern: string
  isRegex: boolean
  regexFlags: string
}

export interface FrequencyDoc {
  headerComments: string
  globalFilters: GlobalFilterEntry[]
  groups: FrequencyGroup[]
}

export interface SearchTopic {
  id: string
  name: string
  queries: string[]
  excludeWords: string[]
  excludeSites: string[]
  maxItems?: number
  freshnessDays?: number
  provider?: string
}

export interface SearchQueriesDoc {
  headerComments: string
  globalExcludeWords: string[]
  globalExcludeSites: string[]
  topics: SearchTopic[]
}

export interface TimelineOnce {
  analyze?: boolean
  push?: boolean
  search?: boolean
}

export interface TimelineBehavior {
  collect?: boolean
  analyze?: boolean
  push?: boolean
  search?: boolean | null
  report_mode?: 'daily' | 'current' | 'incremental'
  ai_mode?: 'follow_report' | 'daily' | 'current' | 'incremental'
  filter_method?: 'keyword' | 'ai'
  frequency_file?: string
  interests_file?: string
  search_file?: string
  once?: TimelineOnce
}

export interface TimelinePeriod extends TimelineBehavior {
  name?: string
  start: string
  end: string
}

export interface TimelinePresetConfig {
  name?: string
  description?: string
  default: TimelineBehavior
  periods: Record<string, TimelinePeriod>
  day_plans: Record<string, { periods: string[] }>
  week_map: Record<string, string>
  overlap?: { policy?: 'error_on_overlap' | 'last_wins' }
}

export interface HealthIssue {
  id: string
  severity: 'error' | 'warning' | 'info'
  section: SectionId
  file: ConfigFileKey
  titleZh: string
  titleEn: string
  descZh: string
  descEn: string
  fixLabelZh?: string
  fixLabelEn?: string
  fixKey?: string
}

export interface YamlParseError {
  message: string
  line?: number
  col?: number
}

export interface SnapshotSummary {
  enabledSources: number
  filterMethod: 'keyword' | 'ai'
  aiEnabled: boolean
  scheduleEnabled: boolean
  schedulePreset: string
  configuredChannels: number
}

export interface ConfigVersionSnapshot {
  id: string
  name: string
  note: string
  createdAt: number
  updatedAt: number
  deployMode: DeployMode
  files: ConfigFilesMap
  summary: SnapshotSummary
}
