import { useState } from 'react'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Cloud,
  Cpu,
  ExternalLink,
  FileDiff,
  Globe,
  HelpCircle,
  History,
  Laptop,
  Server,
  Sparkles,
  Sun,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import { GuidedStarter } from '@/components/guided/GuidedStarter'
import { GuidedTrialFiles } from '@/components/guided/GuidedTrialFiles'
import { AdvancedCollapsible, SectionShell } from '@/components/shared/SharedControls'
import { Badge, Button, Callout, Card } from '@/components/ui/primitives'
import { useT } from '@/i18n'
import { getOfficialDocUrl, SCENARIO_PRESETS, type ScenarioPreset } from '@/lib/presets'
import type { DeployMode, SectionId } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useEditor } from '@/store/editor-store'

interface DeployOptionMeta {
  mode: DeployMode
  icon: typeof Cloud
  titleZh: string
  titleEn: string
  shortZh: string
  shortEn: string
  tipZh: string
  tipEn: string
}

const DEPLOY_OPTIONS: DeployOptionMeta[] = [
  {
    mode: 'docker',
    icon: Server,
    titleZh: 'Docker / NAS',
    titleEn: 'Docker / NAS',
    shortZh: '自托管长期稳定运行（推荐）',
    shortEn: 'Self-hosted container (Recommended)',
    tipZh: '支持导出完整 config.zip 与 .env 文件，挂载目录即可长期保留历史数据。',
    tipEn: 'Export config.zip + .env directly for persistent self-hosted SQLite history.',
  },
  {
    mode: 'github_actions',
    icon: Cloud,
    titleZh: 'GitHub Actions',
    titleEn: 'GitHub Actions',
    shortZh: '免服务器，云端免费定时运行',
    shortEn: 'Serverless free cloud schedule',
    tipZh: '已开启 GitHub 安全防坑保护：复制或导出时自动脱敏密钥，并预警本地代理误开。',
    tipEn: 'GitHub guardrails active: automatic secret sanitization & local proxy warnings.',
  },
  {
    mode: 'local',
    icon: Laptop,
    titleZh: '本机 Python (uv)',
    titleEn: 'Local Python (uv)',
    shortZh: '本地快速试用与开发调试',
    shortEn: 'Fast local trial & debugging',
    tipZh: '覆盖项目 config/ 目录后，执行 uv run python -m trendradar 即可立即验证效果。',
    tipEn: 'Overwrite config/, then run locally with uv to verify immediately.',
  },
]

const SECTION_LABELS: Record<SectionId, [string, string]> = {
  onboarding: ['快速上手', 'Quick Start'],
  sources: ['01 信息来源', '01 Sources'],
  filter: ['02 内容筛选', '02 Filter'],
  ai: ['03 AI 引擎与增强', '03 AI & Prompts'],
  report: ['04 报告与版面', '04 Report & Layout'],
  push: ['05 推送与定时', '05 Push & Schedule'],
  storage: ['06 存储与系统', '06 Storage & System'],
}

function getPresetIcon(id: string) {
  switch (id) {
    case 'daily_briefing':
      return Sun
    case 'ai_tech_radar':
      return Cpu
    case 'web_search_intel':
      return Globe
    default:
      return Zap
  }
}

export function OnboardingSection() {
  const {
    configError,
    lang,
    deployMode,
    setDeployMode,
    setActiveSection,
    openImportDialog,
    patchConfigValues,
    workspaceMode,
    changedFromDefaults,
    setChangesRequest,
    resumedSession,
    dismissResumedSession,
    notify,
  } = useEditor()
  const t = useT()
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null)

  const activeDeploy = DEPLOY_OPTIONS.find((d) => d.mode === deployMode) ?? DEPLOY_OPTIONS[0]

  const handleApplyPreset = (preset: ScenarioPreset) => {
    patchConfigValues(preset.patches)
    setAppliedPresetId(preset.id)
    notify(
      t('已将「{v0}」应用到 config.yaml', 'Applied "{v1}" to config.yaml', { v0: preset.titleZh, v1: preset.titleEn }),
      'success',
    )
  }

  const deploymentBlock = (
    <section id="guided-anchor-deploy" className="scroll-mt-4 space-y-2.5">
      <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
        {t('运行环境选择', 'Deployment Environment')}
      </h2>

      <div className="grid grid-cols-1 gap-3 @min-[36rem]/section:grid-cols-3">
        {DEPLOY_OPTIONS.map((opt) => {
          const Icon = opt.icon
          const selected = deployMode === opt.mode
          return (
            <button
              key={opt.mode}
              type="button"
              onClick={() => setDeployMode(opt.mode)}
              aria-pressed={selected}
              className={cn(
                'tr-focus-ring flex items-start justify-between gap-3 rounded-2xl border p-4 text-left transition-all cursor-pointer',
                selected
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-soft)] shadow-[var(--shadow-xs)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]',
              )}
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border',
                      selected
                        ? 'border-[var(--brand-border)] bg-[var(--bg-surface)] text-[var(--brand-primary)]'
                        : 'border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[14.5px] font-semibold text-[var(--text-primary)]">
                    {t(opt.titleZh, opt.titleEn)}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                  {t(opt.shortZh, opt.shortEn)}
                </p>
              </div>
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                  selected
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                    : 'border-[var(--border-strong)]',
                )}
              >
                {selected && <Check className="h-3 w-3" />}
              </span>
            </button>
          )
        })}
      </div>

      <p className="px-1 text-xs text-[var(--text-muted)]">
        {t(activeDeploy.tipZh, activeDeploy.tipEn)}
      </p>
    </section>
  )

  const presetsGrid = (
    <div className="space-y-4">
      {appliedPresetId && (
        <Callout
          tone="success"
          icon={<CheckCircle2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
          title={t('场景方案已写入 config.yaml', 'Scenario preset applied')}
          action={
            <Button size="xs" variant="primary" onClick={() => setActiveSection('push')}>
              <span>{t('去填写通知渠道', 'Add Push Channel')}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          }
        >
          {t('核心开关已自动配好，可立即试跑或继续配置推送机器人与关注关键词。', 'Core switches updated. Try a run now or add your bot webhook and keywords.')}
        </Callout>
      )}
      {appliedPresetId && workspaceMode === 'guided' && (
        <GuidedTrialFiles section="onboarding" choices={['config.yaml']} inline />
      )}

      <div className="grid grid-cols-1 gap-3.5 @min-[48rem]/section:grid-cols-2">
        {SCENARIO_PRESETS.map((preset) => {
          const Icon = getPresetIcon(preset.id)
          const applied = appliedPresetId === preset.id
          return (
            <Card
              key={preset.id}
              className={cn(
                'flex flex-col justify-between p-4.5 transition-colors',
                applied && 'border-[var(--brand-primary)] bg-[var(--brand-soft)]/50',
              )}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-primary)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <h3 className="text-[14.5px] font-semibold text-[var(--text-primary)] truncate">
                      {t(preset.titleZh, preset.titleEn)}
                    </h3>
                  </div>
                  <Badge tone={applied ? 'success' : 'brand'}>
                    {applied ? t('已应用', 'Applied') : t(preset.badgeZh, preset.badgeEn)}
                  </Badge>
                </div>
                <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  {t(preset.descZh, preset.descEn)}
                </p>
              </div>

              <div className="mt-3.5 flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {preset.highlightsZh.slice(0, 2).map((tagZh, idx) => {
                    const tag = t(tagZh, preset.highlightsEn[idx] ?? tagZh)
                    return (
                      <span key={tagZh} className="rounded bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                        {tag}
                      </span>
                    )
                  })}
                </div>
                <Button
                  size="xs"
                  variant={applied ? 'outline' : 'primary'}
                  disabled={Boolean(configError)}
                  onClick={() => handleApplyPreset(preset)}
                >
                  {applied ? <Check className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                  <span>{applied ? t('重新套用', 'Re-apply') : t('一键套用', 'Apply')}</span>
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )

  if (workspaceMode === 'guided') {
    const showResumeBanner = resumedSession.active && (changedFromDefaults.length > 0 || resumedSession.savedSection !== 'onboarding')
    return (
      <SectionShell
        sectionId="onboarding"
        docSlug="quick-start"
        title={t('快速上手', 'Quick Start')}
        subtitle={t(
          '改一项就能直接复制去试跑，草稿会自动保存在当前浏览器。',
          'Tweak any setting to copy & try right away — drafts auto-save in your browser.',
        )}
        headerExtra={
          <Button variant="outline" size="sm" onClick={() => openImportDialog('local')}>
            <Upload className="h-4 w-4" />
            <span>{t('导入已有配置', 'Import Existing')}</span>
          </Button>
        }
      >
        {/* Explicit Draft Resume Card when returning to browser */}
        {showResumeBanner && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-soft)]/55 px-4 py-3.5">
            <div className="flex items-start gap-3 min-w-0">
              <History className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
              <div className="space-y-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  {t('已恢复你上次保存的本地草稿', 'Restored your saved local draft')}
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  {changedFromDefaults.length > 0
                    ? t('已修改 {v0} 个文件（{v1}），可随时继续完善或查看改动。', '{v0} modified file(s) ({v2}). Continue editing or review your changes.', { v0: changedFromDefaults.length, v1: changedFromDefaults.join('、'), v2: changedFromDefaults.join(', ') })
                    : t('浏览器已记住你上次的向导浏览进度。', 'Your previous guided progress was restored.')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {resumedSession.savedSection !== 'onboarding' && (
                <Button size="xs" variant="primary" onClick={() => setActiveSection(resumedSession.savedSection)}>
                  <span>{t('回到 {v0}', 'Resume {v1}', { v0: SECTION_LABELS[resumedSession.savedSection][0], v1: SECTION_LABELS[resumedSession.savedSection][1] })}</span>
                  <ArrowRight size={13} />
                </Button>
              )}
              {changedFromDefaults.length > 0 && (
                <Button size="xs" variant="outline" onClick={() => setChangesRequest({})}>
                  <FileDiff size={13} />
                  <span>{t('查看改动 / 重置', 'Review / Reset')}</span>
                </Button>
              )}
              <button
                type="button"
                onClick={dismissResumedSession}
                aria-label={t('隐藏提示', 'Dismiss')}
                className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Interactive 3-Stage Pipeline + Try-One-Setting Workbench */}
        <div id="guided-anchor-starter" className="scroll-mt-4">
          <GuidedStarter />
        </div>

        {/* Deployment Environment (No nested collapsible wrapper!) */}
        {deploymentBlock}

        {/* Optional Ready-Made Scenario Presets (Single clean collapsible) */}
        <AdvancedCollapsible
          id="guided-anchor-presets"
          title={t('懒得逐项挑？一键套用 4 套常用场景方案', 'Want a head start? Pick from 4 ready-made scenario presets')}
          description={t('每日早晚简报 · AI 科技追踪 · 联网专题情报 · 零成本纯热榜监控', 'Morning/Evening Briefing · AI Tracker · Web Search Intel · Zero-Cost Monitor')}
          icon={<Sparkles className="h-4 w-4 text-[var(--brand-primary)]" />}
          defaultOpen={false}
        >
          {presetsGrid}
        </AdvancedCollapsible>

        {/* How to Apply Guide */}
        <AdvancedCollapsible
          id="guided-anchor-export-guide"
          title={t('全部配好后如何导出并让 TrendRadar 长期运行？', 'How do I export everything for production deployment?')}
          description={t('点击展开查看打包 config.zip、脱敏密钥与启动步骤', 'Expand for the 3-step export, secret setup, and startup guide')}
          icon={<HelpCircle className="h-4 w-4" />}
          defaultOpen={false}
        >
          <ol className="space-y-2 pl-5 text-[13.5px] leading-relaxed text-[var(--text-secondary)] list-decimal">
            <li>
              <strong className="text-[var(--text-primary)]">{t('打包导出', 'Export')}</strong>：
              {t('点击右上角「导出」，自动体检配置冲突并下载 config.zip（支持一键剥离敏感密钥）。', 'Click Export in the top bar to run health checks and download config.zip.')}
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">{t('覆盖目录', 'Overwrite')}</strong>：
              {t('解压覆盖项目中的 config/ 目录。', 'Extract into your project config/ directory.')}
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">{t('注入密钥并启动', 'Configure secrets & start')}</strong>：
              {t('GitHub Actions 将密钥填入仓库 Secrets；Docker / 本地放入 .env 后启动即可。', 'Add secrets to GitHub Secrets or .env, then start the service.')}
            </li>
          </ol>
          <div className="pt-1">
            <a
              href={getOfficialDocUrl('editor', lang)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--brand-primary)] hover:underline"
            >
              <span>{t('查看官网完整配置编辑器教程', 'Read full editor documentation on official site')}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </AdvancedCollapsible>
      </SectionShell>
    )
  }

  // Pro Mode ("预设向导" / Presets & Deployment Utility View)
  return (
    <SectionShell
      sectionId="onboarding"
      title={t('场景预设与部署环境', 'Scenario Presets & Deployment')}
      docSlug="quick-start"
      sourceFile="config.yaml"
    >
      {deploymentBlock}

      <section className="space-y-3">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
          {t('4 套常用场景预设方案', '4 Ready-Made Scenario Presets')}
        </h2>
        {presetsGrid}
      </section>
    </SectionShell>
  )
}
