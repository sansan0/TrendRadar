import {
  AlertTriangle,
  BellRing,
  Compass,
  Database,
  ExternalLink,
  Filter,
  HardDrive,
  Heart,
  HelpCircle,
  LayoutList,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { ConfigMenuPopover } from '@/components/layout/ConfigMenuPopover'
import { InfoTooltip } from '@/components/ui/primitives'
import { useT } from '@/i18n'
import { getPersonalSupportUrl } from '@/lib/presets'
import type { SectionId } from '@/lib/types'
import { cn } from '@/lib/utils'
import { stageStyleVars, WORKFLOW_STAGES, type PipelineStageKey } from '@/lib/workflow-stages'
import { getInObject } from '@/lib/yaml-doc'
import { useEditor } from '@/store/editor-store'

interface NavItemDef {
  id: SectionId
  step?: string
  stage?: PipelineStageKey
  titleZh: string
  titleEn: string
  descZh: string
  descEn: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItemDef[] = [
  {
    id: 'onboarding',
    titleZh: '快速上手',
    titleEn: 'Quick Start',
    descZh: '工作流引导与场景预设',
    descEn: 'Workflow & scenario presets',
    icon: <Compass className="h-4 w-4" />,
  },
  {
    id: 'sources',
    step: '01',
    stage: 'collect',
    titleZh: '信息来源',
    titleEn: 'Data Sources',
    descZh: '热榜、RSS 与联网搜索',
    descEn: 'Hotlists, RSS & Web Search',
    icon: <Database className="h-4 w-4" />,
  },
  {
    id: 'filter',
    step: '02',
    stage: 'analyze',
    titleZh: '内容筛选',
    titleEn: 'Content Filter',
    descZh: '关键词规则或 AI 兴趣',
    descEn: 'Keywords or AI interests',
    icon: <Filter className="h-4 w-4" />,
  },
  {
    id: 'ai',
    step: '03',
    stage: 'analyze',
    titleZh: 'AI 引擎与增强',
    titleEn: 'AI & Prompts',
    descZh: '模型、深度分析与翻译',
    descEn: 'Model, analysis & translation',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    id: 'report',
    step: '04',
    stage: 'deliver',
    titleZh: '报告与版面',
    titleEn: 'Report & Layout',
    descZh: '推送模式与区域排序',
    descEn: 'Push modes & region order',
    icon: <LayoutList className="h-4 w-4" />,
  },
  {
    id: 'push',
    step: '05',
    stage: 'deliver',
    titleZh: '推送与定时',
    titleEn: 'Channels & Schedule',
    descZh: '9 大通知渠道与时间线',
    descEn: '9 channels & 7×24 timeline',
    icon: <BellRing className="h-4 w-4" />,
  },
  {
    id: 'storage',
    step: '06',
    stage: 'system',
    titleZh: '存储与系统',
    titleEn: 'Storage & System',
    descZh: '时区、本地/云端与高级',
    descEn: 'Timezone, S3/R2 & advanced',
    icon: <HardDrive className="h-4 w-4" />,
  },
]

export function SideNav({
  onSelect,
  collapsed = false,
}: {
  onSelect?: () => void
  collapsed?: boolean
}) {
  const {
    activeSection,
    setActiveSection,
    issues,
    configData,
    lang,
    setExportOpen,
    setCommandOpen,
    persistenceError,
  } = useEditor()
  const t = useT()

  const getSectionBadge = (id: SectionId): string | null => {
    if (id === 'sources') {
      const enabledCount = [
        getInObject<boolean>(configData, ['platforms', 'enabled'], true),
        getInObject<boolean>(configData, ['rss', 'enabled'], true),
        getInObject<boolean>(configData, ['web_search', 'enabled'], false),
      ].filter(Boolean).length
      return `${enabledCount}/3`
    }
    if (id === 'filter') {
      const m = getInObject<string>(configData, ['filter', 'method'], 'keyword')
      return m === 'ai' ? 'AI' : t('关键词', 'KW')
    }
    if (id === 'ai') {
      const active =
        getInObject<boolean>(configData, ['ai_analysis', 'enabled'], false) ||
        getInObject<boolean>(configData, ['ai_translation', 'enabled'], false)
      return active ? 'ON' : 'OFF'
    }
    if (id === 'push') {
      const sch = getInObject<boolean>(configData, ['schedule', 'enabled'], false)
      return sch ? t('定时', 'Sched') : null
    }
    return null
  }

  const totalErrors = issues.filter((i) => i.severity === 'error').length
  const totalWarnings = issues.filter((i) => i.severity === 'warning').length
  const supportUrl = getPersonalSupportUrl(lang)

  return (
    <aside
      data-collapsed={collapsed ? 'true' : 'false'}
      className="flex h-full w-full flex-col justify-between bg-[var(--bg-surface)]/85 py-3 transition-[padding] duration-200"
    >
      <div
        className={cn(
          'tr-sidenav-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto overflow-x-hidden',
          collapsed ? 'px-2' : 'pl-3 pr-2',
        )}
      >
        {/* Quick Search Bar */}
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          aria-label={t('搜索配置项', 'Search settings')}
          className={cn(
            'tr-focus-ring flex h-9 w-full items-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] cursor-pointer',
            collapsed ? 'justify-center px-0' : 'justify-between gap-2 px-3',
          )}
          title={t('快速搜索任意配置项 (Ctrl/⌘ + K)', 'Quick search settings (Ctrl/⌘ + K)')}
        >
          {collapsed ? (
            <Search className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <span className="flex items-center gap-2 truncate">
                <Search className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t('搜索配置项...', 'Search settings...')}</span>
              </span>
              <kbd className="shrink-0 rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                ⌘K
              </kbd>
            </>
          )}
        </button>

        {/* Privacy Guarantee Pill */}
        <InfoTooltip
          side="right"
          content={t(
            '纯前端运行，没有后台服务器。你填写的配置、关键词和密钥仅保存在当前浏览器本地，不会上传到任何服务器。',
            'Pure client-side app with no backend server. Your config, keywords, and secrets stay locally in this browser and are never uploaded.',
          )}
        >
          <div
            className={cn(
              'flex items-center rounded-xl border border-teal-500/20 bg-teal-500/[0.06] text-xs text-teal-700 dark:text-teal-300 cursor-help',
              collapsed ? 'h-9 justify-center px-0' : 'justify-between gap-2 px-3 py-2',
            )}
          >
            <span className="flex items-center gap-2 leading-snug">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{t('本地运行 · 数据不上传', 'Runs locally · Never uploaded')}</span>}
            </span>
            {!collapsed && <HelpCircle className="h-3.5 w-3.5 shrink-0 opacity-65" />}
          </div>
        </InfoTooltip>

        {/* Navigation List */}
        <div className="space-y-1">
          {NAV_ITEMS.map((item, idx) => {
            const active = activeSection === item.id
            const secIssues = issues.filter((i) => i.section === item.id)
            const hasErr = secIssues.some((i) => i.severity === 'error')
            const hasWarn = secIssues.some((i) => i.severity === 'warning')
            const statusPill = getSectionBadge(item.id)
            const itemLabel = t(item.titleZh, item.titleEn)
            const prevStage = idx > 0 ? NAV_ITEMS[idx - 1].stage : undefined
            const showGroupHeader = Boolean(item.stage && item.stage !== prevStage)
            const stageMeta = item.stage ? WORKFLOW_STAGES[item.stage] : null
            const stageVars = item.stage ? stageStyleVars(item.stage) : undefined

            return (
              <div key={item.id} className={cn(showGroupHeader && (collapsed ? 'pt-1.5' : 'pt-2 first:pt-0'))}>
                {showGroupHeader && stageMeta && (
                  collapsed ? (
                    <div className="mx-auto mb-1.5 h-px w-6 bg-[var(--border-default)]" aria-hidden="true" />
                  ) : (
                    <div
                      data-sidenav-stage-group={item.stage}
                      style={stageVars}
                      className="mb-1 flex items-center gap-1.5 px-2.5 text-[11px] font-semibold tracking-wide text-[var(--stage-text)]"
                    >
                      <span className="h-2 w-2 rounded-full bg-[var(--stage-bar)] shrink-0" aria-hidden="true" />
                      <span className="truncate">{t(stageMeta.compactTitleZh, stageMeta.compactTitleEn)}</span>
                    </div>
                  )
                )}

                <button
                  type="button"
                  data-nav-section={item.id}
                  data-stage={item.stage}
                  style={stageVars}
                  onClick={() => {
                    setActiveSection(item.id)
                    onSelect?.()
                  }}
                  title={collapsed ? `${item.step ? `${item.step} ` : ''}${itemLabel}` : undefined}
                  aria-label={collapsed ? itemLabel : undefined}
                  className={cn(
                    'tr-focus-ring group relative flex w-full items-center rounded-xl text-left transition-all cursor-pointer',
                    collapsed ? 'justify-center px-0 py-1.5' : 'gap-2.5 px-2.5 py-1.5',
                    active
                      ? item.stage
                        ? 'bg-[var(--stage-soft)] text-[var(--stage-text)] shadow-[inset_0_0_0_1px_var(--stage-border)]'
                        : 'bg-[var(--brand-soft)] text-[var(--brand-primary)] shadow-[inset_0_0_0_1px_var(--brand-border)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]/70 hover:text-[var(--text-primary)]',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                      active
                        ? item.stage
                          ? 'bg-[var(--stage-solid)] text-white shadow-[var(--shadow-xs)]'
                          : 'bg-[var(--brand-primary)] text-white'
                        : item.stage
                          ? 'bg-[var(--stage-soft)]/70 text-[var(--stage-text)] group-hover:bg-[var(--stage-soft)]'
                          : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] group-hover:text-[var(--text-primary)]',
                    )}
                  >
                    {item.icon}
                  </span>

                  {collapsed ? (
                    (hasErr || hasWarn) && (
                      <span
                        className={cn(
                          'pointer-events-none absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-[var(--bg-surface)]',
                          hasErr ? 'bg-red-500' : 'bg-amber-400',
                        )}
                      />
                    )
                  ) : (
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="truncate text-[13.5px] font-semibold leading-snug">
                          {item.step && (
                            <span
                              className={cn(
                                'mr-1.5 font-mono text-xs',
                                active ? 'font-bold opacity-90' : 'opacity-55',
                              )}
                            >
                              {item.step}
                            </span>
                          )}
                          {itemLabel}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {hasErr && <span className="h-2 w-2 rounded-full bg-red-500" />}
                          {!hasErr && hasWarn && <span className="h-2 w-2 rounded-full bg-amber-400" />}
                          {statusPill && (
                            <span
                              className={cn(
                                'rounded-md px-1.5 py-0.5 font-mono text-[11px] leading-none',
                                active
                                  ? item.stage
                                    ? 'bg-[var(--stage-solid)] text-white'
                                    : 'bg-[var(--brand-primary)]/15 text-[var(--brand-primary)]'
                                  : 'bg-[var(--bg-muted)] text-[var(--text-muted)]',
                              )}
                            >
                              {statusPill}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom Health Summary & Utility Actions */}
      <div className={cn('mt-2.5 shrink-0 space-y-2 border-t border-[var(--border-default)] pt-2.5', collapsed ? 'px-2' : 'px-3')}>
        {(totalErrors > 0 || totalWarnings > 0) && (
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            title={
              totalErrors > 0
                ? t('{v0} 项错误 / {v1} 项提醒', '{v0} err · {v1} warn', { v0: totalErrors, v1: totalWarnings })
                : t('{v0} 项配置提醒', '{v0} warnings', { v0: totalWarnings })
            }
            className={cn(
              'flex w-full items-center rounded-xl border border-amber-500/30 bg-amber-500/8 text-left text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-500/14 transition-colors cursor-pointer',
              collapsed ? 'h-9 justify-center px-0' : 'justify-between gap-2 px-3 py-2',
            )}
          >
            {collapsed ? (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {totalErrors > 0
                      ? t('{v0} 项错误 / {v1} 项提醒', '{v0} err · {v1} warn', { v0: totalErrors, v1: totalWarnings })
                      : t('{v0} 项配置提醒', '{v0} warnings', { v0: totalWarnings })}
                  </span>
                </span>
                <span className="underline">{t('查看', 'View')}</span>
              </>
            )}
          </button>
        )}

        {persistenceError && !collapsed && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-300">
            {t('最新草稿未保存到浏览器', 'Latest draft could not be saved')}
          </div>
        )}

        <ConfigMenuPopover variant="sidenav" collapsed={collapsed} onActionSelect={onSelect} />

        <a
          href={supportUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={t('支持项目', 'Support')}
          aria-label={t('支持项目', 'Support')}
          className={cn(
            'tr-focus-ring group inline-flex w-full items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] text-xs font-semibold text-[var(--text-secondary)] no-underline transition-all duration-200 hover:-translate-y-px hover:border-rose-500/45 hover:bg-rose-500/[0.08] hover:text-rose-600 hover:shadow-[0_6px_14px_-6px_rgba(244,63,94,0.28)] dark:hover:border-rose-400/45 dark:hover:bg-rose-500/14 dark:hover:text-rose-300',
            collapsed ? 'h-9 px-0' : 'gap-1.5 px-2.5 py-2',
          )}
        >
          <Heart className="h-3.5 w-3.5 shrink-0 text-rose-500/75 transition-all duration-200 group-hover:scale-115 group-hover:fill-rose-500 group-hover:text-rose-500" />
          {!collapsed && (
            <>
              <span>{t('支持项目', 'Support')}</span>
              <ExternalLink className="h-3 w-3 opacity-55 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
            </>
          )}
        </a>
      </div>
    </aside>
  )
}
