import type { CSSProperties } from 'react'
import type { ConfigFileKey, SectionId } from '@/lib/types'

export type GuidedStage = 'sources' | 'filter' | 'report' | 'push'

export type FlowStageKey = 'collect' | 'analyze' | 'deliver'

export type PipelineStageKey = FlowStageKey | 'system'

export interface WorkflowStageMeta {
  key: PipelineStageKey
  stepRange: string
  stepBadgeZh: string
  stepBadgeEn: string
  titleZh: string
  titleEn: string
  compactTitleZh: string
  compactTitleEn: string
  subtitleZh: string
  subtitleEn: string
  primarySection: SectionId
  sections: SectionId[]
  files: ConfigFileKey[]
}

export const WORKFLOW_STAGES: Record<PipelineStageKey, WorkflowStageMeta> = {
  collect: {
    key: 'collect',
    stepRange: '01',
    stepBadgeZh: '步骤 01',
    stepBadgeEn: 'Step 01',
    titleZh: '数据采集',
    titleEn: 'Collect',
    compactTitleZh: '数据采集',
    compactTitleEn: 'Collect',
    subtitleZh: '抓取热榜、订阅源与网页搜索',
    subtitleEn: 'Fetch hotlists, RSS & search',
    primarySection: 'sources',
    sections: ['sources'],
    files: ['config.yaml', 'search_queries.txt'],
  },
  analyze: {
    key: 'analyze',
    stepRange: '02–03',
    stepBadgeZh: '步骤 02–03',
    stepBadgeEn: 'Steps 02–03',
    titleZh: '筛选与 AI',
    titleEn: 'Filter & AI',
    compactTitleZh: '筛选与 AI',
    compactTitleEn: 'Filter & AI',
    subtitleZh: '挑出关心的新闻并总结翻译',
    subtitleEn: 'Filter topics, summarize & translate',
    primarySection: 'filter',
    sections: ['filter', 'ai'],
    files: ['config.yaml', 'frequency_words.txt', 'ai_interests.txt', 'ai_analysis_prompt.txt', 'ai_translation_prompt.txt'],
  },
  deliver: {
    key: 'deliver',
    stepRange: '04–05',
    stepBadgeZh: '步骤 04–05',
    stepBadgeEn: 'Steps 04–05',
    titleZh: '报告与推送',
    titleEn: 'Report & Push',
    compactTitleZh: '报告与推送',
    compactTitleEn: 'Report & Push',
    subtitleZh: '生成网页报告并发送到群或手机',
    subtitleEn: 'Build web report & send alerts',
    primarySection: 'report',
    sections: ['report', 'push'],
    files: ['config.yaml', 'timeline.yaml'],
  },
  system: {
    key: 'system',
    stepRange: '06',
    stepBadgeZh: '步骤 06',
    stepBadgeEn: 'Step 06',
    titleZh: '存储与系统',
    titleEn: 'Storage & System',
    compactTitleZh: '系统底座',
    compactTitleEn: 'System',
    subtitleZh: '时区、本地/云端存储与底层运行参数',
    subtitleEn: 'Timezone, storage & runtime settings',
    primarySection: 'storage',
    sections: ['storage'],
    files: ['config.yaml'],
  },
}

export const FLOW_STAGE_ORDER: FlowStageKey[] = ['collect', 'analyze', 'deliver']

export const ALL_STAGE_ORDER: PipelineStageKey[] = ['collect', 'analyze', 'deliver', 'system']

export const STAGE_FOR_SECTION: Record<SectionId, PipelineStageKey> = {
  onboarding: 'collect',
  sources: 'collect',
  filter: 'analyze',
  ai: 'analyze',
  report: 'deliver',
  push: 'deliver',
  storage: 'system',
}

export const STAGE_FOR_GUIDED_STAGE: Record<GuidedStage, FlowStageKey> = {
  sources: 'collect',
  filter: 'analyze',
  report: 'deliver',
  push: 'deliver',
}

export interface GuidedStepDef {
  id: Exclude<SectionId, 'onboarding'>
  index: number
  step: string
  stage: PipelineStageKey
  titleZh: string
  titleEn: string
  files: ConfigFileKey[]
}

export const GUIDED_STEPS: GuidedStepDef[] = [
  {
    id: 'sources',
    index: 1,
    step: '01',
    stage: 'collect',
    titleZh: '信息来源',
    titleEn: 'Data Sources',
    files: ['config.yaml', 'search_queries.txt'],
  },
  {
    id: 'filter',
    index: 2,
    step: '02',
    stage: 'analyze',
    titleZh: '内容筛选',
    titleEn: 'Content Filter',
    files: ['config.yaml', 'frequency_words.txt', 'ai_interests.txt'],
  },
  {
    id: 'ai',
    index: 3,
    step: '03',
    stage: 'analyze',
    titleZh: 'AI 引擎与增强',
    titleEn: 'AI & Prompts',
    files: ['config.yaml', 'ai_analysis_prompt.txt', 'ai_translation_prompt.txt'],
  },
  {
    id: 'report',
    index: 4,
    step: '04',
    stage: 'deliver',
    titleZh: '报告与版面',
    titleEn: 'Report & Layout',
    files: ['config.yaml'],
  },
  {
    id: 'push',
    index: 5,
    step: '05',
    stage: 'deliver',
    titleZh: '推送与定时',
    titleEn: 'Channels & Schedule',
    files: ['config.yaml', 'timeline.yaml'],
  },
  {
    id: 'storage',
    index: 6,
    step: '06',
    stage: 'system',
    titleZh: '存储与系统',
    titleEn: 'Storage & System',
    files: ['config.yaml'],
  },
]

export const FILES_FOR_SECTION: Record<SectionId, ConfigFileKey[]> = {
  onboarding: ['config.yaml'],
  sources: ['config.yaml', 'search_queries.txt'],
  filter: ['config.yaml', 'frequency_words.txt', 'ai_interests.txt'],
  ai: ['config.yaml', 'ai_analysis_prompt.txt', 'ai_translation_prompt.txt'],
  report: ['config.yaml'],
  push: ['config.yaml', 'timeline.yaml'],
  storage: ['config.yaml'],
}

/** Exposes `--stage-*` custom properties scoped to a single stage element */
export function stageStyleVars(stage: PipelineStageKey): CSSProperties {
  return {
    '--stage-bar': `var(--stage-${stage}-bar)`,
    '--stage-solid': `var(--stage-${stage}-solid)`,
    '--stage-text': `var(--stage-${stage}-text)`,
    '--stage-soft': `var(--stage-${stage}-soft)`,
    '--stage-chip': `var(--stage-${stage}-chip)`,
    '--stage-border': `var(--stage-${stage}-border)`,
    '--stage-ring': `var(--stage-${stage}-ring)`,
  } as CSSProperties
}
