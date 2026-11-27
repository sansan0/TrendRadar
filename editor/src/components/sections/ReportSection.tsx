import * as React from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CalendarClock,
  CalendarDays,
  Check,
  Flame,
  Globe,
  GripVertical,
  HelpCircle,
  Layers,
  LayoutGrid,
  LayoutList,
  Radio,
  RotateCcw,
  Rss,
  Scale,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Zap,
} from 'lucide-react'
import {
  Badge,
  Button,
  Callout,
  Card,
  Collapsible,
  CollapsibleContent,
  InfoTooltip,
  Input,
  Slider,
  Switch,
} from '@/components/ui/primitives'
import {
  AdvancedCollapsible,
  SectionShell,
  SettingRow,
} from '@/components/shared/SharedControls'
import { useT } from '@/i18n'
import {
  getLocalizedPlatformName,
  getLocalizedRssFeedName,
  getLocalizedTimelinePresetName,
} from '@/lib/presets'
import {
  ALL_REGIONS,
  type PlatformSource,
  type RegionKey,
  type RssFeed,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { restrictToVerticalAxis } from '@/lib/scroll-focus'
import { getInObject } from '@/lib/yaml-doc'
import { useEditor } from '@/store/editor-store'

type ReportMode = 'daily' | 'current' | 'incremental'
type DisplayMode = 'keyword' | 'platform'

interface RegionMeta {
  key: RegionKey
  icon: React.ReactNode
  titleZh: string
  titleEn: string
  shortDescZh: string
  shortDescEn: string
  tooltipZh: string
  tooltipEn: string
}

const REGION_META: Record<RegionKey, RegionMeta> = {
  new_items: {
    key: 'new_items',
    icon: <Sparkles className="h-4 w-4" />,
    titleZh: '新增热点区',
    titleEn: 'New Items',
    shortDescZh: '汇总本次新上榜的热点条目',
    shortDescEn: 'Newly surfaced items this run',
    tooltipZh: '汇总本次新出现的热榜、RSS 与联网搜索条目；关闭本区不影响热词统计内的新增标签。',
    tooltipEn: 'Aggregates newly discovered hotlist, RSS, and web search items without affecting stats badges.',
  },
  hotlist: {
    key: 'hotlist',
    icon: <Flame className="h-4 w-4" />,
    titleZh: '热榜筛选区',
    titleEn: 'Hotlist Digest',
    shortDescZh: '经关键词或 AI 筛选的平台热榜',
    shortDescEn: 'Filtered platform trending items',
    tooltipZh: '展示经关键词规则或 AI 筛选命中的热搜榜单；关闭仅隐藏 IM 推送中的热榜区块，不影响 HTML 网页报告生成。',
    tooltipEn: 'Matched hotlist headlines. Disabling hides this block in IM notifications only; HTML reports stay unaffected.',
  },
  rss: {
    key: 'rss',
    icon: <Rss className="h-4 w-4" />,
    titleZh: 'RSS 订阅区',
    titleEn: 'RSS Feeds',
    shortDescZh: '已订阅的博客与媒体文章流',
    shortDescEn: 'Articles from enabled RSS feeds',
    tooltipZh: '按时间流展示已启用的 RSS 订阅文章；关闭后不仅隐藏推送，也会跳过 RSS 内容的 AI 分析与翻译。',
    tooltipEn: 'Chronological stream of RSS articles. Turning off hides pushes and skips RSS AI analysis & translation.',
  },
  web_search: {
    key: 'web_search',
    icon: <Globe className="h-4 w-4" />,
    titleZh: '联网搜索区',
    titleEn: 'Web Search',
    shortDescZh: '定向检索并过滤后的专题结果',
    shortDescEn: 'Filtered web search findings',
    tooltipZh: '展示联网搜索任务主动检索、并通过评分与域名过滤的全网专题结果。',
    tooltipEn: 'Displays targeted web search results filtered through score and authority rules.',
  },
  standalone: {
    key: 'standalone',
    icon: <LayoutGrid className="h-4 w-4" />,
    titleZh: '独立展示区',
    titleEn: 'Standalone Showcase',
    shortDescZh: '完整输出指定源，不过滤关键词',
    shortDescEn: 'Full unfiltered feeds for picked sources',
    tooltipZh: '完整展示下方勾选的热榜平台或 RSS 源，绕过关键词与 AI 过滤；即使关闭推送，只要开启 ai_analysis.include_standalone 仍会参与分析。',
    tooltipEn: 'Shows selected platforms or RSS feeds unfiltered. Even if hidden from push, sources still feed AI if ai_analysis.include_standalone is enabled.',
  },
  ai_analysis: {
    key: 'ai_analysis',
    icon: <Brain className="h-4 w-4" />,
    titleZh: 'AI 深度分析区',
    titleEn: 'AI Analysis',
    shortDescZh: '大模型提炼的趋势与核心结论',
    shortDescEn: 'LLM-synthesized trends & takeaways',
    tooltipZh: '展示 AI 深度分析输出；注意：若 AI 分析总开关仍开启而此处关闭，后台仍会调用大模型消耗 Token。',
    tooltipEn: 'Displays LLM briefing output. Warning: hiding this section while AI Analysis master toggle is ON still calls the LLM.',
  },
}

function normalizeRegionOrder(rawOrder: unknown): RegionKey[] {
  const validSet = new Set<string>(ALL_REGIONS)
  const out: RegionKey[] = []
  if (Array.isArray(rawOrder)) {
    for (const item of rawOrder) {
      const s = String(item)
      if (validSet.has(s) && !out.includes(s as RegionKey)) {
        out.push(s as RegionKey)
      }
    }
  }
  for (const r of ALL_REGIONS) {
    if (!out.includes(r)) out.push(r)
  }
  return out
}

function roundWeight(val: number): number {
  return Math.max(0, Math.min(1, Math.round(val * 100) / 100))
}

interface SortableRegionRowProps {
  regionKey: RegionKey
  orderIndex: number
  enabled: boolean
  onToggle: (checked: boolean) => void
  statusBadge?: React.ReactNode
}

function SortableRegionRow({
  regionKey,
  orderIndex,
  enabled,
  onToggle,
  statusBadge,
}: SortableRegionRowProps) {
  const t = useT()
  const meta = REGION_META[regionKey]
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: regionKey })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl border px-3.5 py-2.5',
        isDragging
          ? 'z-20 border-dashed border-[var(--brand-primary)]/70 bg-[var(--brand-soft)]/35 opacity-40'
          : cn(
              'transition-colors',
              enabled
                ? 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
                : 'border-[var(--border-default)] bg-[var(--bg-subtle)]/60 opacity-80',
            ),
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="tr-focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] cursor-grab active:cursor-grabbing touch-none select-none"
        aria-label={t('拖拽调整区域顺序', 'Drag to reorder region')}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold tabular-nums',
          enabled
            ? 'border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-primary)]'
            : 'border-[var(--border-default)] bg-[var(--bg-muted)] text-[var(--text-muted)]',
        )}
      >
        {enabled ? orderIndex : '-'}
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'shrink-0',
              enabled ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]',
            )}
          >
            {meta.icon}
          </span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {t(meta.titleZh, meta.titleEn)}
          </span>
          <code className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-muted)]">
            {regionKey}
          </code>
          <InfoTooltip content={t(meta.tooltipZh, meta.tooltipEn)}>
            <button
              type="button"
              className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
              aria-label={t('查看机制说明', 'View details')}
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </InfoTooltip>
          {statusBadge}
        </div>
        <p className="text-[13px] leading-relaxed text-[var(--text-muted)] truncate">
          {t(meta.shortDescZh, meta.shortDescEn)}
        </p>
      </div>

      <div className="shrink-0">
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          ariaLabel={t(meta.titleZh, meta.titleEn)}
        />
      </div>
    </div>
  )
}

export function ReportSection() {
  const {
    configData,
    lang,
    setConfigValue,
    patchConfigValues,
    setActiveSection,
    visualFocusTarget,
    applyQuickFix,
    notify,
  } = useEditor()
  const t = useT()

  const [autoBalanceWeights, setAutoBalanceWeights] = React.useState(false)

  // Schedule awareness
  const scheduleEnabled = getInObject<boolean>(configData, ['schedule', 'enabled'], false)
  const schedulePreset = getInObject<string>(configData, ['schedule', 'preset'], 'morning_evening')

  // Report fields
  const reportMode = getInObject<ReportMode>(configData, ['report', 'mode'], 'current')
  const displayMode = getInObject<DisplayMode>(configData, ['report', 'display_mode'], 'keyword')
  const sortByPositionFirst = getInObject<boolean>(
    configData,
    ['report', 'sort_by_position_first'],
    false,
  )
  const maxNewsPerKeyword = Number(
    getInObject<number>(configData, ['report', 'max_news_per_keyword'], 0),
  )
  const rankThreshold = Number(getInObject<number>(configData, ['report', 'rank_threshold'], 5))
  const showSearchSnippet = getInObject<boolean>(
    configData,
    ['web_search', 'notification_show_snippet'],
    false,
  )

  // Cross-section awareness for contextual region badges
  const aiAnalysisEnabled = getInObject<boolean>(configData, ['ai_analysis', 'enabled'], true)
  const aiIncludeStandalone = getInObject<boolean>(
    configData,
    ['ai_analysis', 'include_standalone'],
    true,
  )
  const rssMasterEnabled = getInObject<boolean>(configData, ['rss', 'enabled'], true)
  const webSearchMasterEnabled = getInObject<boolean>(configData, ['web_search', 'enabled'], false)

  // Display regions & ordering
  const rawRegionOrder = getInObject<string[]>(configData, ['display', 'region_order'], [])
  const orderedRegions = React.useMemo(
    () => normalizeRegionOrder(rawRegionOrder),
    [rawRegionOrder],
  )

  const regionSwitches: Record<RegionKey, boolean> = {
    new_items: getInObject<boolean>(configData, ['display', 'regions', 'new_items'], false),
    hotlist: getInObject<boolean>(configData, ['display', 'regions', 'hotlist'], true),
    rss: getInObject<boolean>(configData, ['display', 'regions', 'rss'], true),
    web_search: getInObject<boolean>(configData, ['display', 'regions', 'web_search'], true),
    standalone: getInObject<boolean>(configData, ['display', 'regions', 'standalone'], false),
    ai_analysis: getInObject<boolean>(configData, ['display', 'regions', 'ai_analysis'], true),
  }

  // Standalone config + available sources
  const standalonePlatforms = getInObject<string[]>(
    configData,
    ['display', 'standalone', 'platforms'],
    [],
  )
  const standaloneRssFeeds = getInObject<string[]>(
    configData,
    ['display', 'standalone', 'rss_feeds'],
    [],
  )
  const standaloneMaxItems = Number(
    getInObject<number>(configData, ['display', 'standalone', 'max_items'], 20),
  )
  const rawPlatformSources = getInObject<PlatformSource[]>(
    configData,
    ['platforms', 'sources'],
    [],
  )
  const rawRssFeeds = getInObject<RssFeed[]>(configData, ['rss', 'feeds'], [])

  const platformSources = Array.isArray(rawPlatformSources) ? rawPlatformSources.filter((item) => item && typeof item.id === 'string') : []
  const rssFeeds = Array.isArray(rawRssFeeds) ? rawRssFeeds.filter((item) => item && typeof item.id === 'string') : []
  const selectedPlatforms = Array.isArray(standalonePlatforms) ? standalonePlatforms.filter((item) => typeof item === 'string') : []
  const selectedRss = Array.isArray(standaloneRssFeeds) ? standaloneRssFeeds.filter((item) => typeof item === 'string') : []

  const orphanPlatforms = selectedPlatforms.filter(
    (id) => !platformSources.some((p) => p.id === id),
  )
  const orphanRss = selectedRss.filter((id) => !rssFeeds.some((f) => f.id === id))

  const [standaloneManualOpen, setStandaloneManualOpen] = React.useState(false)
  React.useEffect(() => {
    if (visualFocusTarget?.section === 'report' && visualFocusTarget.anchor === 'pro-anchor-standalone') {
      setStandaloneManualOpen(true)
    }
  }, [visualFocusTarget])

  const standaloneExpanded = regionSwitches.standalone || standaloneManualOpen

  // Ranking weights
  const wRank = Number(getInObject<number>(configData, ['advanced', 'weight', 'rank'], 0.6))
  const wFreq = Number(getInObject<number>(configData, ['advanced', 'weight', 'frequency'], 0.3))
  const wHot = Number(getInObject<number>(configData, ['advanced', 'weight', 'hotness'], 0.1))
  const weightSum = wRank + wFreq + wHot
  const weightMismatch = Math.abs(weightSum - 1) > 0.005

  const weightCustomizedCount =
    (Math.abs(wRank - 0.6) > 0.001 ? 1 : 0) +
    (Math.abs(wFreq - 0.3) > 0.001 ? 1 : 0) +
    (Math.abs(wHot - 0.1) > 0.001 ? 1 : 0)

  const [activeDragRegion, setActiveDragRegion] = React.useState<RegionKey | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragRegion(event.active.id as RegionKey)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragRegion(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = orderedRegions.indexOf(active.id as RegionKey)
    const newIdx = orderedRegions.indexOf(over.id as RegionKey)
    if (oldIdx < 0 || newIdx < 0) return
    const nextOrder = arrayMove(orderedRegions, oldIdx, newIdx)
    setConfigValue(['display', 'region_order'], nextOrder)
  }

  const handleRegionToggle = (key: RegionKey, nextChecked: boolean) => {
    const rawSet = new Set(Array.isArray(rawRegionOrder) ? rawRegionOrder.map(String) : [])
    const missingAny = ALL_REGIONS.some((r) => !rawSet.has(r))
    if (nextChecked && missingAny) {
      patchConfigValues([
        { path: ['display', 'regions', key], value: true },
        { path: ['display', 'region_order'], value: orderedRegions },
      ])
    } else {
      setConfigValue(['display', 'regions', key], nextChecked)
    }
  }

  const toggleStandalonePlatform = (id: string) => {
    const exists = selectedPlatforms.includes(id)
    const next = exists
      ? selectedPlatforms.filter((x) => x !== id)
      : [...selectedPlatforms, id]
    setConfigValue(['display', 'standalone', 'platforms'], next)
  }

  const toggleStandaloneRss = (id: string) => {
    const exists = selectedRss.includes(id)
    const next = exists ? selectedRss.filter((x) => x !== id) : [...selectedRss, id]
    setConfigValue(['display', 'standalone', 'rss_feeds'], next)
  }

  const handleWeightChange = (key: 'rank' | 'frequency' | 'hotness', rawVal: number) => {
    const val = roundWeight(rawVal)
    if (!autoBalanceWeights) {
      setConfigValue(['advanced', 'weight', key], val)
      return
    }
    const remaining = Math.max(0, 1 - val)
    const keys: Array<'rank' | 'frequency' | 'hotness'> = ['rank', 'frequency', 'hotness']
    const others = keys.filter((k) => k !== key)
    const currMap = { rank: wRank, frequency: wFreq, hotness: wHot }
    const otherSum = currMap[others[0]] + currMap[others[1]]
    let v0: number
    let v1: number
    if (otherSum > 0.001) {
      v0 = roundWeight((currMap[others[0]] / otherSum) * remaining)
      v1 = roundWeight(Math.max(0, 1 - val - v0))
    } else {
      v0 = roundWeight(remaining / 2)
      v1 = roundWeight(Math.max(0, 1 - val - v0))
    }
    patchConfigValues([
      { path: ['advanced', 'weight', key], value: val },
      { path: ['advanced', 'weight', others[0]], value: v0 },
      { path: ['advanced', 'weight', others[1]], value: v1 },
    ])
  }

  const resetWeights = () => {
    patchConfigValues([
      { path: ['advanced', 'weight', 'rank'], value: 0.6 },
      { path: ['advanced', 'weight', 'frequency'], value: 0.3 },
      { path: ['advanced', 'weight', 'hotness'], value: 0.1 },
    ])
    notify(t('已恢复默认排序权重 (0.6 / 0.3 / 0.1)', 'Reset weights to defaults (0.6 / 0.3 / 0.1)'), 'success')
  }

  // Compute display rank numbers only for active regions
  let activeCounter = 0
  const activeRankMap: Partial<Record<RegionKey, number>> = {}
  for (const r of orderedRegions) {
    if (regionSwitches[r]) {
      activeCounter += 1
      activeRankMap[r] = activeCounter
    }
  }

  const reportModes: Array<{
    value: ReportMode
    icon: React.ReactNode
    titleZh: string
    titleEn: string
    tagZh: string
    tagEn: string
    descZh: string
    descEn: string
  }> = [
    {
      value: 'daily',
      icon: <CalendarDays className="h-4 w-4" />,
      titleZh: '当日汇总',
      titleEn: 'Daily Summary',
      tagZh: '全天复盘',
      tagEn: 'Full-Day',
      descZh: '汇总全天所有匹配热点，适合早晚集中复盘。',
      descEn: 'Collects all matched news today — best for daily digests.',
    },
    {
      value: 'current',
      icon: <Radio className="h-4 w-4" />,
      titleZh: '当前榜单',
      titleEn: 'Current Snapshot',
      tagZh: '此刻在榜',
      tagEn: 'Live Now',
      descZh: '推送此刻仍在榜的热点，实时掌握当下焦点。',
      descEn: 'Shows matched news currently trending right now.',
    },
    {
      value: 'incremental',
      icon: <Zap className="h-4 w-4" />,
      titleZh: '增量监控',
      titleEn: 'Incremental',
      tagZh: '零重复',
      tagEn: 'Zero Repeats',
      descZh: '仅推送本次新上榜内容，无新增则静默不打扰。',
      descEn: 'Pushes only newly surfaced items and stays quiet when idle.',
    },
  ]

  const renderRegionStatusBadge = (key: RegionKey): React.ReactNode => {
    if (key === 'ai_analysis') {
      if (!regionSwitches.ai_analysis && aiAnalysisEnabled) {
        return (
          <InfoTooltip
            content={t(
              'AI 分析总开关当前已开启：关闭此展示区后后台仍会调用大模型并消耗 Token，建议在「AI 引擎」页关闭分析开关。',
              'AI Analysis is ON: hiding this block still calls the LLM and consumes tokens.',
            )}
          >
            <span className="cursor-help">
              <Badge tone="warning">
                <AlertTriangle className="h-3 w-3" />
                <span>{t('仍消耗 Token', 'Still Calls AI')}</span>
              </Badge>
            </span>
          </InfoTooltip>
        )
      }
      if (regionSwitches.ai_analysis && !aiAnalysisEnabled) {
        return (
          <InfoTooltip
            content={t(
              '当前 AI 分析总开关未开启，实际推送中不会输出本区块。',
              'AI Analysis master toggle is OFF, so this block will stay empty.',
            )}
          >
            <span className="cursor-help">
              <Badge tone="outline">{t('总开关未开', 'Master OFF')}</Badge>
            </span>
          </InfoTooltip>
        )
      }
      return null
    }
    if (key === 'rss' && !rssMasterEnabled) {
      return (
        <InfoTooltip
          content={t(
            '当前 RSS 数据源总开关未开启。',
            'RSS data source master toggle is OFF.',
          )}
        >
          <span className="cursor-help">
            <Badge tone="outline">{t('数据源未开', 'Source OFF')}</Badge>
          </span>
        </InfoTooltip>
      )
    }
    if (key === 'web_search' && !webSearchMasterEnabled) {
      return (
        <InfoTooltip
          content={t(
            '当前联网搜索数据源总开关未开启。',
            'Web Search data source master toggle is OFF.',
          )}
        >
          <span className="cursor-help">
            <Badge tone="outline">{t('数据源未开', 'Source OFF')}</Badge>
          </span>
        </InfoTooltip>
      )
    }
    if (key === 'standalone' && !regionSwitches.standalone && aiIncludeStandalone) {
      return (
        <InfoTooltip
          content={t(
            '推送已隐藏，但 ai_analysis.include_standalone 已开启，下方独立源仍会送入 AI 分析。',
            'Hidden from push, but ai_analysis.include_standalone is ON so picked sources still feed AI.',
          )}
        >
          <span className="cursor-help">
            <Badge tone="brand">{t('仅参与 AI 分析', 'AI Input Only')}</Badge>
          </span>
        </InfoTooltip>
      )
    }
    return null
  }

  const barDenom = weightSum > 0 ? weightSum : 1
  const pctRank = (wRank / barDenom) * 100
  const pctFreq = (wFreq / barDenom) * 100
  const pctHot = (wHot / barDenom) * 100

  return (
    <SectionShell
      sectionId="report"
      stepNumber="STEP 04"
      title={t('报告与版面', 'Report & Layout')}
      subtitle={t(
        '设置推送模式、分组方式、各板块顺序与热榜排序权重。',
        'Set push mode, grouping, section order, and ranking weights.',
      )}
      docSlug="push-modes"
      sourceFile="config.yaml"
    >
      {/* Card 1: Report Mode */}
      <Card id="pro-anchor-report" className="scroll-mt-4 p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {t('推送报告模式', 'Report Push Mode')}
            </h2>
            <code className="rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-muted)] shrink-0">
              report.mode
            </code>
            <InfoTooltip
              content={t(
                '选择每次推送时的汇总窗口与去重策略：当日汇总适合早晚复盘，当前榜单看此刻在榜焦点，增量监控仅推新上榜内容。',
                'Choose how news items are aggregated and deduplicated: Daily Summary for digests, Current Snapshot for live rankings, or Incremental for new items only.',
              )}
            >
              <button
                type="button"
                className="tr-focus-ring inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--brand-primary)] cursor-help"
                aria-label={t('报告模式说明', 'Report mode info')}
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </InfoTooltip>
          </div>

          <div
            role="tablist"
            aria-label={t('推送报告模式切换', 'Report push mode selector')}
            className="grid w-full grid-cols-3 gap-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1 @min-[36rem]/section:w-auto"
          >
            {reportModes.map((item) => {
              const active = reportMode === item.value
              return (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setConfigValue(['report', 'mode'], item.value)}
                  className={cn(
                    'tr-focus-ring inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-all cursor-pointer whitespace-nowrap',
                    active
                      ? 'bg-[var(--bg-surface)] font-semibold text-[var(--brand-primary)] shadow-[var(--shadow-xs)] ring-1 ring-[var(--brand-border)]'
                      : 'font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]/70 hover:text-[var(--text-primary)]',
                  )}
                >
                  {item.icon}
                  <span className="truncate">{t(item.titleZh, item.titleEn)}</span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" />}
                </button>
              )
            })}
          </div>
        </div>

        {(() => {
          const activeMode = reportModes.find((m) => m.value === reportMode) ?? reportModes[0]
          return (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--bg-subtle)]/75 px-3 py-2 text-xs text-[var(--text-secondary)]">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Badge tone="brand">{t(activeMode.tagZh, activeMode.tagEn)}</Badge>
                <span>{t(activeMode.descZh, activeMode.descEn)}</span>
              </div>
              <code className="font-mono text-[11px] text-[var(--text-muted)]">
                {activeMode.value}
              </code>
            </div>
          )
        })()}

        {scheduleEnabled && (
          <Callout
            tone="info"
            icon={<CalendarClock className="h-4 w-4 text-[var(--brand-primary)]" />}
            title={t('定时调度已启用（{v0} · {v1}），时段内由时间线接管模式', 'Schedule active ({v0} · {v1}); timeline overrides mode per window', { v0: getLocalizedTimelinePresetName(schedulePreset, undefined, lang), v1: schedulePreset })}
            action={
              <Button
                variant="outline"
                size="xs"
                onClick={() => setActiveSection('push')}
              >
                <span>{t('修改时间线', 'Edit Timeline')}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            }
          >
            {t(
              '上方选项仍作为关闭调度或默认回退模式生效。',
              'The choice above still serves as your fallback default.',
            )}
          </Callout>
        )}
      </Card>

      {/* Card 2: Grouping & Display Trimming */}
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-1.5 pb-3 border-b border-[var(--border-default)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            {t('分组与展示裁剪', 'Grouping & Display Trimming')}
          </h2>
          <InfoTooltip
            content={t(
              '控制新闻分组方式、单组条数上限与高亮门槛。',
              'Control grouping dimension, group limits, and highlight thresholds.',
            )}
          >
            <button
              type="button"
              className="tr-focus-ring inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--brand-primary)] cursor-help"
              aria-label={t('分组裁剪说明', 'Grouping info')}
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </InfoTooltip>
        </div>

        <div className="divide-y divide-[var(--border-default)]">
          <SettingRow
            label={t('新闻分组维度', 'Grouping Dimension')}
            description={t(
              '按关键词/AI 标签聚拢，或按来源平台分别列出。',
              'Group hotlist by keyword/AI tag or by source platform.',
            )}
          >
            <div className="inline-flex w-full @min-[40rem]/section:w-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1 gap-1">
              <button
                type="button"
                onClick={() => setConfigValue(['report', 'display_mode'], 'keyword')}
                className={cn(
                  'tr-focus-ring flex-1 @min-[40rem]/section:flex-initial inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-all cursor-pointer whitespace-nowrap',
                  displayMode === 'keyword'
                    ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] shadow-[var(--shadow-xs)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                )}
              >
                <Tag className="h-4 w-4" />
                <span>{t('按关键词 / AI 标签', 'By Keyword / AI Tag')}</span>
              </button>
              <button
                type="button"
                onClick={() => setConfigValue(['report', 'display_mode'], 'platform')}
                className={cn(
                  'tr-focus-ring flex-1 @min-[40rem]/section:flex-initial inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-all cursor-pointer whitespace-nowrap',
                  displayMode === 'platform'
                    ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] shadow-[var(--shadow-xs)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                )}
              >
                <LayoutList className="h-4 w-4" />
                <span>{t('按平台来源', 'By Platform')}</span>
              </button>
            </div>
          </SettingRow>

          {displayMode === 'keyword' && (
            <SettingRow
              label={t('按词库顺序排列分组', 'Sort by Definition Order')}
              description={t(
                '开启按词库书写顺序，关闭按命中条数降序。',
                'On: keep frequency_words.txt order; Off: sort by hit count.',
              )}
            >
              <Switch
                checked={sortByPositionFirst}
                onCheckedChange={(v) => setConfigValue(['report', 'sort_by_position_first'], v)}
                ariaLabel={t('按词库定义顺序排列分组', 'Sort groups by definition order')}
              />
            </SettingRow>
          )}

          <SettingRow
            label={t('每组最大显示条数', 'Max Items per Group')}
            description={t(
              '每个关键词或标签下最多展示条数，0 为不限。',
              'Max items shown per keyword or tag (0 for unlimited).',
            )}
          >
            <div className="flex items-center gap-2 @min-[40rem]/section:w-44">
              <Input
                type="number"
                min={0}
                max={200}
                value={Number.isFinite(maxNewsPerKeyword) ? maxNewsPerKeyword : 0}
                onChange={(e) => {
                  const n = Math.max(0, Math.floor(Number(e.target.value) || 0))
                  setConfigValue(['report', 'max_news_per_keyword'], n)
                }}
                className="font-mono text-right"
              />
              <span className="shrink-0 text-[13px] text-[var(--text-muted)]">
                {maxNewsPerKeyword === 0 ? t('不限', 'Unlimited') : t('条', 'items')}
              </span>
            </div>
          </SettingRow>

          <SettingRow
            label={t('前排排名高亮阈值', 'Top Rank Highlight Threshold')}
            description={t(
              '排名前 N 名的热点在报告中醒目高亮。',
              'Items ranked within top N receive visual emphasis.',
            )}
            tooltip={t(
              '该阈值不改变抓取范围，除用于报告视觉强调外，还参与热榜综合排序公式中「高排名热度权重 (hotness)」的计算。',
              'Does not change crawl scope; also defines the high-rank bucket used by the hotness weight in ranking.',
            )}
          >
            <div className="flex items-center gap-2 @min-[40rem]/section:w-44">
              <span className="shrink-0 text-[13px] text-[var(--text-muted)]">
                {t('前', 'Top')}
              </span>
              <Input
                type="number"
                min={1}
                max={50}
                value={Number.isFinite(rankThreshold) ? rankThreshold : 5}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(50, Math.floor(Number(e.target.value) || 1)))
                  setConfigValue(['report', 'rank_threshold'], n)
                }}
                className="font-mono text-right"
              />
              <span className="shrink-0 text-[13px] text-[var(--text-muted)]">
                {t('名', '')}
              </span>
            </div>
          </SettingRow>

          <SettingRow
            label={t('IM 消息附带联网搜索摘要', 'Show Search Snippets in IM')}
            description={t(
              '是否在群消息中展示搜索摘要（网页报告始终显示）。',
              'Include search snippets in IM pushes (always shown in HTML).',
            )}
          >
            <Switch
              checked={showSearchSnippet}
              onCheckedChange={(v) =>
                setConfigValue(['web_search', 'notification_show_snippet'], v)
              }
              ariaLabel={t('IM 消息附带联网搜索摘要', 'Show web search snippets in IM')}
            />
          </SettingRow>
        </div>
      </Card>

      {/* Card 3: Unified Region Ordering & Toggles + Standalone Disclosure */}
      <Card id="pro-anchor-display" className="p-6 space-y-5">
        <div className="flex flex-col gap-2 @min-[40rem]/section:flex-row @min-[40rem]/section:items-start @min-[40rem]/section:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Layers className="h-4 w-4 text-[var(--brand-primary)]" />
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                {t('推送区域与排序编排', 'Notification Sections & Ordering')}
              </h2>
              <Badge tone="brand">
                {t('已启用 {v0} / {v1}', '{v0} / {v1} active', { v0: activeCounter, v1: ALL_REGIONS.length })}
              </Badge>
              <InfoTooltip
                content={t(
                  '开启任意板块开关时，编辑器会自动同步更新 display.region_order，确保该区域不会因排序列表缺失而被忽略。',
                  'Toggling any section automatically keeps display.region_order synchronized so nothing is accidentally omitted.',
                )}
              >
                <button
                  type="button"
                  className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                  aria-label={t('查看排序同步说明', 'Order sync info')}
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </InfoTooltip>
            </div>
            <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
              {t(
                '拖拽左侧手柄调整板块顺序，点击右侧开关控制显隐。',
                'Drag handles to reorder sections; toggle switches to show or hide.',
              )}
            </p>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragCancel={() => setActiveDragRegion(null)}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={orderedRegions} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {orderedRegions.map((regionKey) => (
                <SortableRegionRow
                  key={regionKey}
                  regionKey={regionKey}
                  orderIndex={activeRankMap[regionKey] ?? 0}
                  enabled={regionSwitches[regionKey]}
                  onToggle={(checked) => handleRegionToggle(regionKey, checked)}
                  statusBadge={renderRegionStatusBadge(regionKey)}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
            {activeDragRegion ? (
              <div className="flex items-center gap-3 rounded-xl border border-[var(--brand-primary)] bg-[var(--bg-elevated)] px-3.5 py-2.5 shadow-[var(--shadow-md)] ring-2 ring-[var(--brand-primary)]/20 cursor-grabbing">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--brand-primary)]">
                  <GripVertical className="h-4 w-4" />
                </span>
                <span className="text-[var(--brand-primary)] shrink-0">
                  {REGION_META[activeDragRegion].icon}
                </span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {t(REGION_META[activeDragRegion].titleZh, REGION_META[activeDragRegion].titleEn)}
                </span>
                <code className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-muted)]">
                  {activeDragRegion}
                </code>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Progressive disclosure: display.standalone */}
        <div id="pro-anchor-standalone" className="scroll-mt-4">
          {!standaloneExpanded && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]/50 px-4 py-3 text-[13px] text-[var(--text-secondary)]">
              <div className="flex flex-wrap items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-[var(--brand-primary)] shrink-0" />
                <span>
                  {aiIncludeStandalone
                    ? t('独立展示区推送未开启（已选 {v0} 平台 · {v1} RSS，若配置仍可供 AI 概括）', 'Standalone push is OFF ({v0} platforms · {v1} RSS selected; still feeds AI if set)', { v0: selectedPlatforms.length, v1: selectedRss.length })
                    : t('独立展示区数据源配置（已选 {v0} 平台 · {v1} RSS）', 'Standalone sources ({v0} platforms · {v1} RSS selected)', { v0: selectedPlatforms.length, v1: selectedRss.length })}
                </span>
              </div>
              <Button
                variant="outline"
                size="xs"
                onClick={() => setStandaloneManualOpen(true)}
              >
                <span>{t('配置独立源', 'Configure Sources')}</span>
              </Button>
            </div>
          )}

          <Collapsible open={standaloneExpanded}>
            <CollapsibleContent className="tr-collapsible-content">
              <div className="mt-2 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-soft)]/50 p-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <LayoutGrid className="h-4 w-4 text-[var(--brand-primary)]" />
                      <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
                        {t('独立展示区数据源', 'Standalone Showcase Sources')}
                      </h3>
                      <code className="rounded bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-xs text-[var(--text-muted)]">
                        display.standalone
                      </code>
                    </div>
                    <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                      {t(
                        '点选需要完整输出（绕过关键词过滤）的平台或 RSS 源。',
                        'Pick hotlist platforms or RSS feeds to output unfiltered.',
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">
                      {t('已选 {v0} 平台 · {v1} RSS', '{v0} platforms · {v1} RSS', { v0: selectedPlatforms.length, v1: selectedRss.length })}
                    </Badge>
                    {!regionSwitches.standalone && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setStandaloneManualOpen(false)}
                      >
                        <span>{t('收起', 'Hide')}</span>
                      </Button>
                    )}
                  </div>
                </div>

              {/* Hotlist platform chips */}
              <div className="space-y-2.5">
                <div className="text-sm font-medium text-[var(--text-secondary)]">
                  {t('热榜平台 (platforms)', 'Hotlist Platforms (platforms)')}
                </div>
                <div className="flex flex-wrap gap-2">
                  {platformSources.map((src) => {
                    const picked = selectedPlatforms.includes(src.id)
                    return (
                      <button
                        key={src.id}
                        type="button"
                        onClick={() => toggleStandalonePlatform(src.id)}
                        className={cn(
                          'tr-focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all cursor-pointer',
                          picked
                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-[var(--shadow-xs)]'
                            : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--brand-border)] hover:text-[var(--text-primary)]',
                        )}
                      >
                        {picked && <Check className="h-3.5 w-3.5" />}
                        <span>{getLocalizedPlatformName(src.id, src.name, lang)}</span>
                      </button>
                    )
                  })}
                  {orphanPlatforms.map((id) => (
                    <button
                      key={`orphan-${id}`}
                      type="button"
                      onClick={() => toggleStandalonePlatform(id)}
                      className="tr-focus-ring inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-[13px] font-medium text-amber-800 dark:text-amber-200 cursor-pointer"
                      title={t('该平台 ID 不在当前平台列表中，点击移除', 'Not in platforms.sources; click to remove')}
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span className="font-mono">{id}</span>
                    </button>
                  ))}
                  {platformSources.length === 0 && orphanPlatforms.length === 0 && (
                    <span className="text-[13px] text-[var(--text-muted)]">
                      {t('尚未配置任何热榜平台。', 'No hotlist platforms configured yet.')}
                    </span>
                  )}
                </div>
              </div>

              {/* RSS feed chips */}
              <div className="space-y-2.5">
                <div className="text-sm font-medium text-[var(--text-secondary)]">
                  {t('RSS 订阅源 (rss_feeds)', 'RSS Feeds (rss_feeds)')}
                </div>
                <div className="flex flex-wrap gap-2">
                  {rssFeeds.map((feed) => {
                    const picked = selectedRss.includes(feed.id)
                    return (
                      <button
                        key={feed.id}
                        type="button"
                        onClick={() => toggleStandaloneRss(feed.id)}
                        className={cn(
                          'tr-focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all cursor-pointer',
                          picked
                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-[var(--shadow-xs)]'
                            : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--brand-border)] hover:text-[var(--text-primary)]',
                        )}
                      >
                        {picked && <Check className="h-3.5 w-3.5" />}
                        <span>{getLocalizedRssFeedName(feed.id, feed.name, lang)}</span>
                      </button>
                    )
                  })}
                  {orphanRss.map((id) => (
                    <button
                      key={`orphan-rss-${id}`}
                      type="button"
                      onClick={() => toggleStandaloneRss(id)}
                      className="tr-focus-ring inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-[13px] font-medium text-amber-800 dark:text-amber-200 cursor-pointer"
                      title={t('该 RSS ID 不在当前订阅列表中，点击移除', 'Not in rss.feeds; click to remove')}
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span className="font-mono">{id}</span>
                    </button>
                  ))}
                  {rssFeeds.length === 0 && orphanRss.length === 0 && (
                    <span className="text-[13px] text-[var(--text-muted)]">
                      {t('尚未配置任何 RSS 订阅源。', 'No RSS feeds configured yet.')}
                    </span>
                  )}
                </div>
              </div>

              {/* Standalone max_items */}
              <div className="border-t border-[var(--brand-border)]/60 pt-3">
                <SettingRow
                  label={t('每个独立源最多展示条数', 'Max Items per Source')}
                  description={t(
                    '限制单个平台或 RSS 源的条数，0 为全部展示。',
                    'Cap items per standalone source (0 for all).',
                  )}
                >
                  <div className="flex items-center gap-2 @min-[40rem]/section:w-44">
                    <Input
                      type="number"
                      min={0}
                      max={200}
                      value={Number.isFinite(standaloneMaxItems) ? standaloneMaxItems : 20}
                      onChange={(e) => {
                        const n = Math.max(0, Math.floor(Number(e.target.value) || 0))
                        setConfigValue(['display', 'standalone', 'max_items'], n)
                      }}
                      className="font-mono text-right bg-[var(--bg-surface)]"
                    />
                    <span className="shrink-0 text-[13px] text-[var(--text-muted)]">
                      {standaloneMaxItems === 0 ? t('不限', 'All') : t('条', 'items')}
                    </span>
                  </div>
                </SettingRow>
              </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </Card>

      {/* Bottom AdvancedCollapsible: Hotlist Ranking Weights */}
      <AdvancedCollapsible
        id="pro-anchor-weight"
        forceOpenSeq={visualFocusTarget?.anchor === 'pro-anchor-weight' ? visualFocusTarget.seq : undefined}
        title={t('热榜综合排序权重微调', 'Hotlist Ranking Weights')}
        description={t(
          '调整排名、频次与高排名热度的排序权重（advanced.weight）',
          'Fine-tune rank, frequency, and hotness weights (advanced.weight)',
        )}
        customizedCount={weightCustomizedCount}
        icon={<SlidersHorizontal className="h-4 w-4" />}
      >
        <div className="space-y-5">
          {/* Segmented 3-color proportional bar */}
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-4 text-[13px]">
                <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-primary)]" />
                  {t('排名', 'Rank')} {Math.round(pctRank)}%
                </span>
                <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                  {t('频次', 'Frequency')} {Math.round(pctFreq)}%
                </span>
                <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-violet)]" />
                  {t('高排名热度', 'Hotness')} {Math.round(pctHot)}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Badge tone={weightMismatch ? 'warning' : 'success'}>
                  {t('总和 {v0}', 'Sum {v0}', { v0: weightSum.toFixed(2) })}
                </Badge>
                {weightMismatch && (
                  <Button
                    variant="primary"
                    size="xs"
                    onClick={() => applyQuickFix('normalize_weights')}
                  >
                    <Scale className="h-3.5 w-3.5" />
                    <span>{t('一键归一化为 1.0', 'Normalize to 1.0')}</span>
                  </Button>
                )}
              </div>
            </div>

            <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
              {pctRank > 0 && (
                <div
                  className="h-full bg-[var(--brand-primary)] transition-all duration-200"
                  style={{ width: `${pctRank}%` }}
                />
              )}
              {pctFreq > 0 && (
                <div
                  className="h-full bg-teal-500 transition-all duration-200"
                  style={{ width: `${pctFreq}%` }}
                />
              )}
              {pctHot > 0 && (
                <div
                  className="h-full bg-[var(--brand-violet)] transition-all duration-200"
                  style={{ width: `${pctHot}%` }}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <label className="inline-flex items-center gap-2.5 text-[13px] text-[var(--text-secondary)] cursor-pointer select-none">
                <Switch
                  checked={autoBalanceWeights}
                  onCheckedChange={setAutoBalanceWeights}
                  ariaLabel={t('联动配平总和为 1.0', 'Auto-balance weights to 1.0')}
                />
                <span>{t('拖动时自动配平总和为 1.0', 'Auto-balance sliders to 1.0 while dragging')}</span>
              </label>

              {weightCustomizedCount > 0 && (
                <Button variant="ghost" size="xs" onClick={resetWeights}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{t('恢复默认', 'Reset defaults')}</span>
                </Button>
              )}
            </div>
          </div>

          {/* 3 Weight Sliders */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-primary)]" />
                  <span className="font-medium text-[var(--text-primary)]">
                    {t('排名权重 (rank)', 'Rank Weight (rank)')}
                  </span>
                  <span className="text-[13px] text-[var(--text-muted)]">
                    {t('默认 0.60 · 偏重榜首高排位', 'Default 0.60 · Favors top positions')}
                  </span>
                </div>
                <span className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                  {wRank.toFixed(2)}
                </span>
              </div>
              <Slider
                value={wRank}
                onValueChange={(v) => handleWeightChange('rank', v)}
                min={0}
                max={1}
                step={0.05}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                  <span className="font-medium text-[var(--text-primary)]">
                    {t('频次权重 (frequency)', 'Frequency Weight (frequency)')}
                  </span>
                  <span className="text-[13px] text-[var(--text-muted)]">
                    {t('默认 0.30 · 偏重持续霸榜话题', 'Default 0.30 · Favors persistent topics')}
                  </span>
                </div>
                <span className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                  {wFreq.toFixed(2)}
                </span>
              </div>
              <Slider
                value={wFreq}
                onValueChange={(v) => handleWeightChange('frequency', v)}
                min={0}
                max={1}
                step={0.05}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-violet)]" />
                  <span className="font-medium text-[var(--text-primary)]">
                    {t('高排名热度权重 (hotness)', 'Hotness Weight (hotness)')}
                  </span>
                  <span className="text-[13px] text-[var(--text-muted)]">
                    {t('默认 0.10 · 进入前 {v0} 名占比', 'Default 0.10 · Share inside top {v0}', { v0: rankThreshold })}
                  </span>
                </div>
                <span className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                  {wHot.toFixed(2)}
                </span>
              </div>
              <Slider
                value={wHot}
                onValueChange={(v) => handleWeightChange('hotness', v)}
                min={0}
                max={1}
                step={0.05}
              />
            </div>
          </div>
        </div>
      </AdvancedCollapsible>
    </SectionShell>
  )
}
