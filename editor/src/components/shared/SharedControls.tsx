import * as React from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  ChevronDown,
  Code2,
  Eye,
  EyeOff,
  HelpCircle,
  Info,
  KeyRound,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from 'lucide-react'
import {
  Badge,
  Button,
  Callout,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  InfoTooltip,
  Input,
  Switch,
} from '@/components/ui/primitives'
import { GuidedPipeline } from '@/components/guided/GuidedPipeline'
import { GuidedTrialFiles } from '@/components/guided/GuidedTrialFiles'
import { useT } from '@/i18n'
import { getOfficialDocUrl } from '@/lib/presets'
import { sourceForFeature, type SourceTarget } from '@/lib/pro-navigation'
import type { ConfigFileKey, SectionId } from '@/lib/types'
import { cn } from '@/lib/utils'
import { STAGE_FOR_SECTION, stageStyleVars } from '@/lib/workflow-stages'
import { useEditor } from '@/store/editor-store'

const SECTION_FLOW: SectionId[] = [
  'onboarding',
  'sources',
  'filter',
  'ai',
  'report',
  'push',
  'storage',
]

export function SectionShell({
  sectionId,
  stepNumber,
  title,
  subtitle,
  docSlug,
  sourceFile = 'config.yaml',
  headerExtra,
  children,
}: {
  sectionId: SectionId
  stepNumber?: string
  title: string
  subtitle?: string
  docSlug?: string
  sourceFile?: ConfigFileKey
  headerExtra?: React.ReactNode
  children: React.ReactNode
}) {
  const {
    lang,
    issues,
    applyQuickFix,
    setActiveSection,
    jumpToSource,
    openSourceTarget,
    sourcesSubTab,
    setExportOpen,
    workspaceMode,
  } = useEditor()
  const t = useT()

  const isPro = workspaceMode === 'pro'
  const guidedStep = !isPro && sectionId !== 'onboarding'
  const sectionStage = STAGE_FOR_SECTION[sectionId]
  const sectionIssues = issues.filter((i) => i.section === sectionId)
  const flowIndex = SECTION_FLOW.indexOf(sectionId)
  const prevSection = flowIndex > 0 ? SECTION_FLOW[flowIndex - 1] : null
  const nextSection = flowIndex >= 0 && flowIndex < SECTION_FLOW.length - 1 ? SECTION_FLOW[flowIndex + 1] : null
  const effectiveSourceFile: ConfigFileKey = sectionId === 'push' ? 'config.yaml' : sourceFile

  const references = (
    <>
      {!guidedStep && (
        <Button
          variant="ghost"
          size="xs"
          onClick={() => {
            if (isPro && effectiveSourceFile === 'config.yaml') openSourceTarget(sourceForFeature(sectionId, sourcesSubTab))
            else jumpToSource(effectiveSourceFile)
          }}
          title={t('查看或编辑对应原始配置文件', 'Inspect the underlying config file')}
        >
          <Code2 className="h-3.5 w-3.5" />
          <span className="font-mono text-xs">{effectiveSourceFile}</span>
        </Button>
      )}
      {docSlug && (
        <a
          href={getOfficialDocUrl(docSlug, lang)}
          target="_blank"
          rel="noopener noreferrer"
          className="tr-focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--brand-border)] hover:text-[var(--brand-primary)] no-underline whitespace-nowrap"
        >
          <BookOpen className="h-3.5 w-3.5 shrink-0" />
          <span>{t('详细文档', 'Full Docs')}</span>
        </a>
      )}
    </>
  )

  return (
    <div className={cn('@container/section w-full min-w-0', isPro ? 'space-y-4 pb-12' : 'mx-auto max-w-[880px] space-y-5 pb-20')}>
      {/* Compact Single-Row Header */}
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-2.5 border-b border-[var(--border-default)] pb-3">
        <div className="flex min-w-0 items-center gap-2">
          {stepNumber && !isPro && (
            <span
              data-stage={sectionStage}
              style={stageStyleVars(sectionStage)}
              className="shrink-0 rounded-md border border-[var(--stage-border)] bg-[var(--stage-soft)] px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase text-[var(--stage-text)]"
            >
              {stepNumber}
            </span>
          )}
          <h1
            className={cn(
              'truncate font-bold tracking-tight text-[var(--text-primary)]',
              isPro ? 'text-[17px]' : 'text-xl leading-tight',
            )}
          >
            {title}
          </h1>
          {subtitle && (
            <InfoTooltip content={subtitle}>
              <button
                type="button"
                className="tr-focus-ring inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--brand-primary)] cursor-help"
                aria-label={t('功能说明', 'Section info')}
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </InfoTooltip>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {headerExtra}
          {guidedStep && <GuidedTrialFiles section={sectionId} defaultFile={effectiveSourceFile} />}
          {references}
        </div>
      </header>

      {/* Always-visible compact 3-stage pipeline locator on Guided steps */}
      {guidedStep && <GuidedPipeline section={sectionId} compact />}

      {/* Section-level contextual health alerts */}
      {sectionIssues.length > 0 && (
        <div className="space-y-2.5">
          {sectionIssues.map((iss) => (
            <Callout
              key={iss.id}
              tone={iss.severity === 'error' ? 'danger' : iss.severity === 'warning' ? 'warning' : 'info'}
              icon={
                iss.severity === 'error' ? (
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                ) : iss.severity === 'warning' ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                ) : (
                  <Info className="h-4 w-4 text-[var(--brand-primary)]" />
                )
              }
              title={t(iss.titleZh, iss.titleEn)}
              action={
                iss.fixKey ? (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => applyQuickFix(iss.fixKey!)}
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    <span>{t(iss.fixLabelZh!, iss.fixLabelEn!)}</span>
                  </Button>
                ) : undefined
              }
            >
              {t(iss.descZh, iss.descEn)}
            </Callout>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className={cn(isPro ? 'space-y-5' : 'space-y-6')}>{children}</div>

      {/* Guided Step Footer */}
      {guidedStep && (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-default)] pt-6">
          {prevSection ? (
            <Button variant="outline" size="md" onClick={() => setActiveSection(prevSection)}>
              <ArrowLeft className="h-4 w-4" />
              <span>{t('上一步', 'Previous Step')}</span>
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2.5">
            <GuidedTrialFiles section={sectionId} defaultFile={effectiveSourceFile} />
            {nextSection ? (
              <Button variant="primary" size="md" onClick={() => setActiveSection(nextSection)}>
                <span>{t('下一步', 'Next Step')}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="primary" size="md" onClick={() => setExportOpen(true)}>
                <Sparkles className="h-4 w-4" />
                <span>{t('完成并导出配置', 'Finish & Export')}</span>
              </Button>
            )}
          </div>
        </footer>
      )}
    </div>
  )
}

/* ---------------- SettingRow ---------------- */
export function SettingRow({
  label,
  description,
  tooltip,
  envVar,
  sourceTarget,
  children,
  vertical = false,
  className,
}: {
  label: React.ReactNode
  description?: React.ReactNode
  tooltip?: React.ReactNode
  envVar?: string
  sourceTarget?: SourceTarget
  children: React.ReactNode
  vertical?: boolean
  className?: string
}) {
  const { workspaceMode, focusSourceFromForm } = useEditor()
  const t = useT()
  const isPro = workspaceMode === 'pro'
  const handleLocate = () => {
    if (isPro && sourceTarget) focusSourceFromForm(sourceTarget)
  }
  return (
    <div
      onFocusCapture={sourceTarget ? handleLocate : undefined}
      onClick={sourceTarget ? handleLocate : undefined}
      className={cn(
        'flex min-w-0 gap-4 py-4 first:pt-0 last:pb-0',
        vertical ? 'flex-col' : 'flex-col @min-[40rem]/section:flex-row @min-[40rem]/section:items-center @min-[40rem]/section:justify-between',
        className,
      )}
    >
      <div className="min-w-0 space-y-1 @min-[40rem]/section:max-w-[60%]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14.5px] font-medium text-[var(--text-primary)]">{label}</span>
          {tooltip && (
            <InfoTooltip content={tooltip}>
              <button
                type="button"
                className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                aria-label={t('帮助说明', 'Help')}
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </InfoTooltip>
          )}
          {envVar && (
            <code className="rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
              {envVar}
            </code>
          )}
        </div>
        {description && (
          <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">{description}</p>
        )}
      </div>
      <div className={cn('min-w-0 max-w-full [&>*]:max-w-full', vertical ? 'w-full' : '@min-[40rem]/section:w-[42%] @min-[40rem]/section:shrink-0 @min-[40rem]/section:flex @min-[40rem]/section:justify-end')}>
        {children}
      </div>
    </div>
  )
}

/* ---------------- Progressive Disclosure: ToggleSectionCard ---------------- */
export function ToggleSectionCard({
  id,
  icon,
  title,
  description,
  badge,
  checked,
  onCheckedChange,
  forceExpanded = false,
  sourceTarget,
  children,
  disabled,
  className,
}: {
  id?: string
  icon: React.ReactNode
  title: React.ReactNode
  description: React.ReactNode
  badge?: React.ReactNode
  checked: boolean
  onCheckedChange: (val: boolean) => void
  forceExpanded?: boolean
  sourceTarget?: SourceTarget
  children: React.ReactNode
  disabled?: boolean
  className?: string
}) {
  const { visualFocusTarget, focusSourceFromForm, workspaceMode } = useEditor()
  const t = useT()
  const [manualPeek, setManualPeek] = React.useState(false)

  const targetedByFocus = Boolean(id && visualFocusTarget?.anchor === id)
  React.useEffect(() => {
    if (targetedByFocus && !checked) {
      setManualPeek(true)
    }
  }, [targetedByFocus, checked, visualFocusTarget?.seq])

  const isOpen = checked || forceExpanded || manualPeek

  return (
    <div
      id={id}
      onClick={() => {
        if (workspaceMode === 'pro' && sourceTarget) focusSourceFromForm(sourceTarget)
      }}
      className={cn(
        'scroll-mt-4 rounded-2xl border bg-[var(--bg-surface)] transition-colors shadow-[var(--shadow-xs)]',
        checked ? 'border-[var(--brand-border)]' : 'border-[var(--border-default)]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 px-5 py-4.5 sm:px-6">
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={cn(
              'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors',
              checked
                ? 'border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-primary)]'
                : 'border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-muted)]',
            )}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15.5px] font-semibold text-[var(--text-primary)]">{title}</h3>
              {badge}
            </div>
            <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--text-muted)]">{description}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!checked && !forceExpanded && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setManualPeek((v) => !v)
              }}
              className="tr-focus-ring inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              title={t('在关闭状态下展开查看或预先修改内部设置', 'Expand to pre-configure settings while master toggle is off')}
            >
              <span>{manualPeek ? t('收起详情', 'Hide') : t('展开配置', 'Configure')}</span>
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', manualPeek && 'rotate-180')} />
            </button>
          )}
          <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
        </div>
      </div>

      <Collapsible open={isOpen}>
        <CollapsibleContent className="tr-collapsible-content">
          <div className="border-t border-[var(--border-default)] px-5 py-5 sm:px-6 space-y-5">
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

/* ---------------- Progressive Disclosure: AdvancedCollapsible ---------------- */
export function AdvancedCollapsible({
  id,
  title,
  description,
  customizedCount = 0,
  defaultOpen = false,
  forceOpenSeq,
  sourceTarget,
  icon,
  children,
  className,
}: {
  id?: string
  title: string
  description?: string
  customizedCount?: number
  defaultOpen?: boolean
  forceOpenSeq?: number
  sourceTarget?: SourceTarget
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const { visualFocusTarget, workspaceMode, focusSourceFromForm } = useEditor()
  const [open, setOpen] = React.useState(defaultOpen)
  const t = useT()

  const targetedSeq = id && visualFocusTarget?.anchor === id ? visualFocusTarget.seq : undefined

  React.useEffect(() => {
    if ((forceOpenSeq && forceOpenSeq > 0) || (targetedSeq && targetedSeq > 0)) {
      setOpen(true)
    }
  }, [forceOpenSeq, targetedSeq])

  return (
    <Collapsible
      id={id}
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next && workspaceMode === 'pro' && sourceTarget) {
          focusSourceFromForm(sourceTarget)
        }
      }}
      className={cn(
        'scroll-mt-4 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]/55 transition-colors',
        open && 'border-solid border-[var(--border-default)] bg-[var(--bg-surface)]',
        className,
      )}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="tr-focus-ring flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-3.5 text-left transition-colors hover:bg-[var(--bg-muted)]/60 cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[var(--text-muted)] shrink-0">
              {icon ?? <SlidersHorizontal className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-semibold text-[var(--text-primary)]">{title}</span>
                {customizedCount > 0 && (
                  <Badge tone="brand">
                    {t('已自定义 {v0} 项', '{v0} customized', { v0: customizedCount })}
                  </Badge>
                )}
              </div>
              {description && (
                <p className="mt-0.5 text-[12.5px] text-[var(--text-muted)] truncate">{description}</p>
              )}
            </div>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="tr-collapsible-content">
        <div className="border-t border-[var(--border-default)] px-5 py-5 space-y-4">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/* ---------------- SecretInput ---------------- */
export function SecretInput({
  value,
  onChange,
  placeholder,
  envVar,
  className,
}: {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  envVar?: string
  className?: string
}) {
  const [visible, setVisible] = React.useState(false)
  const { deployMode } = useEditor()
  const t = useT()

  const hasValue = value.trim().length > 0

  return (
    <div className={cn('space-y-1.5 w-full', className)}>
      <div className="relative flex items-center">
        <Input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-20 font-mono text-xs"
          autoComplete="off"
          spellCheck={false}
        />
        <div className="absolute right-1.5 flex items-center gap-1">
          {hasValue && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              title={t('清空并改由环境变量/Secrets注入', 'Clear to use env/Secrets instead')}
            >
              {t('清空', 'Clear')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            aria-label={visible ? 'Hide secret' : 'Show secret'}
          >
            {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      {deployMode === 'github_actions' && hasValue && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <KeyRound className="h-3 w-3 shrink-0" />
          <span>
            {t('GitHub 部署请勿提交明文密钥：复制或导出时会自动脱敏并生成 {v0} 清单', 'Avoid committing secrets to GitHub: copy/export automatically sanitizes this for {v0}', { v0: envVar ?? 'Secrets' })}
          </span>
        </div>
      )}
    </div>
  )
}

/* ---------------- Floating Back-To-Top Pill ---------------- */
export function BackToTopButton({
  containerId,
  positionMode = 'fixed',
  className,
}: {
  containerId: string
  positionMode?: 'fixed' | 'pane' | 'responsive-pane'
  className?: string
}) {
  const [visible, setVisible] = React.useState(false)
  const t = useT()

  React.useEffect(() => {
    const el = document.getElementById(containerId)
    const onScroll = () => {
      const containerTop = el ? el.scrollTop : 0
      const winTop = typeof window !== 'undefined' ? window.scrollY : 0
      setVisible(Math.max(containerTop, winTop) > 260)
    }
    el?.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      el?.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onScroll)
    }
  }, [containerId])

  if (!visible) return null

  const handleClick = () => {
    const el = document.getElementById(containerId)
    if (el && el.scrollTop > 0) {
      el.scrollTo({ top: 0, behavior: 'smooth' })
    }
    if (window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t('回到顶部', 'Back to top')}
      className={cn(
        'tr-focus-ring inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)]/95 px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-[var(--shadow-md)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] cursor-pointer',
        positionMode === 'pane'
          ? 'absolute bottom-5 right-5 z-[950]'
          : positionMode === 'responsive-pane'
            ? 'fixed bottom-5 right-5 z-[950] lg:absolute lg:bottom-5 lg:right-5'
            : 'fixed bottom-6 right-6 z-[1150]',
        className,
      )}
    >
      <ArrowUp className="h-3.5 w-3.5" />
      <span>{t('回到顶部', 'Top')}</span>
    </button>
  )
}

/* ---------------- Inline Brand Marks (Zero external assets) ---------------- */
export function SansanBrandMark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      className={cn('rounded-[5px]', className)}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="16" fill="#f4efe6" />
      <g fill="none" stroke="#087ead" strokeWidth="4.5" strokeLinecap="round" opacity=".48">
        <path d="M44.5 14.5C32.1 10.7 20.7 15.7 19 22.5" />
        <path d="M24.7 35.4C31.6 42.2 45.4 39.4 44.3 49" />
      </g>
      <circle cx="44.5" cy="14.5" r="7.5" fill="#087ead" />
      <circle cx="19" cy="29" r="7" fill="none" stroke="#087ead" strokeWidth="4" />
      <circle cx="44.3" cy="49" r="7.5" fill="#087ead" />
    </svg>
  )
}

export function GithubBrandIcon({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .31.21.66.79.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  )
}

export function XBrandIcon({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
