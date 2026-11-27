import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsDownUp,
  ChevronsUpDown,
  Code2,
  Eye,
  FileCode2,
  FilterX,
  FlaskConical,
  GripVertical,
  HelpCircle,
  Info,
  Layers,
  Lightbulb,
  ListFilter,
  MinusCircle,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react'
import { CodeEditor } from '@/components/shared/CodeEditor'
import {
  AdvancedCollapsible,
  SectionShell,
  SettingRow,
} from '@/components/shared/SharedControls'
import {
  Badge,
  Button,
  Callout,
  Card,
  InfoTooltip,
  Input,
  SelectField,
  Slider,
  Switch,
  Textarea,
} from '@/components/ui/primitives'
import { toTemplateLang, useT } from '@/i18n'
import { getLocalizedKeywordGroupName } from '@/lib/presets'
import {
  getGroupDisplayName,
  parseFrequencyWords,
  serializeFrequencyWords,
  testTitlesAgainstFrequency,
} from '@/lib/frequency-parser'
import {
  createEmptyGroupByType,
  detectWordGroupType,
  formatGroupPreviewLines,
  isRegexPatternValid,
  parsePastedFrequencyLines,
  type ParsedPastedFrequency,
  type WordGroupCreationType,
} from '@/lib/keyword-helpers'
import {
  AiRegexHelperModal,
  WordGroupTypeModal,
  type ExampleGroupTemplate,
  type InsertPosition,
} from './KeywordGroupDialogs'
import type {
  FrequencyDoc,
  FrequencyGroup,
  FrequencyItem,
  FrequencyItemKind,
} from '@/lib/types'
import { cn, uid } from '@/lib/utils'
import { restrictToVerticalAxis, scrollAndFocusElement } from '@/lib/scroll-focus'
import { getInObject } from '@/lib/yaml-doc'
import { useEditor } from '@/store/editor-store'

const DEFAULT_VISIBLE_GROUPS = 8

const EXAMPLE_GROUP_TEMPLATES: ExampleGroupTemplate[] = [
  {
    id: 'ai-llm',
    labelZh: 'AI 大模型前沿',
    labelEn: 'AI & LLM Models',
    descZh: 'DeepSeek / OpenAI / Claude / 正则匹配 GPT 系列',
    descEn: 'DeepSeek / OpenAI / Claude / regex GPT series',
    groupAliasZh: 'AI 大模型',
    groupAliasEn: 'AI Models',
    maxCount: 10,
    itemsZh: [
      { kind: 'normal', pattern: 'DeepSeek', isRegex: false, regexFlags: '', alias: '' },
      { kind: 'normal', pattern: 'OpenAI', isRegex: false, regexFlags: '', alias: '' },
      { kind: 'normal', pattern: 'Claude', isRegex: false, regexFlags: '', alias: '' },
      { kind: 'normal', pattern: 'GPT-[45]|o[13]-?(mini|pro)?', isRegex: true, regexFlags: 'i', alias: 'GPT 系列' },
    ],
    itemsEn: [
      { kind: 'normal', pattern: 'DeepSeek', isRegex: false, regexFlags: '', alias: '' },
      { kind: 'normal', pattern: 'OpenAI', isRegex: false, regexFlags: '', alias: '' },
      { kind: 'normal', pattern: 'Claude', isRegex: false, regexFlags: '', alias: '' },
      { kind: 'normal', pattern: 'GPT-[45]|o[13]-?(mini|pro)?', isRegex: true, regexFlags: 'i', alias: 'GPT Series' },
    ],
  },
  {
    id: 'huawei-chip',
    labelZh: '华为与芯片生态',
    labelEn: 'Huawei & Chips',
    descZh: '包含必须词 +芯片 与排除词 !手机壳 的组合示例',
    descEn: 'Combines +required and !exclude rules',
    groupAliasZh: '华为芯片',
    groupAliasEn: 'Huawei Chips',
    itemsZh: [
      { kind: 'normal', pattern: '华为', isRegex: false, regexFlags: '', alias: '' },
      { kind: 'normal', pattern: '鸿蒙', isRegex: false, regexFlags: '', alias: '' },
      { kind: 'required', pattern: '芯片|昇腾|麒麟', isRegex: true, regexFlags: '', alias: '' },
      { kind: 'exclude', pattern: '手机壳', isRegex: false, regexFlags: '', alias: '' },
    ],
    itemsEn: [
      { kind: 'normal', pattern: 'Huawei', isRegex: false, regexFlags: '', alias: '' },
      { kind: 'normal', pattern: 'HarmonyOS', isRegex: false, regexFlags: '', alias: '' },
      { kind: 'required', pattern: 'chip|Ascend|Kirin', isRegex: true, regexFlags: 'i', alias: '' },
      { kind: 'exclude', pattern: 'case', isRegex: false, regexFlags: '', alias: '' },
    ],
  },
  {
    id: 'ev-auto',
    labelZh: '智能汽车与智驾',
    labelEn: 'EV & Autonomous Driving',
    descZh: '比亚迪 / 特斯拉 + 自动驾驶关键词',
    descEn: 'BYD / Tesla with autonomous driving terms',
    groupAliasZh: '智能汽车',
    groupAliasEn: 'Smart EV',
    maxCount: 8,
    itemsZh: [
      { kind: 'normal', pattern: '比亚迪', isRegex: false, regexFlags: '', alias: '' },
      { kind: 'normal', pattern: '特斯拉', isRegex: false, regexFlags: '', alias: '' },
      { kind: 'normal', pattern: '自动驾驶|FSD|智驾', isRegex: true, regexFlags: 'i', alias: '智能驾驶' },
    ],
    itemsEn: [
      { kind: 'normal', pattern: 'BYD', isRegex: false, regexFlags: '', alias: '' },
      { kind: 'normal', pattern: 'Tesla', isRegex: false, regexFlags: '', alias: '' },
      { kind: 'normal', pattern: 'autonomous|FSD|self-driving', isRegex: true, regexFlags: 'i', alias: 'Autonomy' },
    ],
  },
  {
    id: 'macro-finance',
    labelZh: '宏观财经与市场',
    labelEn: 'Macro Finance & Markets',
    descZh: '美联储 / 黄金 / 汇率 / 降息',
    descEn: 'Fed / Gold / Interest Rates / Inflation',
    groupAliasZh: '宏观财经',
    groupAliasEn: 'Macro Finance',
    maxCount: 8,
    itemsZh: [
      { kind: 'normal', pattern: '美联储', isRegex: false, regexFlags: '', alias: '' },
      { kind: 'normal', pattern: '降息|加息', isRegex: true, regexFlags: '', alias: '利率政策' },
      { kind: 'normal', pattern: '黄金', isRegex: false, regexFlags: '', alias: '' },
    ],
    itemsEn: [
      { kind: 'normal', pattern: 'Federal Reserve', isRegex: false, regexFlags: '', alias: 'Fed' },
      { kind: 'normal', pattern: 'rate cut|interest rate', isRegex: true, regexFlags: 'i', alias: 'Rates' },
      { kind: 'normal', pattern: 'gold price', isRegex: false, regexFlags: '', alias: 'Gold' },
    ],
  },
]

const DEFAULT_TEST_TITLES_ZH = [
  '华为发布新一代鸿蒙AI手机与昇腾芯片进展',
  'DeepSeek 开源推理模型登顶全球榜单引爆行业讨论',
  '震惊！内部曝光太可怕了，不看后悔一辈子',
  '周末全国多地迎来晴好天气，公园赏花客流上升',
].join('\n')

const DEFAULT_TEST_TITLES_EN = [
  'Huawei unveils next-gen HarmonyOS phone and Ascend AI chip updates',
  'DeepSeek open-source reasoning model tops global AI benchmarks',
  'Shocking! Clickbait scandal exposed inside the industry',
  'Sunny weekend weather boosts local park visitors across the region',
].join('\n')

const GROUP_TYPE_BADGE: Record<
  WordGroupCreationType,
  { zh: string; en: string; cls: string }
> = {
  group: {
    zh: '组别名',
    en: 'Group',
    cls: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  alias: {
    zh: '单个别名',
    en: 'Alias',
    cls: 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300',
  },
  'multi-alias': {
    zh: '连续别名组',
    en: 'Multi-alias',
    cls: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
  plain: {
    zh: '普通词组',
    en: 'Plain',
    cls: 'border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-muted)]',
  },
}

/* ---------------- Sortable Keyword Group Card ---------------- */
function SortableGroupCard({
  group,
  displayIndex,
  expanded,
  dragDisabled,
  onToggleExpand,
  onUpdateGroup,
  onDeleteGroup,
  onOpenAiRegex,
  onNotify,
}: {
  group: FrequencyGroup
  displayIndex: number
  expanded: boolean
  dragDisabled: boolean
  onToggleExpand: () => void
  onUpdateGroup: (updater: (g: FrequencyGroup) => FrequencyGroup) => void
  onDeleteGroup: () => void
  onOpenAiRegex: (group: FrequencyGroup) => void
  onNotify: (message: string, tone?: 'success' | 'warning' | 'default' | 'danger') => void
}) {
  const t = useT()
  const { lang } = useEditor()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id, disabled: dragDisabled })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
  }

  const displayName = getLocalizedKeywordGroupName(getGroupDisplayName(group), lang)
  const groupKind = detectWordGroupType(group)
  const groupKindMeta = GROUP_TYPE_BADGE[groupKind]

  const activeNormalCount = group.items.filter((i) => i.kind === 'normal' && i.pattern.trim()).length
  const activeReqCount = group.items.filter((i) => i.kind === 'required' && i.pattern.trim()).length
  const activeExcludeCount = group.items.filter((i) => i.kind === 'exclude' && i.pattern.trim()).length
  const activeTotal = activeNormalCount + activeReqCount + activeExcludeCount
  const hasRegex = group.items.some((i) => i.isRegex && i.pattern.trim())
  const hasInvalidRegex = group.items.some(
    (i) => i.isRegex && i.pattern.trim() && !isRegexPatternValid(i.pattern),
  )
  const previewLines = useMemo(() => (expanded ? formatGroupPreviewLines(group) : []), [expanded, group])

  const handleUpdateItem = (itemId: string, patch: Partial<FrequencyItem>) => {
    onUpdateGroup((g) => ({
      ...g,
      items: g.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
    }))
  }

  const handleAddItem = (kind: FrequencyItemKind = 'normal', isRegex = false) => {
    const newItemId = uid('fi')
    onUpdateGroup((g) => ({
      ...g,
      items: [
        ...g.items,
        {
          id: newItemId,
          kind,
          pattern: '',
          isRegex,
          regexFlags: '',
          alias: '',
        },
      ],
    }))
    scrollAndFocusElement(`freq-rule-${newItemId}`, {
      focusSelector: 'input[data-rule-keyword="true"]',
      align: 'nearest',
    })
  }

  const handleSmartPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    item: FrequencyItem,
  ) => {
    const pasted = e.clipboardData.getData('text')
    if (!pasted) return
    const trimmed = pasted.trim()
    const looksStructured =
      trimmed.includes('\n') ||
      trimmed.includes('=>') ||
      /^\/.+\/[a-z]*$/i.test(trimmed) ||
      trimmed.startsWith('+') ||
      trimmed.startsWith('!') ||
      trimmed.startsWith('[')
    if (!looksStructured) return

    const parsed = parsePastedFrequencyLines(trimmed)
    if (parsed.items.length === 0 && !parsed.groupAlias && !parsed.maxCount) return

    e.preventDefault()
    onUpdateGroup((g) => {
      const nextItems = [...g.items]
      const idx = nextItems.findIndex((x) => x.id === item.id)
      const incoming = parsed.items.map((it) => ({ ...it, id: uid('fi') }))

      if (incoming.length > 0) {
        if (idx >= 0 && !item.pattern.trim()) {
          nextItems.splice(idx, 1, ...incoming)
        } else if (idx >= 0) {
          nextItems.splice(idx + 1, 0, ...incoming)
        } else {
          nextItems.push(...incoming)
        }
      }

      return {
        ...g,
        groupAlias: parsed.groupAlias && !g.groupAlias.trim() ? parsed.groupAlias : g.groupAlias,
        maxCount: parsed.maxCount ?? g.maxCount,
        items: nextItems,
      }
    })
    onNotify(
      t('已自动识别并填入 {v0} 条规则', 'Auto-parsed and inserted {v0} rule(s)', { v0: parsed.items.length }),
      'success',
    )
  }

  const handleRemoveItem = (itemId: string) => {
    onUpdateGroup((g) => ({
      ...g,
      items: g.items.filter((it) => it.id !== itemId),
    }))
  }

  const kindOptions = useMemo(
    () => [
      { value: 'normal', label: t('普通词 (OR)', 'Normal (OR)') },
      { value: 'required', label: t('+必须词 (AND)', '+Required (AND)') },
      { value: 'exclude', label: t('!排除词', '!Exclude') },
    ],
    [t],
  )

  return (
    <div
      id={`freq-group-${group.id}`}
      data-group-id={group.id}
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/row relative rounded-xl border',
        isDragging
          ? 'border-dashed border-[var(--brand-primary)]/70 bg-[var(--brand-soft)]/35 opacity-40'
          : expanded
            ? 'border-[var(--brand-border)] bg-[var(--bg-surface)] shadow-[var(--shadow-xs)] transition-colors'
            : 'border-[var(--border-default)] bg-[var(--bg-base)]/80 hover:border-[var(--border-strong)] transition-colors',
      )}
    >
      {/* Clean Single-Line Header */}
      <div className="flex items-center gap-2 px-3 py-2 @min-[40rem]/section:px-3.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={dragDisabled}
          className={cn(
            'tr-focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors touch-none select-none',
            dragDisabled
              ? 'opacity-30 cursor-not-allowed'
              : 'hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] cursor-grab active:cursor-grabbing',
          )}
          title={
            dragDisabled
              ? t('清空搜索词后可拖拽排序', 'Clear search to drag-reorder')
              : t('拖拽调整优先级顺序', 'Drag to reorder priority')
          }
          aria-label={t('拖拽排序', 'Drag to reorder')}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <span className="inline-flex h-6 min-w-[28px] shrink-0 items-center justify-center rounded-md bg-[var(--bg-muted)] px-2 font-mono text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
          #{displayIndex + 1}
        </span>

        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className="tr-focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-md py-0.5 text-left cursor-pointer"
        >
          <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {displayName}
          </span>
          <span
            className={cn(
              'hidden @min-[36rem]/section:inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none',
              groupKindMeta.cls,
            )}
          >
            {t(groupKindMeta.zh, groupKindMeta.en)}
          </span>
        </button>

        <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
          <Badge tone="neutral">
            {t('{v0} 条', '{v0} rules', { v0: activeTotal })}
          </Badge>
          {activeReqCount > 0 && (
            <Badge tone="success">+{activeReqCount}</Badge>
          )}
          {activeExcludeCount > 0 && (
            <Badge tone="warning">!{activeExcludeCount}</Badge>
          )}
          {hasRegex && (
            <span className="hidden @min-[40rem]/section:inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 font-mono text-xs font-medium text-violet-700 dark:text-violet-300">
              /regex/
            </span>
          )}
          {hasInvalidRegex && (
            <Badge tone="danger">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{t('正则异常', 'Bad Regex')}</span>
            </Badge>
          )}
          {group.maxCount && group.maxCount > 0 && (
            <Badge tone="brand">@{group.maxCount}</Badge>
          )}

          <button
            type="button"
            onClick={onToggleExpand}
            className="tr-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
            title={expanded ? t('收起编辑', 'Collapse') : t('展开编辑', 'Expand to edit')}
            aria-label={expanded ? t('收起编辑', 'Collapse') : t('展开编辑', 'Expand to edit')}
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform duration-150',
                expanded && 'rotate-180',
              )}
            />
          </button>

          <button
            type="button"
            onClick={onDeleteGroup}
            className="tr-focus-ring tr-hover-delete inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
            title={t('删除词组', 'Delete group')}
            aria-label={t('删除词组', 'Delete group')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded Edit Panel */}
      {expanded && (
        <div className="border-t border-[var(--border-default)] bg-[var(--bg-subtle)]/25 px-4 py-3.5 space-y-3.5">
          {/* Group metadata row */}
          <div className="grid grid-cols-1 gap-3 @min-[40rem]/section:grid-cols-3 @min-[40rem]/section:items-end">
            <div className="@min-[40rem]/section:col-span-2 space-y-1">
              <label className="flex min-h-[22px] items-center gap-1.5 text-xs font-medium text-[var(--text-primary)]">
                <span>{t('组显示名称 [组名]', 'Group Alias [Name]')}</span>
                <InfoTooltip
                  content={t(
                    '推送报告中该词组的分组标题（对应 frequency_words.txt 中的 [组名] 语法；留空时会自动使用行内别名或拼接关键词）。',
                    'Section heading shown in reports for this group ([Name] syntax; blank uses inline aliases or joins keywords).',
                  )}
                >
                  <button
                    type="button"
                    className="inline-flex items-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                    aria-label={t('组显示名称说明', 'Group alias help')}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </InfoTooltip>
              </label>
              <Input
                data-autofocus-group-alias="true"
                value={group.groupAlias}
                onChange={(e) =>
                  onUpdateGroup((g) => ({ ...g, groupAlias: e.target.value }))
                }
                placeholder={t(
                  '如：东亚 / AI 大模型（用行内 => 别名时可留空）',
                  'e.g. East Asia / AI Models (optional if using => alias)',
                )}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="flex min-h-[22px] items-center gap-1.5 text-xs font-medium text-[var(--text-primary)] whitespace-nowrap">
                <span>{t('单组上限 @数量', 'Max Limit @N')}</span>
                <InfoTooltip
                  content={t(
                    '限制该词组在单次报告中最多展示几条匹配新闻（如填 5 即写入 @5；留空则使用全局上限）。',
                    'Max matched items shown for this group per report (@N syntax; blank uses global limit).',
                  )}
                >
                  <button
                    type="button"
                    className="inline-flex items-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                    aria-label={t('单组上限说明', 'Max limit help')}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </InfoTooltip>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-[var(--text-muted)]">
                  @
                </span>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={group.maxCount ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value.trim()
                    if (!raw) {
                      onUpdateGroup((g) => ({ ...g, maxCount: undefined }))
                    } else {
                      const n = Number.parseInt(raw, 10)
                      onUpdateGroup((g) => ({
                        ...g,
                        maxCount: Number.isFinite(n) && n > 0 ? n : undefined,
                      }))
                    }
                  }}
                  placeholder={t('跟随全局', 'Global')}
                  className="h-9 pl-7 font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Rules List */}
          <div className="space-y-2">
            <div className="hidden @min-[40rem]/section:grid @min-[40rem]/section:grid-cols-[148px_1fr_68px_156px_34px] gap-2 px-1.5 text-xs font-medium text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1">
                <span>{t('规则类型', 'Rule Type')}</span>
                <InfoTooltip
                  content={
                    <div className="space-y-1">
                      <div>1. {t('普通词：命中组内任意一个普通词即可入选。', 'Normal: matches if any normal word appears.')}</div>
                      <div>2. {t('+必须词：必须同时包含组内全部 +必须词。', '+Required: every +required word must also appear.')}</div>
                      <div>3. {t('!排除词：包含该词时直接过滤剔除。', '!Exclude: drops headlines containing this word.')}</div>
                    </div>
                  }
                >
                  <button
                    type="button"
                    className="inline-flex items-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                    aria-label={t('规则类型说明', 'Rule type help')}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </InfoTooltip>
              </span>
              <span>{t('关键词 / 正则（支持回车续行、粘贴 /正则/ => 别名自动拆分）', 'Keyword / Regex (Enter adds row · Smart Paste)')}</span>
              <span className="text-center">{t('正则', 'Regex')}</span>
              <span className="inline-flex items-center gap-1">
                <span>{t('别名 (=>)', 'Alias (=>)')}</span>
                <InfoTooltip
                  content={t(
                    '命中该词时，在报告中统一显示为你指定的简短名称（对应 关键词 => 别名 语法）。',
                    'Display name shown in reports when this rule matches (keyword => alias).',
                  )}
                >
                  <button
                    type="button"
                    className="inline-flex items-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                    aria-label={t('别名说明', 'Alias help')}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </InfoTooltip>
              </span>
              <span />
            </div>

            {group.items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border-strong)] px-4 py-3.5 text-center text-[13px] text-[var(--text-muted)]">
                {t('暂无规则行，请点击下方按钮添加关键词或用「AI 写正则」生成。', 'No rules yet. Add a row below or use AI Regex.')}
              </div>
            ) : (
              <div className="space-y-1.5">
                {group.items.map((item, itemIdx) => {
                  const regexBroken =
                    item.isRegex && item.pattern.trim().length > 0 && !isRegexPatternValid(item.pattern)
                  return (
                    <div
                      key={item.id}
                      id={`freq-rule-${item.id}`}
                      className={cn(
                        'grid grid-cols-1 gap-2 rounded-xl border p-2 @min-[40rem]/section:grid-cols-[148px_1fr_68px_156px_34px] @min-[40rem]/section:items-center @min-[40rem]/section:border-transparent @min-[40rem]/section:bg-[var(--bg-subtle)]/65 @min-[40rem]/section:p-1.5',
                        item.kind === 'required' && '@min-[40rem]/section:border-l-2 @min-[40rem]/section:border-l-teal-500/60',
                        item.kind === 'exclude' && '@min-[40rem]/section:border-l-2 @min-[40rem]/section:border-l-amber-500/60',
                      )}
                    >
                      <SelectField
                        value={item.kind}
                        onValueChange={(val) =>
                          handleUpdateItem(item.id, { kind: val as FrequencyItemKind })
                        }
                        options={kindOptions}
                        className="h-9 text-sm"
                      />

                      <div className="relative">
                        {item.isRegex && (
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-violet-600 dark:text-violet-400">
                            /
                          </span>
                        )}
                        <Input
                          data-rule-keyword="true"
                          data-autofocus-keyword={itemIdx === 0 ? 'true' : undefined}
                          value={item.pattern}
                          onChange={(e) =>
                            handleUpdateItem(item.id, { pattern: e.target.value })
                          }
                          onPaste={(e) => handleSmartPaste(e, item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && item.pattern.trim()) {
                              e.preventDefault()
                              handleAddItem(item.kind, item.isRegex)
                            }
                          }}
                          placeholder={
                            item.isRegex
                              ? t('如 胖东来|于东来，回车续行或粘贴 AI 结果', 'e.g. GPT-[45]|Claude (Enter = next row)')
                              : item.kind === 'required'
                                ? t('必须同时包含的关键词，回车续行', 'Must-include keyword (Enter = next)')
                                : item.kind === 'exclude'
                                  ? t('排除关键词，回车续行', 'Excluded keyword (Enter = next)')
                                  : t('输入关键词，回车快速添加下一条', 'Type keyword & press Enter for next')
                          }
                          className={cn(
                            'h-9 text-sm',
                            item.isRegex && 'pl-6 pr-8 font-mono',
                            regexBroken && 'border-red-500/70 focus:border-red-500',
                          )}
                          spellCheck={false}
                        />
                        {item.isRegex && (
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm text-violet-600 dark:text-violet-400">
                            /{item.regexFlags}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateItem(item.id, { isRegex: !item.isRegex })
                        }
                        className={cn(
                          'tr-focus-ring inline-flex h-9 items-center justify-center rounded-xl border font-mono text-xs font-medium transition-colors cursor-pointer',
                          item.isRegex
                            ? 'border-violet-500/40 bg-violet-500/12 text-violet-700 dark:text-violet-300'
                            : 'border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]',
                        )}
                        title={t('切换正则表达式匹配 /.../', 'Toggle /regex/ matching')}
                      >
                        /.../
                      </button>

                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-[var(--text-muted)]">
                          =&gt;
                        </span>
                        <Input
                          value={item.alias}
                          disabled={item.kind === 'exclude'}
                          onChange={(e) =>
                            handleUpdateItem(item.id, { alias: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && item.pattern.trim()) {
                              e.preventDefault()
                              handleAddItem(item.kind, item.isRegex)
                            }
                          }}
                          placeholder={
                            item.kind === 'exclude'
                              ? t('无别名', 'N/A')
                              : t('可选别名', 'Optional')
                          }
                          className="h-9 pl-8 text-sm"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="tr-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 cursor-pointer transition-colors"
                        title={t('删除规则行', 'Remove rule')}
                        aria-label={t('删除规则行', 'Remove rule')}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Quick add rule actions + AI Write Regex */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => handleAddItem('normal', groupKind === 'alias' || groupKind === 'multi-alias')}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t('添加规则行', 'Add Row')}</span>
                </Button>
                <Button variant="ghost" size="xs" onClick={() => handleAddItem('required', false)}>
                  <Plus className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span>{t('+必须词', '+Required')}</span>
                </Button>
                <Button variant="ghost" size="xs" onClick={() => handleAddItem('exclude', false)}>
                  <Plus className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span>{t('!排除词', '!Exclude')}</span>
                </Button>
              </div>

              <Button
                variant="outline"
                size="xs"
                onClick={() => onOpenAiRegex(group)}
                className="border-[var(--brand-border)] bg-[var(--brand-soft)]/50 text-[var(--brand-primary)] hover:bg-[var(--brand-soft)]"
              >
                <Wand2 className="h-3.5 w-3.5" />
                <span>{t('AI 写正则', 'AI Regex')}</span>
              </Button>
            </div>
          </div>

          {/* Live syntax preview of what gets written into frequency_words.txt */}
          {previewLines.length > 0 && (
            <div className="rounded-lg border border-[var(--border-default)]/80 bg-[var(--bg-base)]/80 px-3 py-2">
              <div className="mb-1 text-[11px] font-medium text-[var(--text-muted)]">
                {t('实时生成的 frequency_words.txt 语法预览', 'Live frequency_words.txt syntax')}
              </div>
              <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-[var(--text-secondary)]">
                {previewLines.join('\n')}
              </pre>
            </div>
          )}

          {/* Gentle notice when !exclude rules are present */}
          {activeExcludeCount > 0 && (
            <Callout
              tone="warning"
              icon={<Info className="h-4 w-4 text-amber-500" />}
            >
              {t(
                '提示：后端会将所有词组中的 !排除词 汇总并全局生效；建议统一放入上方 [GLOBAL_FILTER] 全局屏蔽区。',
                'Note: The backend aggregates all !exclude terms globally; consider moving them to [GLOBAL_FILTER] above.',
              )}
            </Callout>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------- Main FilterSection ---------------- */
export function FilterSection() {
  const {
    files,
    configData,
    lang,
    theme,
    workspaceMode,
    setFileContent,
    setConfigValue,
    removeConfigKey,
    setChangesRequest,
    setActiveSection,
    jumpToSource,
    openSourceTarget,
    visualFocusTarget,
    notify,
  } = useEditor()
  const t = useT()

  const [showCustomFilterPrompts, setShowCustomFilterPrompts] = useState(false)

  const rawMethod = getInObject<string>(configData, ['filter', 'method'], 'keyword')
  const method: 'keyword' | 'ai' = rawMethod === 'ai' ? 'ai' : 'keyword'
  const [previewOverride, setPreviewOverride] = useState<'keyword' | 'ai' | null>(null)

  useEffect(() => {
    if (!visualFocusTarget || visualFocusTarget.section !== 'filter') return
    const targetMode =
      visualFocusTarget.filterMode ??
      (visualFocusTarget.anchor === 'pro-anchor-ai-interests' ||
      visualFocusTarget.anchor === 'pro-anchor-ai-filter-advanced'
        ? 'ai'
        : visualFocusTarget.anchor === 'pro-anchor-frequency'
          ? 'keyword'
          : undefined)
    if (targetMode) {
      setPreviewOverride(method === targetMode ? null : targetMode)
    }
  }, [visualFocusTarget, method])

  const displayMethod: 'keyword' | 'ai' = previewOverride ?? method

  // Keyword mode: local parsed FrequencyDoc preserving stable IDs across edits
  const rawFreqText = files['frequency_words.txt']
  const [freqDoc, setFreqDoc] = useState<FrequencyDoc>(() => parseFrequencyWords(rawFreqText))
  const lastWrittenFreqRef = useRef<string>(rawFreqText)

  useEffect(() => {
    if (rawFreqText !== lastWrittenFreqRef.current) {
      lastWrittenFreqRef.current = rawFreqText
      setFreqDoc(parseFrequencyWords(rawFreqText))
    }
  }, [rawFreqText])

  const commitFreqDoc = useCallback(
    (next: FrequencyDoc) => {
      setFreqDoc(next)
      const serialized = serializeFrequencyWords(next)
      lastWrittenFreqRef.current = serialized
      setFileContent('frequency_words.txt', serialized)
    },
    [setFileContent],
  )

  // Global filter adder state
  const [newGlobalPattern, setNewGlobalPattern] = useState('')
  const [newGlobalIsRegex, setNewGlobalIsRegex] = useState(false)

  // Word groups search + expand + progressive slice + creator dialogs state
  const [groupSearch, setGroupSearch] = useState('')
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [expandedGroupIds, setExpandedGroupIds] = useState<Record<string, boolean>>({})
  const [groupTypeModalState, setGroupTypeModalState] = useState<{
    open: boolean
    insertIndex?: number
  }>({ open: false })
  const [aiRegexTarget, setAiRegexTarget] = useState<
    | { mode: 'new'; initialTopic: string; insertIndex?: number }
    | { mode: 'group'; groupId: string; label: string; initialTopic: string }
    | null
  >(null)

  // Sandbox test titles state
  const [sandboxInput, setSandboxInput] = useState<string>(() =>
    toTemplateLang(lang) === 'en' ? DEFAULT_TEST_TITLES_EN : DEFAULT_TEST_TITLES_ZH,
  )

  useEffect(() => {
    const tplLang = toTemplateLang(lang)
    setSandboxInput((prev) => {
      if (tplLang === 'en' && prev === DEFAULT_TEST_TITLES_ZH) return DEFAULT_TEST_TITLES_EN
      if (tplLang === 'zh' && prev === DEFAULT_TEST_TITLES_EN) return DEFAULT_TEST_TITLES_ZH
      return prev
    })
  }, [lang])

  const [activeDragGroupId, setActiveDragGroupId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const isSearching = groupSearch.trim().length > 0

  const filteredGroupsWithIndex = useMemo(() => {
    const q = groupSearch.trim().toLowerCase()
    return freqDoc.groups
      .map((group, originalIndex) => ({ group, originalIndex }))
      .filter(({ group }) => {
        if (!q) return true
        if (group.groupAlias.toLowerCase().includes(q)) return true
        if (getGroupDisplayName(group).toLowerCase().includes(q)) return true
        return group.items.some(
          (it) =>
            it.pattern.toLowerCase().includes(q) ||
            it.alias.toLowerCase().includes(q),
        )
      })
  }, [freqDoc.groups, groupSearch])

  const visibleGroupsWithIndex = useMemo(() => {
    if (isSearching || showAllGroups || filteredGroupsWithIndex.length <= DEFAULT_VISIBLE_GROUPS) {
      return filteredGroupsWithIndex
    }
    return filteredGroupsWithIndex.slice(0, DEFAULT_VISIBLE_GROUPS)
  }, [filteredGroupsWithIndex, isSearching, showAllGroups])

  const hiddenGroupsCount = filteredGroupsWithIndex.length - visibleGroupsWithIndex.length

  const handleAddGlobalFilter = () => {
    const pattern = newGlobalPattern.trim()
    if (!pattern) return
    const next: FrequencyDoc = {
      ...freqDoc,
      globalFilters: [
        ...freqDoc.globalFilters,
        {
          id: uid('gf'),
          pattern,
          isRegex: newGlobalIsRegex,
          regexFlags: '',
        },
      ],
    }
    commitFreqDoc(next)
    setNewGlobalPattern('')
    setNewGlobalIsRegex(false)
  }

  const handleRemoveGlobalFilter = (id: string) => {
    commitFreqDoc({
      ...freqDoc,
      globalFilters: freqDoc.globalFilters.filter((gf) => gf.id !== id),
    })
  }

  const insertNewGroup = (
    newGroup: FrequencyGroup,
    position: InsertPosition,
    focusSelector?: string,
    toastMsg?: string,
  ) => {
    setGroupSearch('')
    let nextGroups: FrequencyGroup[]
    if (typeof position === 'number') {
      const idx = Math.max(0, Math.min(freqDoc.groups.length, position))
      if (idx >= DEFAULT_VISIBLE_GROUPS) setShowAllGroups(true)
      nextGroups = [
        ...freqDoc.groups.slice(0, idx),
        newGroup,
        ...freqDoc.groups.slice(idx),
      ]
    } else if (position === 'top') {
      nextGroups = [newGroup, ...freqDoc.groups]
    } else {
      if (freqDoc.groups.length >= DEFAULT_VISIBLE_GROUPS) setShowAllGroups(true)
      nextGroups = [...freqDoc.groups, newGroup]
    }
    setExpandedGroupIds((prev) => ({ ...prev, [newGroup.id]: true }))
    commitFreqDoc({
      ...freqDoc,
      groups: nextGroups,
    })
    if (toastMsg) notify(toastMsg, 'success')
    scrollAndFocusElement(`freq-group-${newGroup.id}`, {
      focusSelector,
    })
  }

  const handleCreateGroupByType = (type: WordGroupCreationType, position: InsertPosition) => {
    setGroupTypeModalState({ open: false })
    const newGroup = createEmptyGroupByType(type)
    const nextIndex =
      typeof position === 'number'
        ? Math.max(0, Math.min(freqDoc.groups.length, position)) + 1
        : position === 'top'
          ? 1
          : freqDoc.groups.length + 1
    const focusSelector =
      type === 'group'
        ? 'input[data-autofocus-group-alias="true"]'
        : 'input[data-autofocus-keyword="true"]'
    const typeLabelZh: Record<WordGroupCreationType, string> = {
      group: '多关键词词组（组别名）',
      alias: '正则 / 关键词 + 别名',
      'multi-alias': '连续别名组',
      plain: '简单关键词词组',
    }
    const typeLabelEn: Record<WordGroupCreationType, string> = {
      group: 'Multi-keyword Group',
      alias: 'Regex + Alias',
      'multi-alias': 'Multi-alias Group',
      plain: 'Simple Keyword',
    }
    insertNewGroup(
      newGroup,
      position,
      focusSelector,
      t('已新建「{v0}」#{v1}\n支持回车续行或直接粘贴 AI 生成的正则', 'Created {v2} #{v1}\nPress Enter to add rows or paste AI regex directly', { v0: typeLabelZh[type], v1: nextIndex, v2: typeLabelEn[type] }),
    )
  }

  const handleAddTemplateGroup = (tpl: ExampleGroupTemplate, position: InsertPosition) => {
    setGroupTypeModalState({ open: false })
    const itemsRaw = toTemplateLang(lang) === 'en' ? tpl.itemsEn : tpl.itemsZh
    const newGroup: FrequencyGroup = {
      id: uid('fg'),
      groupAlias: toTemplateLang(lang) === 'en' ? tpl.groupAliasEn : tpl.groupAliasZh,
      maxCount: tpl.maxCount,
      items: itemsRaw.map((it) => ({ ...it, id: uid('fi') })),
    }
    insertNewGroup(
      newGroup,
      position,
      undefined,
      t('已添加示例词组「{v0}」', 'Added template group "{v1}"', { v0: tpl.groupAliasZh, v1: tpl.groupAliasEn }),
    )
  }

  const handleApplyAiRegex = (parsed: ParsedPastedFrequency, position: InsertPosition) => {
    if (parsed.items.length === 0) return
    const incoming = parsed.items.map((it) => ({ ...it, id: uid('fi') }))

    if (aiRegexTarget && aiRegexTarget.mode === 'group') {
      const targetId = aiRegexTarget.groupId
      handleUpdateGroup(targetId, (g) => {
        // Drop placeholder empty rows when replacing into a newly created empty group
        const existingNonEmpty = g.items.filter((it) => it.pattern.trim().length > 0)
        return {
          ...g,
          groupAlias: parsed.groupAlias && !g.groupAlias.trim() ? parsed.groupAlias : g.groupAlias,
          maxCount: parsed.maxCount ?? g.maxCount,
          items: [...existingNonEmpty, ...incoming],
        }
      })
      setExpandedGroupIds((prev) => ({ ...prev, [targetId]: true }))
      notify(
        t('已向词组填入 {v0} 条 AI 生成规则', 'Inserted {v0} AI-generated rule(s) into group', { v0: incoming.length }),
        'success',
      )
      scrollAndFocusElement(`freq-group-${targetId}`)
      return
    }

    const newGroup: FrequencyGroup = {
      id: uid('fg'),
      groupAlias: parsed.groupAlias ?? '',
      maxCount: parsed.maxCount,
      items: incoming,
    }
    const label = getGroupDisplayName(newGroup)
    insertNewGroup(
      newGroup,
      position,
      undefined,
      t('已通过 AI 正则创建词组「{v0}」', 'Created group "{v0}" from AI regex', { v0: label }),
    )
  }

  const handleUpdateGroup = (groupId: string, updater: (g: FrequencyGroup) => FrequencyGroup) => {
    commitFreqDoc({
      ...freqDoc,
      groups: freqDoc.groups.map((g) => (g.id === groupId ? updater(g) : g)),
    })
  }

  const handleDeleteGroup = (groupId: string) => {
    setExpandedGroupIds((prev) => {
      if (!(groupId in prev)) return prev
      const copy = { ...prev }
      delete copy[groupId]
      return copy
    })
    commitFreqDoc({
      ...freqDoc,
      groups: freqDoc.groups.filter((g) => g.id !== groupId),
    })
  }

  const handleDragStart = (event: DragStartEvent) => {
    if (isSearching) return
    setActiveDragGroupId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragGroupId(null)
    if (isSearching) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = freqDoc.groups.findIndex((g) => g.id === active.id)
    const newIdx = freqDoc.groups.findIndex((g) => g.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    commitFreqDoc({
      ...freqDoc,
      groups: arrayMove(freqDoc.groups, oldIdx, newIdx),
    })
  }

  const activeDragEntry = useMemo(() => {
    if (!activeDragGroupId) return null
    const idx = freqDoc.groups.findIndex((g) => g.id === activeDragGroupId)
    if (idx < 0) return null
    return { group: freqDoc.groups[idx], index: idx }
  }, [activeDragGroupId, freqDoc.groups])

  const allExpanded =
    visibleGroupsWithIndex.length > 0 &&
    visibleGroupsWithIndex.every(({ group }) => Boolean(expandedGroupIds[group.id]))

  const handleToggleAllExpand = () => {
    if (allExpanded) {
      setExpandedGroupIds({})
    } else {
      const next: Record<string, boolean> = {}
      for (const { group } of visibleGroupsWithIndex) {
        next[group.id] = true
      }
      setExpandedGroupIds(next)
    }
  }

  // Sandbox live evaluation
  const sandboxEvaluation = useMemo(() => {
    const lines = sandboxInput.split(/\r?\n/)
    return testTitlesAgainstFrequency(freqDoc, lines)
  }, [freqDoc, sandboxInput])

  const sandboxCounts = useMemo(() => {
    let matched = 0
    let globalBlocked = 0
    let excludeBlocked = 0
    let unmatched = 0
    for (const r of sandboxEvaluation.results) {
      if (r.status === 'matched') matched++
      else if (r.status === 'filtered_global') globalBlocked++
      else if (r.status === 'filtered_exclude') excludeBlocked++
      else unmatched++
    }
    return { matched, globalBlocked, excludeBlocked, unmatched }
  }, [sandboxEvaluation.results])

  // Config values for Keyword & AI paths
  const sortByPositionFirst = getInObject<boolean>(
    configData,
    ['report', 'sort_by_position_first'],
    false,
  )

  const aiModel = String(getInObject<string>(configData, ['ai', 'model'], '') ?? '')
  const aiMinScore = Number(getInObject<number>(configData, ['ai_filter', 'min_score'], 0.7))
  const prioritySortEnabled = getInObject<boolean>(
    configData,
    ['filter', 'priority_sort_enabled'],
    true,
  )
  const interestsFile = String(
    getInObject<string>(configData, ['ai_filter', 'interests_file'], '') ?? '',
  )
  const aiBatchSize = Number(getInObject<number>(configData, ['ai_filter', 'batch_size'], 200))
  const aiBatchInterval = Number(
    getInObject<number>(configData, ['ai_filter', 'batch_interval'], 2),
  )
  const reclassifyThreshold = Number(
    getInObject<number>(configData, ['ai_filter', 'reclassify_threshold'], 0.6),
  )
  const filterPromptFile = String(
    getInObject<string>(configData, ['ai_filter', 'prompt_file'], 'prompt.txt') ?? 'prompt.txt',
  )
  const extractPromptFile = String(
    getInObject<string>(
      configData,
      ['ai_filter', 'extract_prompt_file'],
      'extract_prompt.txt',
    ) ?? 'extract_prompt.txt',
  )
  const updateTagsPromptFile = String(
    getInObject<string>(
      configData,
      ['ai_filter', 'update_tags_prompt_file'],
      'update_tags_prompt.txt',
    ) ?? 'update_tags_prompt.txt',
  )

  const aiFilterAdvancedCustomized = useMemo(() => {
    let count = 0
    if (interestsFile.trim() !== '') count++
    if (aiBatchSize !== 200) count++
    if (aiBatchInterval !== 2) count++
    if (Math.abs(reclassifyThreshold - 0.6) > 0.001) count++
    if (filterPromptFile !== 'prompt.txt') count++
    if (extractPromptFile !== 'extract_prompt.txt') count++
    if (updateTagsPromptFile !== 'update_tags_prompt.txt') count++
    return count
  }, [
    interestsFile,
    aiBatchSize,
    aiBatchInterval,
    reclassifyThreshold,
    filterPromptFile,
    extractPromptFile,
    updateTagsPromptFile,
  ])

  // Stats for ai_interests.txt
  const interestsStats = useMemo(() => {
    const raw = files['ai_interests.txt'] || ''
    const allLines = raw.split(/\r?\n/)
    let activeLines = 0
    let numberedItems = 0
    for (const ln of allLines) {
      const s = ln.trim()
      if (!s || s.startsWith('#')) continue
      activeLines++
      if (/^\d+[.)、]/.test(s) || /^[-*]/.test(s)) {
        numberedItems++
      }
    }
    return {
      totalLines: allLines.length,
      activeLines,
      numberedItems,
    }
  }, [files])

  const newGlobalRegexInvalid =
    newGlobalIsRegex &&
    newGlobalPattern.trim().length > 0 &&
    !isRegexPatternValid(newGlobalPattern.trim())

  return (
    <SectionShell
      sectionId="filter"
      stepNumber="STEP 02"
      title={t('内容筛选策略', 'Content Filtering')}
      subtitle={t(
        '选择一种筛选方式：零成本关键词匹配，或自然语言 AI 语义筛选。',
        'Pick one engine: zero-cost keyword rules or plain-language AI filtering.',
      )}
      docSlug={displayMethod === 'ai' ? 'ai-filter' : 'keywords'}
      sourceFile={displayMethod === 'ai' ? 'ai_interests.txt' : 'frequency_words.txt'}
    >
      {/* Compact Single-Row Mode Switcher + Progressive Context Strip */}
      <Card id="guided-anchor-filter-mode" className="scroll-mt-4 p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {t('当前筛选方式', 'Filter Mode')}
            </span>
            <code className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
              filter.method
            </code>
            <InfoTooltip
              content={t(
                '二选一：关键词规则零 API 费用，按词组、+必含、!排除与正则精确过滤；AI 智能筛选用自然语言描述关注方向，由共享大模型语义分类打分。',
                'Choose one: Keyword Rules run at zero API cost using groups, +must, !exclude, and regex; AI Smart Filter uses your shared LLM to score headlines against plain-language interests.',
              )}
            >
              <button
                type="button"
                className="tr-focus-ring inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--brand-primary)] cursor-help"
                aria-label={t('筛选方式说明', 'Filter mode info')}
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </InfoTooltip>
          </div>

          <div
            role="tablist"
            aria-label={t('内容筛选方式切换', 'Content filter mode selector')}
            className="grid w-full grid-cols-2 gap-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1 @min-[34rem]/section:w-auto @min-[34rem]/section:min-w-[380px]"
          >
            {(['keyword', 'ai'] as const).map((tabKey) => {
              const isViewing = displayMethod === tabKey
              const isActiveMethod = method === tabKey
              const isPreviewTab = isViewing && !isActiveMethod
              const Icon = tabKey === 'keyword' ? ListFilter : Sparkles
              const label = tabKey === 'keyword' ? t('关键词规则', 'Keyword Rules') : t('AI 智能筛选', 'AI Smart Filter')
              const countLabel =
                tabKey === 'keyword'
                  ? t('{v0} 组', '{v0}', { v0: freqDoc.groups.length })
                  : t('{v0} 行', '{v0}', { v0: interestsStats.activeLines })

              return (
                <button
                  key={tabKey}
                  type="button"
                  role="tab"
                  data-filter-tab={tabKey}
                  data-active-method={isActiveMethod ? 'true' : 'false'}
                  data-previewing={isPreviewTab ? 'true' : 'false'}
                  aria-selected={isViewing}
                  onClick={() => {
                    setPreviewOverride(null)
                    setConfigValue(['filter', 'method'], tabKey)
                  }}
                  className={cn(
                    'tr-focus-ring inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] transition-all cursor-pointer whitespace-nowrap',
                    isPreviewTab
                      ? 'border border-dashed border-amber-500/65 bg-amber-500/10 font-semibold text-amber-800 dark:text-amber-200'
                      : isActiveMethod && isViewing
                        ? 'bg-[var(--bg-surface)] font-semibold text-[var(--brand-primary)] shadow-[var(--shadow-xs)] ring-1 ring-[var(--brand-border)]'
                        : isActiveMethod
                          ? 'bg-emerald-500/10 font-semibold text-emerald-700 ring-1 ring-emerald-500/30 hover:bg-emerald-500/15 dark:text-emerald-300'
                          : 'font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]/70 hover:text-[var(--text-primary)]',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{label}</span>
                  <span className="rounded-full bg-[var(--bg-muted)] px-1.5 py-0.5 text-[11px] font-normal text-[var(--text-secondary)]">
                    {countLabel}
                  </span>
                  {isActiveMethod && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                      <Check className="h-2.5 w-2.5 shrink-0" />
                      <span>{t('生效中', 'Active')}</span>
                    </span>
                  )}
                  {isPreviewTab && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                      <Eye className="h-2.5 w-2.5 shrink-0" />
                      <span>{t('预览中', 'Preview')}</span>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Dynamic Single-Line Context Strip */}
        {previewOverride && previewOverride !== method ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-950 dark:text-amber-100">
            <span className="flex min-w-0 items-center gap-2 font-medium">
              <Eye className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                {previewOverride === 'ai'
                  ? t(
                      '当前仅在预览「AI 智能筛选」(ai_interests.txt)，实际生效仍为「关键词规则」',
                      'Previewing AI Smart Filter (ai_interests.txt) only — Keyword Rules is still active',
                    )
                  : t(
                      '当前仅在预览「关键词规则」(frequency_words.txt)，实际生效仍为「AI 智能筛选」',
                      'Previewing Keyword Rules (frequency_words.txt) only — AI Smart Filter is still active',
                    )}
              </span>
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                size="xs"
                variant="primary"
                onClick={() => {
                  setConfigValue(['filter', 'method'], previewOverride)
                  setPreviewOverride(null)
                }}
              >
                {t('设为生效方式', 'Make Active')}
              </Button>
              <Button size="xs" variant="outline" onClick={() => setPreviewOverride(null)}>
                {t('返回当前生效', 'Back to Active')}
              </Button>
            </div>
          </div>
        ) : displayMethod === 'keyword' ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--bg-subtle)]/75 px-3 py-2 text-xs text-[var(--text-secondary)]">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge tone="success">{t('零 API 费用', 'Zero API Cost')}</Badge>
              <span>
                {t(
                  '下方依次按「全局屏蔽词 → 关键词词组」匹配过滤热点',
                  'Matches headlines below in order: Global Blocklist → Keyword Groups',
                )}
              </span>
            </div>
            <span className="font-mono text-[11px] text-[var(--text-muted)]">
              frequency_words.txt ·{' '}
              {t('{v0} 条屏蔽', '{v0} blocked', { v0: freqDoc.globalFilters.length })}
            </span>
          </div>
        ) : null}

        {displayMethod === 'ai' && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--bg-subtle)]/75 px-3 py-2 text-xs text-[var(--text-secondary)]">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <Badge tone="brand">{t('共享模型', 'Shared AI')}</Badge>
              <span>{t('当前模型：', 'Model: ')}</span>
              <code className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--text-primary)]">
                {aiModel || t('(尚未设置)', '(not set)')}
              </code>
              <span className="text-[var(--text-muted)]">
                · {t('门槛 {v0}', 'min {v0}', { v0: aiMinScore.toFixed(2) })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('ai')}
              className="tr-focus-ring inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-[var(--brand-primary)] hover:bg-[var(--brand-soft)] cursor-pointer"
            >
              <span>{t('配置 AI 模型', 'AI Settings')}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </Card>

      {/* ================================================================= */}
      {/* PATH A: KEYWORD RULES                                             */}
      {/* ================================================================= */}
      {displayMethod === 'keyword' && (
        <div id="pro-anchor-frequency" className="scroll-mt-4 space-y-5">
          {/* Sub-card 1: Global Blocklist */}
          <Card className="p-5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/8 text-red-600 dark:text-red-400">
                  <Ban className="h-4 w-4" />
                </span>
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {t('全局屏蔽词', 'Global Blocklist')}
                </h3>
                <code className="rounded bg-[var(--bg-muted)] px-2 py-0.5 font-mono text-xs text-[var(--text-muted)]">
                  [GLOBAL_FILTER]
                </code>
                <Badge tone="neutral">
                  {t('{v0} 条', '{v0}', { v0: freqDoc.globalFilters.length })}
                </Badge>
                <InfoTooltip
                  content={t(
                    '标题命中任意屏蔽词或正则时直接丢弃，优先级最高（优先于所有关键词词组）。',
                    'Headlines matching any blocklist term or regex are discarded first before any group rules.',
                  )}
                >
                  <button
                    type="button"
                    className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                    aria-label={t('全局屏蔽词说明', 'Global blocklist info')}
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </InfoTooltip>
              </div>
            </div>

            {/* Add bar */}
            <div className="space-y-2">
              <div className="flex flex-col gap-2.5 @min-[40rem]/section:flex-row @min-[40rem]/section:items-center">
                <div className="relative flex-1">
                  {newGlobalIsRegex && (
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-violet-600 dark:text-violet-400">
                      /
                    </span>
                  )}
                  <Input
                    value={newGlobalPattern}
                    onChange={(e) => setNewGlobalPattern(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddGlobalFilter()
                      }
                    }}
                    placeholder={
                      newGlobalIsRegex
                        ? t('输入屏蔽正则，例如：赌博|博彩|代购', 'Enter blocklist regex, e.g. spam|promo')
                        : t('输入屏蔽词（如：震惊、广告），回车添加', 'Enter a term to block (e.g. clickbait) & press Enter')
                    }
                    className={cn(
                      'h-10 text-sm',
                      newGlobalIsRegex && 'pl-7 pr-7 font-mono',
                      newGlobalRegexInvalid && 'border-red-500/70 focus:border-red-500',
                    )}
                    spellCheck={false}
                  />
                  {newGlobalIsRegex && (
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm text-violet-600 dark:text-violet-400">
                      /
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setNewGlobalIsRegex((v) => !v)}
                    className={cn(
                      'tr-focus-ring inline-flex h-10 items-center gap-1.5 rounded-xl border px-3.5 text-[13px] font-medium transition-colors cursor-pointer',
                      newGlobalIsRegex
                        ? 'border-violet-500/40 bg-violet-500/12 text-violet-700 dark:text-violet-300'
                        : 'border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
                    )}
                  >
                    <span className="font-mono text-xs">/.../</span>
                    <span>{t('正则', 'Regex')}</span>
                  </button>

                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleAddGlobalFilter}
                    disabled={!newGlobalPattern.trim()}
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('添加', 'Add')}</span>
                  </Button>
                </div>
              </div>

              {newGlobalRegexInvalid && (
                <p className="flex items-center gap-1.5 text-[13px] text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    {t(
                      '当前正则表达式语法有误，建议修正后再添加。',
                      'Invalid regular expression syntax. Please check before adding.',
                    )}
                  </span>
                </p>
              )}
            </div>

            {/* Tag list */}
            {freqDoc.globalFilters.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]/40 px-4 py-3.5 text-[13px] leading-relaxed text-[var(--text-muted)]">
                {t(
                  '暂未设置全局屏蔽词，可添加标题党、广告或不想看的话题。',
                  'No global blocklist terms yet. Add clickbait, spam, or noisy topics to skip.',
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {freqDoc.globalFilters.map((gf) => (
                  <span
                    key={gf.id}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border py-1.5 pl-3 pr-2 text-[13px] font-medium transition-colors',
                      gf.isRegex
                        ? 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300 font-mono'
                        : 'border-red-500/20 bg-red-500/8 text-[var(--text-primary)]',
                    )}
                  >
                    {gf.isRegex && (
                      <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-xs font-sans font-semibold">
                        regex
                      </span>
                    )}
                    <span>
                      {gf.isRegex ? `/${gf.pattern}/${gf.regexFlags}` : gf.pattern}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveGlobalFilter(gf.id)}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full opacity-70 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10 cursor-pointer"
                      aria-label={t('移除屏蔽词', 'Remove blocklist entry')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Card>

          {/* Sub-card 2: Keyword Word Groups */}
          <Card id="guided-anchor-keyword-groups" className="scroll-mt-4 p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-primary)]">
                <Layers className="h-4 w-4" />
              </span>
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
                {t('关键词词组管理', 'Keyword Groups')}
              </h3>
              <code className="rounded bg-[var(--bg-muted)] px-2 py-0.5 font-mono text-xs text-[var(--text-muted)]">
                [WORD_GROUPS]
              </code>
              <Badge tone="brand">
                {t('{v0} 组', '{v0} groups', { v0: freqDoc.groups.length })}
              </Badge>
              <InfoTooltip
                content={t(
                  '词组从上到下按优先级依次匹配（首命中排他）；拖拽左侧手柄可调整先后顺序，点击任意词组展开编辑。',
                  'Groups are evaluated top-to-bottom (first match wins). Drag to change priority or click any group to edit.',
                )}
              >
                <button
                  type="button"
                  className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                  aria-label={t('词组优先级说明', 'Priority matching info')}
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </InfoTooltip>
            </div>

            {/* Toolbar: search + quick add + templates + expand toggle */}
            <div className="flex flex-col gap-3 @min-[40rem]/section:flex-row @min-[40rem]/section:items-center @min-[40rem]/section:justify-between">
              <div className="relative flex-1 @min-[40rem]/section:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  placeholder={t('搜索词组名或关键词...', 'Search groups or keywords...')}
                  className="h-9 pl-9 pr-8 text-sm"
                />
                {groupSearch && (
                  <button
                    type="button"
                    onClick={() => setGroupSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    aria-label={t('清空搜索', 'Clear search')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {visibleGroupsWithIndex.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleToggleAllExpand}>
                    {allExpanded ? (
                      <>
                        <ChevronsDownUp className="h-4 w-4" />
                        <span>{t('全部收起', 'Collapse All')}</span>
                      </>
                    ) : (
                      <>
                        <ChevronsUpDown className="h-4 w-4" />
                        <span>{t('全部展开', 'Expand All')}</span>
                      </>
                    )}
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAiRegexTarget({ mode: 'new', initialTopic: '' })}
                  className="border-[var(--brand-border)] bg-[var(--brand-soft)]/45 text-[var(--brand-primary)] hover:bg-[var(--brand-soft)]"
                >
                  <Wand2 className="h-4 w-4" />
                  <span>{t('AI 写正则', 'AI Regex')}</span>
                </Button>

                <Button variant="primary" size="sm" onClick={() => setGroupTypeModalState({ open: true })}>
                  <Plus className="h-4 w-4" />
                  <span>{t('新建词组', 'New Group')}</span>
                </Button>
              </div>
            </div>

            {isSearching && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-soft)]/50 px-4 py-2.5 text-[13px] text-[var(--text-secondary)]">
                <span>
                  {t('已筛选 {v0} / {v1} 组；清空搜索后可拖拽排序。', 'Showing {v0} of {v1} groups. Clear search to reorder.', { v0: filteredGroupsWithIndex.length, v1: freqDoc.groups.length })}
                </span>
                <button
                  type="button"
                  onClick={() => setGroupSearch('')}
                  className="font-medium text-[var(--brand-primary)] hover:underline cursor-pointer shrink-0"
                >
                  {t('清空搜索', 'Clear')}
                </button>
              </div>
            )}

            {/* Sortable Groups List */}
            {freqDoc.groups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]/40 px-5 py-8 text-center space-y-2.5">
                <p className="text-[15px] font-medium text-[var(--text-primary)]">
                  {t('当前词库为空（全量放行模式）', 'No keyword groups yet (allow-all mode)')}
                </p>
                <p className="text-[13px] leading-relaxed text-[var(--text-muted)] max-w-md mx-auto">
                  {t(
                    '不设词组时将保留所有未屏蔽热点。点击「新建词组」选择类型，或使用「AI 写正则」快速生成。',
                    'Without groups, all non-blocked headlines pass through. Click New Group or AI Regex to start.',
                  )}
                </p>
              </div>
            ) : filteredGroupsWithIndex.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border-strong)] px-5 py-6 text-center text-[13px] text-[var(--text-muted)]">
                {t('未找到匹配的词组，请尝试其他关键词。', 'No matching groups found. Try a different query.')}
              </div>
            ) : (
              <div className="space-y-3">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToVerticalAxis]}
                  onDragStart={handleDragStart}
                  onDragCancel={() => setActiveDragGroupId(null)}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={visibleGroupsWithIndex.map(({ group }) => group.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1.5">
                      {/* Hover-revealed top insertion zone before #1 */}
                      {!isSearching && !activeDragGroupId && visibleGroupsWithIndex.length > 0 && (
                        <div className="group/ins relative -my-1 flex h-3 items-center justify-center z-10 hover:z-20 focus-within:z-20">
                          <div className="pointer-events-none absolute inset-x-3 top-1/2 h-[1.5px] -translate-y-1/2 rounded-full bg-[var(--brand-primary)]/45 opacity-0 transition-opacity duration-150 group-hover/ins:opacity-100 group-focus-within/ins:opacity-100" />
                          <button
                            type="button"
                            data-insert-group-at={0}
                            onClick={() => setGroupTypeModalState({ open: true, insertIndex: 0 })}
                            title={t('在最顶部插入词组（#1 最高优先级）', 'Insert group at top (#1 highest priority)')}
                            aria-label={t('在最顶部插入词组', 'Insert group at top')}
                            className="tr-focus-ring relative inline-flex h-6 items-center gap-1 rounded-full border border-[var(--brand-primary)] bg-[var(--brand-primary)] px-2.5 text-[11px] font-medium text-white shadow-[var(--shadow-sm)] opacity-0 scale-90 transition-all duration-150 group-hover/ins:opacity-100 group-hover/ins:scale-100 group-focus-within/ins:opacity-100 group-focus-within/ins:scale-100 hover:bg-[var(--brand-primary-hover)] cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>{t('在顶部插入词组', 'Insert at top')}</span>
                          </button>
                        </div>
                      )}

                      {visibleGroupsWithIndex.map(({ group, originalIndex }, listIdx) => (
                        <div key={group.id} className="space-y-1.5">
                          <SortableGroupCard
                            group={group}
                            displayIndex={originalIndex}
                            expanded={Boolean(expandedGroupIds[group.id])}
                            dragDisabled={isSearching}
                            onToggleExpand={() =>
                              setExpandedGroupIds((prev) => ({
                                ...prev,
                                [group.id]: !prev[group.id],
                              }))
                            }
                            onUpdateGroup={(updater) => handleUpdateGroup(group.id, updater)}
                            onDeleteGroup={() => handleDeleteGroup(group.id)}
                            onOpenAiRegex={(targetGroup) => {
                              const rawName = getGroupDisplayName(targetGroup)
                              const initialTopic =
                                rawName === '(未命名词组)'
                                  ? ''
                                  : targetGroup.groupAlias.trim() ||
                                    targetGroup.items.find((i) => i.alias.trim())?.alias.trim() ||
                                    rawName
                              setAiRegexTarget({
                                mode: 'group',
                                groupId: targetGroup.id,
                                label: getLocalizedKeywordGroupName(rawName, lang),
                                initialTopic,
                              })
                            }}
                            onNotify={notify}
                          />

                          {/* Hover-revealed inline insert button between any two groups */}
                          {!isSearching &&
                            !activeDragGroupId &&
                            listIdx < visibleGroupsWithIndex.length - 1 && (
                              <div className="group/ins relative -my-1 flex h-3 items-center justify-center z-10 hover:z-20 focus-within:z-20">
                                <div className="pointer-events-none absolute inset-x-3 top-1/2 h-[1.5px] -translate-y-1/2 rounded-full bg-[var(--brand-primary)]/45 opacity-0 transition-opacity duration-150 group-hover/ins:opacity-100 group-focus-within/ins:opacity-100" />
                                <button
                                  type="button"
                                  data-insert-group-at={originalIndex + 1}
                                  onClick={() =>
                                    setGroupTypeModalState({
                                      open: true,
                                      insertIndex: originalIndex + 1,
                                    })
                                  }
                                  title={t('在第 #{v0} 组下方插入词组', 'Insert group below #{v0}', { v0: originalIndex + 1 })}
                                  aria-label={t('在第 #{v0} 组下方插入词组', 'Insert group below #{v0}', { v0: originalIndex + 1 })}
                                  className="tr-focus-ring relative inline-flex h-6 items-center gap-1 rounded-full border border-[var(--brand-primary)] bg-[var(--brand-primary)] px-2.5 text-[11px] font-medium text-white shadow-[var(--shadow-sm)] opacity-0 scale-90 transition-all duration-150 group-hover/ins:opacity-100 group-hover/ins:scale-100 group-focus-within/ins:opacity-100 group-focus-within/ins:scale-100 hover:bg-[var(--brand-primary-hover)] cursor-pointer"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  <span>{t('在此处插入词组', 'Insert group here')}</span>
                                </button>
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
                    {activeDragEntry ? (
                      <div className="flex items-center gap-2 rounded-xl border border-[var(--brand-primary)] bg-[var(--bg-surface)] px-3 py-2 shadow-[var(--shadow-md)] ring-2 ring-[var(--brand-primary)]/20 cursor-grabbing">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--brand-primary)]">
                          <GripVertical className="h-4 w-4" />
                        </span>
                        <span className="inline-flex h-6 min-w-[28px] shrink-0 items-center justify-center rounded-md bg-[var(--brand-soft)] px-2 font-mono text-xs font-semibold tabular-nums text-[var(--brand-primary)]">
                          #{activeDragEntry.index + 1}
                        </span>
                        <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                          {getLocalizedKeywordGroupName(getGroupDisplayName(activeDragEntry.group), lang)}
                        </span>
                        <Badge tone="neutral" className="ml-auto shrink-0">
                          {t('{v0} 条', '{v0} rules', { v0: activeDragEntry.group.items.filter((i) => i.pattern.trim()).length })}
                        </Badge>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>

                {!isSearching && hiddenGroupsCount > 0 && (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setShowAllGroups(true)}
                    className="w-full border-dashed border-[var(--brand-border)] bg-[var(--brand-soft)]/35 text-[var(--brand-primary)] hover:bg-[var(--brand-soft)]"
                  >
                    <ChevronDown className="h-4 w-4" />
                    <span>
                      {t('展开全部 {v0} 组词条（还有 {v1} 组）', 'Show all {v0} groups ({v1} more)', { v0: filteredGroupsWithIndex.length, v1: hiddenGroupsCount })}
                    </span>
                  </Button>
                )}

                {!isSearching &&
                  showAllGroups &&
                  filteredGroupsWithIndex.length > DEFAULT_VISIBLE_GROUPS && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllGroups(false)}
                      className="w-full text-[var(--text-secondary)]"
                    >
                      <ChevronUp className="h-4 w-4" />
                      <span>
                        {t('收起列表，仅显示前 {v0} 组', 'Collapse list, show first {v0} only', { v0: DEFAULT_VISIBLE_GROUPS })}
                      </span>
                    </Button>
                  )}
              </div>
            )}
          </Card>

          {/* Sub-card 3: Live Headline Test Sandbox (Collapsed by Default) */}
          <AdvancedCollapsible
            id="guided-anchor-filter-sandbox"
            defaultOpen={false}
            icon={<FlaskConical className="h-4 w-4 text-[var(--brand-primary)]" />}
            title={t('试一试：粘贴新闻标题测试命中效果', 'Try It: Paste Headlines to Test Matching')}
            description={t(
              '实时模拟全局屏蔽、!排除词与词组匹配归属',
              'Simulate blocklist, !excludes, and group priority live',
            )}
          >
            <div className="space-y-4">
              {/* Regex warnings */}
              {sandboxEvaluation.regexWarnings.length > 0 && (
                <Callout
                  tone="warning"
                  icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
                  title={t('检测到 {v0} 条非法正则表达式', '{v0} invalid regular expression(s) detected', { v0: sandboxEvaluation.regexWarnings.length })}
                >
                  <ul className="mt-1.5 space-y-1 font-mono text-xs">
                    {sandboxEvaluation.regexWarnings.map((w, idx) => (
                      <li key={`${w.pattern}-${idx}`}>
                        /{w.pattern}/ — {w.error}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-[13px]">
                    {t(
                      '非法正则会在运行时自动降级为纯文本匹配。',
                      'Invalid regex patterns fall back to plain substring matching at runtime.',
                    )}
                  </p>
                </Callout>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-medium text-[var(--text-primary)]">
                    {t('测试新闻标题（每行一条）', 'Sample Headlines (one per line)')}
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSandboxInput(
                        toTemplateLang(lang) === 'en' ? DEFAULT_TEST_TITLES_EN : DEFAULT_TEST_TITLES_ZH,
                      )
                    }
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{t('恢复示例', 'Reset Samples')}</span>
                  </Button>
                </div>
                <Textarea
                  rows={4}
                  value={sandboxInput}
                  onChange={(e) => setSandboxInput(e.target.value)}
                  placeholder={t('每行输入一条模拟新闻标题...', 'Enter one headline per line...')}
                  className="text-sm leading-relaxed"
                />
              </div>

              {/* Summary chips */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{t('命中 {v0}', 'Matched {v0}', { v0: sandboxCounts.matched })}</span>
                </Badge>
                <Badge tone="danger">
                  <Ban className="h-3.5 w-3.5" />
                  <span>
                    {t('全局屏蔽 {v0}', 'Global Blocked {v0}', { v0: sandboxCounts.globalBlocked })}
                  </span>
                </Badge>
                <Badge tone="warning">
                  <FilterX className="h-3.5 w-3.5" />
                  <span>
                    {t('!排除拦截 {v0}', '!Excluded {v0}', { v0: sandboxCounts.excludeBlocked })}
                  </span>
                </Badge>
                <Badge tone="neutral">
                  <MinusCircle className="h-3.5 w-3.5" />
                  <span>{t('未命中 {v0}', 'Unmatched {v0}', { v0: sandboxCounts.unmatched })}</span>
                </Badge>
              </div>

              {/* Per-line Results */}
              <div className="divide-y divide-[var(--border-default)] rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]">
                {sandboxEvaluation.results.length === 0 ? (
                  <div className="px-4 py-5 text-center text-[13px] text-[var(--text-muted)]">
                    {t('请在上方输入至少一行标题以查看匹配结果。', 'Enter at least one headline above to preview results.')}
                  </div>
                ) : (
                  sandboxEvaluation.results.map((res, idx) => (
                    <div
                      key={`${idx}-${res.title}`}
                      className="flex flex-col gap-2 px-4 py-3 @min-[40rem]/section:flex-row @min-[40rem]/section:items-center @min-[40rem]/section:justify-between"
                    >
                      <span className="text-sm text-[var(--text-primary)] leading-relaxed break-words min-w-0 flex-1">
                        {res.title}
                      </span>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {res.status === 'matched' && (
                          <>
                            <Badge tone="success">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>
                                {typeof res.matchedGroupIndex === 'number'
                                  ? `#${res.matchedGroupIndex + 1} ${getLocalizedKeywordGroupName(res.matchedGroupName ?? '', lang)}`
                                  : getLocalizedKeywordGroupName(res.matchedGroupName ?? '', lang)}
                              </span>
                            </Badge>
                            {res.matchedRule && (
                              <code className="rounded bg-[var(--bg-muted)] px-2 py-0.5 font-mono text-xs text-[var(--text-secondary)]">
                                {res.matchedRule}
                              </code>
                            )}
                          </>
                        )}

                        {res.status === 'filtered_global' && (
                          <>
                            <Badge tone="danger">
                              <Ban className="h-3.5 w-3.5" />
                              <span>{t('全局屏蔽', 'Global Blocked')}</span>
                            </Badge>
                            {res.filteredBy && (
                              <code className="rounded bg-red-500/10 px-2 py-0.5 font-mono text-xs text-red-700 dark:text-red-300">
                                {res.filteredBy}
                              </code>
                            )}
                          </>
                        )}

                        {res.status === 'filtered_exclude' && (
                          <>
                            <Badge tone="warning">
                              <FilterX className="h-3.5 w-3.5" />
                              <span>{t('!排除词拦截', '!Exclude Blocked')}</span>
                            </Badge>
                            {res.filteredBy && (
                              <code className="rounded bg-amber-500/12 px-2 py-0.5 font-mono text-xs text-amber-700 dark:text-amber-300">
                                {res.filteredBy}
                              </code>
                            )}
                          </>
                        )}

                        {res.status === 'unmatched' && (
                          <Badge tone="neutral">
                            <MinusCircle className="h-3.5 w-3.5" />
                            <span>{t('未命中', 'Unmatched')}</span>
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </AdvancedCollapsible>

          {/* Bottom Basic Setting: report.sort_by_position_first */}
          <Card className="p-5">
            <SettingRow
              label={t('词组展示排序方式', 'Keyword Group Display Order')}
              description={t(
                '开启按词组先后顺序展示，关闭按命中条数排序。',
                'ON preserves group order above; OFF sorts by hit count.',
              )}
              tooltip={t(
                '仅在报告展示模式为“按关键词分组”时生效：开启后严格遵循词组定义顺序，关闭则按各词组命中的热点条数从多到少展示。',
                'Applies when report display_mode is keyword: ON preserves your top-to-bottom order, OFF sorts by matched item count descending.',
              )}
            >
              <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
                <span className="text-sm font-medium text-[var(--text-secondary)]">
                  {sortByPositionFirst
                    ? t('按词组顺序', 'By Group Order')
                    : t('按命中条数', 'By Hit Count')}
                </span>
                <Switch
                  checked={sortByPositionFirst}
                  onCheckedChange={(v) =>
                    setConfigValue(['report', 'sort_by_position_first'], v)
                  }
                  ariaLabel={t('按词组定义顺序排序', 'Sort by group definition order')}
                />
              </div>
            </SettingRow>
          </Card>
        </div>
      )}

      {/* ================================================================= */}
      {/* PATH B: AI SMART FILTER                                           */}
      {/* ================================================================= */}
      {displayMethod === 'ai' && (
        <div id="pro-anchor-ai-interests" className="scroll-mt-4 space-y-5">
          {/* Card 1: Embedded ai_interests.txt Editor */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {t('关注兴趣描述编辑器', 'Interest Profile Editor')}
                </h3>
                <code className="rounded bg-[var(--bg-muted)] px-2 py-0.5 font-mono text-xs text-[var(--text-muted)]">
                  ai_interests.txt
                </code>
                <Badge tone="brand">
                  {t('{v0} 项 · {v1} 行', '{v0} entries · {v1} lines', { v0: interestsStats.numberedItems > 0 ? interestsStats.numberedItems : interestsStats.activeLines, v1: interestsStats.totalLines })}
                </Badge>
                <InfoTooltip
                  content={t(
                    '按优先级从上到下写下关注领域与质量要求；修改非注释内容后，下次运行会自动平滑更新分类标签。',
                    'Write topics and quality preferences from highest to lowest priority; editing non-comment lines updates tags automatically on the next run.',
                  )}
                >
                  <button
                    type="button"
                    className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                    aria-label={t('兴趣描述说明', 'Interest profile info')}
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </InfoTooltip>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    workspaceMode === 'pro'
                      ? openSourceTarget({ file: 'ai_interests.txt', line: 1 })
                      : jumpToSource('ai_interests.txt')
                  }
                >
                  <Code2 className="h-3.5 w-3.5" />
                  <span>{workspaceMode === 'pro' ? t('在左侧打开', 'Open in Left Pane') : t('在侧边栏大屏编辑', 'Open in Side Panel')}</span>
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setChangesRequest({ file: 'ai_interests.txt', restoreFile: true })}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{t('恢复默认模板', 'Reset Default')}</span>
                </Button>
              </div>
            </div>

            {/* Writing tips collapsible (default collapsed) */}
            <AdvancedCollapsible
              defaultOpen={false}
              icon={<Lightbulb className="h-4 w-4 text-amber-500" />}
              title={t('写法技巧与示例', 'Writing Tips & Examples')}
              description={t(
                '如何写出高准确率的自然语言兴趣清单',
                'Tips for writing high-precision interest lists',
              )}
            >
              <ul className="space-y-2 text-[13px] leading-relaxed text-[var(--text-secondary)] list-disc pl-5">
                <li>
                  <strong className="text-[var(--text-primary)]">
                    {t('越靠前优先级越高：', 'Top-down priority: ')}
                  </strong>
                  {t(
                    '用 1. 2. 3. 编号列出领域，跨主题新闻会优先归入更靠前的方向。',
                    'Number topics 1, 2, 3...; multi-topic stories match earlier entries first.',
                  )}
                </li>
                <li>
                  <strong className="text-[var(--text-primary)]">
                    {t('实体 + 关注视角：', 'Entities + angles: ')}
                  </strong>
                  {t(
                    '尽量写明代表公司、关键产品与想看的维度（发布、融资、监管等）。',
                    'Name representative companies, products, and angles (launches, earnings, regulation).',
                  )}
                </li>
                <li>
                  <strong className="text-[var(--text-primary)]">
                    {t('文末补充质量过滤：', 'Quality rules at the bottom: ')}
                  </strong>
                  {t(
                    '可加“- 不要标题党/震惊体”等要求，AI 会自动压低低质内容评分。',
                    'Add rules like "- Skip clickbait or ads" so the LLM downranks low-signal items.',
                  )}
                </li>
                <li>
                  <strong className="text-[var(--text-primary)]">
                    {t('井号注释不触发重分类：', 'Comments ignored: ')}
                  </strong>
                  {t(
                    '以 # 开头的行仅作备注，修改注释不会触发标签重建。',
                    'Lines starting with # are comments and will not trigger tag rebuilds.',
                  )}
                </li>
              </ul>
            </AdvancedCollapsible>

            {/* Fixed-height CodeEditor */}
            <div className="h-[280px] w-full">
              <CodeEditor
                language="text"
                theme={theme}
                value={files['ai_interests.txt']}
                onChange={(val) => setFileContent('ai_interests.txt', val)}
              />
            </div>

            <div className="flex items-start gap-2.5 rounded-xl bg-[var(--bg-subtle)] px-4 py-3 text-[13px] leading-relaxed text-[var(--text-muted)]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
              <span>
                {t(
                  '修改非注释内容后，下次运行会自动平滑更新分类标签。',
                  'Editing non-comment lines automatically updates tags on the next run.',
                )}
              </span>
            </div>
          </Card>

          {/* Card 2: Common AI Filter Settings */}
          <Card className="p-5 divide-y divide-[var(--border-default)]">
            <SettingRow
              label={t('最低相关度门槛 (min_score)', 'Minimum Relevance Score (min_score)')}
              description={t(
                '越高越严格，推荐 0.50~0.70 起步，0 为不过滤。',
                'Higher is stricter; 0.50–0.70 recommended (0 = off).',
              )}
              tooltip={t(
                '范围 0.0 ~ 1.0。AI 会给每条新闻打相关度分，低于此门槛的条目将被过滤。',
                'Range 0.0–1.0. Headlines scored below this threshold are filtered out.',
              )}
            >
              <div className="flex w-full @min-[40rem]/section:w-64 items-center gap-3">
                <Slider
                  min={0}
                  max={1}
                  step={0.05}
                  value={Number.isFinite(aiMinScore) ? aiMinScore : 0.7}
                  onValueChange={(v) =>
                    setConfigValue(['ai_filter', 'min_score'], Math.round(v * 100) / 100)
                  }
                  className="flex-1"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <span className="min-w-[42px] text-right font-mono text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                    {(Number.isFinite(aiMinScore) ? aiMinScore : 0.7).toFixed(2)}
                  </span>
                  <Badge
                    tone={
                      aiMinScore === 0
                        ? 'neutral'
                        : aiMinScore >= 0.5 && aiMinScore <= 0.75
                          ? 'success'
                          : aiMinScore > 0.75
                            ? 'warning'
                            : 'brand'
                    }
                  >
                    {aiMinScore === 0
                      ? t('不过滤', 'Off')
                      : aiMinScore < 0.5
                        ? t('宽松', 'Loose')
                        : aiMinScore <= 0.75
                          ? t('推荐', 'Balanced')
                          : t('严格', 'Strict')}
                  </Badge>
                </div>
              </div>
            </SettingRow>

            <SettingRow
              label={t('AI 标签排序方式', 'AI Tag Sort Order')}
              description={t(
                '开启按兴趣先后顺序展示，关闭按匹配条数排序。',
                'ON preserves interest order; OFF sorts by match count.',
              )}
              tooltip={t(
                '开启后按 ai_interests.txt 中的兴趣先后顺序展示；关闭则按各标签匹配到的新闻条数从多到少排序。',
                'ON preserves order from ai_interests.txt; OFF sorts tags by matched count descending.',
              )}
            >
              <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
                <span className="text-sm font-medium text-[var(--text-secondary)]">
                  {prioritySortEnabled
                    ? t('按兴趣顺序', 'By Interest Priority')
                    : t('按匹配条数', 'By Match Count')}
                </span>
                <Switch
                  checked={prioritySortEnabled}
                  onCheckedChange={(v) =>
                    setConfigValue(['filter', 'priority_sort_enabled'], v)
                  }
                  ariaLabel={t('按兴趣定义顺序排序', 'Sort by interest priority')}
                />
              </div>
            </SettingRow>
          </Card>

          {/* Bottom AdvancedCollapsible: AI Filter Advanced Tuning & Prompts */}
          <AdvancedCollapsible
            id="pro-anchor-ai-filter-advanced"
            sourceTarget={{ file: 'config.yaml', path: ['ai_filter'] }}
            title={t('AI 筛选进阶调优与 Prompt 文件', 'AI Filter Tuning & Prompt Files')}
            description={t(
              '自定义兴趣文件、分批并发、重分类阈值与提示词文件',
              'Custom interests file, batching, reclassify threshold, and prompts',
            )}
            customizedCount={aiFilterAdvancedCustomized}
          >
            <div className="divide-y divide-[var(--border-default)]">
              <SettingRow
                label={t('自定义兴趣文件 (interests_file)', 'Custom Interests File')}
                description={t('留空走默认 config/ai_interests.txt。', 'Blank uses config/ai_interests.txt.')}
                tooltip={t(
                  '可选填写 config/custom/ai/ 目录下的文件名（如 finance.txt）来切换不同兴趣方案。',
                  'Optionally specify a filename inside config/custom/ai/ (e.g. finance.txt).',
                )}
              >
                <Input
                  value={interestsFile}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val.trim() === '') {
                      removeConfigKey(['ai_filter', 'interests_file'])
                    } else {
                      setConfigValue(['ai_filter', 'interests_file'], val)
                    }
                  }}
                  placeholder={t('默认 config/ai_interests.txt', 'Default: ai_interests.txt')}
                  className="h-9 w-full @min-[40rem]/section:w-64 font-mono text-sm"
                  spellCheck={false}
                />
              </SettingRow>

              <SettingRow
                label={t('单批处理标题数 (batch_size)', 'Batch Size (batch_size)')}
                description={t('每批发送给 AI 分类的上限，默认 200。', 'Max headlines per batch (default 200).')}
              >
                <Input
                  type="number"
                  min={10}
                  max={1000}
                  step={10}
                  value={aiBatchSize}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10)
                    if (Number.isFinite(n) && n > 0) {
                      setConfigValue(['ai_filter', 'batch_size'], n)
                    }
                  }}
                  className="h-9 w-32 font-mono text-sm"
                />
              </SettingRow>

              <SettingRow
                label={t('分批间隔秒数 (batch_interval)', 'Batch Interval (s)')}
                description={t('批次间等待秒数防限流，默认 2 秒。', 'Wait seconds between batches (default 2).')}
              >
                <Input
                  type="number"
                  min={0}
                  max={60}
                  step={0.5}
                  value={aiBatchInterval}
                  onChange={(e) => {
                    const n = Number.parseFloat(e.target.value)
                    if (Number.isFinite(n) && n >= 0) {
                      setConfigValue(['ai_filter', 'batch_interval'], n)
                    }
                  }}
                  className="h-9 w-32 font-mono text-sm"
                />
              </SettingRow>

              <SettingRow
                label={t('全量重分类阈值 (reclassify_threshold)', 'Reclassify Threshold')}
                description={t('越低越倾向全量重分，越高越省 Token（默认 0.6）。', 'Lower = full reclassify; higher = incremental (0.6).')}
                tooltip={t(
                  '范围 0~1：兴趣变更幅度超过该阈值时触发全量重分类，否则增量更新标签。',
                  'Range 0–1: lower favors full reclassification (accurate, more tokens); higher favors incremental updates.',
                )}
              >
                <div className="flex w-full @min-[40rem]/section:w-56 items-center gap-3">
                  <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    value={Number.isFinite(reclassifyThreshold) ? reclassifyThreshold : 0.6}
                    onValueChange={(v) =>
                      setConfigValue(
                        ['ai_filter', 'reclassify_threshold'],
                        Math.round(v * 100) / 100,
                      )
                    }
                    className="flex-1"
                  />
                  <span className="min-w-[40px] text-right font-mono text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                    {(Number.isFinite(reclassifyThreshold) ? reclassifyThreshold : 0.6).toFixed(2)}
                  </span>
                </div>
              </SettingRow>

              {/* 3 Internal Prompt Files (Clean Warning List matching reference design) */}
              <div className="pt-4">
                <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
                  <div className="flex items-center justify-between gap-2 border-b border-[var(--border-default)] bg-[var(--bg-subtle)]/50 px-4 py-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                      <FileCode2 className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                      <span>{t('Prompt 文件（内部模板）', 'Internal Prompt Files')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCustomFilterPrompts((v) => !v)}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-pointer"
                    >
                      {showCustomFilterPrompts ||
                      filterPromptFile !== 'prompt.txt' ||
                      extractPromptFile !== 'extract_prompt.txt' ||
                      updateTagsPromptFile !== 'update_tags_prompt.txt'
                        ? t('收起文件名修改', 'Hide filenames')
                        : t('指定其他文件名', 'Custom filenames')}
                    </button>
                  </div>

                  <div className="divide-y divide-[var(--border-default)]">
                    {[
                      {
                        title: t('AI 过滤提示词', 'AI Filter Prompt'),
                        desc: t('AI 语义筛选打分的主提示词模板，程序依赖其固定 JSON 输出结构', 'Primary prompt template for AI scoring; strict JSON structure required'),
                        displayPath: `ai_filter/${filterPromptFile}`,
                      },
                      {
                        title: t('AI 过滤提取提示词', 'AI Interest Extraction Prompt'),
                        desc: t('从你的兴趣描述中自动拆解分类标签的内部提示词', 'Internal prompt that extracts category tags from your interests'),
                        displayPath: `ai_filter/${extractPromptFile}`,
                      },
                      {
                        title: t('AI 标签更新提示词', 'AI Tag Update Prompt'),
                        desc: t('修改兴趣描述后平滑增量更新已有标签的内部提示词', 'Internal prompt for incremental tag updates when interests change'),
                        displayPath: `ai_filter/${updateTagsPromptFile}`,
                      },
                    ].map((row) => (
                      <div
                        key={row.displayPath}
                        className="flex flex-col gap-2 px-4 py-3 @min-[40rem]/section:flex-row @min-[40rem]/section:items-center @min-[40rem]/section:justify-between"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13.5px] font-semibold text-[var(--text-primary)]">
                              {row.title}
                            </span>
                            <Badge tone="danger">{t('不建议修改', 'Do not edit')}</Badge>
                          </div>
                          <p className="text-xs text-[var(--text-muted)]">{row.desc}</p>
                        </div>
                        <code className="shrink-0 font-mono text-xs text-[var(--text-muted)]">
                          {row.displayPath}
                        </code>
                      </div>
                    ))}
                  </div>

                  {(showCustomFilterPrompts ||
                    filterPromptFile !== 'prompt.txt' ||
                    extractPromptFile !== 'extract_prompt.txt' ||
                    updateTagsPromptFile !== 'update_tags_prompt.txt') && (
                    <div className="grid grid-cols-1 gap-3 border-t border-[var(--border-default)] bg-[var(--bg-subtle)]/35 p-4 @min-[40rem]/section:grid-cols-3">
                      <div className="space-y-1">
                        <label className="block font-mono text-xs text-[var(--text-muted)]">
                          prompt_file
                        </label>
                        <Input
                          value={filterPromptFile}
                          onChange={(e) =>
                            setConfigValue(['ai_filter', 'prompt_file'], e.target.value)
                          }
                          className="h-8 font-mono text-xs"
                          spellCheck={false}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-mono text-xs text-[var(--text-muted)]">
                          extract_prompt_file
                        </label>
                        <Input
                          value={extractPromptFile}
                          onChange={(e) =>
                            setConfigValue(['ai_filter', 'extract_prompt_file'], e.target.value)
                          }
                          className="h-8 font-mono text-xs"
                          spellCheck={false}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-mono text-xs text-[var(--text-muted)]">
                          update_tags_prompt_file
                        </label>
                        <Input
                          value={updateTagsPromptFile}
                          onChange={(e) =>
                            setConfigValue(['ai_filter', 'update_tags_prompt_file'], e.target.value)
                          }
                          className="h-8 font-mono text-xs"
                          spellCheck={false}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </AdvancedCollapsible>
        </div>
      )}

      <WordGroupTypeModal
        open={groupTypeModalState.open}
        onOpenChange={(open) =>
          setGroupTypeModalState((prev) => ({
            open,
            insertIndex: open ? prev.insertIndex : undefined,
          }))
        }
        lang={lang}
        fixedInsertIndex={groupTypeModalState.insertIndex}
        templates={EXAMPLE_GROUP_TEMPLATES}
        onSelectType={handleCreateGroupByType}
        onSelectTemplate={handleAddTemplateGroup}
        onOpenAiRegex={(idx) =>
          setAiRegexTarget({ mode: 'new', initialTopic: '', insertIndex: idx })
        }
      />

      <AiRegexHelperModal
        open={aiRegexTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAiRegexTarget(null)
        }}
        lang={lang}
        initialTopic={aiRegexTarget?.initialTopic ?? ''}
        targetGroupLabel={aiRegexTarget?.mode === 'group' ? aiRegexTarget.label : undefined}
        fixedInsertIndex={aiRegexTarget?.mode === 'new' ? aiRegexTarget.insertIndex : undefined}
        onApplyParsed={handleApplyAiRegex}
        onNotify={notify}
      />
    </SectionShell>
  )
}
