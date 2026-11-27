import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUpRight,
  Brain,
  Check,
  Code2,
  Cpu,
  EyeOff,
  FileCode2,
  Globe,
  Info,
  Languages,
  Layers,
  Link2,
  Newspaper,
  Plus,
  RotateCcw,
  Rss,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Wand2,
  X,
} from 'lucide-react'
import {
  AdvancedCollapsible,
  SecretInput,
  SectionShell,
  SettingRow,
  ToggleSectionCard,
} from '@/components/shared/SharedControls'
import {
  Badge,
  Button,
  Callout,
  Card,
  Collapsible,
  CollapsibleContent,
  Input,
  SelectField,
  Slider,
  Switch,
} from '@/components/ui/primitives'
import { tr, useT } from '@/i18n'
import { AI_PROVIDER_PRESETS, type AiProviderPreset } from '@/lib/presets'
import type { Lang } from '@/lib/types'
import type { RegionKey } from '@/lib/types'
import { cn } from '@/lib/utils'
import { getInObject } from '@/lib/yaml-doc'
import { useEditor } from '@/store/editor-store'

const ANALYSIS_LANG_PRESETS = [
  { value: 'Chinese', labelZh: '中文 (Chinese)', labelEn: 'Chinese' },
  { value: 'English', labelZh: 'English', labelEn: 'English' },
  { value: 'Japanese', labelZh: '日本語 (Japanese)', labelEn: 'Japanese' },
  { value: 'Korean', labelZh: '한국어 (Korean)', labelEn: 'Korean' },
]

const TRANSLATION_LANG_PRESETS = [
  { value: '中文', labelZh: '中文', labelEn: 'Chinese (中文)' },
  { value: 'English', labelZh: 'English', labelEn: 'English' },
  { value: '日本語', labelZh: '日本語', labelEn: 'Japanese (日本語)' },
  { value: '한국어', labelZh: '한국어', labelEn: 'Korean (한국어)' },
]

function getPresetDisplayName(preset: AiProviderPreset, lang: Lang): string {
  if (preset.id === 'ollama') return tr(lang, 'Ollama (本地模型)', 'Ollama (Local)')
  if (preset.id === 'relay') return tr(lang, 'API 中转站 (OpenAI 兼容)', 'API Relay (OpenAI-Compat)')
  return preset.name
}

export function AiSection() {
  const {
    files,
    baselineFiles,
    configData,
    lang,
    workspaceMode,
    setConfigValue,
    patchConfigValues,
    removeConfigKey,
    setChangesRequest,
    jumpToSource,
    openSourceTarget,
    focusSourceFromForm,
    focusVisual,
    setSourcesSubTab,
    activeSourceFile,
    visualFocusTarget,
    notify,
  } = useEditor()
  const t = useT()

  // Local UI state
  const [newFallback, setNewFallback] = useState('')
  const [extraKeyDraft, setExtraKeyDraft] = useState('')
  const [extraValDraft, setExtraValDraft] = useState('')
  const [showCustomAnalysisPath, setShowCustomAnalysisPath] = useState(false)
  const [showCustomTransPath, setShowCustomTransPath] = useState(false)
  const [relayOpenNonce, setRelayOpenNonce] = useState(0)
  const analysisPromptOpenSeq =
    visualFocusTarget?.section === 'ai' && visualFocusTarget.anchor === 'pro-anchor-ai-analysis-prompt'
      ? visualFocusTarget.seq
      : 0
  const transPromptOpenSeq =
    visualFocusTarget?.section === 'ai' && visualFocusTarget.anchor === 'pro-anchor-ai-translation-prompt'
      ? visualFocusTarget.seq
      : 0

  /* ---------- Read config values ---------- */
  const aiModel = String(getInObject<string>(configData, ['ai', 'model'], 'deepseek/deepseek-v4-flash') ?? '')
  const aiApiKey = String(getInObject<string>(configData, ['ai', 'api_key'], '') ?? '')
  const aiApiBase = String(getInObject<string>(configData, ['ai', 'api_base'], '') ?? '')
  const aiTimeout = Number(getInObject<number>(configData, ['ai', 'timeout'], 120))
  const aiTemperature = Number(getInObject<number>(configData, ['ai', 'temperature'], 1.0))
  const aiMaxTokens = Number(getInObject<number>(configData, ['ai', 'max_tokens'], 5000))
  const aiNumRetries = Number(getInObject<number>(configData, ['ai', 'num_retries'], 1))
  const rawFallbacks = getInObject<unknown>(configData, ['ai', 'fallback_models'], [])
  const fallbackModels: string[] = Array.isArray(rawFallbacks)
    ? rawFallbacks.map((x) => String(x)).filter(Boolean)
    : []
  const rawExtraParams = getInObject<unknown>(configData, ['ai', 'extra_params'], {})
  const extraParams: Record<string, unknown> =
    rawExtraParams && typeof rawExtraParams === 'object' && !Array.isArray(rawExtraParams)
      ? (rawExtraParams as Record<string, unknown>)
      : {}
  const extraParamEntries = Object.entries(extraParams)

  // Shared engine consumers status
  const aiAnalysisEnabled = getInObject<boolean>(configData, ['ai_analysis', 'enabled'], true)
  const aiTransEnabled = getInObject<boolean>(configData, ['ai_translation', 'enabled'], true)
  const filterMethod = getInObject<string>(configData, ['filter', 'method'], 'keyword')
  const webSearchEnabled = getInObject<boolean>(configData, ['web_search', 'enabled'], false)
  const webSearchQueryMode = getInObject<string>(configData, ['web_search', 'query_mode'], 'direct')
  const smartSearchActive = webSearchEnabled && webSearchQueryMode === 'smart'

  // AI Analysis config
  const reportMode = getInObject<string>(configData, ['report', 'mode'], 'current')
  const analysisLang = String(getInObject<string>(configData, ['ai_analysis', 'language'], 'Chinese') ?? '')
  const analysisPromptFile = String(
    getInObject<string>(configData, ['ai_analysis', 'prompt_file'], 'ai_analysis_prompt.txt') ??
      'ai_analysis_prompt.txt',
  )
  const analysisMode = getInObject<string>(configData, ['ai_analysis', 'mode'], 'follow_report')
  const maxNewsForAnalysis = Number(
    getInObject<number>(configData, ['ai_analysis', 'max_news_for_analysis'], 150),
  )
  const includeRss = getInObject<boolean>(configData, ['ai_analysis', 'include_rss'], false)
  const includeWebSearch = getInObject<boolean>(
    configData,
    ['ai_analysis', 'include_web_search'],
    true,
  )
  const searchSummaryMaxChars = Number(
    getInObject<number>(configData, ['ai_analysis', 'search_summary_max_chars'], 300),
  )
  const includeStandalone = getInObject<boolean>(
    configData,
    ['ai_analysis', 'include_standalone'],
    true,
  )
  const includeRankTimeline = getInObject<boolean>(
    configData,
    ['ai_analysis', 'include_rank_timeline'],
    true,
  )

  // AI Translation config
  const transLang = String(getInObject<string>(configData, ['ai_translation', 'language'], '中文') ?? '')
  const transPromptFile = String(
    getInObject<string>(
      configData,
      ['ai_translation', 'prompt_file'],
      'ai_translation_prompt.txt',
    ) ?? 'ai_translation_prompt.txt',
  )
  const transBatchSize = Number(getInObject<number>(configData, ['ai_translation', 'batch_size'], 100))
  const transBatchInterval = Number(
    getInObject<number>(configData, ['ai_translation', 'batch_interval'], 2),
  )
  const scopeHotlist = getInObject<boolean>(configData, ['ai_translation', 'scope', 'hotlist'], false)
  const scopeRss = getInObject<boolean>(configData, ['ai_translation', 'scope', 'rss'], true)
  const scopeWebSearch = getInObject<boolean>(
    configData,
    ['ai_translation', 'scope', 'web_search'],
    false,
  )
  const scopeStandalone = getInObject<boolean>(
    configData,
    ['ai_translation', 'scope', 'standalone'],
    true,
  )

  // Display regions cross-check
  const regionHotlist = getInObject<boolean>(configData, ['display', 'regions', 'hotlist'], true)
  const regionRss = getInObject<boolean>(configData, ['display', 'regions', 'rss'], true)
  const regionWebSearch = getInObject<boolean>(configData, ['display', 'regions', 'web_search'], true)
  const regionStandalone = getInObject<boolean>(configData, ['display', 'regions', 'standalone'], false)
  const regionAiAnalysis = getInObject<boolean>(configData, ['display', 'regions', 'ai_analysis'], true)

  /* ---------- Derived checks ---------- */
  const trimmedModel = aiModel.trim()
  const trimmedBase = aiApiBase.trim()
  const needsOpenAiPrefixHint =
    trimmedBase.length > 0 &&
    trimmedModel.length > 0 &&
    !trimmedModel.startsWith('openai/') &&
    !trimmedModel.startsWith('ollama/') &&
    !trimmedModel.startsWith('azure/')

  const modelMissingSlash = trimmedModel.length > 0 && !trimmedModel.includes('/')

  const aiAdvancedCustomizedCount = useMemo(() => {
    let n = 0
    if (aiTimeout !== 120) n++
    if (Math.abs(aiTemperature - 1.0) > 0.01) n++
    if (aiMaxTokens !== 5000) n++
    if (aiNumRetries !== 1) n++
    if (fallbackModels.length > 0) n++
    if (extraParamEntries.length > 0) n += extraParamEntries.length
    return n
  }, [aiTimeout, aiTemperature, aiMaxTokens, aiNumRetries, fallbackModels.length, extraParamEntries.length])

  const analysisScopeCustomizedCount = useMemo(() => {
    let n = 0
    if (analysisMode !== 'follow_report') n++
    if (includeRss) n++
    if (!includeWebSearch) n++
    if (searchSummaryMaxChars !== 300) n++
    if (!includeStandalone) n++
    if (!includeRankTimeline) n++
    return n
  }, [
    analysisMode,
    includeRss,
    includeWebSearch,
    searchSummaryMaxChars,
    includeStandalone,
    includeRankTimeline,
  ])

  const analysisPromptText = files['ai_analysis_prompt.txt'] || ''
  const analysisContract = useMemo(
    () => ({
      hasSystem: analysisPromptText.includes('[system]'),
      hasUser: analysisPromptText.includes('[user]'),
      hasNewsContent: analysisPromptText.includes('{news_content}'),
    }),
    [analysisPromptText],
  )
  const analysisPromptCustomized =
    (analysisPromptText !== baselineFiles['ai_analysis_prompt.txt'] ? 1 : 0) +
    (analysisPromptFile !== 'ai_analysis_prompt.txt' ? 1 : 0)

  const transPromptText = files['ai_translation_prompt.txt'] || ''
  const transContract = useMemo(
    () => ({
      hasSystem: transPromptText.includes('[system]'),
      hasUser: transPromptText.includes('[user]'),
      hasTargetLang: transPromptText.includes('{target_language}'),
      hasContent: transPromptText.includes('{content}'),
    }),
    [transPromptText],
  )
  const transAdvancedCustomized = useMemo(() => {
    let n = 0
    if (transBatchSize !== 100) n++
    if (transBatchInterval !== 2) n++
    if (transPromptFile !== 'ai_translation_prompt.txt') n++
    if (transPromptText !== baselineFiles['ai_translation_prompt.txt']) n++
    return n
  }, [transBatchSize, transBatchInterval, transPromptFile, transPromptText, baselineFiles])

  const independentAnalysisDiffers =
    analysisMode !== 'follow_report' && analysisMode !== reportMode

  /* ---------- Handlers ---------- */
  const handleApplyProviderPreset = (preset: AiProviderPreset) => {
    patchConfigValues([
      { path: ['ai', 'model'], value: preset.model },
      { path: ['ai', 'api_base'], value: preset.apiBase },
    ])
    if (preset.apiBase.trim().length > 0) {
      setRelayOpenNonce((n) => n + 1)
    }
    const displayName = getPresetDisplayName(preset, lang)
    notify(
      t('已应用 {v0} 预设（{v1}）', 'Applied {v0} preset ({v1})', { v0: displayName, v1: preset.model }),
      'success',
    )
  }

  const handlePrependOpenAiPrefix = () => {
    if (!trimmedModel || trimmedModel.startsWith('openai/')) return
    const nextModel = `openai/${trimmedModel}`
    setConfigValue(['ai', 'model'], nextModel)
    notify(
      t('已添加 openai/ 前缀：{v0}', 'Prefixed model: {v0}', { v0: nextModel }),
      'success',
    )
  }

  const handleAddFallbackModel = () => {
    const val = newFallback.trim()
    if (!val) return
    if (fallbackModels.includes(val)) {
      notify(t('该备用模型已在列表中', 'Fallback model already in list'), 'warning')
      return
    }
    setConfigValue(['ai', 'fallback_models'], [...fallbackModels, val])
    setNewFallback('')
  }

  const handleRemoveFallbackModel = (idx: number) => {
    const next = fallbackModels.filter((_, i) => i !== idx)
    setConfigValue(['ai', 'fallback_models'], next)
  }

  const parseExtraParamValue = (raw: string): unknown => {
    const s = raw.trim()
    if (s === 'true') return true
    if (s === 'false') return false
    if (s === 'null') return null
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
    if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
      try {
        return JSON.parse(s)
      } catch {
        return raw
      }
    }
    return raw
  }

  const formatExtraParamValue = (val: unknown): string => {
    if (typeof val === 'string') return val
    try {
      return JSON.stringify(val)
    } catch {
      return String(val)
    }
  }

  const handleAddExtraParam = () => {
    const key = extraKeyDraft.trim()
    if (!key) return
    const val = parseExtraParamValue(extraValDraft)
    setConfigValue(['ai', 'extra_params', key], val)
    setExtraKeyDraft('')
    setExtraValDraft('')
  }

  const handleRemoveExtraParam = (key: string) => {
    if (extraParamEntries.length <= 1) {
      removeConfigKey(['ai', 'extra_params'])
    } else {
      removeConfigKey(['ai', 'extra_params', key])
    }
  }

  const handleDisableAllAi = () => {
    const patches: Array<{ path: string[]; value: unknown }> = [
      { path: ['ai_analysis', 'enabled'], value: false },
      { path: ['ai_translation', 'enabled'], value: false },
      { path: ['display', 'regions', 'ai_analysis'], value: false },
    ]
    if (filterMethod === 'ai') {
      patches.push({ path: ['filter', 'method'], value: 'keyword' })
    }
    patchConfigValues(patches)
    notify(
      t(
        '已关闭全部 AI 分析与翻译开关，当前可零成本直接运行',
        'Disabled AI analysis & translation — ready to run with zero AI cost',
      ),
      'success',
    )
  }

  const openPromptInSidePanel = (file: 'ai_analysis_prompt.txt' | 'ai_translation_prompt.txt') => {
    if (workspaceMode === 'pro') {
      openSourceTarget({ file, line: 1 })
    } else {
      jumpToSource(file)
    }
  }

  const consumers = [
    {
      id: 'analysis',
      active: aiAnalysisEnabled,
      label: t('AI 深度分析', 'AI Analysis'),
      crossSection: false,
      title: t('点击定位到下方「AI 深度分析」配置', 'Jump to AI Analysis below'),
      onJump: () => {
        focusVisual('ai', 'pro-anchor-ai-analysis')
        if (workspaceMode === 'pro') focusSourceFromForm({ file: 'config.yaml', path: ['ai_analysis'] })
      },
    },
    {
      id: 'translation',
      active: aiTransEnabled,
      label: t('AI 翻译', 'AI Translation'),
      crossSection: false,
      title: t('点击定位到下方「AI 多语言翻译」配置', 'Jump to AI Translation below'),
      onJump: () => {
        focusVisual('ai', 'pro-anchor-ai-translation')
        if (workspaceMode === 'pro') focusSourceFromForm({ file: 'config.yaml', path: ['ai_translation'] })
      },
    },
    {
      id: 'filter',
      active: filterMethod === 'ai',
      label: t('AI 智能筛选', 'AI Smart Filter'),
      crossSection: true,
      title: t('点击前往「02 内容筛选 · AI 智能筛选」查看或开启', 'Go to 02 Content Filter (AI mode)'),
      onJump: () => {
        focusVisual('filter', 'pro-anchor-ai-interests', { filterMode: 'ai' })
        if (workspaceMode === 'pro') focusSourceFromForm({ file: 'config.yaml', path: ['ai_filter'] })
      },
    },
    {
      id: 'search_smart',
      active: smartSearchActive,
      label: t('Smart 联网搜索', 'Smart Web Search'),
      crossSection: true,
      title: t('点击前往「01 信息来源 · 定时联网搜索」查看或开启', 'Go to 01 Data Sources (Web Search)'),
      onJump: () => {
        setSourcesSubTab('search')
        focusVisual('sources', 'pro-anchor-search')
        if (workspaceMode === 'pro') focusSourceFromForm({ file: 'config.yaml', path: ['web_search'] })
      },
    },
  ]

  const activeConsumerCount = consumers.filter((c) => c.active).length

  const analysisModeOptions = useMemo(
    () => [
      {
        value: 'follow_report',
        label: t('跟随全局报告模式 (follow_report)', 'Follow Report Mode (follow_report)'),
        hint: t('当前跟随 report.mode = {v0}', 'Currently follows report.mode = {v0}', { v0: reportMode }),
      },
      {
        value: 'daily',
        label: t('当日汇总 (daily)', 'Daily Digest (daily)'),
        hint: t('独立强制分析当天全部热榜', 'Force full-day hotlist analysis'),
      },
      {
        value: 'current',
        label: t('当前榜单 (current)', 'Current Snapshot (current)'),
        hint: t('独立强制分析当前在榜热榜', 'Force current snapshot hotlist analysis'),
      },
      {
        value: 'incremental',
        label: t('增量监控 (incremental)', 'Incremental (incremental)'),
        hint: t('独立强制仅分析新增热榜', 'Force newly-added hotlist analysis'),
      },
    ],
    [reportMode, t],
  )

  const translationScopeCards: Array<{
    key: 'hotlist' | 'rss' | 'web_search' | 'standalone'
    regionKey: RegionKey
    checked: boolean
    regionOn: boolean
    title: string
    desc: string
  }> = [
    {
      key: 'hotlist',
      regionKey: 'hotlist',
      checked: scopeHotlist,
      regionOn: regionHotlist,
      title: t('热榜标题', 'Hotlist Headlines'),
      desc: t('翻译各平台热榜新闻标题', 'Translate trending platform headlines'),
    },
    {
      key: 'rss',
      regionKey: 'rss',
      checked: scopeRss,
      regionOn: regionRss,
      title: t('RSS 订阅标题', 'RSS Feed Titles'),
      desc: t('外文博客与资讯流自动翻译', 'Auto-translate foreign RSS feeds'),
    },
    {
      key: 'web_search',
      regionKey: 'web_search',
      checked: scopeWebSearch,
      regionOn: regionWebSearch,
      title: t('联网搜索结果', 'Web Search Results'),
      desc: t('翻译海外检索标题与摘要', 'Translate international search results'),
    },
    {
      key: 'standalone',
      regionKey: 'standalone',
      checked: scopeStandalone,
      regionOn: regionStandalone,
      title: t('独立展示区', 'Standalone Region'),
      desc: t('翻译独立源中的外文标题', 'Translate standalone source titles'),
    },
  ]

  return (
    <SectionShell
      sectionId="ai"
      stepNumber="STEP 03"
      title={t('AI 引擎、分析与翻译', 'AI Engine, Analysis & Translation')}
      subtitle={t(
        '配置一次共享大模型，即可驱动分析、翻译、智能筛选与联网搜索。',
        'Configure one shared LLM to power analysis, translation, smart filter, and search.',
      )}
      docSlug="ai-analysis"
      sourceFile="config.yaml"
    >
      {/* ================================================================= */}
      {/* CARD 1: SHARED AI MODEL ENGINE (ai)                               */}
      {/* ================================================================= */}
      <Card id="pro-anchor-ai-model" className="scroll-mt-4 p-6 space-y-6">
        {/* Header + 4 Live Consumer Status Badges */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-primary)]">
                <Cpu className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">
                    {t('共享 AI 模型引擎', 'Shared AI Model Engine')}
                  </h2>
                  <code className="rounded-md bg-[var(--bg-muted)] px-2 py-0.5 font-mono text-xs text-[var(--text-muted)]">
                    ai
                  </code>
                  <Badge tone={activeConsumerCount > 0 ? 'brand' : 'neutral'}>
                    {t('{v0} / 4 项功能已联动', '{v0} / 4 active', { v0: activeConsumerCount })}
                  </Badge>
                </div>
                <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                  {t(
                    '一次配置模型与密钥，以下 AI 模块共用。',
                    'One model & key shared across the AI features below.',
                  )}
                </p>
              </div>
            </div>

            {(aiAnalysisEnabled || aiTransEnabled || filterMethod === 'ai') && (
              <Button
                variant="outline"
                size="xs"
                onClick={handleDisableAllAi}
                title={t(
                  '关闭 AI 深度分析与翻译并隐藏 AI 展示区，无需 API Key 即可零成本运行',
                  'Turn off AI analysis & translation to run TrendRadar with zero API cost',
                )}
              >
                <EyeOff className="h-3.5 w-3.5" />
                <span>{t('暂不使用 AI（零成本运行）', 'Skip AI (Zero Cost)')}</span>
              </Button>
            )}
          </div>

          {/* 4 Interactive Consumer Status Badges */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/60 px-3.5 py-2.5">
            {consumers.map((c) => (
              <button
                key={c.id}
                type="button"
                data-ai-consumer={c.id}
                title={c.title}
                onClick={c.onJump}
                className={cn(
                  'tr-focus-ring group inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium transition-all cursor-pointer',
                  c.active
                    ? 'border-teal-500/30 bg-teal-500/10 text-teal-700 hover:border-teal-500/55 hover:bg-teal-500/18 dark:text-teal-300'
                    : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-[var(--brand-border)] hover:bg-[var(--brand-soft)]/50 hover:text-[var(--text-primary)]',
                )}
              >
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    c.active ? 'bg-teal-500' : 'bg-[var(--border-strong)] group-hover:bg-[var(--brand-primary)]/60',
                  )}
                />
                <span>{c.label}</span>
                {c.crossSection ? (
                  <ArrowUpRight className="h-3 w-3 shrink-0 opacity-55 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                ) : (
                  <ArrowDown className="h-3 w-3 shrink-0 opacity-55 transition-transform group-hover:translate-y-0.5 group-hover:opacity-100" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Core 1: Provider One-Click Presets (1 Row x 3 Columns) */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {t('常用接入方式一键预设', 'Quick Provider Presets')}
            </span>
            <span className="text-[13px] text-[var(--text-muted)]">
              {t('点选自动填入模型标识；其他官方模型直接改下方 model 即可', 'Click to fill model & endpoint; edit model below for other providers')}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 @min-[34rem]/section:grid-cols-3">
            {AI_PROVIDER_PRESETS.map((preset) => {
              const isMatched = preset.isRelay
                ? trimmedBase.length > 0 &&
                  trimmedModel.startsWith('openai/') &&
                  !trimmedBase.includes('localhost:11434')
                : trimmedModel === preset.model && trimmedBase === preset.apiBase
              const displayName = getPresetDisplayName(preset, lang)
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyProviderPreset(preset)}
                  className={cn(
                    'tr-focus-ring flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all cursor-pointer',
                    isMatched
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-soft)]/55 ring-1 ring-[var(--brand-primary)]/20'
                      : 'border-[var(--border-default)] bg-[var(--bg-base)]/70 hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {displayName}
                    </span>
                    {isMatched && (
                      <Check className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                    )}
                  </div>
                  <code className="mt-1.5 truncate font-mono text-xs text-[var(--brand-primary)]">
                    {preset.model}
                  </code>
                  <span className="mt-1 line-clamp-1 text-[13px] leading-relaxed text-[var(--text-muted)]">
                    {t(preset.hintZh, preset.hintEn)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Core 2 & 3: Model & API Key */}
        <div className="divide-y divide-[var(--border-default)] border-t border-[var(--border-default)] pt-2">
          <SettingRow
            label={t('模型标识 (model)', 'Model Identifier (model)')}
            description={t(
              '采用「提供商/模型名」格式，如 deepseek/deepseek-v4-flash。',
              'Use "provider/model" format, e.g. deepseek/deepseek-v4-flash.',
            )}
            tooltip={t(
              'TrendRadar 通过 LiteLLM 统一路由大模型，斜杠前的提供商前缀决定调用协议（官方直连如 deepseek/、openai/、gemini/；第三方中转站需用 openai/ 前缀）。',
              'TrendRadar routes requests via LiteLLM using the provider prefix (e.g. deepseek/, openai/, gemini/; use openai/ for OpenAI-compatible relays).',
            )}
            vertical
          >
            <div className="space-y-2">
              <div className="flex flex-col gap-2 @min-[40rem]/section:flex-row @min-[40rem]/section:items-center">
                <Input
                  value={aiModel}
                  onChange={(e) => setConfigValue(['ai', 'model'], e.target.value)}
                  placeholder="deepseek/deepseek-v4-flash"
                  className={cn(
                    'font-mono text-sm flex-1',
                    modelMissingSlash && 'border-amber-500/70 focus:border-amber-500',
                  )}
                  spellCheck={false}
                />

                {needsOpenAiPrefixHint && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrependOpenAiPrefix}
                    className="h-10 shrink-0 border-amber-500/40 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 dark:text-amber-200"
                  >
                    <Wand2 className="h-4 w-4" />
                    <span>{t('一键添加 openai/ 前缀', 'Add openai/ Prefix')}</span>
                  </Button>
                )}
              </div>

              {modelMissingSlash && (
                <p className="flex items-center gap-1.5 text-[13px] leading-relaxed text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    {t(
                      '缺少「提供商/」前缀（如 deepseek/ 或 openai/），运行时会校验失败。',
                      'Missing "provider/" prefix (e.g. deepseek/ or openai/). LiteLLM requires it.',
                    )}
                  </span>
                </p>
              )}
            </div>
          </SettingRow>

          <SettingRow
            label={t('API 密钥 (api_key)', 'API Key (api_key)')}
            envVar="AI_API_KEY"
            description={t(
              '建议留空，改用环境变量或 GitHub Secrets 注入。',
              'Recommended: leave blank and inject via AI_API_KEY env/Secrets.',
            )}
            tooltip={t(
              '将明文密钥直接写入 config.yaml 并上传公开仓库存在泄露风险；留空后系统会自动读取环境变量 AI_API_KEY。',
              'Avoid committing plaintext keys to Git. When blank, TrendRadar automatically reads AI_API_KEY from environment variables.',
            )}
            vertical
          >
            <SecretInput
              value={aiApiKey}
              onChange={(v) => setConfigValue(['ai', 'api_key'], v)}
              envVar="AI_API_KEY"
              placeholder={t(
                '留空时自动读取环境变量 AI_API_KEY',
                'Leave blank to read from AI_API_KEY environment variable',
              )}
            />
          </SettingRow>
        </div>

        {/* Progressive Disclosure 1: Custom API Base / Relay (collapsed when empty) */}
        <AdvancedCollapsible
          id="pro-anchor-ai-relay"
          key={`ai-relay-${relayOpenNonce}`}
          defaultOpen={trimmedBase.length > 0}
          sourceTarget={{ file: 'config.yaml', path: ['ai', 'api_base'] }}
          title={t('第三方中转站 / 本地接口 (api_base)', 'Custom Relay / Local Endpoint (api_base)')}
          description={t(
            '官方直连留空即可；使用中转站或 Ollama 本地模型时展开',
            'Leave blank for official APIs; expand for relays or Ollama',
          )}
          customizedCount={trimmedBase.length > 0 ? 1 : 0}
          icon={<Link2 className="h-4 w-4" />}
        >
          <div className="space-y-4">
            <SettingRow
              label={t('自定义 API 地址 (api_base)', 'Custom API Base URL (api_base)')}
              description={t(
                '填写中转站或本地部署地址，通常以 /v1 结尾。',
                'Enter your relay or local endpoint URL (usually ending with /v1).',
              )}
              vertical
            >
              <Input
                value={aiApiBase}
                onChange={(e) => setConfigValue(['ai', 'api_base'], e.target.value)}
                placeholder={t(
                  '示例：https://your-relay.example.com/v1',
                  'e.g. https://your-relay.example.com/v1',
                )}
                className="font-mono text-sm"
                spellCheck={false}
              />
            </SettingRow>

            <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/70 px-4 py-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
              <div className="space-y-1">
                <div className="font-semibold text-[var(--text-primary)]">
                  {t('中转站接入两步法', 'Two-step relay setup')}
                </div>
                <p className="text-[var(--text-muted)]">
                  {t(
                    '1) 在上方填入中转站地址（通常以 /v1 结尾）；2) 在模型标识前加上 openai/ 前缀（如 openai/deepseek-ai/DeepSeek-V3）以启用 OpenAI 兼容协议。',
                    '1) Paste the relay URL above (usually ending in /v1); 2) Prefix model with openai/ (e.g. openai/deepseek-ai/DeepSeek-V3) for OpenAI-compatible routing.',
                  )}
                </p>
              </div>
            </div>
          </div>
        </AdvancedCollapsible>

        {/* Progressive Disclosure 2: Generation params & Fallbacks */}
        <AdvancedCollapsible
          id="pro-anchor-ai-advanced"
          sourceTarget={{ file: 'config.yaml', path: ['ai', 'timeout'] }}
          title={t('生成参数与容错回退（进阶）', 'Generation Parameters & Fallbacks (Advanced)')}
          description={t(
            '超时时间、采样温度、最大 Token、重试次数与备用模型',
            'Timeout, temperature, max_tokens, retries, and fallback models',
          )}
          customizedCount={aiAdvancedCustomizedCount}
          icon={<SlidersHorizontal className="h-4 w-4" />}
        >
          <div className="divide-y divide-[var(--border-default)]">
            <SettingRow
              label={t('请求超时秒数 (timeout)', 'Request Timeout (timeout)')}
              description={t(
                '单次 API 调用的最长等待秒数，默认 120 秒。',
                'Max wait seconds per LLM request (default 120s).',
              )}
            >
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={10}
                  max={600}
                  step={10}
                  value={aiTimeout}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10)
                    if (Number.isFinite(n) && n > 0) {
                      setConfigValue(['ai', 'timeout'], n)
                    }
                  }}
                  className="h-9 w-28 font-mono text-sm text-right"
                />
                <span className="text-[13px] text-[var(--text-muted)]">{t('秒', 's')}</span>
              </div>
            </SettingRow>

            <SettingRow
              label={t('采样温度 (temperature)', 'Temperature (temperature)')}
              description={t(
                '0.0 ~ 2.0，越低输出越稳定保守。',
                'Range 0.0–2.0; lower values are more deterministic.',
              )}
              tooltip={t(
                '注意：部分推理模型（如 GPT-5 系列）强制要求 temperature 为 1.0，修改为其他值会报错。',
                'Note: some reasoning models (such as GPT-5) require temperature to be exactly 1.0.',
              )}
            >
              <div className="flex w-full @min-[40rem]/section:w-60 items-center gap-3">
                <Slider
                  min={0}
                  max={2}
                  step={0.1}
                  value={Number.isFinite(aiTemperature) ? aiTemperature : 1.0}
                  onValueChange={(v) =>
                    setConfigValue(['ai', 'temperature'], Math.round(v * 10) / 10)
                  }
                  className="flex-1"
                />
                <span className="min-w-[40px] text-right font-mono text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                  {(Number.isFinite(aiTemperature) ? aiTemperature : 1.0).toFixed(1)}
                </span>
              </div>
            </SettingRow>

            <SettingRow
              label={t('最大生成 Token (max_tokens)', 'Max Output Tokens (max_tokens)')}
              description={t(
                '默认 5000；填 0 表示不发送该参数。',
                'Default 5000; set 0 to omit from API requests.',
              )}
              tooltip={t(
                '若第三方中转站或模型因 max_tokens 参数报 HTTP 400 错误，请将其设为 0。',
                'If a strict relay or model returns HTTP 400 on max_tokens, set this to 0.',
              )}
            >
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={64000}
                  step={500}
                  value={aiMaxTokens}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10)
                    if (Number.isFinite(n) && n >= 0) {
                      setConfigValue(['ai', 'max_tokens'], n)
                    }
                  }}
                  className="h-9 w-28 font-mono text-sm text-right"
                />
                {aiMaxTokens === 0 && (
                  <Badge tone="neutral">{t('不发送参数', 'Omitted')}</Badge>
                )}
              </div>
            </SettingRow>

            <SettingRow
              label={t('失败重试次数 (num_retries)', 'Retry Attempts (num_retries)')}
              description={t(
                '网络波动或限流时的自动重试次数（默认 1）。',
                'Automatic retries on transient errors or rate limits (default 1).',
              )}
            >
              <Input
                type="number"
                min={0}
                max={10}
                step={1}
                value={aiNumRetries}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10)
                  if (Number.isFinite(n) && n >= 0) {
                    setConfigValue(['ai', 'num_retries'], n)
                  }
                }}
                className="h-9 w-28 font-mono text-sm text-right"
              />
            </SettingRow>

            <SettingRow
              label={t('备用回退模型 (fallback_models)', 'Fallback Models (fallback_models)')}
              description={t(
                '主模型失败时按顺序降级尝试，格式同 model。',
                'Tried in order if the primary model fails (provider/model format).',
              )}
              vertical
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={newFallback}
                    onChange={(e) => setNewFallback(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddFallbackModel()
                      }
                    }}
                    placeholder="openai/gpt-4o-mini"
                    className="h-9 flex-1 font-mono text-sm"
                    spellCheck={false}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddFallbackModel}
                    disabled={!newFallback.trim()}
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('添加', 'Add')}</span>
                  </Button>
                </div>

                {fallbackModels.length === 0 ? (
                  <p className="text-[13px] text-[var(--text-muted)]">
                    {t('暂未配置备用模型。', 'No fallback models configured.')}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {fallbackModels.map((fm, idx) => (
                      <span
                        key={`${fm}-${idx}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-base)] py-1 pl-3 pr-2 font-mono text-xs text-[var(--text-primary)]"
                      >
                        <span className="text-[var(--text-muted)]">#{idx + 1}</span>
                        <span>{fm}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFallbackModel(idx)}
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                          aria-label={t('移除备用模型', 'Remove fallback model')}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </SettingRow>

            <SettingRow
              label={t('模型附加参数 (extra_params)', 'Extra Model Params (extra_params)')}
              description={t(
                '给模型接口额外附带的参数（如 reasoning_effort、thinking、top_p），平时留空即可。',
                'Optional extra fields passed to the LLM request (e.g. reasoning_effort, thinking, top_p); normally leave empty.',
              )}
              sourceTarget={{ file: 'config.yaml', path: ['ai', 'extra_params'] }}
              vertical
            >
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 @min-[40rem]/section:grid-cols-[180px_1fr_auto]">
                  <Input
                    value={extraKeyDraft}
                    onChange={(e) => setExtraKeyDraft(e.target.value)}
                    placeholder={t('参数名，如 reasoning_effort', 'Key, e.g. reasoning_effort')}
                    className="h-9 font-mono text-sm"
                    spellCheck={false}
                  />
                  <Input
                    value={extraValDraft}
                    onChange={(e) => setExtraValDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddExtraParam()
                      }
                    }}
                    placeholder={t('值，如 low、0.8 或 {"type":"disabled"}', 'Value, e.g. low, 0.8, or {"type":"disabled"}')}
                    className="h-9 font-mono text-sm"
                    spellCheck={false}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddExtraParam}
                    disabled={!extraKeyDraft.trim()}
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('设置', 'Set')}</span>
                  </Button>
                </div>

                {extraParamEntries.length === 0 ? (
                  <p className="text-[13px] text-[var(--text-muted)]">
                    {t('暂未设置额外参数（默认不附加）。', 'No extra_params set.')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {extraParamEntries.map(([k, v]) => (
                      <div
                        key={k}
                        className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2"
                      >
                        <code className="font-mono text-xs font-semibold text-[var(--brand-primary)]">
                          {k}
                        </code>
                        <span className="text-[var(--text-muted)]">=</span>
                        <Input
                          value={formatExtraParamValue(v)}
                          onChange={(e) =>
                            setConfigValue(['ai', 'extra_params', k], parseExtraParamValue(e.target.value))
                          }
                          className="h-8 flex-1 min-w-[160px] font-mono text-xs"
                          spellCheck={false}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveExtraParam(k)}
                          className="h-7 w-7 text-[var(--text-muted)] hover:text-red-500"
                          aria-label={t('删除参数 {v0}', 'Remove {v0}', { v0: k })}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SettingRow>
          </div>
        </AdvancedCollapsible>
      </Card>

      {/* ================================================================= */}
      {/* CARD 2: AI DEEP ANALYSIS (ai_analysis)                            */}
      {/* ================================================================= */}
      <ToggleSectionCard
        id="pro-anchor-ai-analysis"
        icon={<Brain className="h-5 w-5" />}
        title={t('AI 深度分析', 'AI Deep Analysis')}
        description={t(
          '自动提炼热点脉络、舆论风向与核心结论。',
          'Synthesizes headlines into structured trends and takeaways.',
        )}
        badge={
          aiAnalysisEnabled ? (
            !regionAiAnalysis ? (
              <Badge tone="warning">{t('展示区未开启', 'Region Hidden')}</Badge>
            ) : (
              <Badge tone="brand">{t('已启用', 'Enabled')}</Badge>
            )
          ) : (
            <Badge tone="neutral">{t('已关闭', 'Off')}</Badge>
          )
        }
        checked={aiAnalysisEnabled}
        forceExpanded={activeSourceFile === 'ai_analysis_prompt.txt' || analysisPromptOpenSeq > 0 || visualFocusTarget?.anchor === 'pro-anchor-ai-analysis'}
        onCheckedChange={(v) => setConfigValue(['ai_analysis', 'enabled'], v)}
      >
        {/* Core 2 common items visible by default */}
        <div className="divide-y divide-[var(--border-default)]">
          {/* Output Language */}
          <SettingRow
            label={t('输出语言 (language)', 'Output Language (language)')}
            description={t(
              '点选常用语言，或直接输入自定义语言名称。',
              'Pick a preset or type any custom language.',
            )}
            vertical
          >
            <div className="flex flex-col gap-2.5 @min-[40rem]/section:flex-row @min-[40rem]/section:items-center">
              <div className="flex flex-wrap items-center gap-2">
                {ANALYSIS_LANG_PRESETS.map((opt) => {
                  const active = analysisLang === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setConfigValue(['ai_analysis', 'language'], opt.value)}
                      className={cn(
                        'tr-focus-ring rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors cursor-pointer',
                        active
                          ? 'border-[var(--brand-primary)] bg-[var(--brand-soft)] text-[var(--brand-primary)]'
                          : 'border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
                      )}
                    >
                      {t(opt.labelZh, opt.labelEn)}
                    </button>
                  )
                })}
              </div>
              <Input
                value={analysisLang}
                onChange={(e) => setConfigValue(['ai_analysis', 'language'], e.target.value)}
                placeholder={t('自定义语言名称', 'Custom language')}
                className="h-9 @min-[40rem]/section:w-48 text-sm"
              />
            </div>
          </SettingRow>

          {/* Max news for analysis */}
          <SettingRow
            label={t('参与分析新闻上限 (max_news_for_analysis)', 'Max News for Analysis')}
            description={t(
              '控制 Token 消耗的核心上限，默认 150 条。',
              'Main token-cost cap for items sent to AI (default 150).',
            )}
            tooltip={t(
              '配额按优先级分配：热榜优先占用，RSS 使用剩余配额；独立展示区不受此数量上限约束。',
              'Hotlist items use quota first, RSS takes the remaining quota, and Standalone region is exempt.',
            )}
            vertical
          >
            <div className="flex items-center gap-3.5">
              <Slider
                min={10}
                max={400}
                step={10}
                value={Math.min(400, Math.max(10, Number.isFinite(maxNewsForAnalysis) ? maxNewsForAnalysis : 150))}
                onValueChange={(v) => setConfigValue(['ai_analysis', 'max_news_for_analysis'], v)}
                className="flex-1"
              />
              <Input
                type="number"
                min={10}
                max={1000}
                step={10}
                value={maxNewsForAnalysis}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10)
                  if (Number.isFinite(n) && n >= 1) {
                    setConfigValue(['ai_analysis', 'max_news_for_analysis'], n)
                  }
                }}
                className="h-9 w-24 font-mono text-sm text-right shrink-0"
              />
              <span className="text-[13px] text-[var(--text-muted)] shrink-0">
                {t('条', 'items')}
              </span>
            </div>
          </SettingRow>
        </div>

        {/* Progressive Disclosure: More Analysis Scope & Mode */}
        <AdvancedCollapsible
          id="pro-anchor-ai-analysis-scope"
          sourceTarget={{ file: 'config.yaml', path: ['ai_analysis', 'mode'] }}
          title={t('更多分析范围与模式', 'More Analysis Scope & Mode')}
          description={t(
            '独立分析模式，以及 RSS / 搜索 / 独立区 / 排名轨迹纳入开关',
            'Analysis mode override and RSS / Search / Standalone / timeline toggles',
          )}
          customizedCount={analysisScopeCustomizedCount}
          icon={<SlidersHorizontal className="h-4 w-4" />}
        >
          <div className="space-y-5">
            {/* Analysis Mode */}
            <SettingRow
              label={t('AI 分析模式 (mode)', 'AI Analysis Mode (mode)')}
              description={t(
                '默认跟随全局报告模式，也可独立固定。',
                'Follows report.mode by default or overrides independently.',
              )}
              vertical
            >
              <div className="space-y-2.5">
                <SelectField
                  value={analysisMode}
                  onValueChange={(v) => setConfigValue(['ai_analysis', 'mode'], v)}
                  options={analysisModeOptions}
                />

                {independentAnalysisDiffers && (
                  <Callout
                    tone="warning"
                    icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
                  >
                    {t('独立分析模式（{v0}）与报告模式（{v1}）不同：此时仅分析热榜，不包含 RSS、搜索与独立区。', 'Independent mode ({v0}) differs from report.mode ({v1}): analyzes hotlists only and skips RSS, Search, and Standalone.', { v0: analysisMode, v1: reportMode })}
                  </Callout>
                )}
              </div>
            </SettingRow>

            {/* Included Data Dimensions Grid */}
            <div className="border-t border-[var(--border-default)] pt-4 space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  {t('纳入分析的数据源', 'Data Sources Included in Analysis')}
                </div>
                <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                  {t(
                    '按需勾选投喂给 AI 的额外上下文维度。',
                    'Choose extra context dimensions sent to the LLM.',
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 @min-[40rem]/section:grid-cols-2">
                {/* include_rss */}
                <div
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-xl border p-4 transition-colors',
                    includeRss
                      ? 'border-[var(--brand-border)] bg-[var(--brand-soft)]/35'
                      : 'border-[var(--border-default)] bg-[var(--bg-base)]/60',
                  )}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Rss className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                    <div className="space-y-1 min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        {t('纳入 RSS 订阅', 'Include RSS Feeds')}
                      </div>
                      <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                        {t('补充垂直博客与媒体视角', 'Add specialist blog & RSS context')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={includeRss}
                    onCheckedChange={(v) => setConfigValue(['ai_analysis', 'include_rss'], v)}
                    ariaLabel={t('纳入 RSS 订阅', 'Include RSS feeds')}
                  />
                </div>

                {/* include_web_search */}
                <div
                  className={cn(
                    'flex flex-col rounded-xl border p-4 transition-colors',
                    includeWebSearch
                      ? 'border-[var(--brand-border)] bg-[var(--brand-soft)]/35'
                      : 'border-[var(--border-default)] bg-[var(--bg-base)]/60',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Globe className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                      <div className="space-y-1 min-w-0">
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                          {t('纳入联网搜索', 'Include Web Search')}
                        </div>
                        <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                          {t('将搜索结果与摘要交给 AI 研判', 'Feed search results & snippets to AI')}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={includeWebSearch}
                      onCheckedChange={(v) =>
                        setConfigValue(['ai_analysis', 'include_web_search'], v)
                      }
                      ariaLabel={t('纳入联网搜索结果', 'Include web search')}
                    />
                  </div>

                  <Collapsible open={includeWebSearch}>
                    <CollapsibleContent className="tr-collapsible-content">
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border-default)] pt-3">
                        <span className="text-[13px] text-[var(--text-secondary)]">
                          {t('单条摘要上限', 'Max snippet chars')}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min={50}
                            max={2000}
                            step={50}
                            value={searchSummaryMaxChars}
                            onChange={(e) => {
                              const n = Number.parseInt(e.target.value, 10)
                              if (Number.isFinite(n) && n > 0) {
                                setConfigValue(['ai_analysis', 'search_summary_max_chars'], n)
                              }
                            }}
                            className="h-9 w-24 font-mono text-sm text-right"
                          />
                          <span className="text-[13px] text-[var(--text-muted)]">
                            {t('字', 'ch')}
                          </span>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>

                {/* include_standalone */}
                <div
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-xl border p-4 transition-colors',
                    includeStandalone
                      ? 'border-[var(--brand-border)] bg-[var(--brand-soft)]/35'
                      : 'border-[var(--border-default)] bg-[var(--bg-base)]/60',
                  )}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Layers className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                    <div className="space-y-1 min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        {t('纳入独立展示区', 'Include Standalone')}
                      </div>
                      <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                        {t('为独立源单独输出去重概括', 'Summarize standalone sources separately')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={includeStandalone}
                    onCheckedChange={(v) => setConfigValue(['ai_analysis', 'include_standalone'], v)}
                    ariaLabel={t('纳入独立展示区', 'Include standalone region')}
                  />
                </div>

                {/* include_rank_timeline */}
                <div
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-xl border p-4 transition-colors',
                    includeRankTimeline
                      ? 'border-[var(--brand-border)] bg-[var(--brand-soft)]/35'
                      : 'border-[var(--border-default)] bg-[var(--bg-base)]/60',
                  )}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {t('包含排名轨迹', 'Include Rank Timeline')}
                        </span>
                        <Badge tone="warning">{t('+0.5~1x Token', '+0.5–1x Tokens')}</Badge>
                      </div>
                      <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                        {t('传入完整排名走势，急升判断更准', 'Sends full rank history for trend precision')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={includeRankTimeline}
                    onCheckedChange={(v) =>
                      setConfigValue(['ai_analysis', 'include_rank_timeline'], v)
                    }
                    ariaLabel={t('包含完整排名轨迹', 'Include full rank timeline')}
                  />
                </div>
              </div>
            </div>
          </div>
        </AdvancedCollapsible>

        {/* Prompt File Entry (Opens in Side Source Drawer / Left Pane instead of inline editor) */}
        <AdvancedCollapsible
          id="pro-anchor-ai-analysis-prompt"
          forceOpenSeq={analysisPromptOpenSeq}
          title={t(
            '分析提示词模板（一般无需修改）',
            'Analysis Prompt Template (Optional)',
          )}
          description={t(
            '内置提示词已针对热点脉络提炼调优；如需自定义文风可在侧边文件栏打开查看',
            'Built-in prompt is pre-tuned; open in the side file panel only if you want custom tone',
          )}
          customizedCount={analysisPromptCustomized}
          icon={<FileCode2 className="h-4 w-4" />}
        >
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border-default)] bg-[var(--bg-subtle)]/50 px-4 py-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                  <FileCode2 className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                  <span>{t('Prompt 文件', 'Prompt File')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomAnalysisPath((v) => !v)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-pointer"
                >
                  {showCustomAnalysisPath || analysisPromptFile !== 'ai_analysis_prompt.txt'
                    ? t('收起路径设置', 'Hide path')
                    : t('指定其他文件名', 'Custom filename')}
                </button>
              </div>

              <div className="flex flex-col gap-3 px-4 py-3.5 @min-[40rem]/section:flex-row @min-[40rem]/section:items-center @min-[40rem]/section:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {t('AI 分析提示词', 'AI Analysis Prompt')}
                    </span>
                    <Badge tone="warning">{t('谨慎修改', 'Edit with care')}</Badge>
                    {analysisPromptText !== baselineFiles['ai_analysis_prompt.txt'] && (
                      <Badge tone="brand">{t('已修改', 'Modified')}</Badge>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                    {t(
                      '自定义 AI 新闻总结的分析框架与语气。默认模板开箱即用；若自行调整，请保留文件中的 [system]、[user] 和 {news_content} 标记。',
                      'Customizes the tone and structure of AI news summaries. Keep [system], [user], and {news_content} intact if editing.',
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <code className="rounded-md bg-[var(--bg-subtle)] px-2 py-1 font-mono text-xs text-[var(--text-muted)]">
                    {analysisPromptFile}
                  </code>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => openPromptInSidePanel('ai_analysis_prompt.txt')}
                  >
                    <Code2 className="h-3.5 w-3.5" />
                    <span>
                      {workspaceMode === 'pro'
                        ? t('在左侧查看文件', 'Open in Left Pane')
                        : t('在侧边栏查看文件', 'Open in Side Panel')}
                    </span>
                  </Button>
                  {analysisPromptText !== baselineFiles['ai_analysis_prompt.txt'] && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setChangesRequest({ file: 'ai_analysis_prompt.txt', restoreFile: true })}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{t('恢复默认', 'Reset')}</span>
                    </Button>
                  )}
                </div>
              </div>

              {(showCustomAnalysisPath || analysisPromptFile !== 'ai_analysis_prompt.txt') && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-default)] bg-[var(--bg-subtle)]/35 px-4 py-2.5">
                  <span className="text-xs text-[var(--text-secondary)]">
                    {t('自定义提示词文件名（相对于 config/ 目录）', 'Custom prompt filename (relative to config/)')}
                  </span>
                  <Input
                    value={analysisPromptFile}
                    onChange={(e) => setConfigValue(['ai_analysis', 'prompt_file'], e.target.value)}
                    placeholder="ai_analysis_prompt.txt"
                    className="h-8 w-56 font-mono text-xs"
                    spellCheck={false}
                  />
                </div>
              )}
            </div>

            {(!analysisContract.hasSystem || !analysisContract.hasUser || !analysisContract.hasNewsContent) && (
              <Callout
                tone="danger"
                icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
                title={t('分析提示词缺少必需占位符，运行时会报错或漏掉新闻内容', 'Analysis prompt is missing required placeholders')}
                action={
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => openPromptInSidePanel('ai_analysis_prompt.txt')}
                  >
                    {t('打开检查', 'Inspect')}
                  </Button>
                }
              >
                {t(
                  '请确保 ai_analysis_prompt.txt 中同时保留 [system]、[user] 与 {news_content}。',
                  'Ensure [system], [user], and {news_content} are all present in ai_analysis_prompt.txt.',
                )}
              </Callout>
            )}
          </div>
        </AdvancedCollapsible>
      </ToggleSectionCard>

      {/* ================================================================= */}
      {/* CARD 3: AI MULTI-LANGUAGE TRANSLATION (ai_translation)            */}
      {/* ================================================================= */}
      <ToggleSectionCard
        id="pro-anchor-ai-translation"
        icon={<Languages className="h-5 w-5" />}
        title={t('AI 多语言翻译', 'AI Multi-Language Translation')}
        description={t(
          '自动翻译外文新闻标题为你的目标语言。',
          'Automatically translates headlines into your target language.',
        )}
        badge={
          aiTransEnabled ? (
            <Badge tone="brand">
              {transLang === '中文' ? t('中文', 'Chinese') : transLang || t('中文', 'Chinese')}
            </Badge>
          ) : (
            <Badge tone="neutral">{t('已关闭', 'Off')}</Badge>
          )
        }
        checked={aiTransEnabled}
        forceExpanded={activeSourceFile === 'ai_translation_prompt.txt' || transPromptOpenSeq > 0 || visualFocusTarget?.anchor === 'pro-anchor-ai-translation'}
        onCheckedChange={(v) => setConfigValue(['ai_translation', 'enabled'], v)}
      >
        <div className="divide-y divide-[var(--border-default)]">
          {/* Target Language */}
          <SettingRow
            label={t('目标语言 (language)', 'Target Language (language)')}
            description={t(
              '点选快捷语言，或输入任意目标语言。',
              'Pick a preset or enter any target language.',
            )}
            vertical
          >
            <div className="flex flex-col gap-2.5 @min-[40rem]/section:flex-row @min-[40rem]/section:items-center">
              <div className="flex flex-wrap items-center gap-2">
                {TRANSLATION_LANG_PRESETS.map((opt) => {
                  const active = transLang === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setConfigValue(['ai_translation', 'language'], opt.value)}
                      className={cn(
                        'tr-focus-ring rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors cursor-pointer',
                        active
                          ? 'border-[var(--brand-primary)] bg-[var(--brand-soft)] text-[var(--brand-primary)]'
                          : 'border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
                      )}
                    >
                      {t(opt.labelZh, opt.labelEn)}
                    </button>
                  )
                })}
              </div>
              <Input
                value={transLang}
                onChange={(e) => setConfigValue(['ai_translation', 'language'], e.target.value)}
                placeholder={t('自定义目标语言', 'Custom target language')}
                className="h-9 @min-[40rem]/section:w-48 text-sm"
              />
            </div>
          </SettingRow>

          {/* Translation Scope 4 Cards */}
          <div className="pt-4 space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {t('翻译作用范围 (scope)', 'Translation Scope (scope)')}
              </div>
              <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                {t(
                  '仅对已勾选且展示区开启的板块生效。',
                  'Applies only where checked here and enabled in display.regions.',
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 @min-[40rem]/section:grid-cols-2">
              {translationScopeCards.map((item) => (
                <div
                  key={item.key}
                  className={cn(
                    'flex flex-col justify-between gap-3 rounded-xl border p-4 transition-colors',
                    item.checked && item.regionOn
                      ? 'border-[var(--brand-border)] bg-[var(--brand-soft)]/35'
                      : 'border-[var(--border-default)] bg-[var(--bg-base)]/60',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {item.key === 'hotlist' ? (
                        <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                      ) : item.key === 'rss' ? (
                        <Rss className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                      ) : item.key === 'web_search' ? (
                        <Globe className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                      ) : (
                        <Layers className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                      )}
                      <div className="space-y-1 min-w-0">
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                          {item.title}
                        </div>
                        <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                          {item.desc}
                        </p>
                      </div>
                    </div>

                    <Switch
                      checked={item.checked}
                      onCheckedChange={(v) =>
                        setConfigValue(['ai_translation', 'scope', item.key], v)
                      }
                      ariaLabel={item.title}
                    />
                  </div>

                  {/* Real-time display.regions cross-status */}
                  <div className="flex items-center justify-between gap-2 border-t border-[var(--border-default)]/70 pt-2.5">
                    <code className="font-mono text-xs text-[var(--text-muted)] truncate">
                      {item.regionKey}
                    </code>
                    {!item.regionOn ? (
                      <Badge tone="neutral">
                        <EyeOff className="h-3 w-3" />
                        <span>{t('展示区未开启', 'Region OFF')}</span>
                      </Badge>
                    ) : item.checked ? (
                      <Badge tone="success">
                        <Sparkles className="h-3 w-3" />
                        <span>{t('生效中', 'Active')}</span>
                      </Badge>
                    ) : (
                      <Badge tone="outline">{t('展示区已开', 'Region ON')}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Advanced Collapsible: Batching & Translation Prompt File Entry */}
        <AdvancedCollapsible
          id="pro-anchor-ai-translation-prompt"
          forceOpenSeq={transPromptOpenSeq}
          title={t(
            '分批速度与翻译提示词（进阶）',
            'Batching & Translation Prompt (Advanced)',
          )}
          description={t(
            '调整分批条数与请求间隔；翻译系统提示词一般不建议修改',
            'Adjust batch size and interval; translation prompt rarely needs changes',
          )}
          customizedCount={transAdvancedCustomized}
          icon={<SlidersHorizontal className="h-4 w-4" />}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 @min-[36rem]/section:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
                  {t('每批翻译条数 (batch_size)', 'Batch Size (batch_size)')}
                </label>
                <Input
                  type="number"
                  min={10}
                  max={500}
                  step={10}
                  value={transBatchSize}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10)
                    if (Number.isFinite(n) && n > 0) {
                      setConfigValue(['ai_translation', 'batch_size'], n)
                    }
                  }}
                  className="h-9 font-mono text-sm"
                />
                <p className="text-xs text-[var(--text-muted)]">
                  {t('每次打包发给模型翻译的标题数量上限（默认 100）。', 'Max titles sent per translation request (default 100).')}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
                  {t('批次等待间隔秒数 (batch_interval)', 'Batch Interval (s)')}
                </label>
                <Input
                  type="number"
                  min={0}
                  max={60}
                  step={0.5}
                  value={transBatchInterval}
                  onChange={(e) => {
                    const n = Number.parseFloat(e.target.value)
                    if (Number.isFinite(n) && n >= 0) {
                      setConfigValue(['ai_translation', 'batch_interval'], n)
                    }
                  }}
                  className="h-9 font-mono text-sm"
                />
                <p className="text-xs text-[var(--text-muted)]">
                  {t('多批翻译之间的等待秒数，避免触发接口限流（默认 2 秒）。', 'Delay between batches to avoid rate limits (default 2s).')}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border-default)] bg-[var(--bg-subtle)]/50 px-4 py-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                  <FileCode2 className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                  <span>{t('Prompt 文件', 'Prompt File')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomTransPath((v) => !v)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-pointer"
                >
                  {showCustomTransPath || transPromptFile !== 'ai_translation_prompt.txt'
                    ? t('收起路径设置', 'Hide path')
                    : t('指定其他文件名', 'Custom filename')}
                </button>
              </div>

              <div className="flex flex-col gap-3 px-4 py-3.5 @min-[40rem]/section:flex-row @min-[40rem]/section:items-center @min-[40rem]/section:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {t('AI 翻译提示词', 'AI Translation Prompt')}
                    </span>
                    <Badge tone="warning">{t('谨慎修改 · 一般无需编辑', 'Rarely needs editing')}</Badge>
                    {transPromptText !== baselineFiles['ai_translation_prompt.txt'] && (
                      <Badge tone="brand">{t('已修改', 'Modified')}</Badge>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                    {t(
                      '控制批量标题翻译的系统提示词。程序依赖其逐行对齐格式把译文贴回原新闻，一般不建议自行修改；如确需查看或微调术语，可在侧边栏打开。',
                      'System prompt for batch headline translation. Output line alignment is strict, so editing is generally not recommended.',
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <code className="rounded-md bg-[var(--bg-subtle)] px-2 py-1 font-mono text-xs text-[var(--text-muted)]">
                    {transPromptFile}
                  </code>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => openPromptInSidePanel('ai_translation_prompt.txt')}
                  >
                    <Code2 className="h-3.5 w-3.5" />
                    <span>
                      {workspaceMode === 'pro'
                        ? t('在左侧查看文件', 'Open in Left Pane')
                        : t('在侧边栏查看文件', 'Open in Side Panel')}
                    </span>
                  </Button>
                  {transPromptText !== baselineFiles['ai_translation_prompt.txt'] && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setChangesRequest({ file: 'ai_translation_prompt.txt', restoreFile: true })}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{t('恢复默认', 'Reset')}</span>
                    </Button>
                  )}
                </div>
              </div>

              {(showCustomTransPath || transPromptFile !== 'ai_translation_prompt.txt') && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-default)] bg-[var(--bg-subtle)]/35 px-4 py-2.5">
                  <span className="text-xs text-[var(--text-secondary)]">
                    {t('自定义提示词文件名（相对于 config/ 目录）', 'Custom prompt filename (relative to config/)')}
                  </span>
                  <Input
                    value={transPromptFile}
                    onChange={(e) => setConfigValue(['ai_translation', 'prompt_file'], e.target.value)}
                    placeholder="ai_translation_prompt.txt"
                    className="h-8 w-56 font-mono text-xs"
                    spellCheck={false}
                  />
                </div>
              )}
            </div>

            {(!transContract.hasSystem || !transContract.hasUser || !transContract.hasTargetLang || !transContract.hasContent) && (
              <Callout
                tone="danger"
                icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
                title={t('翻译提示词缺少必需占位符，会导致翻译失败', 'Translation prompt is missing required placeholders')}
                action={
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => openPromptInSidePanel('ai_translation_prompt.txt')}
                  >
                    {t('打开检查', 'Inspect')}
                  </Button>
                }
              >
                {t(
                  '请确保 ai_translation_prompt.txt 中同时保留 [system]、[user]、{target_language} 与 {content}。',
                  'Ensure [system], [user], {target_language}, and {content} remain in ai_translation_prompt.txt.',
                )}
              </Callout>
            )}
          </div>
        </AdvancedCollapsible>
      </ToggleSectionCard>
    </SectionShell>
  )
}
