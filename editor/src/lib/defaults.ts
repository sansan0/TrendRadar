import configZh from '../../../config/config.yaml?raw'
import configEn from '../../../config/config.en.yaml?raw'
import timelineZh from '../../../config/timeline.yaml?raw'
import timelineEn from '../../../config/timeline.en.yaml?raw'
import frequencyZh from '../../../config/frequency_words.txt?raw'
import frequencyEn from '../../../config/frequency_words.en.txt?raw'
import searchZh from '../../../config/search_queries.txt?raw'
import searchEn from '../../../config/search_queries.en.txt?raw'
import aiInterestsZh from '../../../config/ai_interests.txt?raw'
import aiInterestsEn from '../../../config/ai_interests.en.txt?raw'
import aiAnalysisPromptZh from '../../../config/ai_analysis_prompt.txt?raw'
import aiAnalysisPromptEn from '../../../config/ai_analysis_prompt.en.txt?raw'
import aiTranslationPromptZh from '../../../config/ai_translation_prompt.txt?raw'
import aiTranslationPromptEn from '../../../config/ai_translation_prompt.en.txt?raw'
import versionConfigsRaw from '../../../version_configs?raw'
import { ALL_CONFIG_FILES, type ConfigFileKey, type ConfigFilesMap, type Lang, type TemplateLang } from './types'
import { toTemplateLang } from '../i18n/languages'

export function getDefaultFiles(lang: Lang): ConfigFilesMap {
  const tplLang = toTemplateLang(lang)
  return {
    'config.yaml': tplLang === 'en' ? configEn : configZh,
    'timeline.yaml': tplLang === 'en' ? timelineEn : timelineZh,
    'frequency_words.txt': tplLang === 'en' ? frequencyEn : frequencyZh,
    'search_queries.txt': tplLang === 'en' ? searchEn : searchZh,
    'ai_interests.txt': tplLang === 'en' ? aiInterestsEn : aiInterestsZh,
    'ai_analysis_prompt.txt': tplLang === 'en' ? aiAnalysisPromptEn : aiAnalysisPromptZh,
    'ai_translation_prompt.txt': tplLang === 'en' ? aiTranslationPromptEn : aiTranslationPromptZh,
  }
}

export function getDefaultFile(key: ConfigFileKey, lang: Lang): string {
  return getDefaultFiles(lang)[key]
}

export function inferFileTemplateLang(file: ConfigFileKey, content: string, fallback: Lang): TemplateLang {
  const fallbackTpl = toTemplateLang(fallback)
  if (file === 'config.yaml') {
    if (content.includes('TrendRadar Configuration File') || content === configEn) return 'en'
    if (content.includes('TrendRadar 配置文件') || content === configZh) return 'zh'
    if (/"(?:Toutiao|Baidu Hot|WallStreetCN|The Paper|Bilibili Hot)"/.test(content)) return 'en'
    if (/"(?:今日头条|百度热搜|华尔街见闻|澎湃新闻)"/.test(content)) return 'zh'
    return fallbackTpl
  }
  if (file === 'timeline.yaml') {
    if (content.includes('TrendRadar Timeline Configuration') || content === timelineEn) return 'en'
    if (content.includes('TrendRadar 时间线配置') || content === timelineZh) return 'zh'
    if (/"(?:Always-on Monitoring|Morning\/Evening Summary|Office Hours|Night Owl)"/.test(content)) return 'en'
    if (/"(?:全天监控|早晚汇总|办公时间|夜猫子模式)"/.test(content)) return 'zh'
    return fallbackTpl
  }
  if (file === 'frequency_words.txt') {
    if (content.includes('TrendRadar Frequency-words Configuration') || content === frequencyEn) return 'en'
    if (content.includes('TrendRadar 频率词配置文件') || content === frequencyZh) return 'zh'
    return fallbackTpl
  }
  if (file === 'search_queries.txt') {
    if (content.includes('TrendRadar Web Search Queries Config') || content === searchEn) return 'en'
    if (content.includes('TrendRadar 联网搜索任务配置文件') || content === searchZh) return 'zh'
    return fallbackTpl
  }
  if (file === 'ai_interests.txt') {
    if (content.includes('TrendRadar AI Interests Profile') || content === aiInterestsEn) return 'en'
    if (content.includes('TrendRadar AI 兴趣描述文件') || content === aiInterestsZh) return 'zh'
    return fallbackTpl
  }
  if (file === 'ai_analysis_prompt.txt') {
    if (content.includes('TrendRadar AI Analysis Prompt Config') || content === aiAnalysisPromptEn) return 'en'
    if (content.includes('TrendRadar AI 分析提示词配置') || content === aiAnalysisPromptZh) return 'zh'
    return fallbackTpl
  }
  if (file === 'ai_translation_prompt.txt') {
    if (content.includes('TrendRadar AI Translation Prompt Config') || content === aiTranslationPromptEn) return 'en'
    if (content.includes('TrendRadar AI 翻译提示词配置') || content === aiTranslationPromptZh) return 'zh'
    return fallbackTpl
  }
  return fallbackTpl
}

export function getMatchingDefaultFile(file: ConfigFileKey, content: string, fallback: Lang): string {
  return getDefaultFile(file, inferFileTemplateLang(file, content, fallback))
}

export function getMatchingDefaultFiles(files: ConfigFilesMap, fallback: Lang): ConfigFilesMap {
  return Object.fromEntries(
    ALL_CONFIG_FILES.map((file) => [file, getMatchingDefaultFile(file, files[file], fallback)]),
  ) as ConfigFilesMap
}

export function parseVersionConfigs(raw = versionConfigsRaw): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq > 0) {
      result[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
    }
  }
  return result
}

export const BUNDLED_CONFIG_VERSIONS = parseVersionConfigs(versionConfigsRaw)
