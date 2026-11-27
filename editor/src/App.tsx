import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Code2,
  Database,
  Filter,
  HardDrive,
  Info,
  LayoutList,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { TooltipProvider } from '@/components/ui/primitives'
import { BackToTopButton } from '@/components/shared/SharedControls'
import { GuidedSectionOutline } from '@/components/guided/GuidedSectionOutline'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { SideNav } from '@/components/layout/SideNav'
import { SourceDrawer, SourcePanel } from '@/components/layout/SourceDrawer'
import '@/components/layout/pro-workspace.css'
import { ProViewToolbar, ProFileLocation, ProFileFields } from '@/components/layout/ProFilePanel'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { ExportCenterDialog } from '@/components/modals/ExportCenterDialog'
import { ImportSyncDialog } from '@/components/modals/ImportSyncDialog'
import { ReportPreviewPanel } from '@/components/modals/ReportPreviewPanel'
import { VersionsDialog } from '@/components/modals/VersionsDialog'
import { OnboardingSection } from '@/components/sections/OnboardingSection'
import { SourcesSection } from '@/components/sections/SourcesSection'
import { FilterSection } from '@/components/sections/FilterSection'
import { AiSection } from '@/components/sections/AiSection'
import { ReportSection } from '@/components/sections/ReportSection'
import { PushScheduleSection } from '@/components/sections/PushScheduleSection'
import { StorageSystemSection } from '@/components/sections/StorageSystemSection'
import { useT } from '@/i18n'
import type { SectionId } from '@/lib/types'
import { cn } from '@/lib/utils'
import { EditorProvider, useEditor } from '@/store/editor-store'

function ToastStack() {
  const { toasts } = useEditor()
  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-16 right-5 z-[1600] flex flex-col gap-2 max-w-sm">
      {toasts.map((item) => {
        const lines = item.message
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
        const isMultiLine = lines.length > 1

        return (
          <div
            key={item.id}
            className={cn(
              'pointer-events-auto flex gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs font-medium shadow-[var(--shadow-md)] backdrop-blur-md',
              isMultiLine ? 'items-start' : 'items-center',
              item.tone === 'success' &&
                'border-teal-500/30 bg-[var(--bg-elevated)]/95 text-teal-700 dark:text-teal-300',
              item.tone === 'warning' &&
                'border-amber-500/30 bg-[var(--bg-elevated)]/95 text-amber-700 dark:text-amber-300',
              item.tone === 'danger' &&
                'border-red-500/30 bg-[var(--bg-elevated)]/95 text-red-700 dark:text-red-300',
              item.tone === 'default' &&
                'border-[var(--border-default)] bg-[var(--bg-elevated)]/95 text-[var(--text-primary)]',
            )}
          >
            {item.tone === 'success' ? (
              <CheckCircle2 className={cn('h-4 w-4 shrink-0 text-teal-500', isMultiLine && 'mt-0.5')} />
            ) : item.tone === 'warning' ? (
              <AlertTriangle className={cn('h-4 w-4 shrink-0 text-amber-500', isMultiLine && 'mt-0.5')} />
            ) : item.tone === 'danger' ? (
              <ShieldAlert className={cn('h-4 w-4 shrink-0 text-red-500', isMultiLine && 'mt-0.5')} />
            ) : (
              <Info className={cn('h-4 w-4 shrink-0 text-[var(--brand-primary)]', isMultiLine && 'mt-0.5')} />
            )}
            {isMultiLine ? (
              <div className="min-w-0 space-y-0.5 leading-snug">
                <div className="font-semibold">{lines[0]}</div>
                {lines.slice(1).map((sub, idx) => (
                  <div key={idx} className="text-[11px] font-normal opacity-80">
                    {sub}
                  </div>
                ))}
              </div>
            ) : (
              <span className="leading-snug">{item.message}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ActiveSectionView({ activeSection }: { activeSection: SectionId }) {
  return (
    <>
      {activeSection === 'onboarding' && <OnboardingSection />}
      {activeSection === 'sources' && <SourcesSection />}
      {activeSection === 'filter' && <FilterSection />}
      {activeSection === 'ai' && <AiSection />}
      {activeSection === 'report' && <ReportSection />}
      {activeSection === 'push' && <PushScheduleSection />}
      {activeSection === 'storage' && <StorageSystemSection />}
    </>
  )
}

/** Smoothly scrolls the active scroll container to an anchor or top, re-aligning if collapsible content expands */
function useVisualFocusScroll(containerId: string, enabled = true) {
  const { visualFocusTarget } = useEditor()

  useEffect(() => {
    if (!enabled || !visualFocusTarget) return
    const container = document.getElementById(containerId)
    if (!container) return

    if (!visualFocusTarget.anchor || visualFocusTarget.anchor === '__TOP__') {
      container.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const targetId = visualFocusTarget.anchor
    let attempts = 0
    let rafId = 0
    let settleTimer = 0

    const alignToElement = (el: HTMLElement) => {
      const targetTop = container.scrollTop + el.getBoundingClientRect().top - container.getBoundingClientRect().top - 14
      container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
    }

    const tryScroll = () => {
      const el = container.querySelector<HTMLElement>(`#${CSS.escape(targetId)}`)
      if (el) {
        alignToElement(el)
        el.classList.remove('tr-focus-flash')
        void el.offsetWidth
        el.classList.add('tr-focus-flash')
        // Re-align once Collapsible 200ms open transition settles so bottom items are not clipped
        settleTimer = window.setTimeout(() => {
          if (document.body.contains(el)) alignToElement(el)
        }, 220)
        return
      }
      if (attempts < 24) {
        attempts++
        rafId = requestAnimationFrame(tryScroll)
      }
    }

    rafId = requestAnimationFrame(tryScroll)
    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(settleTimer)
    }
  }, [containerId, enabled, visualFocusTarget])
}

const PRO_NAV_ITEMS: Array<{
  id: SectionId
  labelZh: string
  labelEn: string
  icon: typeof Database
}> = [
  { id: 'sources', labelZh: '信息来源', labelEn: 'Sources', icon: Database },
  { id: 'filter', labelZh: '内容筛选', labelEn: 'Filter', icon: Filter },
  { id: 'ai', labelZh: 'AI 增强', labelEn: 'AI', icon: Sparkles },
  { id: 'report', labelZh: '报告版面', labelEn: 'Report', icon: LayoutList },
  { id: 'push', labelZh: '推送定时', labelEn: 'Push & Schedule', icon: BellRing },
  { id: 'storage', labelZh: '存储系统', labelEn: 'Storage', icon: HardDrive },
]

function ProSplitWorkspace() {
  const {
    activeSection,
    selectProSection,
    proSplitRatio,
    setProSplitRatio,
    proView,
    setProView,
    issues,
  } = useEditor()
  const t = useT()

  const containerRef = useRef<HTMLDivElement | null>(null)
  const [draggingSplit, setDraggingSplit] = useState(false)
  const [mobileProTab, setMobileProTab] = useState<'code' | 'visual'>('visual')

  useVisualFocusScroll('studio-pro-visual-scroll', proView === 'features')

  useEffect(() => {
    if (!draggingSplit) return
    const onMove = (e: MouseEvent) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      if (rect.width <= 0) return
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      setProSplitRatio(pct)
    }
    const onUp = () => setDraggingSplit(false)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [draggingSplit, setProSplitRatio])

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] min-h-0 flex-1 flex-col overflow-hidden lg:h-full">
      {/* Mobile / Tablet Code vs Visual Switcher (< lg) */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 lg:hidden">
        <div className="inline-flex w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-0.5">
          <button
            type="button"
            onClick={() => setMobileProTab('code')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium cursor-pointer',
              mobileProTab === 'code'
                ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] shadow-[var(--shadow-xs)]'
                : 'text-[var(--text-muted)]',
            )}
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>{t('左侧源码', 'Source Code')}</span>
          </button>
          <button
            type="button"
            onClick={() => { setMobileProTab('visual'); setProView(proView) }}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium cursor-pointer',
              mobileProTab === 'visual'
                ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] shadow-[var(--shadow-xs)]'
                : 'text-[var(--text-muted)]',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>{t('右侧视觉表单', 'Visual Editor')}</span>
          </button>
        </div>
      </div>

      {/* Main Left-Code / Right-Visual Split Workspace */}
      <div
        ref={containerRef}
        data-mobile-pane={mobileProTab}
        style={{ '--pro-left-width': `${proSplitRatio}%` } as React.CSSProperties}
        className="pro-workspace"
      >
        <SourcePanel embedded />

        {/* Draggable Split Divider (Desktop only) */}
        <div
          role="separator"
          aria-orientation="vertical"
          tabIndex={0}
          aria-valuemin={28}
          aria-valuemax={68}
          aria-valuenow={proSplitRatio}
          onKeyDown={(e) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
            e.preventDefault()
            setProSplitRatio(e.key === 'Home' ? 28 : e.key === 'End' ? 68 : proSplitRatio + (e.key === 'ArrowLeft' ? -2 : 2))
          }}
          aria-label={t('拖动调整代码与可视化面板宽度（双击恢复默认）', 'Drag to resize panes (double-click to reset)')}
          onMouseDown={() => setDraggingSplit(true)}
          onDoubleClick={() => setProSplitRatio(46)}
          title={t('拖动调整左右比例 · 双击重置', 'Drag to resize · Double-click to reset')}
          className={cn(
            'pro-divider tr-focus-ring cursor-col-resize items-center justify-center transition-colors hover:bg-[var(--brand-soft)]',
            draggingSplit && 'bg-[var(--brand-soft)]',
          )}
        >
          <div
            className={cn(
              'relative z-10 h-10 w-[3px] rounded-full transition-colors',
              draggingSplit ? 'bg-[var(--brand-primary)]' : 'bg-[var(--border-strong)]/65',
            )}
          />
        </div>

        {/* Right Pane: Single-Row Aligned Visual Section Strip + Visual Editor */}
        <section className="pro-form-pane">
          <ProViewToolbar />
          {proView === 'file' ? <ProFileLocation /> : (
            <nav aria-label={t('功能模块', 'Features')}
              className="pro-form-navigation no-scrollbar flex h-9 min-w-0 flex-nowrap items-center gap-1 overflow-x-auto border-b border-[var(--border-default)] bg-[var(--bg-subtle)]/70 px-2">
              {PRO_NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const active = activeSection === item.id
                const secIssues = issues.filter((i) => i.section === item.id)
                const hasErr = secIssues.some((i) => i.severity === 'error')
                const hasWarn = secIssues.some((i) => i.severity === 'warning')
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectProSection(item.id)}
                    title={active ? t('再次点击快速回到顶部', 'Click again to scroll to top') : undefined}
                    className={cn(
                      'tr-focus-ring inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-all cursor-pointer',
                      active
                        ? 'bg-[var(--bg-surface)] font-semibold text-[var(--brand-primary)] shadow-[inset_0_0_0_1px_var(--brand-border),var(--shadow-xs)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]/80 hover:text-[var(--text-primary)]',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{t(item.labelZh, item.labelEn)}</span>
                    {hasErr && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                    {!hasErr && hasWarn && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                  </button>
                )
              })}
            </nav>
          )}

          {/* Right Visual Form Scroll Area */}
          <main
            id="studio-pro-visual-scroll"
            className={cn('pro-form-body min-h-0 min-w-0 flex-1 overflow-auto bg-[var(--bg-base)]', proView === 'file' ? 'p-3' : 'px-4 py-5 sm:px-6')}
          >
            {proView === 'file' ? (
              <ProFileFields />
            ) : (
              <ActiveSectionView activeSection={activeSection === 'onboarding' ? 'sources' : activeSection} />
            )}
          </main>
        </section>
      </div>

      {/* Anchored to ProSplitWorkspace (outside display:contents .pro-form-pane) so it stays pinned to visible bottom-right */}
      <BackToTopButton
        containerId="studio-pro-visual-scroll"
        positionMode="pane"
        className={mobileProTab === 'code' ? 'hidden lg:inline-flex' : undefined}
      />
    </div>
  )
}

function StudioWorkspace() {
  const { activeSection, workspaceMode, persistenceError, setExportOpen, previewMode } = useEditor()
  const t = useT()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sideNavHover, setSideNavHover] = useState(false)
  const compactSideNav = previewMode === 'docked'

  useVisualFocusScroll('studio-main-scroll')

  useEffect(() => {
    setSideNavHover(false)
  }, [compactSideNav])

  useEffect(() => {
    const mainEl = document.getElementById('studio-main-scroll')
    if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeSection])

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg-base)] text-[var(--text-primary)] lg:h-dvh">
      <TopNavBar
        mobileNavOpen={mobileNavOpen}
        onToggleMobileNav={() => setMobileNavOpen((o) => !o)}
      />

      <div
        data-workspace-body="true"
        className="flex min-h-0 flex-1 lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden"
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {workspaceMode === 'pro' ? (
            <ProSplitWorkspace />
          ) : (
            <div className="relative mx-auto flex min-h-0 w-full max-w-[1680px] flex-1 lg:h-full">
              {/* Desktop Sidebar (auto-collapses to 60px icon rail in Docked Preview, expands on hover) */}
              <div
                data-sidenav-rail={compactSideNav ? 'compact' : 'expanded'}
                onMouseEnter={() => {
                  if (compactSideNav) setSideNavHover(true)
                }}
                onMouseLeave={() => setSideNavHover(false)}
                onFocusCapture={() => {
                  if (compactSideNav) setSideNavHover(true)
                }}
                onBlurCapture={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setSideNavHover(false)
                  }
                }}
                className={cn(
                  'hidden lg:block relative z-[1040] h-full shrink-0 transition-[width] duration-200 ease-out',
                  compactSideNav ? 'w-[60px]' : 'w-[248px]',
                )}
              >
                <div
                  className={cn(
                    'h-full border-r border-[var(--border-default)] bg-[var(--bg-surface)] transition-[width,box-shadow] duration-200 ease-out',
                    compactSideNav && sideNavHover
                      ? 'absolute left-0 top-0 z-[1060] w-[248px] shadow-2xl'
                      : 'w-full',
                  )}
                >
                  <SideNav collapsed={compactSideNav && !sideNavHover} />
                </div>
              </div>

              {/* Mobile Sidebar Drawer */}
              {mobileNavOpen && (
                <div className="fixed inset-0 top-14 z-[1200] flex lg:hidden">
                  <div
                    className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
                    onClick={() => setMobileNavOpen(false)}
                  />
                  <div className="relative z-10 h-full w-[268px] border-r border-[var(--border-default)] bg-[var(--bg-surface)] shadow-2xl">
                    <SideNav onSelect={() => setMobileNavOpen(false)} />
                  </div>
                </div>
              )}

              {/* Primary Focus Canvas (viewport-locked on lg+ so <main> scrolls internally and BackToTop stays fixed to visible bottom-right) */}
              <div
                data-guided-scroll-pane="true"
                className="relative flex min-h-0 min-w-0 flex-1 flex-col lg:h-full"
              >
                <main
                  id="studio-main-scroll"
                  className={cn(
                    'min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6',
                    compactSideNav ? 'lg:px-6' : 'lg:px-10',
                  )}
                >
                  <ActiveSectionView activeSection={activeSection} />
                </main>

                <GuidedSectionOutline containerId="studio-main-scroll" />
                <BackToTopButton containerId="studio-main-scroll" positionMode="responsive-pane" />
              </div>

              {/* On-Demand Source / Diff Drawer or Split Panel */}
              <SourceDrawer />
            </div>
          )}
        </div>

        {/* Live Desktop HTML Report Preview (Modal or Right-Docked Split — single mounted instance preserves user toggles) */}
        {previewMode !== 'closed' && <ReportPreviewPanel />}
      </div>

      {/* Global Overlays */}
      {persistenceError && (
        <div role="alert" className="fixed bottom-3 left-3 z-[1200] max-w-[calc(100vw-1.5rem)] rounded-xl border border-amber-500/40 bg-[var(--bg-elevated)] p-3 text-sm shadow-lg">
          <p>{t('浏览器未能保存最新草稿，关闭页面前请先导出配置。', 'The latest draft could not be saved. Export your configuration before closing this page.')}</p>
          <button type="button" className="mt-1 cursor-pointer text-[var(--brand-primary)] underline" onClick={() => setExportOpen(true)}>
            {t('导出配置', 'Export configuration')}
          </button>
        </div>
      )}
      <CommandPalette />
      <VersionsDialog />
      <ExportCenterDialog />
      <ImportSyncDialog />
      <ToastStack />
    </div>
  )
}

export default function App() {
  return (
    <TooltipProvider>
      <EditorProvider>
        <StudioWorkspace />
      </EditorProvider>
    </TooltipProvider>
  )
}
