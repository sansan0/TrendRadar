import { useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Columns2,
  Compass,
  Copy,
  ExternalLink,
  Eye,
  FileDiff,
  Globe,
  Handshake,
  Heart,
  MapPinned,
  Menu,
  MessageSquare,
  Moon,
  Radar,
  ScanLine,
  Sparkles,
  Star,
  Sun,
  X,
} from 'lucide-react'
import { Button, InfoTooltip, Popover, PopoverPanel, PopoverTrigger } from '@/components/ui/primitives'
import { ConfigMenuPopover } from '@/components/layout/ConfigMenuPopover'
import { LanguageMenuPopover } from '@/components/layout/LanguageMenuPopover'
import { ChangesDialog } from '@/components/modals/ChangesDialog'
import { GithubBrandIcon, SansanBrandMark, XBrandIcon } from '@/components/shared/SharedControls'
import { toTemplateLang, useT } from '@/i18n'
import {
  getPersonalSupportUrl,
  GITHUB_PROFILE_URL,
  GITHUB_REPO_URL,
  MAO_MAP_REPO_URL,
  MAO_MAP_SITE_URL,
  OFFICIAL_SITE_URL,
  SANDEV_URL,
  SANFRAME_URL,
  X_PROFILE_URL,
} from '@/lib/presets'
import { extractSecrets, sanitizeConfigYaml } from '@/lib/exporter'
import { cn, copyToClipboard } from '@/lib/utils'
import { GUIDED_STEPS, STAGE_FOR_SECTION, stageStyleVars } from '@/lib/workflow-stages'
import { useEditor } from '@/store/editor-store'

export function TopNavBar({
  mobileNavOpen,
  onToggleMobileNav,
}: {
  mobileNavOpen: boolean
  onToggleMobileNav: () => void
}) {
  const {
    lang,
    theme,
    toggleTheme,
    deployMode,
    workspaceMode,
    setWorkspaceMode,
    activeSection,
    files,
    totalChangesCount,
    previewMode,
    togglePreview,
    changesRequest,
    setChangesRequest,
    getActiveCopyFile,
    notify,
  } = useEditor()
  const t = useT()

  const [linksOpen, setLinksOpen] = useState(false)
  const [activeSubmenu, setActiveSubmenu] = useState<'official' | 'github' | null>(null)
  const [configMenuOpen, setConfigMenuOpen] = useState(false)
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [justCopied, setJustCopied] = useState(false)
  const [progressBadgeVisible, setProgressBadgeVisible] = useState(false)
  const [progressRailHover, setProgressRailHover] = useState(false)
  const [progressJumpSeq, setProgressJumpSeq] = useState(0)
  const menuCloseTimerRef = useRef<number | null>(null)
  const subCloseTimerRef = useRef<number | null>(null)
  const progressHideTimerRef = useRef<number | null>(null)

  const guidedStepDef = GUIDED_STEPS.find((s) => s.id === activeSection)
  const guidedStepIndex = guidedStepDef ? guidedStepDef.index : 0
  const guidedProgressPct = guidedStepIndex > 0 ? Math.round((guidedStepIndex / GUIDED_STEPS.length) * 100) : 0
  const guidedStage = STAGE_FOR_SECTION[activeSection]
  const prevStepIndexRef = useRef<number>(guidedStepIndex)

  useEffect(() => {
    if (workspaceMode !== 'guided') {
      prevStepIndexRef.current = guidedStepIndex
      setProgressBadgeVisible(false)
      return
    }
    if (prevStepIndexRef.current !== guidedStepIndex) {
      prevStepIndexRef.current = guidedStepIndex
      if (progressHideTimerRef.current !== null) {
        window.clearTimeout(progressHideTimerRef.current)
        progressHideTimerRef.current = null
      }
      if (guidedStepIndex > 0) {
        setProgressJumpSeq((n) => n + 1)
        setProgressBadgeVisible(true)
        progressHideTimerRef.current = window.setTimeout(() => {
          setProgressBadgeVisible(false)
          progressHideTimerRef.current = null
        }, 2200)
      } else {
        setProgressBadgeVisible(false)
      }
    }
  }, [workspaceMode, guidedStepIndex])

  const clearMenuCloseTimer = () => {
    if (menuCloseTimerRef.current !== null) {
      window.clearTimeout(menuCloseTimerRef.current)
      menuCloseTimerRef.current = null
    }
  }

  const clearSubCloseTimer = () => {
    if (subCloseTimerRef.current !== null) {
      window.clearTimeout(subCloseTimerRef.current)
      subCloseTimerRef.current = null
    }
  }

  const openLinksMenu = () => {
    clearMenuCloseTimer()
    setConfigMenuOpen(false)
    setLangMenuOpen(false)
    setLinksOpen(true)
  }

  const scheduleCloseLinksMenu = () => {
    clearMenuCloseTimer()
    menuCloseTimerRef.current = window.setTimeout(() => {
      setLinksOpen(false)
      setActiveSubmenu(null)
      menuCloseTimerRef.current = null
    }, 150)
  }

  const closeLinksMenuNow = () => {
    clearMenuCloseTimer()
    clearSubCloseTimer()
    setLinksOpen(false)
    setActiveSubmenu(null)
  }

  const openSubmenu = (menu: 'official' | 'github') => {
    clearMenuCloseTimer()
    clearSubCloseTimer()
    setActiveSubmenu(menu)
  }

  const scheduleCloseSubmenu = () => {
    clearSubCloseTimer()
    subCloseTimerRef.current = window.setTimeout(() => {
      setActiveSubmenu(null)
      subCloseTimerRef.current = null
    }, 120)
  }

  useEffect(() => () => {
    clearMenuCloseTimer()
    clearSubCloseTimer()
    if (progressHideTimerRef.current !== null) {
      window.clearTimeout(progressHideTimerRef.current)
    }
  }, [])

  const siteLang = toTemplateLang(lang)
  const langPrefix = siteLang === 'en' ? '/en' : '/zh'
  const homeUrl = siteLang === 'en' ? `${OFFICIAL_SITE_URL}/en/` : `${OFFICIAL_SITE_URL}/`

  const officialSubLinks = [
    {
      key: 'docs',
      label: t('使用文档', 'Documentation'),
      href: `${OFFICIAL_SITE_URL}${langPrefix}/docs/quick-start/`,
      icon: <BookOpen className="h-4 w-4" />,
    },
    {
      key: 'community',
      label: t('社区交流', 'Community'),
      href: `${OFFICIAL_SITE_URL}${langPrefix}/community/`,
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      key: 'sponsors',
      label: t('赞助商', 'Sponsors'),
      href: `${OFFICIAL_SITE_URL}${langPrefix}/sponsors/`,
      icon: <Handshake className="h-4 w-4" />,
    },
    {
      key: 'credits',
      label: t('支持项目', 'Support Project'),
      href: getPersonalSupportUrl(siteLang),
      icon: <Heart className="h-4 w-4" />,
    },
  ]

  const githubSubLinks = [
    {
      key: 'trendradar-repo',
      label: t('TrendRadar 仓库', 'TrendRadar Repo'),
      subtitle: t('当前项目 · 欢迎 Star', 'Current project · Star'),
      href: GITHUB_REPO_URL,
      icon: <Star className="h-4 w-4" />,
      featured: true,
    },
    {
      key: 'trendradar-issues',
      label: t('问题与反馈', 'Issues'),
      href: `${GITHUB_REPO_URL}/issues`,
      icon: <CircleDot className="h-4 w-4" />,
    },
  ]

  const otherDestinations: Array<{
    key: string
    title: string
    host: string
    hoverHint: string
    tooltip?: React.ReactNode
    href: string
    icon: React.ReactNode
  }> = [
    {
      key: 'sandev',
      title: t('sansan 的主页', "sansan's Notes"),
      host: 'sandev.cc/notes',
      hoverHint: t('关注作者近况', 'Author updates'),
      tooltip: t(
        '查看作者近期动态、开发随笔与新项目进展',
        'Read recent updates, dev notes, and project progress from sansan',
      ),
      href: `${SANDEV_URL}/${siteLang}/notes/`,
      icon: <Globe className="h-5 w-5" />,
    },
    {
      key: 'sanframe',
      title: t('SanFrame 官网', 'SanFrame site'),
      host: 'ocr.sandev.cc',
      hoverHint: t('了解新软件', 'Explore app'),
      tooltip: (
        <div className="space-y-1.5">
          <div className="font-semibold text-white">
            {t('SanFrame · 剪贴板与资料管理工作台', 'SanFrame · Clipboard & Material Workspace')}
          </div>
          <div className="space-y-1 text-slate-300">
            <div>1. {t('自动归档截图、复制文字与文件，内置标注与离线 OCR。', 'Auto-organizes captures, copied text & files with offline OCR.')}</div>
            <div>2. {t('支持局域网多设备互传及 AI / MCP 资料整理，免费免登录。', 'Supports LAN cross-device transfer and AI/MCP workflows — free & account-free.')}</div>
          </div>
        </div>
      ),
      href: `${SANFRAME_URL}/${siteLang}/`,
      icon: <ScanLine className="h-5 w-5" />,
    },
    {
      key: 'x',
      title: t('X 主页', 'X profile'),
      host: 'x.com/heysandev',
      hoverHint: t('欢迎关注', 'Follow'),
      href: X_PROFILE_URL,
      icon: <XBrandIcon className="h-[18px] w-[18px]" />,
    },
  ]

  const copyTargetFile = getActiveCopyFile()

  const handleQuickCopy = async () => {
    const raw = files[copyTargetFile]
    const sanitizeForGha =
      copyTargetFile === 'config.yaml' &&
      deployMode === 'github_actions' &&
      extractSecrets(raw).length > 0
    const content = sanitizeForGha ? sanitizeConfigYaml(raw) : raw
    const ok = await copyToClipboard(content)
    if (ok) {
      setJustCopied(true)
      notify(
        sanitizeForGha
          ? t(
              '已复制脱敏后的 config.yaml\n可在「配置 → 导出全部配置」查看 GitHub Secrets 清单',
              'Copied sanitized config.yaml\nOpen Config → Export All for the GitHub Secrets list',
            )
          : t('已复制 {v0} 到剪贴板\n可在「配置 → 导出全部配置」打包 ZIP 或脱敏', 'Copied {v0} to clipboard\nOpen Config → Export All for ZIP or sanitization', { v0: copyTargetFile }),
        'success',
      )
      setTimeout(() => setJustCopied(false), 1800)
    }
  }

  return (
    <header className="sticky top-0 z-[1100] h-14 w-full border-b border-[var(--nav-border)] bg-[var(--nav-bg)] backdrop-blur-xl transition-colors">
      <div className="mx-auto flex h-full max-w-[1680px] items-center justify-between gap-2 px-3 sm:px-5 xl:grid xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:gap-3">
        {/* Left Zone: Brand Lockup + Single Clean "导航" Hover Dropdown */}
        <div className="flex items-center gap-2 min-w-0 xl:justify-self-start">
          {workspaceMode === 'guided' && (
            <button
              type="button"
              onClick={onToggleMobileNav}
              className="tr-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] lg:hidden cursor-pointer"
              aria-label={t('切换配置步骤导航', 'Toggle steps menu')}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}

          <a
            href={homeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 no-underline shrink-0"
            title={t('访问 TrendRadar 官网 (trendradar.sandev.cc)', 'Visit TrendRadar Website')}
          >
            <span className="tr-brand-gradient text-[18px] font-bold tracking-[-0.02em]">
              TrendRadar
            </span>
          </a>

          {/* Sansan Creator Signature Badge */}
          <a
            href={`${SANDEV_URL}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative hidden md:inline-grid min-h-[32px] grid-cols-[20px_auto_16px] items-center gap-1.5 rounded-[9px] border border-[rgba(77,168,218,0.16)] bg-[rgba(77,168,218,0.04)] px-1.5 py-1 text-[var(--text-secondary)] no-underline transition-all hover:-translate-y-px hover:border-[rgba(77,168,218,0.32)] hover:bg-[rgba(77,168,218,0.1)] hover:text-[var(--brand-primary)] dark:border-white/10 dark:bg-white/[0.025]"
          >
            <SansanBrandMark className="h-5 w-5" />
            <span className="grid gap-0.5 leading-none">
              <small className="text-[7.5px] font-semibold tracking-[0.09em] opacity-60 uppercase">
                {t('项目来自', 'A PROJECT BY')}
              </small>
              <strong className="text-[11.5px] font-semibold">sansan</strong>
            </span>
            <span className="grid h-4 w-4 place-items-center rounded-[5px] bg-[rgba(77,168,218,0.08)] opacity-65 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="h-2.5 w-2.5" />
            </span>
            <span className="pointer-events-none invisible absolute left-1/2 top-[calc(100%+9px)] z-[1300] grid -translate-x-1/2 -translate-y-1 gap-0.5 rounded-lg border border-white/10 bg-[#0f172a]/95 px-3 py-2 text-slate-100 opacity-0 shadow-xl transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 whitespace-nowrap">
              <strong className="text-xs font-semibold">
                {t('sansan 个人项目与软件主页', "sansan's personal projects and software")}
              </strong>
              <small className="text-xs text-slate-400">sandev.cc</small>
            </span>
          </a>

          <span className="hidden sm:inline-block h-4 w-px bg-[var(--border-default)] mx-0.5" />

          {/* Single Clean "导航" Entry (Hover-to-Open + Click/Keyboard Fallback) with Hover Submenus */}
          <Popover
            open={linksOpen}
            onOpenChange={(o) => {
              clearMenuCloseTimer()
              setLinksOpen(o)
              if (!o) {
                clearSubCloseTimer()
                setActiveSubmenu(null)
              }
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                onMouseEnter={openLinksMenu}
                onMouseLeave={scheduleCloseLinksMenu}
                className={cn(
                  'tr-focus-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13.5px] font-medium whitespace-nowrap text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] cursor-pointer',
                  linksOpen && 'bg-[var(--bg-muted)] text-[var(--text-primary)]',
                )}
                aria-expanded={linksOpen}
              >
                <Compass className="h-4 w-4 shrink-0" />
                <span>{t('导航', 'Links')}</span>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 transition-transform duration-180',
                    linksOpen && 'rotate-180',
                  )}
                />
              </button>
            </PopoverTrigger>
            <PopoverPanel
              align="start"
              onMouseEnter={openLinksMenu}
              onMouseLeave={scheduleCloseLinksMenu}
              onOpenAutoFocus={(e) => e.preventDefault()}
              onCloseAutoFocus={(e) => e.preventDefault()}
              className={cn(
                'relative overflow-visible p-0 transition-[width] duration-150 before:absolute before:-top-3 before:left-0 before:right-0 before:h-3 before:content-[""]',
                activeSubmenu ? 'w-[308px] md:w-[532px]' : 'w-[308px]',
              )}
            >
              <div
                className="flex flex-col overflow-hidden rounded-2xl md:flex-row"
                onMouseLeave={scheduleCloseSubmenu}
              >
                {/* Primary Column */}
                <div className="w-full p-2 md:w-[292px] shrink-0">
                  <div className="space-y-0.5">
                    {/* Featured 1: TrendRadar Official Site (expands connected right submenu on hover) */}
                    <div>
                      <div
                        onMouseEnter={() => openSubmenu('official')}
                        className={cn(
                          'group grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors',
                          activeSubmenu === 'official'
                            ? 'bg-[var(--brand-soft)] text-[var(--brand-primary)]'
                            : 'hover:bg-[var(--bg-muted)]/75',
                        )}
                      >
                        <a
                          href={homeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={closeLinksMenuNow}
                          className="contents no-underline text-inherit"
                        >
                          <span className="grid h-5 w-5 place-items-center text-[var(--brand-primary)]">
                            <Radar className="h-5 w-5" />
                          </span>
                          <span className="grid min-w-0 gap-0.5">
                            <strong className="truncate text-[13.5px] font-semibold leading-snug text-[var(--text-primary)]">
                              {t('TrendRadar 官网', 'TrendRadar Website')}
                            </strong>
                            <small className="truncate text-xs leading-snug text-[var(--text-muted)]">
                              trendradar.sandev.cc
                            </small>
                          </span>
                        </a>
                        <button
                          type="button"
                          onClick={() => setActiveSubmenu((v) => (v === 'official' ? null : 'official'))}
                          className={cn(
                            'inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors cursor-pointer',
                            activeSubmenu === 'official'
                              ? 'bg-[var(--bg-surface)]/80 text-[var(--brand-primary)]'
                              : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--brand-primary)]',
                          )}
                          aria-label={t('展开官网子页面', 'Toggle website submenu')}
                        >
                          <ChevronRight
                            className={cn(
                              'h-4 w-4 transition-transform',
                              activeSubmenu === 'official' && 'rotate-90 md:rotate-0',
                            )}
                          />
                        </button>
                      </div>

                      {/* Mobile Inline Submenu: Official Site */}
                      {activeSubmenu === 'official' && (
                        <div className="mt-1 space-y-0.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/70 p-1.5 md:hidden">
                          {officialSubLinks.map((sub) => (
                            <a
                              key={sub.key}
                              href={sub.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={closeLinksMenuNow}
                              className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[var(--text-primary)] no-underline hover:bg-[var(--bg-surface)]"
                            >
                              <span className="flex items-center gap-2">
                                <span className="text-[var(--brand-primary)]">{sub.icon}</span>
                                <span>{sub.label}</span>
                              </span>
                              <ExternalLink className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Featured 2: GitHub Profile (right below Official Site; expands current project repo submenu on hover) */}
                    <div>
                      <div
                        onMouseEnter={() => openSubmenu('github')}
                        className={cn(
                          'group grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors',
                          activeSubmenu === 'github'
                            ? 'bg-[var(--brand-soft)] text-[var(--brand-primary)]'
                            : 'hover:bg-[var(--bg-muted)]/75',
                        )}
                      >
                        <a
                          href={GITHUB_PROFILE_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={closeLinksMenuNow}
                          className="contents no-underline text-inherit"
                        >
                          <span
                            className={cn(
                              'grid h-5 w-5 place-items-center transition-colors',
                              activeSubmenu === 'github'
                                ? 'text-[var(--brand-primary)]'
                                : 'text-[var(--text-primary)] group-hover:text-[var(--brand-primary)]',
                            )}
                          >
                            <GithubBrandIcon className="h-5 w-5" />
                          </span>
                          <span className="grid min-w-0 gap-0.5">
                            <strong className="truncate text-[13.5px] font-semibold leading-snug text-[var(--text-primary)]">
                              {t('GitHub 主页', 'GitHub profile')}
                            </strong>
                            <small className="truncate text-xs leading-snug text-[var(--text-muted)]">
                              github.com/sansan0
                            </small>
                          </span>
                        </a>
                        <button
                          type="button"
                          onClick={() => setActiveSubmenu((v) => (v === 'github' ? null : 'github'))}
                          className={cn(
                            'inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors cursor-pointer',
                            activeSubmenu === 'github'
                              ? 'bg-[var(--bg-surface)]/80 text-[var(--brand-primary)]'
                              : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--brand-primary)]',
                          )}
                          aria-label={t('展开当前 GitHub 仓库入口', 'Toggle GitHub repository submenu')}
                        >
                          <ChevronRight
                            className={cn(
                              'h-4 w-4 transition-transform',
                              activeSubmenu === 'github' && 'rotate-90 md:rotate-0',
                            )}
                          />
                        </button>
                      </div>

                      {/* Mobile Inline Submenu: Current Project GitHub + mao-map */}
                      {activeSubmenu === 'github' && (
                        <div className="mt-1 space-y-0.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/70 p-1.5 md:hidden">
                          {githubSubLinks.map((sub) => (
                            <a
                              key={sub.key}
                              href={sub.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={closeLinksMenuNow}
                              className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[var(--text-primary)] no-underline hover:bg-[var(--bg-surface)]"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="text-[var(--brand-primary)] shrink-0">{sub.icon}</span>
                                <span className="truncate">{sub.label}</span>
                              </span>
                              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                            </a>
                          ))}
                          <div className="my-1 mx-1.5 h-px bg-[var(--border-default)]/70" />
                          <a
                            href={MAO_MAP_REPO_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={closeLinksMenuNow}
                            className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[var(--text-primary)] no-underline hover:bg-[var(--bg-surface)]"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <MapPinned className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                              <span className="truncate">{t('毛主席足迹地图', "Mao's Footprints Map")}</span>
                            </span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                          </a>
                          <a
                            href={MAO_MAP_SITE_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={closeLinksMenuNow}
                            className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--brand-primary)] no-underline hover:bg-[var(--bg-surface)]"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <Globe className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{t('在线浏览地图', 'Browse Map Online')}</span>
                            </span>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="my-1 h-px bg-[var(--border-default)]/70 mx-2" />

                    {/* Other External Destinations with Gentle Hover Prompts & Tooltips */}
                    {otherDestinations.map((dest) => {
                      const rowLink = (
                        <a
                          key={dest.key}
                          href={dest.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onMouseEnter={scheduleCloseSubmenu}
                          onClick={closeLinksMenuNow}
                          className="group grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl px-2.5 py-2 no-underline transition-colors hover:bg-[var(--bg-muted)]/75"
                        >
                          <span className="grid h-5 w-5 place-items-center text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors">
                            {dest.icon}
                          </span>
                          <span className="grid min-w-0 gap-0.5">
                            <strong className="truncate text-[13.5px] font-semibold leading-snug text-[var(--text-primary)]">
                              {dest.title}
                            </strong>
                            <small className="truncate text-xs leading-snug text-[var(--text-muted)]">
                              {dest.host}
                            </small>
                          </span>
                          <span className="inline-flex items-center gap-1 shrink-0">
                            <span className="max-w-0 overflow-hidden whitespace-nowrap text-[11.5px] font-medium text-[var(--brand-primary)] opacity-0 transition-all duration-150 group-hover:max-w-[96px] group-hover:opacity-100">
                              {dest.hoverHint}
                            </span>
                            <ExternalLink className="h-3.5 w-3.5 text-[var(--text-muted)] opacity-65 group-hover:text-[var(--brand-primary)] group-hover:opacity-100 transition-colors" />
                          </span>
                        </a>
                      )

                      if (dest.tooltip) {
                        return (
                          <InfoTooltip key={dest.key} side="right" content={dest.tooltip}>
                            {rowLink}
                          </InfoTooltip>
                        )
                      }
                      return rowLink
                    })}
                  </div>
                </div>

                {/* Seamlessly Fused Right Secondary Column (Desktop) */}
                {activeSubmenu === 'official' && (
                  <div
                    onMouseEnter={() => openSubmenu('official')}
                    className="hidden md:flex md:w-[236px] shrink-0 flex-col justify-between border-l border-[var(--border-default)] bg-[var(--bg-subtle)]/55 p-2"
                  >
                    <div className="space-y-0.5">
                      {officialSubLinks.map((sub) => (
                        <a
                          key={sub.key}
                          href={sub.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={closeLinksMenuNow}
                          className="group flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 no-underline transition-colors hover:bg-[var(--bg-surface)] hover:shadow-[var(--shadow-xs)]"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="text-[var(--text-muted)] group-hover:text-[var(--brand-primary)] shrink-0 transition-colors">
                              {sub.icon}
                            </span>
                            <span className="truncate text-[13px] font-medium text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors">
                              {sub.label}
                            </span>
                          </span>
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-55 group-hover:text-[var(--brand-primary)] group-hover:opacity-100 transition-all" />
                        </a>
                      ))}
                    </div>

                    <a
                      href={homeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={closeLinksMenuNow}
                      className="mt-2 flex items-center justify-between rounded-lg border border-[var(--border-default)]/80 bg-[var(--bg-surface)]/80 px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] no-underline transition-colors hover:border-[var(--brand-border)] hover:text-[var(--brand-primary)]"
                    >
                      <span>{t('进入官网首页', 'Visit Homepage')}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  </div>
                )}

                {activeSubmenu === 'github' && (
                  <div
                    onMouseEnter={() => openSubmenu('github')}
                    className="hidden md:flex md:w-[236px] shrink-0 flex-col justify-between border-l border-[var(--border-default)] bg-[var(--bg-subtle)]/55 p-2"
                  >
                    <div className="space-y-0.5">
                      {githubSubLinks.map((sub) => (
                        <a
                          key={sub.key}
                          href={sub.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={closeLinksMenuNow}
                          className={cn(
                            'group flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 no-underline transition-colors hover:bg-[var(--bg-surface)] hover:shadow-[var(--shadow-xs)]',
                            sub.featured && 'bg-[var(--bg-surface)]/75',
                          )}
                        >
                          <span className="flex items-start gap-2 min-w-0">
                            <span
                              className={cn(
                                'mt-0.5 shrink-0 transition-colors',
                                sub.featured
                                  ? 'text-[var(--brand-primary)]'
                                  : 'text-[var(--text-muted)] group-hover:text-[var(--brand-primary)]',
                              )}
                            >
                              {sub.icon}
                            </span>
                            <span className="grid min-w-0 gap-0.5">
                              <span className="truncate text-[13px] font-medium text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors">
                                {sub.label}
                              </span>
                              {sub.subtitle && (
                                <small className="truncate text-[11px] leading-snug text-[var(--text-muted)]">
                                  {sub.subtitle}
                                </small>
                              )}
                            </span>
                          </span>
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-55 group-hover:text-[var(--brand-primary)] group-hover:opacity-100 transition-all" />
                        </a>
                      ))}

                      <div className="my-1.5 mx-1.5 h-px bg-[var(--border-default)]/70" />

                      {/* Sibling Open-Source Project: Mao's Footprints Map (Repo + Live Map Page + Hover Intro) */}
                      <InfoTooltip
                        side="right"
                        content={
                          <div className="space-y-1.5">
                            <div className="font-semibold text-white">
                              {t('毛主席足迹地图 · 1893–1976 历史轨迹', "Chairman Mao's Footprints Map · 1893–1976")}
                            </div>
                            <div className="space-y-1 text-slate-300">
                              <div>1. {t('交互式动态时间轴呈现 83 年足迹，点击地标可查看事件详情与路线高亮。', 'Interactive timeline map tracing 83 years of journeys, events & highlighted routes.')}</div>
                              <div>2. {t('网页打开即可直接浏览，亦开源提供桌面端与移动端客户端。', 'Browse directly online or explore open-source desktop & mobile builds.')}</div>
                            </div>
                          </div>
                        }
                      >
                        <div className="rounded-xl border border-[var(--border-default)]/70 bg-[var(--bg-surface)]/75 p-1 transition-colors hover:border-[var(--brand-border)] hover:bg-[var(--bg-surface)]">
                          <a
                            href={MAO_MAP_REPO_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={closeLinksMenuNow}
                            className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 no-underline transition-colors hover:bg-[var(--bg-subtle)]"
                          >
                            <span className="flex items-start gap-2 min-w-0">
                              <span className="mt-0.5 shrink-0 text-[var(--brand-primary)]">
                                <MapPinned className="h-4 w-4" />
                              </span>
                              <span className="grid min-w-0 gap-0.5">
                                <span className="truncate text-[13px] font-medium text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors">
                                  {t('毛主席足迹地图', "Mao's Footprints Map")}
                                </span>
                                <small className="truncate text-[11px] leading-snug text-[var(--text-muted)]">
                                  sansan0/mao-map
                                </small>
                              </span>
                            </span>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-55 group-hover:text-[var(--brand-primary)] group-hover:opacity-100 transition-all" />
                          </a>
                          <a
                            href={MAO_MAP_SITE_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={closeLinksMenuNow}
                            className="mt-0.5 flex items-center justify-between gap-1.5 rounded-lg bg-[var(--brand-soft)]/55 px-2 py-1 text-[11.5px] font-medium text-[var(--brand-primary)] no-underline transition-colors hover:bg-[var(--brand-soft)]"
                          >
                            <span className="inline-flex items-center gap-1.5 truncate">
                              <Globe className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{t('在线浏览地图', 'Browse Map Online')}</span>
                            </span>
                            <ArrowUpRight className="h-3 w-3 shrink-0" />
                          </a>
                        </div>
                      </InfoTooltip>
                    </div>

                    <a
                      href={GITHUB_PROFILE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={closeLinksMenuNow}
                      className="mt-2 flex items-center justify-between rounded-lg border border-[var(--border-default)]/80 bg-[var(--bg-surface)]/80 px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] no-underline transition-colors hover:border-[var(--brand-border)] hover:text-[var(--brand-primary)]"
                    >
                      <span>{t('进入 GitHub 主页', 'Visit GitHub Profile')}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  </div>
                )}
              </div>
            </PopoverPanel>
          </Popover>
        </div>

        {/* Center Zone: Fixed-Anchor Workspace Mode Switcher (Zero layout shift between Guided & Pro) */}
        <div className="mr-auto shrink-0 xl:mr-0 xl:justify-self-center">
          <div
            role="group"
            aria-label={t('工作台模式切换', 'Workspace mode switcher')}
            className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-0.5"
          >
            <button
              type="button"
              onClick={() => workspaceMode !== 'guided' && setWorkspaceMode('guided')}
              aria-pressed={workspaceMode === 'guided'}
              title={t('引导模式：按步骤带你快速配好常用功能', 'Guided Mode: Step-by-step setup')}
              className={cn(
                'tr-focus-ring inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-all cursor-pointer',
                workspaceMode === 'guided'
                  ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] shadow-[var(--shadow-xs)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
              )}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{t('引导', 'Guided')}</span>
            </button>
            <button
              type="button"
              onClick={() => workspaceMode !== 'pro' && setWorkspaceMode('pro')}
              aria-pressed={workspaceMode === 'pro'}
              title={t('专业模式：左边看配置文件、右边点选修改，两边实时同步', 'Pro Mode: Side-by-side source code & visual settings')}
              className={cn(
                'tr-focus-ring inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-all cursor-pointer',
                workspaceMode === 'pro'
                  ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] shadow-[var(--shadow-xs)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
              )}
            >
              <Columns2 className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{t('专业', 'Pro')}</span>
            </button>
          </div>
        </div>

        {/* Right Zone: Workflow Actions (Pro keeps Config Menu in TopNavBar; Guided moves Config Menu to SideNav) */}
        <div className="flex items-center gap-1.5 shrink-0 xl:justify-self-end">
          {workspaceMode === 'pro' && (
            <ConfigMenuPopover
              variant="topbar"
              open={configMenuOpen}
              onOpenChange={setConfigMenuOpen}
              onBeforeOpen={() => {
                closeLinksMenuNow()
                setLangMenuOpen(false)
              }}
            />
          )}

          {/* Direct Action 1: Live Desktop HTML Report Preview */}
          <Button
            variant={previewMode !== 'closed' ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(
              'gap-1.5 px-2',
              previewMode !== 'closed' && 'text-[var(--brand-primary)]',
            )}
            onClick={togglePreview}
            aria-pressed={previewMode !== 'closed'}
            title={t('实时预览当前配置生成的桌面端 HTML 报告效果', 'Live preview desktop HTML report for current config')}
            aria-label={t('实时预览报告效果', 'Live report preview')}
          >
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">{t('预览', 'Preview')}</span>
            {previewMode === 'docked' && (
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            )}
          </Button>

          {/* Direct Action 2: Changes & Restore (No dropdown needed) */}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 px-2"
            onClick={() => setChangesRequest({})}
            title={t('查看改动了什么，可随时改回默认设置', 'See what changed and restore defaults anytime')}
            aria-label={totalChangesCount > 0
              ? t('改动与恢复，共 {v0} 项改动', 'Changes and restore, {v0} change(s)', { v0: totalChangesCount })
              : t('我的改动与恢复', 'My changes and restore')}
          >
            <FileDiff className="h-4 w-4" />
            <span className="sm:hidden">{t('改动', 'Changes')}</span>
            <span className="hidden sm:inline">{t('改动与恢复', 'Changes & restore')}</span>
            {totalChangesCount > 0 && (
              <span className="rounded-full bg-[var(--brand-soft)] px-1.5 text-xs font-semibold tabular-nums text-[var(--brand-primary)]">
                {totalChangesCount}
              </span>
            )}
          </Button>

          {/* Direct Primary Action: Clean Single Copy CTA (Identical in Guided & Pro — Zero Shift) */}
          <button
            type="button"
            onClick={() => void handleQuickCopy()}
            title={t('一键复制当前文件 ({v0})', 'Copy {v0}', { v0: copyTargetFile })}
            className="tr-focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-3 text-xs font-medium text-white whitespace-nowrap shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--brand-primary-hover)] cursor-pointer"
          >
            {justCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">
              {justCopied ? t('已复制', 'Copied') : t('复制', 'Copy')}
            </span>
          </button>

          <span className="hidden sm:inline-block h-4 w-px bg-[var(--border-default)] mx-0.5" />

          {/* Language Switch (Hover-to-open 2-column selector with live localized subtitles) */}
          <LanguageMenuPopover
            open={langMenuOpen}
            onOpenChange={setLangMenuOpen}
            onBeforeOpen={() => {
              closeLinksMenuNow()
              setConfigMenuOpen(false)
            }}
          />

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={t(theme === 'dark' ? '切换浅色模式' : '切换深色模式', 'Toggle theme')}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {/* Full-width Guided Step Progress Rail pinned to the bottom edge of TopNavBar */}
      {workspaceMode === 'guided' && (
        <div
          data-topnav-progress="true"
          data-progress-pct={guidedProgressPct}
          data-stage={guidedStage}
          style={stageStyleVars(guidedStage)}
          role="progressbar"
          aria-label={t('向导配置进度', 'Guided setup progress')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={guidedProgressPct}
          onMouseEnter={() => setProgressRailHover(true)}
          onMouseLeave={() => setProgressRailHover(false)}
          className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--border-default)]/55"
        >
          <div
            data-topnav-progress-fill="true"
            style={{ width: `${guidedProgressPct}%` }}
            className="h-full bg-[var(--stage-bar)] transition-[width,background-color] duration-350 ease-out"
          />

          {guidedStepIndex > 0 && (progressBadgeVisible || progressRailHover) && (
            <div
              key={progressJumpSeq}
              data-topnav-progress-badge="true"
              style={{ left: `clamp(40px, ${guidedProgressPct}%, calc(100% - 48px))` }}
              className="tr-progress-pill-pop pointer-events-none absolute top-[calc(100%+5px)] z-[1120] inline-flex items-center gap-1.5 rounded-full bg-[var(--stage-solid)] px-2.5 py-0.5 font-mono text-[11px] font-bold leading-tight text-white shadow-[0_6px_16px_-4px_var(--stage-ring),var(--shadow-sm)] whitespace-nowrap tabular-nums"
            >
              <span>{guidedProgressPct}%</span>
              <span className="opacity-75">
                {guidedStepIndex}/{GUIDED_STEPS.length}
              </span>
            </div>
          )}
        </div>
      )}
      {changesRequest && <ChangesDialog request={changesRequest} onClose={() => setChangesRequest(null)} />}
    </header>
  )
}
