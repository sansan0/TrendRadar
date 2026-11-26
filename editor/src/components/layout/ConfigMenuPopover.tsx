import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, CloudDownload, Download, Layers, Save, Upload } from 'lucide-react'
import { Popover, PopoverPanel, PopoverTrigger } from '@/components/ui/primitives'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { useEditor } from '@/store/editor-store'

export function ConfigMenuPopover({
  variant = 'topbar',
  collapsed = false,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onBeforeOpen,
  onActionSelect,
}: {
  variant?: 'topbar' | 'sidenav'
  collapsed?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onBeforeOpen?: () => void
  onActionSelect?: () => void
}) {
  const { dirtyFiles, issues, openImportDialog, setExportOpen, setVersionsOpen, snapshots } = useEditor()
  const t = useT()

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = (next: boolean) => {
    if (controlledOnOpenChange) controlledOnOpenChange(next)
    else setUncontrolledOpen(next)
  }

  const closeTimerRef = useRef<number | null>(null)

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const openMenu = () => {
    clearCloseTimer()
    onBeforeOpen?.()
    setOpen(true)
  }

  const scheduleClose = () => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false)
      closeTimerRef.current = null
    }, 150)
  }

  const closeNow = () => {
    clearCloseTimer()
    setOpen(false)
  }

  useEffect(() => () => clearCloseTimer(), [])

  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warningCount = issues.filter((i) => i.severity === 'warning').length
  const isSideNav = variant === 'sidenav'

  const runAction = (action: () => void) => {
    closeNow()
    action()
    onActionSelect?.()
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        clearCloseTimer()
        if (next) onBeforeOpen?.()
        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>
        {isSideNav ? (
          <button
            type="button"
            data-config-menu-trigger="sidenav"
            onMouseEnter={openMenu}
            onMouseLeave={scheduleClose}
            aria-expanded={open}
            title={t('配置管理：加载最新、导入、导出与保存方案', 'Config management: load latest, import, export, and save setups')}
            aria-label={t('配置管理：加载最新、导入、导出与保存方案', 'Config management: load latest, import, export, and save setups')}
            className={cn(
              'tr-focus-ring group relative inline-flex w-full items-center justify-center rounded-xl border text-xs font-semibold transition-all duration-200 cursor-pointer',
              collapsed ? 'h-9 px-0' : 'gap-1.5 px-2.5 py-2',
              open
                ? '-translate-y-px border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-[0_8px_18px_-6px_rgba(48,125,167,0.5)]'
                : 'border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:-translate-y-px hover:border-[var(--brand-primary)]/55 hover:bg-[var(--brand-soft)] hover:text-[var(--brand-primary)] hover:shadow-[0_6px_14px_-6px_rgba(48,125,167,0.32)]',
            )}
          >
            <Layers
              className={cn(
                'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                open ? 'scale-105 text-white' : 'text-[var(--brand-primary)]/80 group-hover:scale-110 group-hover:text-[var(--brand-primary)]',
              )}
            />
            {!collapsed && (
              <>
                <span>{t('配置', 'Config')}</span>
                {dirtyFiles.length > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none tabular-nums transition-colors',
                      open
                        ? 'bg-white/22 text-white'
                        : 'bg-[var(--brand-soft)] text-[var(--brand-primary)] group-hover:bg-[var(--brand-primary)] group-hover:text-white',
                    )}
                  >
                    {dirtyFiles.length}
                  </span>
                )}
                <ChevronUp
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                    open ? 'rotate-180 opacity-95' : 'opacity-60 group-hover:-translate-y-0.5 group-hover:opacity-100',
                  )}
                />
              </>
            )}
            {(errorCount > 0 || warningCount > 0) && (
              <span
                className={cn(
                  'pointer-events-none absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2',
                  open ? 'ring-[var(--brand-primary)]' : 'ring-[var(--bg-base)]',
                  errorCount > 0 ? 'bg-red-500' : 'bg-amber-400',
                )}
              />
            )}
          </button>
        ) : (
          <button
            type="button"
            data-config-menu-trigger="topbar"
            onMouseEnter={openMenu}
            onMouseLeave={scheduleClose}
            aria-expanded={open}
            aria-label={t('配置管理：加载最新、导入、导出与保存方案', 'Config management: load latest, import, export, and save setups')}
            className={cn(
              'tr-focus-ring relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium whitespace-nowrap text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] cursor-pointer',
              open && 'bg-[var(--bg-muted)] text-[var(--text-primary)]',
            )}
          >
            <Layers className="h-4 w-4 shrink-0" />
            <span className="hidden md:inline">{t('配置', 'Config')}</span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 transition-transform duration-180',
                open && 'rotate-180',
              )}
            />
            {(errorCount > 0 || warningCount > 0) && (
              <span
                className={cn(
                  'pointer-events-none absolute right-0.5 top-0.5 h-2 w-2 rounded-full ring-2 ring-[var(--nav-bg)]',
                  errorCount > 0 ? 'bg-red-500' : 'bg-amber-400',
                )}
              />
            )}
          </button>
        )}
      </PopoverTrigger>
      <PopoverPanel
        side={isSideNav ? 'top' : 'bottom'}
        align={isSideNav ? 'start' : 'end'}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className={cn(
          'relative w-[280px] overflow-visible p-1.5',
          isSideNav
            ? "after:absolute after:-bottom-3 after:left-0 after:right-0 after:h-3 after:content-['']"
            : "before:absolute before:-top-3 before:left-0 before:right-0 before:h-3 before:content-['']",
        )}
      >
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => runAction(() => openImportDialog('remote'))}
            className="tr-focus-ring group flex w-full items-start gap-2.5 rounded-xl border border-transparent px-2.5 py-2 text-left transition-all duration-150 hover:border-[var(--brand-border)] hover:bg-[var(--brand-soft)]/70 cursor-pointer"
          >
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-primary)] transition-colors duration-150 group-hover:bg-[var(--brand-primary)] group-hover:text-white">
              <CloudDownload className="h-3.5 w-3.5" />
            </span>
            <span className="grid min-w-0 gap-0.5">
              <strong className="truncate text-[13px] font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--brand-primary)]">
                {t('加载官网最新配置', 'Load Official Latest')}
              </strong>
              <small className="truncate text-xs text-[var(--text-muted)]">
                {t('从 GitHub / jsDelivr 拉取最新模板', 'Pull latest templates from GitHub / jsDelivr')}
              </small>
            </span>
          </button>

          <button
            type="button"
            onClick={() => runAction(() => openImportDialog('local'))}
            className="tr-focus-ring group flex w-full items-start gap-2.5 rounded-xl border border-transparent px-2.5 py-2 text-left transition-all duration-150 hover:border-[var(--brand-border)] hover:bg-[var(--brand-soft)]/70 cursor-pointer"
          >
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)] transition-colors duration-150 group-hover:bg-[var(--brand-primary)] group-hover:text-white">
              <Upload className="h-3.5 w-3.5" />
            </span>
            <span className="grid min-w-0 gap-0.5">
              <strong className="truncate text-[13px] font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--brand-primary)]">
                {t('导入本地文件', 'Import Local Files')}
              </strong>
              <small className="truncate text-xs text-[var(--text-muted)]">
                {t('上传已有 config.yaml 等配置文件', 'Load existing local config files')}
              </small>
            </span>
          </button>

          <div className="my-1 mx-2 h-px bg-[var(--border-default)]/70" />

          <button
            type="button"
            onClick={() => runAction(() => setExportOpen(true))}
            aria-label={t('导出全部配置', 'Export all configuration')}
            className="tr-focus-ring group flex w-full items-start gap-2.5 rounded-xl border border-transparent px-2.5 py-2 text-left transition-all duration-150 hover:border-[var(--brand-border)] hover:bg-[var(--brand-soft)]/70 cursor-pointer"
          >
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-primary)] transition-colors duration-150 group-hover:bg-[var(--brand-primary)] group-hover:text-white">
              <Download className="h-3.5 w-3.5" />
            </span>
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="flex items-center justify-between gap-2">
                <strong className="truncate text-[13px] font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--brand-primary)]">
                  {t('导出全部配置', 'Export All Files')}
                </strong>
                <span className="inline-flex items-center gap-1.5 shrink-0">
                  {(errorCount > 0 || warningCount > 0) && (
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        errorCount > 0 ? 'bg-red-500' : 'bg-amber-400',
                      )}
                    />
                  )}
                  {dirtyFiles.length > 0 && (
                    <span className="rounded-full bg-[var(--brand-soft)] px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums text-[var(--brand-primary)] group-hover:bg-[var(--brand-primary)] group-hover:text-white transition-colors">
                      {dirtyFiles.length}
                    </span>
                  )}
                </span>
              </span>
              <small className="truncate text-xs text-[var(--text-muted)]">
                {t('打包下载 ZIP、生成 .env 清单并体检', 'Download config.zip, .env & check issues')}
              </small>
            </span>
          </button>

          <button
            type="button"
            onClick={() => runAction(() => setVersionsOpen(true))}
            className="tr-focus-ring group flex w-full items-start gap-2.5 rounded-xl border border-transparent px-2.5 py-2 text-left transition-all duration-150 hover:border-[var(--brand-border)] hover:bg-[var(--brand-soft)]/70 cursor-pointer"
          >
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)] transition-colors duration-150 group-hover:bg-[var(--brand-primary)] group-hover:text-white">
              <Save className="h-3.5 w-3.5" />
            </span>
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="flex items-center justify-between gap-2">
                <strong className="truncate text-[13px] font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--brand-primary)]">
                  {t('保存与切换方案', 'Save & Switch Setups')}
                </strong>
                {snapshots.length > 0 && (
                  <span className="rounded-full bg-[var(--brand-soft)] px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums text-[var(--brand-primary)] group-hover:bg-[var(--brand-primary)] group-hover:text-white transition-colors">
                    {snapshots.length}
                  </span>
                )}
              </span>
              <small className="truncate text-xs text-[var(--text-muted)]">
                {t('存到本机浏览器，随时找回或切换多套方案', 'Save browser snapshots to restore or compare')}
              </small>
            </span>
          </button>
        </div>
      </PopoverPanel>
    </Popover>
  )
}
