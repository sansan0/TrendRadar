import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ExternalLink,
  Eye,
  Info,
  Maximize2,
  Monitor,
  PanelRight,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react'
import { Badge, Button, InfoTooltip } from '@/components/ui/primitives'
import { useT } from '@/i18n'
import { buildTrendRadarPreview } from '@/lib/preview-engine'
import type { PreviewRegionId } from '@/lib/preview-html-renderer'
import { cn } from '@/lib/utils'
import { useEditor } from '@/store/editor-store'

const REGION_LABEL_MAP: Record<PreviewRegionId, { zh: string; en: string }> = {
  hotlist: { zh: '热榜筛选', en: 'Hotlist' },
  rss: { zh: 'RSS 订阅', en: 'RSS' },
  web_search: { zh: '联网搜索', en: 'Web Search' },
  new_items: { zh: '新增热点', en: 'New Items' },
  standalone: { zh: '独立展示', en: 'Standalone' },
  ai_analysis: { zh: 'AI 分析', en: 'AI Analysis' },
}

const MODE_LABEL_MAP: Record<'daily' | 'current' | 'incremental', { zh: string; en: string }> = {
  daily: { zh: '当日汇总', en: 'Daily' },
  current: { zh: '当前榜单', en: 'Current' },
  incremental: { zh: '增量监控', en: 'Incremental' },
}

export function ReportPreviewPanel() {
  const {
    files,
    lang,
    theme,
    previewMode,
    setPreviewMode,
    applyQuickFix,
    jumpToSource,
    notify,
  } = useEditor()
  const t = useT()

  const [wideMode, setWideMode] = useState(true)
  const [dockedWidth, setDockedWidth] = useState(560)
  const [resizing, setResizing] = useState(false)
  const blobUrlRef = useRef<string | null>(null)

  const reportDarkMode = theme === 'dark'
  const deferredFiles = useDeferredValue(files)

  // Escape closes full modal preview cleanly
  useEffect(() => {
    if (previewMode !== 'modal') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setPreviewMode('closed')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewMode, setPreviewMode])

  // Draggable left border resize for right-docked split preview (pointer + mouse support)
  useEffect(() => {
    if (!resizing) return
    const updateWidth = (clientX: number) => {
      const nextWidth = window.innerWidth - clientX + 7
      const maxW = Math.min(1120, Math.floor(window.innerWidth * 0.72))
      const minW = 360
      setDockedWidth(Math.max(minW, Math.min(maxW, nextWidth)))
    }
    const onPointerMove = (e: PointerEvent) => updateWidth(e.clientX)
    const onMouseMove = (e: MouseEvent) => updateWidth(e.clientX)
    const onUp = () => setResizing(false)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('pointercancel', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizing])

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [])

  const isDocked = previewMode === 'docked'
  const effectiveWideMode = isDocked ? false : wideMode

  const preview = useMemo(() => {
    if (previewMode === 'closed') return null
    return buildTrendRadarPreview(deferredFiles, {
      lang,
      wideMode: effectiveWideMode,
      darkMode: reportDarkMode,
    })
  }, [previewMode, deferredFiles, lang, effectiveWideMode, reportDarkMode])

  if (previewMode === 'closed' || !preview) return null

  const { summary } = preview
  const modeLabel = MODE_LABEL_MAP[summary.mode]
  const activeRegionLabels = summary.activeRegions.map((id) =>
    t(REGION_LABEL_MAP[id].zh, REGION_LABEL_MAP[id].en),
  )

  const handleOpenInNewTab = () => {
    try {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      const tabHtml = isDocked
        ? buildTrendRadarPreview(deferredFiles, {
            lang,
            wideMode,
            darkMode: reportDarkMode,
          }).html
        : preview.html
      const blob = new Blob([tabHtml], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      blobUrlRef.current = url
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      notify(t('浏览器拦截了新窗口，请允许当前站点弹出窗口后重试', 'Popup blocked — please allow popups for this site'), 'warning')
    }
  }

  const chromeHeader = (
    <div className="shrink-0 border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
      {/* Row 1: Single-Line Header (Docked keeps only Live badge on left + actions on far right) */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          {!isDocked && (
            <>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-primary)]">
                <Eye className="h-4 w-4" />
              </span>
              <h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                {t('桌面端 HTML 报告预览', 'Desktop HTML Report Preview')}
              </h2>
            </>
          )}
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-teal-500/25 bg-teal-500/10 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-300">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            <span>{t('实时同步', 'Live')}</span>
          </span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {/* Desktop Wide vs Narrow Email Layout Toggle (Modal view only; docked view resizes directly via drag) */}
          {!isDocked && (
            <div
              role="group"
              aria-label={t('报告版面宽度', 'Report layout width')}
              className="inline-flex shrink-0 items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-0.5"
            >
              <button
                type="button"
                onClick={() => setWideMode(true)}
                aria-pressed={wideMode}
                title={t('桌面端宽屏版面（1200px 双栏）', 'Desktop wide layout (1200px)')}
                className={cn(
                  'tr-focus-ring inline-flex h-6.5 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
                  wideMode
                    ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] shadow-[var(--shadow-xs)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                )}
              >
                <Monitor className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('宽屏', 'Wide')}</span>
              </button>
              <button
                type="button"
                onClick={() => setWideMode(false)}
                aria-pressed={!wideMode}
                title={t('邮件 / 窄屏版面（600px 单栏）', 'Narrow / email layout (600px)')}
                className={cn(
                  'tr-focus-ring inline-flex h-6.5 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
                  !wideMode
                    ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] shadow-[var(--shadow-xs)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                )}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('窄屏', 'Narrow')}</span>
              </button>
            </div>
          )}

          {/* Window Actions: Always Pinned to Far Right on the Same Row */}
          {isDocked ? (
            <Button
              variant="outline"
              size="xs"
              onClick={() => setPreviewMode('modal')}
              title={t('展开为居中大屏预览（完整 1200px 桌面视野）', 'Expand to full desktop modal preview')}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>{t('大图', 'Expand')}</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="xs"
              onClick={() => setPreviewMode('docked')}
              title={t('固定到右侧分栏，边修改配置边看 HTML 报告实时变化', 'Dock to right side for side-by-side live editing')}
            >
              <PanelRight className="h-3.5 w-3.5" />
              <span>{t('边改边看', 'Dock Right')}</span>
            </Button>
          )}

          {/* Open in New Browser Tab */}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleOpenInNewTab}
            title={t('在新标签页中以独立完整页面打开预览', 'Open full preview in a new browser tab')}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className={isDocked ? 'inline' : 'hidden md:inline'}>
              {t('新窗口', 'New Tab')}
            </span>
          </Button>

          {/* Close */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7.5 w-7.5"
            onClick={() => setPreviewMode('closed')}
            aria-label={t('关闭预览', 'Close preview')}
            title={t('关闭预览 (Esc)', 'Close preview (Esc)')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Row 2: Live Config Readout Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-default)] bg-[var(--bg-subtle)]/65 px-3.5 py-1.5 text-xs sm:px-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="brand">{t(modeLabel.zh, modeLabel.en)}</Badge>
          <Badge tone="neutral">
            {summary.displayMode === 'platform'
              ? t('按平台分组', 'By Platform')
              : t('按关键词分组', 'By Keyword')}
          </Badge>
          <Badge tone="neutral">
            {summary.filterMethod === 'ai' ? t('AI 筛选', 'AI Filter') : t('关键词规则', 'Keywords')}
          </Badge>
          <InfoTooltip
            content={
              activeRegionLabels.length > 0
                ? t('当前生效板块顺序：{v0}', 'Active section order: {v0}', { v0: activeRegionLabels.join(' → ') })
                : t('当前未启用任何可展示内容板块', 'No visible content sections enabled')
            }
          >
            <span className="cursor-help">
              <Badge tone="outline">
                {t('展示 {v0} 个板块', '{v0} sections', { v0: summary.activeRegions.length })}
              </Badge>
            </span>
          </InfoTooltip>
          {summary.aiEnabled && (
            <Badge tone="success">
              <Sparkles className="h-3 w-3" />
              <span>{t('AI 分析', 'AI Insights')}</span>
            </Badge>
          )}
          {summary.translationEnabled && (
            <Badge tone="outline">{t('AI 翻译', 'AI Translate')}</Badge>
          )}
        </div>

        <span className="text-[11px] text-[var(--text-muted)]">
          {t('以下均为模拟示例数据（非真实抓取） · 热榜 {v0} · RSS {v1} · 搜索 {v2}', 'Simulated mock data (not live crawl) · Hotlist {v0} · RSS {v1} · Search {v2}', { v0: summary.hotlistCount, v1: summary.rssCount, v2: summary.searchCount })}
        </span>
      </div>

      {/* Contextual Notice: YAML Parse Error */}
      {summary.configErrorMessage && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-800 dark:text-amber-200">
          <span className="flex items-center gap-1.5 min-w-0">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="truncate">
              {t(
                'config.yaml 存在语法错误，预览暂按默认回退渲染：',
                'YAML syntax error in config.yaml — rendering fallback preview: ',
              )}
              {summary.configErrorMessage}
            </span>
          </span>
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              setPreviewMode('closed')
              jumpToSource('config.yaml')
            }}
          >
            {t('定位源码修复', 'Fix in YAML')}
          </Button>
        </div>
      )}

      {/* Contextual Notice: HTML output currently disabled in storage.formats.html */}
      {!summary.htmlFormatEnabled && !summary.configErrorMessage && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--brand-border)] bg-[var(--brand-soft)]/60 px-4 py-1.5 text-xs text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5 min-w-0">
            <Info className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" />
            <span>
              {t(
                '当前配置已关闭 HTML 报告输出（storage.formats.html: false），此处仅供预览样式效果。',
                'HTML output is currently disabled (storage.formats.html: false); preview shown for reference.',
              )}
            </span>
          </span>
          <Button
            size="xs"
            variant="primary"
            onClick={() => applyQuickFix('enable_html_format')}
          >
            {t('立即开启 HTML 输出', 'Enable HTML Output')}
          </Button>
        </div>
      )}
    </div>
  )

  const iframeCanvas = (
    <div
      className={cn(
        'relative min-h-0 flex-1 overflow-hidden',
        reportDarkMode ? 'bg-[#0f172a]' : 'bg-[#fafafa]',
      )}
    >
      {resizing && <div className="absolute inset-0 z-20 cursor-col-resize" />}
      <iframe
        data-preview-iframe="true"
        title={t('TrendRadar 桌面端 HTML 报告实时预览', 'TrendRadar Desktop HTML Report Live Preview')}
        srcDoc={preview.html}
        sandbox="allow-scripts allow-popups allow-downloads"
        className="block h-full w-full border-0 bg-transparent"
      />
    </div>
  )

  if (isDocked) {
    return (
      <aside
        aria-label={t('实时 HTML 报告侧边预览', 'Live HTML report preview panel')}
        style={{ width: `${dockedWidth}px` }}
        className="fixed right-0 top-14 z-[1050] flex h-[calc(100dvh-3.5rem)] max-w-[92vw] flex-row bg-[var(--bg-elevated)] shadow-2xl xl:relative xl:top-0 xl:z-auto xl:h-full xl:max-w-[72vw] xl:shrink-0 xl:shadow-none"
      >
        {/* Dedicated Split Resize Rail — physically separated from left pane scrollbar */}
        <div
          role="separator"
          data-preview-resize-rail="true"
          aria-orientation="vertical"
          tabIndex={0}
          aria-valuemin={360}
          aria-valuemax={1120}
          aria-valuenow={dockedWidth}
          aria-label={t('拖动调整实时预览宽度', 'Drag to resize live preview')}
          onPointerDown={(e) => {
            e.preventDefault()
            setResizing(true)
          }}
          onMouseDown={(e) => {
            e.preventDefault()
            setResizing(true)
          }}
          onDoubleClick={() => setDockedWidth(560)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault()
              setDockedWidth((w) => Math.min(1120, w + 32))
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              setDockedWidth((w) => Math.max(360, w - 32))
            }
          }}
          title={t('按住左右拖动调整预览宽度 · 双击重置', 'Drag left/right to resize preview · Double-click to reset')}
          className={cn(
            'group tr-focus-ring relative z-30 flex w-3.5 shrink-0 cursor-col-resize items-center justify-center border-l border-r border-[var(--border-default)] bg-[var(--bg-subtle)]/80 touch-none select-none transition-colors hover:border-[var(--brand-border)] hover:bg-[var(--brand-soft)]/80',
            resizing && 'border-[var(--brand-border)] bg-[var(--brand-soft)]',
          )}
        >
          <div className="flex flex-col items-center gap-1" aria-hidden="true">
            <span
              className={cn(
                'h-1 w-1 rounded-full transition-colors',
                resizing ? 'bg-[var(--brand-primary)]' : 'bg-[var(--border-strong)] group-hover:bg-[var(--brand-primary)]',
              )}
            />
            <span
              className={cn(
                'h-4 w-[3px] rounded-full transition-all group-hover:h-6',
                resizing ? 'h-8 bg-[var(--brand-primary)]' : 'bg-[var(--border-strong)]/85 group-hover:bg-[var(--brand-primary)]',
              )}
            />
            <span
              className={cn(
                'h-1 w-1 rounded-full transition-colors',
                resizing ? 'bg-[var(--brand-primary)]' : 'bg-[var(--border-strong)] group-hover:bg-[var(--brand-primary)]',
              )}
            />
          </div>
        </div>

        <div className="@container/preview flex min-h-0 min-w-0 flex-1 flex-col">
          {chromeHeader}
          {iframeCanvas}
        </div>
      </aside>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('桌面端 HTML 报告实时预览', 'Desktop HTML Report Live Preview')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setPreviewMode('closed')
      }}
      className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/55 p-2.5 backdrop-blur-[2px] sm:p-5"
    >
      <div className="flex h-[min(92vh,940px)] w-[min(96vw,1380px)] flex-col overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-2xl">
        {chromeHeader}
        {iframeCanvas}
      </div>
    </div>
  )
}
