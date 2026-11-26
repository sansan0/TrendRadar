import { useId, useMemo } from 'react'
import {
  Bell,
  Brain,
  ChevronRight,
  Clock,
  Code2,
  Database,
  FileCode2,
  FileText,
  Filter,
  HardDrive,
  Languages,
  Newspaper,
  Radio,
  Rss,
  Search,
  Send,
  Sparkles,
} from 'lucide-react'
import { useT } from '@/i18n'
import { parseFrequencyWords } from '@/lib/frequency-parser'
import { parseSearchQueries } from '@/lib/search-parser'
import { ALL_CONFIG_FILES, type SectionId } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  FILES_FOR_SECTION,
  STAGE_FOR_GUIDED_STAGE,
  STAGE_FOR_SECTION,
  stageStyleVars,
  WORKFLOW_STAGES,
  type FlowStageKey,
  type GuidedStage,
  type PipelineStageKey,
} from '@/lib/workflow-stages'
import { getInObject } from '@/lib/yaml-doc'
import { useEditor } from '@/store/editor-store'
import './guided-pipeline.css'

export type { GuidedStage, PipelineStageKey }

const STAGE_ICON: Record<PipelineStageKey, typeof Database> = {
  collect: Database,
  analyze: Sparkles,
  deliver: Send,
  system: HardDrive,
}

function countConfiguredChannels(configData: Record<string, unknown>): number {
  const ch = (configData.notification as { channels?: Record<string, Record<string, unknown>> } | undefined)?.channels
  if (!ch || typeof ch !== 'object') return 0
  const checks = [
    ch.feishu?.webhook_url,
    ch.dingtalk?.webhook_url,
    ch.wework?.webhook_url,
    ch.telegram?.bot_token && ch.telegram?.chat_id ? 'ok' : '',
    ch.email?.from && ch.email?.to ? 'ok' : '',
    ch.ntfy?.topic,
    ch.bark?.url,
    ch.slack?.webhook_url,
    ch.generic_webhook?.webhook_url,
  ]
  return checks.filter((v) => String(v ?? '').trim().length > 0).length
}

export function GuidedPipeline({
  section = 'onboarding',
  activeStage,
  onChoose,
  compact = false,
}: {
  section?: SectionId
  activeStage?: GuidedStage
  onChoose?: (stage: GuidedStage) => void
  compact?: boolean
}) {
  const { configData, configError, files, dirtyFiles, jumpToSource } = useEditor()
  const t = useT()
  const titleId = useId()

  const currentPipelineKey: PipelineStageKey = activeStage
    ? STAGE_FOR_GUIDED_STAGE[activeStage]
    : STAGE_FOR_SECTION[section]

  const currentStageMeta = WORKFLOW_STAGES[currentPipelineKey]

  const platformsOn = Boolean(getInObject(configData, ['platforms', 'enabled'], true))
  const rawPlatforms = getInObject<unknown[]>(configData, ['platforms', 'sources'], [])
  const platformCount = Array.isArray(rawPlatforms)
    ? rawPlatforms.filter((p) => p && typeof p === 'object' && (p as { enabled?: boolean }).enabled !== false).length
    : 0

  const rssOn = Boolean(getInObject(configData, ['rss', 'enabled'], true))
  const rawFeeds = getInObject<unknown[]>(configData, ['rss', 'feeds'], [])
  const rssCount = Array.isArray(rawFeeds)
    ? rawFeeds.filter((f) => f && typeof f === 'object' && (f as { enabled?: boolean }).enabled !== false).length
    : 0

  const searchOn = Boolean(getInObject(configData, ['web_search', 'enabled'], false))
  const searchTopicCount = useMemo(() => parseSearchQueries(files['search_queries.txt']).topics.length, [files])

  const aiFilter = getInObject<string>(configData, ['filter', 'method'], 'keyword') === 'ai'
  const kwGroups = useMemo(() => parseFrequencyWords(files['frequency_words.txt']).groups.length, [files])
  const analysisOn = Boolean(getInObject(configData, ['ai_analysis', 'enabled'], true))
  const translationOn = Boolean(getInObject(configData, ['ai_translation', 'enabled'], true))

  const htmlOn = Boolean(getInObject(configData, ['storage', 'formats', 'html'], true))
  const pushOn = Boolean(getInObject(configData, ['notification', 'enabled'], true))
  const scheduleOn = Boolean(getInObject(configData, ['schedule', 'enabled'], false))
  const channelCount = useMemo(() => countConfiguredChannels(configData), [configData])
  const mode = getInObject<string>(configData, ['report', 'mode'], 'current')
  const modeLabel = mode === 'current'
    ? t('当前榜单', 'Current rank')
    : mode === 'incremental'
      ? t('增量新增', 'Incremental')
      : t('当日汇总', 'Daily digest')

  const flowStages: Array<{
    key: FlowStageKey
    targetStage: GuidedStage
    chips: Array<{ icon: typeof Radio; text: string; active: boolean }>
  }> = [
    {
      key: 'collect',
      targetStage: 'sources',
      chips: [
        { icon: Radio, text: platformsOn ? t('热榜 {v0} 平台', '{v0} Hotlists', { v0: platformCount }) : t('热榜已关', 'Hotlists off'), active: platformsOn },
        { icon: Rss, text: rssOn ? t('RSS {v0} 源', '{v0} RSS', { v0: rssCount }) : t('RSS 已关', 'RSS off'), active: rssOn },
        { icon: Search, text: searchOn ? t('联网搜索 {v0} 题', 'Search ({v0})', { v0: searchTopicCount }) : t('联网搜索待开', 'Web search off'), active: searchOn },
      ],
    },
    {
      key: 'analyze',
      targetStage: 'filter',
      chips: [
        { icon: aiFilter ? Brain : Filter, text: aiFilter ? t('AI 兴趣筛选', 'AI smart filter') : t('关键词 {v0} 组', '{v0} KW groups', { v0: kwGroups }), active: true },
        { icon: Sparkles, text: analysisOn ? t('AI 深度分析', 'AI analysis') : t('AI 分析已关', 'Analysis off'), active: analysisOn },
        { icon: Languages, text: translationOn ? t('AI 多语言翻译', 'AI translation') : t('翻译已关', 'Translation off'), active: translationOn },
      ],
    },
    {
      key: 'deliver',
      targetStage: activeStage === 'push' ? 'push' : 'report',
      chips: [
        { icon: Newspaper, text: htmlOn ? `${modeLabel} · HTML` : modeLabel, active: htmlOn || pushOn },
        { icon: Send, text: !pushOn ? t('通知已关', 'Push off') : channelCount > 0 ? t('已配 {v0} 渠道', '{v0} channel(s)', { v0: channelCount }) : t('待填通知渠道', 'Add channel'), active: pushOn && channelCount > 0 },
        { icon: Clock, text: scheduleOn ? t('时间线调度开启', 'Timeline active') : t('每次运行即执行', 'Direct run'), active: scheduleOn },
      ],
    },
  ]

  const highlightedFiles = new Set(currentStageMeta.files)

  if (compact) {
    const sectionFiles = FILES_FOR_SECTION[section]

    return (
      <div
        data-pipeline-compact="true"
        data-current-stage={currentPipelineKey}
        style={stageStyleVars(currentPipelineKey)}
        className="guided-arch rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-3.5 py-2.5 shadow-[var(--shadow-xs)]"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
            <Code2 className="h-3.5 w-3.5 shrink-0 text-[var(--stage-text)]" />
            <span>{t('本页关联文件：', 'Files in this step:')}</span>
          </span>
          {sectionFiles.map((file) => {
            const edited = dirtyFiles.includes(file)
            const Icon = file.endsWith('.yaml') ? FileCode2 : FileText
            return (
              <button
                key={file}
                type="button"
                data-section-file={file}
                onClick={() => jumpToSource(file)}
                title={
                  edited
                    ? t('已修改 · 点击查看或编辑 config/{v0}', 'Edited · Inspect or edit config/{v0}', { v0: file })
                    : t('点击查看或编辑 config/{v0}', 'Inspect or edit config/{v0}', { v0: file })
                }
                className={cn(
                  'tr-focus-ring inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 font-mono text-[11.5px] transition-colors cursor-pointer',
                  edited
                    ? 'border-[var(--stage-border)] bg-[var(--stage-soft)] font-semibold text-[var(--stage-text)] hover:border-[var(--stage-solid)]'
                    : 'border-[var(--border-default)] bg-[var(--bg-subtle)]/75 text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]',
                )}
              >
                <Icon className="h-3 w-3 shrink-0 opacity-75" />
                <span>{file}</span>
                {edited && (
                  <span className="rounded bg-[var(--stage-solid)] px-1 py-0.5 font-sans text-[10px] font-semibold leading-none text-white">
                    {t('已改', 'Edited')}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <figure
      data-pipeline-full="true"
      data-current-stage={currentPipelineKey}
      style={stageStyleVars(currentPipelineKey)}
      className="guided-arch rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 sm:p-5 shadow-[var(--shadow-xs)] space-y-4"
      aria-labelledby={titleId}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-[var(--brand-primary)]" />
          <span id={titleId} className="text-sm font-semibold text-[var(--text-primary)]">
            {t('运行流程（点击任意阶段可调整）', 'Workflow — click any stage to customize')}
          </span>
        </div>
        <span className="text-xs text-[var(--text-muted)]">
          {t('色块与左侧步骤 01–05 一一对应', 'Color-coded to match Steps 01–05')}
        </span>
      </figcaption>

      {/* 3-Stage Color-Coded Pipeline */}
      <div className="guided-arch-grid">
        {flowStages.map((st, idx) => {
          const meta = WORKFLOW_STAGES[st.key]
          const StageIcon = STAGE_ICON[st.key]
          const active = st.key === currentPipelineKey
          const cardBody = (
            <>
              <div className="guided-stage-head flex flex-col justify-between gap-1.5 px-3.5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <div className="flex items-center gap-2">
                    <span className="guided-stage-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-[var(--shadow-xs)]">
                      <StageIcon size={14} />
                    </span>
                    <span className="whitespace-nowrap text-[14.5px] font-bold text-[var(--text-primary)]">
                      {t(meta.titleZh, meta.titleEn)}
                    </span>
                  </div>
                  <span className="guided-stage-step-pill shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold leading-none transition-colors">
                    {t(meta.stepBadgeZh, meta.stepBadgeEn)}
                  </span>
                </div>
                <p className="text-[12px] leading-snug text-[var(--text-secondary)]">
                  {t(meta.subtitleZh, meta.subtitleEn)}
                </p>
              </div>

              {!configError && (
                <div className="flex flex-1 flex-col gap-1.5 p-3">
                  {st.chips.map((chip, cIdx) => {
                    const ChipIcon = chip.icon
                    return (
                      <div
                        key={cIdx}
                        className={cn(
                          'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                          chip.active
                            ? 'guided-stage-chip-active'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]',
                        )}
                      >
                        <ChipIcon
                          size={13}
                          className={cn('shrink-0', chip.active ? 'guided-stage-chip-icon' : 'opacity-55')}
                        />
                        <span className="truncate">{chip.text}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )

          return (
            <div key={st.key} className="contents">
              {onChoose ? (
                <button
                  type="button"
                  data-stage={st.key}
                  data-active={active ? 'true' : 'false'}
                  aria-pressed={active}
                  style={stageStyleVars(st.key)}
                  onClick={() => onChoose(st.targetStage)}
                  className="guided-stage-card tr-focus-ring cursor-pointer text-left"
                >
                  {cardBody}
                </button>
              ) : (
                <div
                  data-stage={st.key}
                  data-active={active ? 'true' : 'false'}
                  aria-current={active ? 'step' : undefined}
                  style={stageStyleVars(st.key)}
                  className="guided-stage-card text-left"
                >
                  {cardBody}
                </div>
              )}

              {idx < flowStages.length - 1 && (
                <div className="guided-arch-connector" data-step={idx + 1} aria-hidden="true">
                  <div className="guided-arch-line">
                    <span className="guided-arch-pulse" />
                  </div>
                  <span className="guided-arch-arrow">
                    <ChevronRight size={11} />
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom Config Files Mapping Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--stage-border)] bg-[var(--stage-soft)]/55 px-3.5 py-2.5 transition-colors">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
          <Database size={13} className="text-[var(--stage-text)] shrink-0" />
          <span>{t('当前阶段关联的配置文件：', 'Config files for this stage:')}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {ALL_CONFIG_FILES.map((file) => {
            const related = highlightedFiles.has(file)
            const modified = dirtyFiles.includes(file)
            const Icon = file.endsWith('.yaml') ? FileCode2 : FileText
            return (
              <button
                key={file}
                type="button"
                onClick={() => jumpToSource(file)}
                title={t('点击查看 config/{v0} 源码', 'Inspect config/{v0}', { v0: file })}
                className={cn(
                  'tr-focus-ring inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[11px] transition-all cursor-pointer',
                  related
                    ? 'border-[var(--stage-border)] bg-[var(--bg-surface)] font-semibold text-[var(--text-primary)] shadow-[var(--shadow-xs)]'
                    : 'border-transparent bg-transparent text-[var(--text-muted)] opacity-65 hover:opacity-100 hover:bg-[var(--bg-surface)]',
                )}
              >
                <Icon size={11} className={cn('shrink-0', related ? 'text-[var(--stage-text)]' : 'opacity-70')} />
                <span>{file}</span>
                {modified && (
                  <span
                    className="rounded bg-[var(--stage-solid)] px-1 py-0.5 font-sans text-[10px] font-semibold leading-none text-white"
                    title={t('此文件已修改', 'Modified')}
                  >
                    {t('已改', 'Edited')}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </figure>
  )
}
