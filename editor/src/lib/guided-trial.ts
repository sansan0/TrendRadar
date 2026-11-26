import { featureForSource } from './pro-navigation.ts'
import { parseTimelinePresets } from './timeline-engine.ts'
import { ALL_CONFIG_FILES, type ConfigFileKey, type Lang, type SectionId, type TimelineBehavior } from './types.ts'
import { getInObject } from './yaml-doc.ts'
import { tr } from '../i18n/translate.ts'

export function trialFileOptions(section: SectionId, modified: ConfigFileKey[], choices?: readonly ConfigFileKey[]): ConfigFileKey[] {
  const related = choices?.length ? choices : ALL_CONFIG_FILES.filter((file) =>
    file === 'config.yaml' || section === 'onboarding' || featureForSource(file, [])?.section === section)
  // A trial must not silently omit an earlier step's changes or a required master switch.
  return [...new Set([...related, ...modified])]
}

export function trialFileNotices(config: unknown, timeline: string, file: ConfigFileKey, lang: Lang): string[] {
  const notices: string[] = []
  const method = getInObject<string>(config, ['filter', 'method'], 'keyword')
  if (file === 'frequency_words.txt' && method === 'ai') {
    notices.push(tr(lang, '当前默认使用 AI 筛选，关键词文件仅在使用关键词筛选的时段生效。', 'AI filtering is the default. Keyword rules apply only when keyword filtering is selected.'))
  }
  if (file === 'ai_interests.txt') {
    if (method !== 'ai') notices.push(tr(lang, '当前使用关键词筛选。要试用兴趣描述，还需在主配置中启用 AI 筛选并配置模型。', 'Keyword filtering is selected. Enable AI filtering and configure the model to try these interests.'))
    const custom = getInObject(config, ['ai_filter', 'interests_file'], '')
    if (custom) notices.push(tr(lang, '当前从 config/custom/ai/{custom} 读取兴趣，复制默认兴趣文件不会修改该文件。', 'Interests are read from config/custom/ai/{custom}. Copying the default file does not change it.', { custom: String(custom) }))
  }
  if (file === 'search_queries.txt') {
    if (!getInObject(config, ['web_search', 'enabled'], false)) notices.push(tr(lang, '联网搜索尚未启用，还需在主配置中打开联网搜索。', 'Web search is disabled. Enable it in the main configuration as well.'))
    const custom = getInObject(config, ['web_search', 'queries_file'], '')
    if (custom && String(custom).replace(/\\/g, '/').replace(/^\.\//, '') !== 'config/search_queries.txt') {
      notices.push(tr(lang, '当前搜索任务来自 {custom}，复制默认搜索词文件不会修改该文件。', 'Search tasks come from {custom}. Copying the default search file does not change it.', { custom: String(custom) }))
    }
  }
  if (getInObject(config, ['schedule', 'enabled'], false)) {
    const key = getInObject(config, ['schedule', 'preset'], 'morning_evening')
    const preset = parseTimelinePresets(timeline).presets.find((entry) => entry.key === key)?.config
    const usedPlans = new Set(Object.values(preset?.week_map ?? {}))
    const usedPeriods = new Set([...usedPlans].flatMap((plan) => preset?.day_plans[plan]?.periods ?? []))
    const behaviors: TimelineBehavior[] = preset ? [preset.default, ...[...usedPeriods].map((period) => preset.periods[period]).filter(Boolean)] : []
    const overrides = file === 'frequency_words.txt' ? behaviors.some((entry) => entry.frequency_file || entry.filter_method)
      : file === 'ai_interests.txt' ? behaviors.some((entry) => entry.interests_file || entry.filter_method)
        : file === 'search_queries.txt' ? behaviors.some((entry) => entry.search_file) : false
    if (overrides) notices.push(tr(lang, '当前时间线会按时段选择筛选方式或其他规则文件；试跑前请核对时间线里的文件覆盖设置。', 'The active timeline selects filtering methods or other rule files by time window. Check its file overrides before the trial.'))
    if (file === 'config.yaml') notices.push(tr(lang, '定时调度已开启，实际采集、分析、推送和报告模式还受 timeline.yaml 当前时段控制。', 'Scheduling is enabled. The current timeline window also controls collection, analysis, delivery and report mode.'))
  }
  return notices
}
