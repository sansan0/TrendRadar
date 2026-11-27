import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpToLine,
  BookmarkPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Layers,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { Badge, Button, Input, ModalDialog, Textarea } from '@/components/ui/primitives'
import { toTemplateLang, useT } from '@/i18n'
import {
  buildAiRegexPrompt,
  parsePastedFrequencyLines,
  type ParsedPastedFrequency,
  type WordGroupCreationType,
} from '@/lib/keyword-helpers'
import type { FrequencyItem, Lang } from '@/lib/types'
import { cn, copyToClipboard } from '@/lib/utils'

export interface ExampleGroupTemplate {
  id: string
  labelZh: string
  labelEn: string
  descZh: string
  descEn: string
  groupAliasZh: string
  groupAliasEn: string
  maxCount?: number
  itemsZh: Array<Omit<FrequencyItem, 'id'>>
  itemsEn: Array<Omit<FrequencyItem, 'id'>>
}

export type InsertPosition = 'bottom' | 'top' | number

const QUICK_AI_TOPICS_ZH = ['胖东来', '英伟达', '华为', '宇树机器人']
const QUICK_AI_TOPICS_EN = ['NVIDIA', 'DeepSeek', 'Tesla', 'Anthropic']

/* ============================================================================
 * 1. Word Group Type Creator Modal (4 Structural Types + Quick Presets)
 * ========================================================================== */
export function WordGroupTypeModal({
  open,
  onOpenChange,
  lang,
  templates,
  fixedInsertIndex,
  onSelectType,
  onSelectTemplate,
  onOpenAiRegex,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lang: Lang
  templates: ExampleGroupTemplate[]
  fixedInsertIndex?: number
  onSelectType: (type: WordGroupCreationType, position: InsertPosition) => void
  onSelectTemplate: (tpl: ExampleGroupTemplate, position: InsertPosition) => void
  onOpenAiRegex: (fixedIndex?: number) => void
}) {
  const t = useT()
  const [position, setPosition] = useState<'bottom' | 'top'>('bottom')
  const effectivePosition: InsertPosition =
    typeof fixedInsertIndex === 'number' ? fixedInsertIndex : position

  const typeCards: Array<{
    type: WordGroupCreationType
    badgeZh: string
    badgeEn: string
    titleZh: string
    titleEn: string
    useZh: string
    useEn: string
    previewLines: Array<{ text: string; accent?: 'group' | 'arrow' }>
    cardCls: string
    badgeCls: string
    checkCls: string
    recommended?: boolean
  }> = [
    {
      type: 'group',
      badgeZh: '组别名',
      badgeEn: 'Group Alias',
      titleZh: '多关键词词组（推荐）',
      titleEn: 'Multi-keyword Group (Recommended)',
      useZh: '适用于：多个关键词归为一组，统一显示为组名',
      useEn: 'Best for grouping multiple terms under one unified heading',
      previewLines: [
        { text: toTemplateLang(lang) === 'en' ? '[East Asia]' : '[东亚]', accent: 'group' },
        { text: toTemplateLang(lang) === 'en' ? 'Japan' : '日本' },
        { text: toTemplateLang(lang) === 'en' ? 'South Korea' : '韩国' },
      ],
      cardCls:
        'border-amber-500/35 bg-amber-500/[0.05] hover:border-amber-500/70 hover:bg-amber-500/[0.09]',
      badgeCls: 'bg-amber-600 text-white dark:bg-amber-500 dark:text-slate-950',
      checkCls: 'text-amber-600 dark:text-amber-400',
      recommended: true,
    },
    {
      type: 'alias',
      badgeZh: '单个别名',
      badgeEn: 'Regex + Alias',
      titleZh: '正则 / 关键词 + 别名',
      titleEn: 'Regex / Keyword + Alias',
      useZh: '适用于：用正则匹配多个同义词，显示为一个别名（支持 AI 写正则）',
      useEn: 'Best for matching aliases via /regex/ under one clean display name',
      previewLines: [
        {
          text:
            toTemplateLang(lang) === 'en'
              ? '/NVIDIA|GeForce|\\bRTX\\b/ => NVIDIA'
              : '/胖东来|于东来/ => 胖东来',
          accent: 'arrow',
        },
      ],
      cardCls:
        'border-teal-500/35 bg-teal-500/[0.05] hover:border-teal-500/70 hover:bg-teal-500/[0.09]',
      badgeCls: 'bg-teal-600 text-white dark:bg-teal-500 dark:text-slate-950',
      checkCls: 'text-teal-600 dark:text-teal-400',
    },
    {
      type: 'multi-alias',
      badgeZh: '连续别名组',
      badgeEn: 'Multi-alias',
      titleZh: '多个相关品牌 / 词组',
      titleEn: 'Related Brands / Aliases',
      useZh: '适用于：多个相关品牌放在同一组内（无空行分隔）',
      useEn: 'Best for keeping related brands together without blank lines',
      previewLines: [
        {
          text:
            toTemplateLang(lang) === 'en'
              ? '/OpenAI|ChatGPT|Sora/ => OpenAI'
              : '/智元|灵犀|稚晖君/ => 智元机器人',
          accent: 'arrow',
        },
        {
          text:
            toTemplateLang(lang) === 'en'
              ? '/Anthropic|Claude/ => Claude'
              : '/众擎|EngineAI/ => 众擎机器人',
          accent: 'arrow',
        },
      ],
      cardCls:
        'border-violet-500/35 bg-violet-500/[0.05] hover:border-violet-500/70 hover:bg-violet-500/[0.09]',
      badgeCls: 'bg-violet-600 text-white dark:bg-violet-500 dark:text-white',
      checkCls: 'text-violet-600 dark:text-violet-400',
    },
    {
      type: 'plain',
      badgeZh: '普通词组',
      badgeEn: 'Plain',
      titleZh: '简单关键词',
      titleEn: 'Simple Keyword',
      useZh: '适用于：单个或少量普通关键词，零语法负担',
      useEn: 'Best for 1–2 plain keywords with zero extra syntax',
      previewLines: [{ text: toTemplateLang(lang) === 'en' ? 'Quantum' : '申奥' }],
      cardCls:
        'border-[var(--border-strong)]/70 bg-[var(--bg-subtle)]/55 hover:border-[var(--brand-primary)]/60 hover:bg-[var(--bg-subtle)]',
      badgeCls: 'bg-slate-600 text-white dark:bg-slate-500 dark:text-white',
      checkCls: 'text-[var(--text-secondary)]',
    },
  ]

  return (
    <ModalDialog
      open={open}
      onOpenChange={onOpenChange}
      maxWidthClass="max-w-2xl"
      title={
        <span className="inline-flex items-center gap-2">
          <Layers className="h-5 w-5 text-[var(--brand-primary)]" />
          <span>{t('选择词组类型', 'Choose Keyword Group Type')}</span>
        </span>
      }
      description={t(
        '按你的追踪方式选择结构，创建后均可随时补充 +必须词、!排除词 或 @条数上限。',
        'Pick the structure that fits your topic. You can add +required, !exclude, or @limit rules anytime.',
      )}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenChange(false)
              onOpenAiRegex(fixedInsertIndex)
            }}
          >
            <Wand2 className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
            <span>{t('不懂正则？用 AI 写正则', 'Need regex? Use AI Helper')}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('取消', 'Cancel')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Insert Position Selector or Fixed Inline Position Banner */}
        {typeof fixedInsertIndex === 'number' ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-soft)]/55 px-3 py-2 text-xs text-[var(--text-primary)]">
            <span className="font-medium">
              {fixedInsertIndex === 0
                ? t('将插入到第 #1 位（词组列表最顶部，最高优先级）', 'Will insert at #1 (top of list, highest priority)')
                : t('将插入到第 #{v0} 位（紧接第 #{v1} 组下方）', 'Will insert at #{v0} (right below group #{v1})', { v0: fixedInsertIndex + 1, v1: fixedInsertIndex })}
            </span>
            <Badge tone="brand">#{fixedInsertIndex + 1}</Badge>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/65 px-3 py-2 text-xs">
            <span className="text-[var(--text-secondary)]">
              {t('新建后插入位置（靠前优先级更高）', 'Insert position (top groups match first)')}
            </span>
            <div
              role="group"
              aria-label={t('插入位置', 'Insert position')}
              className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-0.5"
            >
              <button
                type="button"
                onClick={() => setPosition('bottom')}
                aria-pressed={position === 'bottom'}
                className={cn(
                  'tr-focus-ring inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors cursor-pointer',
                  position === 'bottom'
                    ? 'bg-[var(--brand-soft)] text-[var(--brand-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                )}
              >
                <ArrowDownToLine className="h-3 w-3" />
                <span>{t('末尾', 'Bottom')}</span>
              </button>
              <button
                type="button"
                onClick={() => setPosition('top')}
                aria-pressed={position === 'top'}
                className={cn(
                  'tr-focus-ring inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors cursor-pointer',
                  position === 'top'
                    ? 'bg-[var(--brand-soft)] text-[var(--brand-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                )}
              >
                <ArrowUpToLine className="h-3 w-3" />
                <span>{t('顶部（高优）', 'Top (Priority)')}</span>
              </button>
            </div>
          </div>
        )}

        {/* 4 Structural Type Cards */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {typeCards.map((card) => (
            <button
              key={card.type}
              type="button"
              data-group-type-option={card.type}
              onClick={() => onSelectType(card.type, effectivePosition)}
              className={cn(
                'tr-focus-ring group flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all cursor-pointer',
                card.cardCls,
              )}
            >
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold shrink-0', card.badgeCls)}>
                    {t(card.badgeZh, card.badgeEn)}
                  </span>
                  <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {t(card.titleZh, card.titleEn)}
                  </span>
                </div>

                <div className="rounded-lg border border-[var(--border-default)]/80 bg-[var(--bg-surface)] px-2.5 py-2 font-mono text-xs leading-relaxed text-[var(--text-primary)]">
                  {card.previewLines.map((line, i) => {
                    if (line.accent === 'arrow' && line.text.includes(' => ')) {
                      const [lhs, rhs] = line.text.split(' => ')
                      return (
                        <div key={i} className="truncate">
                          <span>{lhs}</span>
                          <span className="mx-1 font-semibold text-[var(--brand-primary)]">=&gt;</span>
                          <span className="font-semibold">{rhs}</span>
                        </div>
                      )
                    }
                    return (
                      <div
                        key={i}
                        className={cn(
                          'truncate',
                          line.accent === 'group' && 'font-semibold text-amber-700 dark:text-amber-300',
                        )}
                      >
                        {line.text}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="mt-2.5 flex items-start gap-1.5 text-xs leading-snug text-[var(--text-secondary)]">
                <CheckCircle2 className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', card.checkCls)} />
                <span>{t(card.useZh, card.useEn)}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Secondary Compact Quick Templates */}
        <div className="space-y-2 border-t border-[var(--border-default)] pt-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
            <BookmarkPlus className="h-3.5 w-3.5" />
            <span>{t('或者一键套用常见主题模板', 'Or add a ready-made topic template')}</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onSelectTemplate(tpl, effectivePosition)}
                className="tr-focus-ring flex flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-left transition-colors hover:border-[var(--brand-border)] hover:bg-[var(--brand-soft)]/50 cursor-pointer"
              >
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {t(tpl.labelZh, tpl.labelEn)}
                </span>
                <span className="mt-0.5 truncate text-[11.5px] text-[var(--text-muted)]">
                  {t(tpl.descZh, tpl.descEn)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </ModalDialog>
  )
}

/* ============================================================================
 * 2. Closed-Loop AI Regex Helper Modal (Prompt -> DeepSeek/Any AI -> Paste Back)
 * ========================================================================== */
export function AiRegexHelperModal({
  open,
  onOpenChange,
  lang,
  initialTopic = '',
  targetGroupLabel,
  fixedInsertIndex,
  onApplyParsed,
  onNotify,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lang: Lang
  initialTopic?: string
  targetGroupLabel?: string
  fixedInsertIndex?: number
  onApplyParsed: (parsed: ParsedPastedFrequency, insertPos: InsertPosition) => void
  onNotify: (message: string, tone?: 'success' | 'warning' | 'default' | 'danger') => void
}) {
  const t = useT()
  const [topic, setTopic] = useState(initialTopic)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [showFullPrompt, setShowFullPrompt] = useState(false)
  const [pasteInput, setPasteInput] = useState('')
  const [insertPos, setInsertPos] = useState<'bottom' | 'top'>('bottom')
  const effectiveInsertPos: InsertPosition =
    typeof fixedInsertIndex === 'number' ? fixedInsertIndex : insertPos

  useEffect(() => {
    if (open) {
      setTopic(initialTopic)
      setPasteInput('')
      setCopiedPrompt(false)
    }
  }, [open, initialTopic])

  const promptText = useMemo(() => buildAiRegexPrompt(topic, lang), [topic, lang])
  const parsedResult = useMemo(() => parsePastedFrequencyLines(pasteInput), [pasteInput])
  const hasValidItems =
    parsedResult.items.length > 0 && parsedResult.invalidRegexes.length === 0

  const handleCopyPrompt = async (openDeepSeek: boolean) => {
    const trimmed = topic.trim()
    if (!trimmed) {
      onNotify(t('请先输入想追踪的核心主题或品牌名称', 'Please enter a topic or brand name first'), 'warning')
      return
    }
    const ok = await copyToClipboard(promptText)
    if (ok) {
      setCopiedPrompt(true)
      setTimeout(() => setCopiedPrompt(false), 2400)
      if (openDeepSeek) {
        onNotify(
          t('已复制「{v0}」的正则提示词\n前往 DeepSeek 粘贴提问，再把结果粘回第 3 步即可', 'Copied regex prompt for "{v0}"\nPaste in DeepSeek, then paste the result into Step 3', { v0: trimmed }),
          'success',
        )
        window.open('https://chat.deepseek.com/', '_blank', 'noopener,noreferrer')
      } else {
        onNotify(
          t('已复制「{v0}」的正则提示词\n可粘贴到 DeepSeek / ChatGPT / Claude 等任意 AI', 'Copied regex prompt for "{v0}"\nPaste into DeepSeek, ChatGPT, Claude, or any AI', { v0: trimmed }),
          'success',
        )
      }
    } else {
      setShowFullPrompt(true)
      onNotify(t('自动复制失败，已展开提示词供手动复制', 'Auto-copy blocked — prompt expanded below'), 'warning')
    }
  }

  const handleApply = () => {
    if (parsedResult.items.length === 0) return
    onApplyParsed(parsedResult, effectiveInsertPos)
    onOpenChange(false)
  }

  const quickTopics = toTemplateLang(lang) === 'en' ? QUICK_AI_TOPICS_EN : QUICK_AI_TOPICS_ZH

  return (
    <ModalDialog
      open={open}
      onOpenChange={onOpenChange}
      maxWidthClass="max-w-2xl"
      title={
        <span className="inline-flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-[var(--brand-primary)]" />
          <span>{t('AI 写正则助手', 'AI Regex Assistant')}</span>
          {targetGroupLabel && (
            <Badge tone="brand">
              {t('填入：{v0}', 'Into: {v0}', { v0: targetGroupLabel })}
            </Badge>
          )}
        </span>
      }
      description={t(
        '三步生成高精度 Python 正则：输入主题 → 复制提示词问 AI → 粘贴结果自动拆分正则与别名。',
        '3-step precision regex builder: enter topic -> copy prompt for AI -> paste result to auto-parse.',
      )}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {targetGroupLabel ? (
            <span className="text-xs text-[var(--text-muted)]">
              {t('自动解析 /正则/ 与 => 别名并追加到当前词组', 'Auto-splits /regex/ and => alias into this group')}
            </span>
          ) : typeof fixedInsertIndex === 'number' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--brand-primary)]">
              <span>
                {t('将插入到第 #{v0} 位', 'Will insert at #{v0}', { v0: fixedInsertIndex + 1 })}
              </span>
            </span>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <span>{t('创建位置：', 'Insert at:')}</span>
              <button
                type="button"
                onClick={() => setInsertPos('bottom')}
                className={cn(
                  'rounded-md px-2 py-0.5 font-medium cursor-pointer transition-colors',
                  insertPos === 'bottom'
                    ? 'bg-[var(--brand-soft)] text-[var(--brand-primary)]'
                    : 'hover:text-[var(--text-primary)]',
                )}
              >
                {t('末尾', 'Bottom')}
              </button>
              <button
                type="button"
                onClick={() => setInsertPos('top')}
                className={cn(
                  'rounded-md px-2 py-0.5 font-medium cursor-pointer transition-colors',
                  insertPos === 'top'
                    ? 'bg-[var(--brand-soft)] text-[var(--brand-primary)]'
                    : 'hover:text-[var(--text-primary)]',
                )}
              >
                {t('顶部', 'Top')}
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {t('取消', 'Cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!hasValidItems}
              onClick={handleApply}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>
                {targetGroupLabel
                  ? t('一键填入（{v0} 条）', 'Apply ({v0})', { v0: parsedResult.items.length })
                  : t('一键创建词组（{v0} 条）', 'Create Group ({v0})', { v0: parsedResult.items.length })}
              </span>
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Step 1: Topic Input */}
        <div className="space-y-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/45 p-3.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[11px] font-bold text-white">
              1
            </span>
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {t('输入核心主题或品牌名', 'Enter Core Topic or Brand')}
            </span>
          </div>
          <Input
            autoFocus
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && topic.trim()) {
                e.preventDefault()
                void handleCopyPrompt(true)
              }
            }}
            placeholder={t('例如：胖东来、英伟达、华为、宇树机器人', 'e.g. NVIDIA, DeepSeek, Tesla, Anthropic')}
            className="h-9 text-sm"
          />
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[var(--text-muted)]">{t('示例：', 'Try:')}</span>
            {quickTopics.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setTopic(sample)}
                className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)] hover:border-[var(--brand-border)] hover:text-[var(--brand-primary)] cursor-pointer transition-colors"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Copy Prompt & Open AI */}
        <div className="space-y-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/45 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[11px] font-bold text-white">
                2
              </span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {t('一键复制精准提示词并提问 AI', 'Copy Precision Prompt & Ask AI')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowFullPrompt((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-pointer"
            >
              <span>{showFullPrompt ? t('收起提示词', 'Hide prompt') : t('查看提示词', 'Preview prompt')}</span>
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showFullPrompt && 'rotate-180')} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={!topic.trim()}
              onClick={() => void handleCopyPrompt(true)}
            >
              {copiedPrompt ? <Check className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
              <span>{t('复制提示词并打开 DeepSeek', 'Copy Prompt & Open DeepSeek')}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!topic.trim()}
              onClick={() => void handleCopyPrompt(false)}
            >
              <Copy className="h-3.5 w-3.5" />
              <span>{t('仅复制提示词（用于其他 AI）', 'Copy Prompt Only')}</span>
            </Button>
          </div>

          {showFullPrompt && (
            <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-3 font-mono text-[11.5px] leading-relaxed text-[var(--text-secondary)]">
              {promptText}
            </pre>
          )}
        </div>

        {/* Step 3: Paste Back & Auto-Parse */}
        <div className="space-y-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/45 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[11px] font-bold text-white">
                3
              </span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {t('粘贴 AI 返回结果，自动识别填入', 'Paste AI Result to Auto-Parse')}
              </span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)]">
              {t('支持一次粘贴多行', 'Multi-line supported')}
            </span>
          </div>

          <Textarea
            rows={3}
            value={pasteInput}
            onChange={(e) => setPasteInput(e.target.value)}
            spellCheck={false}
            placeholder={t(
              '例如：/胖东来|于东来/ => 胖东来\n直接粘贴 AI 的回复内容即可，多余代码块标记会自动清理',
              'e.g. /NVIDIA|GeForce|\\bRTX\\b/ => NVIDIA\nPaste AI output directly; code fences are stripped automatically',
            )}
            className="font-mono text-xs leading-relaxed"
          />

          {parsedResult.invalidRegexes.length > 0 && (
            <div className="flex items-start gap-1.5 rounded-lg border border-red-500/30 bg-red-500/8 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {t('检测到无效正则语法：{v0}，请检查括号或转义符。', 'Invalid regex syntax: {v1}', { v0: parsedResult.invalidRegexes.join('、'), v1: parsedResult.invalidRegexes.join(', ') })}
              </span>
            </div>
          )}

          {parsedResult.items.length > 0 && parsedResult.invalidRegexes.length === 0 && (
            <div className="space-y-1.5 rounded-lg border border-teal-500/25 bg-teal-500/[0.06] p-2.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-300">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {t('已成功识别 {v0} 条有效规则，点击右下角即可填入：', 'Parsed {v0} valid rule(s) — ready to apply:', { v0: parsedResult.items.length })}
                </span>
              </div>
              <div className="space-y-1">
                {parsedResult.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center gap-1.5 rounded-md bg-[var(--bg-surface)] px-2.5 py-1 font-mono text-xs"
                  >
                    {item.kind === 'required' && <Badge tone="success">+必须</Badge>}
                    {item.kind === 'exclude' && <Badge tone="warning">!排除</Badge>}
                    {item.isRegex && (
                      <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                        regex
                      </span>
                    )}
                    <span className="break-all text-[var(--text-primary)]">
                      {item.isRegex ? `/${item.pattern}/${item.regexFlags}` : item.pattern}
                    </span>
                    {item.alias && (
                      <>
                        <span className="text-[var(--text-muted)]">=&gt;</span>
                        <span className="font-semibold text-[var(--brand-primary)]">{item.alias}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalDialog>
  )
}
