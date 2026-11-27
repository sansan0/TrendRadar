import { useEffect, useMemo, useRef, useState } from 'react'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Ban,
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Flame,
  Globe,
  GripVertical,
  HelpCircle,
  Link2,
  Pencil,
  Plus,
  Rss,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  Zap,
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
  InfoTooltip,
  Input,
  ModalDialog,
  SelectField,
  Slider,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@/components/ui/primitives'
import { useT } from '@/i18n'
import {
  getLocalizedPlatformName,
  getLocalizedRssFeedName,
  getLocalizedSearchTopicTitle,
  OFFICIAL_PLATFORMS,
  RSS_INSPIRATIONS,
  type RssInspirationItem,
} from '@/lib/presets'
import {
  deriveTopicTitle,
  parseSearchQueries,
  serializeSearchQueries,
} from '@/lib/search-parser'
import type {
  PlatformSource,
  RssFeed,
  SearchQueriesDoc,
  SearchTopic,
} from '@/lib/types'
import { cn, uid } from '@/lib/utils'
import { restrictToVerticalAxis, scrollAndFocusElement } from '@/lib/scroll-focus'
import { getInObject } from '@/lib/yaml-doc'
import { useEditor } from '@/store/editor-store'

type PlatformRowData = Record<string, unknown> & PlatformSource
type RssFeedRowData = Record<string, unknown> & RssFeed

const DEFAULT_VISIBLE_PLATFORMS = 6

function slugifyId(raw: string, fallbackPrefix = 'feed'): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return cleaned || uid(fallbackPrefix)
}

function normalizeSiteInput(raw: string): string {
  return raw
    .trim()
    .replace(/^-?site:/i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
}

function extractDomain(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) return ''
  try {
    return new URL(trimmed).hostname.replace(/^www\./, '')
  } catch {
    return trimmed.replace(/^https?:\/\//i, '').split('/')[0] || trimmed
  }
}

/* ---------------- Sortable Hotlist Platform Row ---------------- */
function SortablePlatformRow({
  rowId,
  sortId,
  item,
  onUpdate,
  onDelete,
}: {
  rowId: string
  sortId: string
  item: PlatformRowData
  onUpdate: (patch: Partial<PlatformSource>) => void
  onDelete: () => void
}) {
  const t = useT()
  const { lang } = useEditor()
  const [editing, setEditing] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortId })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  const isEnabled = item.enabled !== false
  const domain = (item.expected_domain ?? '').trim()
  const displayName = item.name || item.id
    ? getLocalizedPlatformName(item.id, item.name, lang)
    : t('未命名平台', 'Untitled Platform')

  return (
    <div
      id={rowId}
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/row relative rounded-xl border bg-[var(--bg-surface)]',
        isDragging
          ? 'z-20 border-dashed border-[var(--brand-primary)]/70 bg-[var(--brand-soft)]/35 opacity-40'
          : cn(
              'transition-colors',
              editing
                ? 'border-[var(--brand-border)] shadow-[var(--shadow-xs)]'
                : 'border-[var(--border-default)] hover:border-[var(--border-strong)]',
              !isEnabled && 'opacity-60 bg-[var(--bg-subtle)]/70',
            ),
      )}
    >
      {/* Clean Single-Line Summary */}
      <div className="flex items-center gap-2.5 px-3 py-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="tr-focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] cursor-grab active:cursor-grabbing touch-none select-none"
          aria-label={t('拖拽排序', 'Drag to reorder')}
          title={t('拖拽调整顺序', 'Drag to reorder')}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <Switch
          checked={isEnabled}
          onCheckedChange={(checked) => onUpdate({ enabled: checked })}
          ariaLabel={t('启用或停用 {v0}', 'Toggle {v0}', { v0: displayName })}
        />

        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="tr-focus-ring flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-md py-0.5 text-left cursor-pointer"
        >
          <span className="truncate text-sm font-medium text-[var(--text-primary)]">
            {displayName}
          </span>

          <code
            className="shrink-0 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2 py-0.5 font-mono text-xs text-[var(--text-muted)]"
            title={t('平台唯一 ID', 'Platform ID')}
          >
            {item.id}
          </code>

          {domain && (
            <span
              className="hidden @min-[40rem]/section:inline-flex items-center gap-1 rounded-full border border-teal-500/25 bg-teal-500/8 px-2 py-0.5 font-mono text-xs text-teal-700 dark:text-teal-300"
              title={t('已启用安全域名校验：{v0}', 'Verified domain: {v0}', { v0: domain })}
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="max-w-[140px] truncate">{domain}</span>
            </span>
          )}
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant={editing ? 'secondary' : 'ghost'}
            size="xs"
            onClick={() => setEditing((v) => !v)}
            aria-expanded={editing}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>{editing ? t('收起', 'Done') : t('编辑', 'Edit')}</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="tr-hover-delete h-8 w-8 shrink-0 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
            aria-label={t('删除平台', 'Remove platform')}
            title={t('从列表移除', 'Remove platform')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progressive Inline Edit Panel */}
      <Collapsible open={editing}>
        <CollapsibleContent className="tr-collapsible-content">
          <div className="grid grid-cols-1 gap-4 border-t border-[var(--border-default)] bg-[var(--bg-subtle)]/35 px-4 py-4 @min-[48rem]/section:grid-cols-3 @min-[48rem]/section:items-end">
            <div className="space-y-1.5">
              <label className="flex min-h-[24px] items-center text-sm font-medium text-[var(--text-primary)]">
                {t('平台显示名称', 'Display Name')}
              </label>
              <Input
                value={item.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder={t('例如：知乎、微博热搜', 'e.g. Zhihu, Weibo')}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex min-h-[24px] items-center gap-1.5">
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  {t('平台唯一 ID (id)', 'Platform ID (id)')}
                </label>
                {OFFICIAL_PLATFORMS.some((p) => p.id === item.id) && (
                  <Badge tone="neutral">{t('官方内置', 'Official')}</Badge>
                )}
              </div>
              <Input
                value={item.id}
                onChange={(e) => onUpdate({ id: e.target.value.trim() })}
                placeholder="zhihu / weibo"
                className="h-9 font-mono text-sm"
                spellCheck={false}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex min-h-[24px] items-center gap-1.5">
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  {t('安全校验域名', 'Expected Domain')}
                </label>
                <InfoTooltip
                  content={t(
                    'expected_domain：校验返回链接是否属于该主域名及子域名，防范接口劫持。',
                    'expected_domain verifies that returned URLs belong to this domain or its subdomains.',
                  )}
                >
                  <button
                    type="button"
                    className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                    aria-label={t('域名校验说明', 'Domain verification info')}
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </InfoTooltip>
              </div>
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  value={item.expected_domain ?? ''}
                  onChange={(e) => onUpdate({ expected_domain: e.target.value })}
                  placeholder={t('如 baidu.com（可选）', 'e.g. baidu.com (optional)')}
                  className="h-9 pl-9 font-mono text-sm"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

/* ---------------- Compact RSS Feed Card ---------------- */
function RssFeedCard({
  feed,
  index,
  total,
  editing,
  onToggleEdit,
  onMoveUp,
  onMoveDown,
  onUpdate,
  onDelete,
}: {
  feed: RssFeedRowData
  index: number
  total: number
  editing: boolean
  onToggleEdit: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onUpdate: (updater: (prev: RssFeedRowData) => RssFeedRowData) => void
  onDelete: () => void
}) {
  const t = useT()
  const { lang } = useEditor()
  const isEnabled = feed.enabled !== false
  const domain = extractDomain(feed.url)
  const displayName = feed.name || feed.id
    ? getLocalizedRssFeedName(feed.id, feed.name, lang)
    : t('未命名订阅源', 'Untitled Feed')

  return (
    <div
      id={`rss-feed-card-${index}`}
      className={cn(
        'group/row rounded-xl border bg-[var(--bg-surface)] transition-colors',
        editing
          ? 'border-[var(--brand-border)] shadow-[var(--shadow-xs)]'
          : 'border-[var(--border-default)] hover:border-[var(--border-strong)]',
        !isEnabled && 'opacity-60 bg-[var(--bg-subtle)]/70',
      )}
    >
      {/* Clean Single-Line Summary */}
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        <Switch
          checked={isEnabled}
          onCheckedChange={(checked) =>
            onUpdate((prev) => ({ ...prev, enabled: checked }))
          }
          ariaLabel={t('启停 {v0}', 'Toggle {v0}', { v0: displayName })}
        />

        <button
          type="button"
          onClick={onToggleEdit}
          className="tr-focus-ring flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1 rounded-md py-0.5 text-left cursor-pointer"
        >
          <span className="truncate text-sm font-medium text-[var(--text-primary)]">
            {displayName}
          </span>

          {domain && (
            <span className="inline-flex items-center gap-1 truncate font-mono text-xs text-[var(--text-muted)]">
              <Link2 className="h-3.5 w-3.5 shrink-0 opacity-75" />
              <span className="max-w-[200px] truncate">{domain}</span>
            </span>
          )}

          {feed.max_age_days !== undefined && (
            <Badge tone="outline" className="font-mono">
              {feed.max_age_days === 0
                ? t('不限天数', 'No age limit')
                : t('{v0}天', '{v0}d', { v0: feed.max_age_days })}
            </Badge>
          )}

          {feed.max_items !== undefined && (
            <Badge tone="outline" className="font-mono">
              max {feed.max_items}
            </Badge>
          )}
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {total > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={onMoveUp}
                disabled={index === 0}
                className="h-8 w-7 text-[var(--text-muted)]"
                aria-label={t('上移订阅源', 'Move feed up')}
                title={t('上移', 'Move up')}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onMoveDown}
                disabled={index >= total - 1}
                className="h-8 w-7 text-[var(--text-muted)]"
                aria-label={t('下移订阅源', 'Move feed down')}
                title={t('下移', 'Move down')}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          <Button
            variant={editing ? 'secondary' : 'ghost'}
            size="xs"
            onClick={onToggleEdit}
            aria-expanded={editing}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>{editing ? t('收起', 'Done') : t('编辑', 'Edit')}</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="tr-hover-delete h-8 w-8 shrink-0 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
            aria-label={t('删除 RSS 源', 'Delete RSS feed')}
            title={t('删除订阅源', 'Delete RSS feed')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progressive Inline Edit Panel */}
      <Collapsible open={editing}>
        <CollapsibleContent className="tr-collapsible-content">
          <div className="space-y-4 border-t border-[var(--border-default)] bg-[var(--bg-subtle)]/35 px-4 py-4">
            <div className="grid grid-cols-1 gap-4 @min-[40rem]/section:grid-cols-2 @min-[40rem]/section:items-end">
              <div className="space-y-1.5">
                <label className="flex min-h-[24px] items-center text-sm font-medium text-[var(--text-primary)]">
                  {t('订阅源名称', 'Feed Name')}
                </label>
                <Input
                  value={feed.name}
                  onChange={(e) =>
                    onUpdate((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder={t('例如：Hacker News 首页', 'e.g. Hacker News Frontpage')}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="flex min-h-[24px] items-center text-sm font-medium text-[var(--text-primary)]">
                  {t('唯一标识 ID', 'Unique Feed ID')}
                </label>
                <Input
                  value={feed.id}
                  onChange={(e) =>
                    onUpdate((prev) => ({ ...prev, id: e.target.value }))
                  }
                  placeholder="feed-id"
                  className="h-9 font-mono text-sm"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 @min-[48rem]/section:grid-cols-12 @min-[48rem]/section:items-end">
              <div className="@min-[48rem]/section:col-span-6 space-y-1.5">
                <label className="flex min-h-[24px] items-center text-sm font-medium text-[var(--text-primary)]">
                  {t('RSS / Atom 订阅地址', 'RSS / Atom URL')}
                </label>
                <div className="relative">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  <Input
                    value={feed.url}
                    onChange={(e) =>
                      onUpdate((prev) => ({ ...prev, url: e.target.value }))
                    }
                    placeholder="https://example.com/feed.xml"
                    className="h-9 pl-9 font-mono text-sm"
                    spellCheck={false}
                  />
                </div>
              </div>

              <div className="@min-[48rem]/section:col-span-3 space-y-1.5">
                <div className="flex min-h-[24px] items-center gap-1.5">
                  <label className="text-sm font-medium text-[var(--text-primary)] whitespace-nowrap">
                    {t('新鲜度（天）', 'Max Age (Days)')}
                  </label>
                  <InfoTooltip
                    content={t(
                      '留空沿用全局新鲜度天数；填 0 表示禁用此源的新鲜度过滤。',
                      'Leave blank to follow the global setting; enter 0 to disable freshness filtering for this feed.',
                    )}
                  >
                    <button
                      type="button"
                      className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                      aria-label={t('新鲜度覆盖说明', 'Max age override info')}
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </InfoTooltip>
                </div>
                <Input
                  type="number"
                  min={0}
                  value={feed.max_age_days ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value.trim()
                    onUpdate((prev) => {
                      const clone: RssFeedRowData = { ...prev }
                      if (raw === '') {
                        delete clone.max_age_days
                      } else {
                        const n = Number.parseInt(raw, 10)
                        if (Number.isFinite(n) && n >= 0) {
                          clone.max_age_days = n
                        }
                      }
                      return clone
                    })
                  }}
                  placeholder={t('留空走全局', 'Global')}
                  className="h-9 font-mono text-sm"
                />
              </div>

              <div className="@min-[48rem]/section:col-span-3 space-y-1.5">
                <div className="flex min-h-[24px] items-center gap-1.5">
                  <label className="text-sm font-medium text-[var(--text-primary)] whitespace-nowrap">
                    {t('条数上限 (max_items)', 'Max Items')}
                  </label>
                  <InfoTooltip
                    content={t(
                      '可选：限制该订阅源每次抓取保留的最大文章数，留空表示不限制。',
                      'Optional cap on articles kept per fetch for this feed; leave blank for unlimited.',
                    )}
                  >
                    <button
                      type="button"
                      className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                      aria-label={t('条数上限说明', 'Max items info')}
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </InfoTooltip>
                </div>
                <Input
                  type="number"
                  min={1}
                  value={feed.max_items ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value.trim()
                    onUpdate((prev) => {
                      const clone: RssFeedRowData = { ...prev }
                      if (raw === '') {
                        delete clone.max_items
                      } else {
                        const n = Number.parseInt(raw, 10)
                        if (Number.isFinite(n) && n >= 1) {
                          clone.max_items = n
                        } else if (n === 0) {
                          delete clone.max_items
                        }
                      }
                      return clone
                    })
                  }}
                  placeholder={t('留空不限', 'Unlimited')}
                  className="h-9 font-mono text-sm"
                />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

/* ---------------- Compact Chip Editor for Words / Sites ---------------- */
function TagChipEditor({
  items,
  prefix = '',
  placeholder,
  addLabel,
  tone = 'neutral',
  normalize,
  onAdd,
  onRemove,
}: {
  items: string[]
  prefix?: string
  placeholder: string
  addLabel: string
  tone?: 'neutral' | 'danger' | 'warning'
  normalize?: (raw: string) => string
  onAdd: (val: string) => void
  onRemove: (idx: number) => void
}) {
  const t = useT()
  const [draft, setDraft] = useState('')

  const submit = () => {
    const cleaned = normalize ? normalize(draft) : draft.trim()
    if (!cleaned) return
    if (!items.includes(cleaned)) {
      onAdd(cleaned)
    }
    setDraft('')
  }

  return (
    <div className="space-y-2.5">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item, idx) => (
            <span
              key={`${item}-${idx}`}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px]',
                tone === 'danger'
                  ? 'border-red-500/25 bg-red-500/8 text-red-700 dark:text-red-300'
                  : tone === 'warning'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                    : 'border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-primary)]',
              )}
            >
              <span className="font-mono text-xs">
                {prefix}
                {item}
              </span>
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="rounded p-0.5 opacity-70 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10 cursor-pointer"
                aria-label={t('移除', 'Remove')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={placeholder}
          className="h-9 text-sm font-mono"
          spellCheck={false}
        />
        <Button size="sm" variant="outline" onClick={submit} disabled={!draft.trim()}>
          <Plus className="h-4 w-4" />
          <span>{addLabel}</span>
        </Button>
      </div>
    </div>
  )
}

/* ---------------- Search Topic Card (Collapsible by Default) ---------------- */
function SearchTopicCard({
  index,
  total,
  topic,
  expanded,
  onToggleExpand,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  index: number
  total: number
  topic: SearchTopic
  expanded: boolean
  onToggleExpand: () => void
  onChange: (next: SearchTopic) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}) {
  const t = useT()
  const { workspaceMode, lang } = useEditor()
  const joinedQueries = topic.queries.join('\n')
  const [nameDraft, setNameDraft] = useState(topic.name)
  const [queriesDraft, setQueriesDraft] = useState(joinedQueries)
  const lastNameRef = useRef(topic.name)
  const lastQueriesRef = useRef(joinedQueries)

  useEffect(() => {
    if (topic.name !== lastNameRef.current) {
      setNameDraft(topic.name)
      lastNameRef.current = topic.name
    }
  }, [topic.name])

  useEffect(() => {
    if (joinedQueries !== lastQueriesRef.current) {
      setQueriesDraft(joinedQueries)
      lastQueriesRef.current = joinedQueries
    }
  }, [joinedQueries])

  const handleNameChange = (val: string) => {
    setNameDraft(val)
    const trimmed = val.trim()
    if (!trimmed && topic.queries.length === 0) return
    lastNameRef.current = trimmed
    onChange({ ...topic, name: trimmed })
  }

  const handleQueriesChange = (val: string) => {
    setQueriesDraft(val)
    const nextQueries = val
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (nextQueries.length === 0 && !topic.name.trim()) return
    const nextJoined = nextQueries.join('\n')
    lastQueriesRef.current = nextJoined
    if (nextJoined !== joinedQueries) {
      onChange({ ...topic, queries: nextQueries })
    }
  }

  const insertSnippet = (snippet: string) => {
    const lines = queriesDraft.split('\n')
    const lastIdx = lines.length - 1
    const lastLine = lines[lastIdx] ?? ''
    if (lastLine.trim() === '') {
      lines[lastIdx] = snippet
    } else if (!lastLine.includes(snippet)) {
      lines[lastIdx] = `${lastLine.trimEnd()} ${snippet}`
    }
    const nextRaw = lines.join('\n')
    handleQueriesChange(nextRaw)
  }

  const titlePreview = getLocalizedSearchTopicTitle(deriveTopicTitle(topic), lang)
  const localExcludesCount = topic.excludeWords.length + topic.excludeSites.length

  return (
    <Card
      id={`search-topic-card-${index}`}
      className={cn(
        'group/row overflow-hidden transition-colors',
        expanded ? 'border-[var(--brand-border)]' : 'hover:border-[var(--border-strong)]',
      )}
    >
      {/* Collapsed / Expandable Topic Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 @min-[40rem]/section:px-4">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className="tr-focus-ring flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-md py-0.5 text-left cursor-pointer"
        >
          <Badge tone="brand" className="font-mono">
            #{index + 1}
          </Badge>
          <span className="truncate text-[15px] font-semibold text-[var(--text-primary)]">
            {titlePreview}
          </span>
          <Badge tone="neutral">
            {t('{v0} 条查询词', '{v0} queries', { v0: topic.queries.length })}
          </Badge>
          {topic.maxItems !== undefined && (
            <Badge tone="outline" className="font-mono">
              @{topic.maxItems}
            </Badge>
          )}
          {topic.freshnessDays !== undefined && (
            <Badge tone="outline" className="font-mono">
              ~{topic.freshnessDays}d
            </Badge>
          )}
          {localExcludesCount > 0 && (
            <Badge tone="warning" className="font-mono">
              !{localExcludesCount}
            </Badge>
          )}
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant={expanded ? 'secondary' : 'ghost'}
            size="xs"
            onClick={onToggleExpand}
            aria-expanded={expanded}
          >
            <span>{expanded ? t('收起', 'Collapse') : t('编辑', 'Edit')}</span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform duration-150',
                expanded && 'rotate-180',
              )}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onMoveUp}
            disabled={index === 0}
            className="h-8 w-8"
            aria-label={t('上移主题', 'Move topic up')}
            title={t('上移', 'Move up')}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="h-8 w-8"
            aria-label={t('下移主题', 'Move topic down')}
            title={t('下移', 'Move down')}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="tr-hover-delete h-8 w-8 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
            aria-label={t('删除主题', 'Delete topic')}
            title={t('删除此主题', 'Delete topic')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded Editing Body */}
      <Collapsible open={expanded}>
        <CollapsibleContent className="tr-collapsible-content">
          <div className="space-y-5 border-t border-[var(--border-default)] bg-[var(--bg-subtle)]/25 px-5 py-5">
            {/* Topic Name + Overrides Row */}
            <div className="grid grid-cols-1 gap-4 @min-[40rem]/section:grid-cols-12 @min-[40rem]/section:items-end">
              <div className="@min-[40rem]/section:col-span-6 space-y-1.5">
                <label className="flex min-h-[24px] items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]">
                  <span>{t('主题名称 [名称]', 'Topic Heading [Name]')}</span>
                  <InfoTooltip
                    content={t(
                      '推送报告与运行日志中展示的搜索专题标题（对应 search_queries.txt 中的 [名称] 语法，可留空）。',
                      'Heading shown in reports and logs for this search topic (maps to [Name] in search_queries.txt; optional).',
                    )}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                      aria-label={t('主题名称说明', 'Topic heading help')}
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </InfoTooltip>
                </label>
                <Input
                  data-autofocus-topic="true"
                  value={nameDraft}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder={t('例如：AI 政策与行业动态', 'e.g. AI Policy & Industry')}
                  className="h-9 text-sm"
                />
              </div>

              <div className="@min-[40rem]/section:col-span-3 space-y-1.5">
                <label className="flex min-h-[24px] items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] whitespace-nowrap">
                  <span>{t('上限 (@N)', 'Limit (@N)')}</span>
                  <InfoTooltip
                    content={t(
                      '该专题每次最多保留几条搜索结果（如填 10 即写入 @10；留空则使用上方全局默认上限）。',
                      'Max results kept per run for this topic (e.g. 10 writes @10; blank uses global default).',
                    )}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                      aria-label={t('条数上限说明', 'Limit help')}
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </InfoTooltip>
                </label>
                <Input
                  type="number"
                  min={1}
                  value={topic.maxItems ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value.trim()
                    if (raw === '') {
                      onChange({ ...topic, maxItems: undefined })
                    } else {
                      const n = Number.parseInt(raw, 10)
                      if (Number.isFinite(n) && n > 0) {
                        onChange({ ...topic, maxItems: n })
                      }
                    }
                  }}
                  placeholder={t('跟随全局', 'Global')}
                  className="h-9 text-sm font-mono"
                />
              </div>

              <div className="@min-[40rem]/section:col-span-3 space-y-1.5">
                <label className="flex min-h-[24px] items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] whitespace-nowrap">
                  <span>{t('时效 (~Nd)', 'Days (~Nd)')}</span>
                  <InfoTooltip
                    content={t(
                      '仅搜索最近 N 天内发布的网页内容（如填 7 即写入 ~7d，只看近 7 天动态；留空则使用全局默认时效）。',
                      'Only include pages published within the last N days (e.g. 7 writes ~7d; blank uses global freshness).',
                    )}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                      aria-label={t('时效说明', 'Freshness days help')}
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </InfoTooltip>
                </label>
                <Input
                  type="number"
                  min={0}
                  value={topic.freshnessDays ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value.trim()
                    if (raw === '') {
                      onChange({ ...topic, freshnessDays: undefined })
                    } else {
                      const n = Number.parseInt(raw, 10)
                      if (Number.isFinite(n) && n >= 0) {
                        onChange({ ...topic, freshnessDays: n })
                      }
                    }
                  }}
                  placeholder={t('跟随全局', 'Global')}
                  className="h-9 text-sm font-mono"
                />
              </div>
            </div>

            {(workspaceMode === 'pro' || topic.provider) && (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {t('本主题搜索引擎 (@provider)', 'Topic search provider (@provider)')}
                </span>
                <Input
                  value={topic.provider ?? ''}
                  onChange={(e) => onChange({ ...topic, provider: e.target.value.trim() || undefined })}
                  placeholder={t('留空使用全局引擎', 'Leave empty to use the global provider')}
                  className="h-9 font-mono text-sm"
                  spellCheck={false}
                />
              </label>
            )}

            {/* Multi-line Queries + Syntax Chips */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  {t('搜索词（每行一条）', 'Search Queries (one per line)')}
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] text-[var(--text-muted)]">
                    {t('快捷限定：', 'Quick syntax:')}
                  </span>
                  {['site:gov.cn', 'site:github.com', 'site:arxiv.org'].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => insertSnippet(chip)}
                      className="tr-focus-ring rounded-md border border-[var(--brand-border)] bg-[var(--brand-soft)] px-2.5 py-0.5 font-mono text-xs text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-primary)] hover:text-white cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                rows={Math.max(2, Math.min(6, queriesDraft.split('\n').length))}
                value={queriesDraft}
                onChange={(e) => handleQueriesChange(e.target.value)}
                placeholder={t(
                  '每行输入一条搜索词，支持 site:domain.com 限定域名',
                  'Enter one search query per line, supports site:domain.com',
                )}
                className="font-mono text-sm leading-relaxed"
                spellCheck={false}
              />
            </div>

            {/* Local Excludes: Words (!word) & Sites (-site:domain) */}
            <div className="grid grid-cols-1 gap-4 border-t border-[var(--border-default)] pt-4 @min-[48rem]/section:grid-cols-2">
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]">
                  <span>{t('本主题排除词 (!词)', 'Local Exclude Words (!word)')}</span>
                  <InfoTooltip
                    content={t(
                      '标题或摘要包含这些词的网页结果将被直接剔除（仅对本主题生效，写入 !排除词）。',
                      'Results containing these words are excluded for this topic (!word).',
                    )}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                      aria-label={t('排除词说明', 'Exclude words help')}
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </InfoTooltip>
                </label>
                <TagChipEditor
                  items={topic.excludeWords}
                  prefix="!"
                  tone="warning"
                  placeholder={t('输入排除词后回车', 'Type word & press Enter')}
                  addLabel={t('添加', 'Add')}
                  onAdd={(w) => onChange({ ...topic, excludeWords: [...topic.excludeWords, w] })}
                  onRemove={(i) =>
                    onChange({
                      ...topic,
                      excludeWords: topic.excludeWords.filter((_, idx) => idx !== i),
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]">
                  <span>{t('本主题屏蔽域名 (-site:)', 'Local Exclude Sites (-site:)')}</span>
                  <InfoTooltip
                    content={t(
                      '屏蔽指定网站域名的搜索结果（如内容农场或低质聚合站，写入 -site:域名）。',
                      'Block results from specific domains for this topic (-site:domain).',
                    )}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                      aria-label={t('屏蔽域名说明', 'Exclude sites help')}
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </InfoTooltip>
                </label>
                <TagChipEditor
                  items={topic.excludeSites}
                  prefix="-site:"
                  tone="danger"
                  normalize={normalizeSiteInput}
                  placeholder={t('如 baijiahao.baidu.com', 'e.g. content-farm.com')}
                  addLabel={t('屏蔽', 'Block')}
                  onAdd={(s) => onChange({ ...topic, excludeSites: [...topic.excludeSites, s] })}
                  onRemove={(i) =>
                    onChange({
                      ...topic,
                      excludeSites: topic.excludeSites.filter((_, idx) => idx !== i),
                    })
                  }
                />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

/* ---------------- Main Sources Section ---------------- */
export function SourcesSection() {
  const {
    files,
    configData,
    lang,
    deployMode,
    setConfigValue,
    setFileContent,
    jumpToSource,
    notify,
    workspaceMode,
    activeSourceFile,
    sourcesSubTab: activeTab,
    setSourcesSubTab: setActiveTab,
    selectProSection,
    visualFocusTarget,
  } = useEditor()
  const t = useT()

  /* ---------- Tab 1 State: Hotlist Platforms ---------- */
  const platformsEnabled = Boolean(getInObject<boolean>(configData, ['platforms', 'enabled'], true))
  const platformsApiUrl = String(getInObject<string>(configData, ['platforms', 'api_url'], '') ?? '')
  const rawSources = getInObject<unknown[]>(configData, ['platforms', 'sources'], [])

  const platforms: PlatformRowData[] = useMemo(() => {
    if (!Array.isArray(rawSources)) return []
    return rawSources
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => {
        const normalized: PlatformRowData = {
          ...item,
          id: String(item.id ?? ''),
          name: String(item.name ?? ''),
        }
        if (item.expected_domain !== undefined) {
          normalized.expected_domain = String(item.expected_domain)
        }
        if (item.enabled !== undefined) {
          normalized.enabled = Boolean(item.enabled)
        }
        return normalized
      })
  }, [rawSources])

  const enabledPlatformsCount = useMemo(
    () => platforms.filter((p) => p.enabled !== false).length,
    [platforms],
  )

  const crawlerInterval = Number(
    getInObject<number>(configData, ['advanced', 'crawler', 'request_interval'], 2000),
  )
  const crawlerUseProxy = Boolean(
    getInObject<boolean>(configData, ['advanced', 'crawler', 'use_proxy'], false),
  )
  const crawlerDefaultProxy = String(
    getInObject<string>(
      configData,
      ['advanced', 'crawler', 'default_proxy'],
      'http://127.0.0.1:10801',
    ) ?? '',
  )

  const crawlerCustomizedCount = useMemo(() => {
    let count = 0
    if (platformsApiUrl.trim() !== '') count += 1
    if (crawlerInterval !== 2000) count += 1
    if (crawlerUseProxy) count += 1
    if (
      crawlerDefaultProxy.trim() !== '' &&
      crawlerDefaultProxy.trim() !== 'http://127.0.0.1:10801'
    ) {
      count += 1
    }
    return count
  }, [platformsApiUrl, crawlerInterval, crawlerUseProxy, crawlerDefaultProxy])

  const [showAllPlatforms, setShowAllPlatforms] = useState(false)
  const [platformModalOpen, setPlatformModalOpen] = useState(false)
  const [platformModalTab, setPlatformModalTab] = useState<'official' | 'custom'>('official')
  const [customPlatId, setCustomPlatId] = useState('')
  const [customPlatName, setCustomPlatName] = useState('')
  const [customPlatDomain, setCustomPlatDomain] = useState('')

  const [activeDragPlatformKey, setActiveDragPlatformKey] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const platformSortKeys = useMemo(
    () => platforms.map((p, idx) => `${p.id || 'platform'}::${idx}`),
    [platforms],
  )

  const visiblePlatformCount =
    showAllPlatforms || platforms.length <= DEFAULT_VISIBLE_PLATFORMS
      ? platforms.length
      : DEFAULT_VISIBLE_PLATFORMS
  const visiblePlatforms = useMemo(
    () => platforms.slice(0, visiblePlatformCount),
    [platforms, visiblePlatformCount],
  )
  const visiblePlatformSortKeys = useMemo(
    () => platformSortKeys.slice(0, visiblePlatformCount),
    [platformSortKeys, visiblePlatformCount],
  )
  const hiddenPlatformsCount = platforms.length - visiblePlatformCount

  const handlePlatformDragStart = (event: DragStartEvent) => {
    setActiveDragPlatformKey(String(event.active.id))
  }

  const handlePlatformDragEnd = (event: DragEndEvent) => {
    setActiveDragPlatformKey(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = platformSortKeys.indexOf(String(active.id))
    const newIndex = platformSortKeys.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(platforms, oldIndex, newIndex)
    setConfigValue(['platforms', 'sources'], reordered)
  }

  const activeDragPlatform = useMemo(() => {
    if (!activeDragPlatformKey) return null
    const idx = platformSortKeys.indexOf(activeDragPlatformKey)
    return idx >= 0 ? platforms[idx] : null
  }, [activeDragPlatformKey, platformSortKeys, platforms])

  const updatePlatformAt = (idx: number, patch: Partial<PlatformSource>) => {
    const next = platforms.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    setConfigValue(['platforms', 'sources'], next)
  }

  const removePlatformAt = (idx: number) => {
    const removed = platforms[idx]
    const next = platforms.filter((_, i) => i !== idx)
    setConfigValue(['platforms', 'sources'], next)
    if (removed) {
      notify(
        t('已移除平台「{v0}」', 'Removed "{v0}"', { v0: removed.name || removed.id }),
        'default',
      )
    }
  }

  const existingPlatformIds = useMemo(() => new Set(platforms.map((p) => p.id)), [platforms])

  const addOfficialPlatform = (preset: (typeof OFFICIAL_PLATFORMS)[number]) => {
    if (existingPlatformIds.has(preset.id)) return
    const nextItem: PlatformSource = {
      id: preset.id,
      name: t(preset.name, preset.nameEn),
      expected_domain: preset.expected_domain,
    }
    const nextIndex = platforms.length
    setConfigValue(['platforms', 'sources'], [...platforms, nextItem])
    if (platforms.length >= DEFAULT_VISIBLE_PLATFORMS) {
      setShowAllPlatforms(true)
    }
    notify(
      t('已添加平台「{v0}」', 'Added platform "{v0}"', { v0: nextItem.name }),
      'success',
    )
    scrollAndFocusElement(`platform-row-${nextIndex}`)
  }

  const addAllMissingOfficial = () => {
    const missing = OFFICIAL_PLATFORMS.filter((p) => !existingPlatformIds.has(p.id))
    if (missing.length === 0) return
    const added: PlatformSource[] = missing.map((p) => ({
      id: p.id,
      name: t(p.name, p.nameEn),
      expected_domain: p.expected_domain,
    }))
    const firstAddedIndex = platforms.length
    setConfigValue(['platforms', 'sources'], [...platforms, ...added])
    setShowAllPlatforms(true)
    notify(
      t('已补全 {v0} 个官方平台', 'Added {v0} official platforms', { v0: added.length }),
      'success',
    )
    scrollAndFocusElement(`platform-row-${firstAddedIndex}`)
  }

  const handleAddCustomPlatform = () => {
    const id = customPlatId.trim()
    const name = customPlatName.trim() || id
    const domain = customPlatDomain.trim()
    if (!id) return
    if (existingPlatformIds.has(id)) {
      notify(t('平台 ID "{v0}" 已存在', 'Platform ID "{v0}" already exists', { v0: id }), 'warning')
      return
    }
    const nextItem: PlatformSource = domain
      ? { id, name, expected_domain: domain }
      : { id, name }
    const nextIndex = platforms.length
    setConfigValue(['platforms', 'sources'], [...platforms, nextItem])
    if (platforms.length >= DEFAULT_VISIBLE_PLATFORMS) {
      setShowAllPlatforms(true)
    }
    setCustomPlatId('')
    setCustomPlatName('')
    setCustomPlatDomain('')
    setPlatformModalOpen(false)
    notify(t('已添加自定义平台「{v0}」', 'Added custom platform "{v0}"', { v0: name }), 'success')
    scrollAndFocusElement(`platform-row-${nextIndex}`)
  }

  /* ---------- Tab 2 State: RSS Feeds ---------- */
  const rssEnabled = Boolean(getInObject<boolean>(configData, ['rss', 'enabled'], true))
  const freshnessEnabled = Boolean(
    getInObject<boolean>(configData, ['rss', 'freshness_filter', 'enabled'], true),
  )
  const freshnessMaxAge = Number(
    getInObject<number>(configData, ['rss', 'freshness_filter', 'max_age_days'], 1),
  )
  const rawFeeds = getInObject<unknown[]>(configData, ['rss', 'feeds'], [])

  const feeds: RssFeedRowData[] = useMemo(() => {
    if (!Array.isArray(rawFeeds)) return []
    return rawFeeds
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => {
        const normalized: RssFeedRowData = {
          ...item,
          id: String(item.id ?? ''),
          name: String(item.name ?? ''),
          url: String(item.url ?? ''),
        }
        if (item.enabled !== undefined) {
          normalized.enabled = Boolean(item.enabled)
        }
        if (item.max_age_days !== undefined && item.max_age_days !== null) {
          normalized.max_age_days = Number(item.max_age_days)
        }
        if (item.max_items !== undefined && item.max_items !== null) {
          normalized.max_items = Number(item.max_items)
        }
        return normalized
      })
  }, [rawFeeds])

  const enabledFeedsCount = useMemo(
    () => feeds.filter((f) => f.enabled !== false).length,
    [feeds],
  )

  const rssInterval = Number(
    getInObject<number>(configData, ['advanced', 'rss', 'request_interval'], 1000),
  )
  const rssTimeout = Number(getInObject<number>(configData, ['advanced', 'rss', 'timeout'], 15))
  const rssUseProxy = Boolean(
    getInObject<boolean>(configData, ['advanced', 'rss', 'use_proxy'], false),
  )
  const rssProxyUrl = String(getInObject<string>(configData, ['advanced', 'rss', 'proxy_url'], '') ?? '')

  const rssAdvancedCustomizedCount = useMemo(() => {
    let count = 0
    if (rssInterval !== 1000) count += 1
    if (rssTimeout !== 15) count += 1
    if (rssUseProxy) count += 1
    if (rssProxyUrl.trim() !== '') count += 1
    return count
  }, [rssInterval, rssTimeout, rssUseProxy, rssProxyUrl])

  const [expandedFeedIndices, setExpandedFeedIndices] = useState<Record<number, boolean>>({})
  const [rssModalOpen, setRssModalOpen] = useState(false)
  const [newFeedName, setNewFeedName] = useState('')
  const [newFeedUrl, setNewFeedUrl] = useState('')
  const [newFeedId, setNewFeedId] = useState('')
  const [newFeedIdTouched, setNewFeedIdTouched] = useState(false)
  const [newFeedMaxAge, setNewFeedMaxAge] = useState('')
  const [newFeedMaxItems, setNewFeedMaxItems] = useState('')
  const [bingKeyword, setBingKeyword] = useState(t('人工智能', 'Artificial Intelligence'))

  const updateFeedAt = (idx: number, updater: (prev: RssFeedRowData) => RssFeedRowData) => {
    const next = feeds.map((item, i) => (i === idx ? updater(item) : item))
    setConfigValue(['rss', 'feeds'], next)
  }

  const moveFeedAt = (from: number, to: number) => {
    if (to < 0 || to >= feeds.length || from === to) return
    setExpandedFeedIndices((prev) => ({
      ...prev,
      [from]: Boolean(prev[to]),
      [to]: Boolean(prev[from]),
    }))
    setConfigValue(['rss', 'feeds'], arrayMove(feeds, from, to))
  }

  const removeFeedAt = (idx: number) => {
    const removed = feeds[idx]
    setExpandedFeedIndices((prev) => {
      const next: Record<number, boolean> = {}
      for (const [k, v] of Object.entries(prev)) {
        const n = Number(k)
        if (!v || n === idx) continue
        next[n > idx ? n - 1 : n] = true
      }
      return next
    })
    setConfigValue(
      ['rss', 'feeds'],
      feeds.filter((_, i) => i !== idx),
    )
    if (removed) {
      notify(t('已删除 RSS 源「{v0}」', 'Removed RSS feed "{v0}"', { v0: removed.name || removed.id }), 'default')
    }
  }

  const openAddRssModal = (prefill?: {
    id?: string
    name?: string
    url?: string
    maxAgeDays?: number
    maxItems?: number
  }) => {
    setNewFeedName(prefill?.name ?? '')
    setNewFeedUrl(prefill?.url ?? '')
    setNewFeedId(prefill?.id ?? '')
    setNewFeedIdTouched(Boolean(prefill?.id))
    setNewFeedMaxAge(prefill?.maxAgeDays !== undefined ? String(prefill.maxAgeDays) : '')
    setNewFeedMaxItems(prefill?.maxItems !== undefined ? String(prefill.maxItems) : '')
    setRssModalOpen(true)
  }

  const handleAddRssFeed = () => {
    const url = newFeedUrl.trim()
    if (!url) return
    const name = newFeedName.trim() || url
    const baseId = newFeedId.trim() || slugifyId(name, 'rss')
    const existingIds = new Set(feeds.map((f) => f.id))
    const finalId = existingIds.has(baseId) ? `${baseId}-${feeds.length + 1}` : baseId

    const nextFeed: RssFeed = {
      id: finalId,
      name,
      url,
      enabled: true,
    }
    const maxAgeRaw = newFeedMaxAge.trim()
    if (maxAgeRaw !== '') {
      const n = Number.parseInt(maxAgeRaw, 10)
      if (Number.isFinite(n) && n >= 0) {
        nextFeed.max_age_days = n
      }
    }
    const maxItemsRaw = newFeedMaxItems.trim()
    if (maxItemsRaw !== '') {
      const n = Number.parseInt(maxItemsRaw, 10)
      if (Number.isFinite(n) && n >= 1) {
        nextFeed.max_items = n
      }
    }

    const nextIndex = feeds.length
    setConfigValue(['rss', 'feeds'], [...feeds, nextFeed])
    setRssModalOpen(false)
    notify(t('已添加 RSS 源「{v0}」', 'Added RSS feed "{v0}"', { v0: name }), 'success')
    scrollAndFocusElement(`rss-feed-card-${nextIndex}`)
  }

  const addInspirationDirectly = (item: RssInspirationItem) => {
    const existingIds = new Set(feeds.map((f) => f.id))
    const finalId = existingIds.has(item.id) ? `${item.id}-${feeds.length + 1}` : item.id
    const name = t(item.nameZh, item.nameEn)
    const nextFeed: RssFeed = {
      id: finalId,
      name,
      url: item.url,
      enabled: true,
      ...(item.maxAgeDays !== undefined ? { max_age_days: item.maxAgeDays } : {}),
    }
    const nextIndex = feeds.length
    setConfigValue(['rss', 'feeds'], [...feeds, nextFeed])
    notify(t('已添加灵感源「{v0}」', 'Added "{v0}"', { v0: name }), 'success')
    scrollAndFocusElement(`rss-feed-card-${nextIndex}`)
  }

  const handleAddBingKeywordFeed = (openInModal = false) => {
    const kw = bingKeyword.trim()
    if (!kw) return
    const queryExpr = kw.replace(/\s+/g, '+')
    const url = `https://www.bing.com/news/search?q=${queryExpr}&format=RSS`
    const name = t('Bing 新闻：{v0}', 'Bing News: {v0}', { v0: kw })
    const id = `bing-${slugifyId(kw, 'kw')}`
    if (openInModal) {
      openAddRssModal({ id, name, url, maxAgeDays: 2 })
      return
    }
    const existingIds = new Set(feeds.map((f) => f.id))
    const finalId = existingIds.has(id) ? `${id}-${feeds.length + 1}` : id
    const nextFeed: RssFeed = {
      id: finalId,
      name,
      url,
      enabled: true,
      max_age_days: 2,
    }
    const nextIndex = feeds.length
    setConfigValue(['rss', 'feeds'], [...feeds, nextFeed])
    notify(t('已添加 Bing 关键词订阅「{v0}」', 'Added Bing keyword feed "{v0}"', { v0: kw }), 'success')
    scrollAndFocusElement(`rss-feed-card-${nextIndex}`)
  }

  /* ---------- Tab 3 State: Web Search & search_queries.txt ---------- */
  const webSearchEnabled = Boolean(
    getInObject<boolean>(configData, ['web_search', 'enabled'], false),
  )
  const wsProvider = String(
    getInObject<string>(configData, ['web_search', 'provider'], 'deepseek') || 'deepseek',
  ).trim() || 'deepseek'
  const queryMode = String(
    getInObject<string>(configData, ['web_search', 'query_mode'], 'direct') || 'direct',
  )
  const providerApiKey = String(
    getInObject<string>(configData, ['web_search', 'providers', wsProvider, 'api_key'], '') ?? '',
  )
  const providerApiBase = String(
    getInObject<string>(
      configData,
      ['web_search', 'providers', wsProvider, 'api_base'],
      wsProvider === 'deepseek' ? 'https://api.deepseek.com' : '',
    ) ?? '',
  )
  const providerLocalization = String(
    getInObject<string>(
      configData,
      ['web_search', 'providers', wsProvider, 'localization'],
      '',
    ) ?? '',
  )
  const wsShowSnippet = Boolean(
    getInObject<boolean>(configData, ['web_search', 'notification_show_snippet'], false),
  )

  const maxItemsPerTopic = Number(
    getInObject<number>(configData, ['web_search', 'max_items_per_topic'], 8),
  )
  const wsFreshnessDays = Number(
    getInObject<number>(configData, ['web_search', 'freshness_days'], 7),
  )
  const wsDedupDays = Number(getInObject<number>(configData, ['web_search', 'dedup_days'], 7))
  const wsMinScore = Number(getInObject<number>(configData, ['web_search', 'min_score'], 0.5))

  const wsFetchCount = Number(getInObject<number>(configData, ['web_search', 'fetch_count'], 20))
  const wsMinAuthority = Number(
    getInObject<number>(configData, ['web_search', 'min_authority'], -1),
  )
  const wsAllowUnknownAuth = Boolean(
    getInObject<boolean>(configData, ['web_search', 'allow_unknown_authority'], true),
  )
  const wsNeedContent = Boolean(
    getInObject<boolean>(configData, ['web_search', 'need_content'], false),
  )
  const wsQueriesFile = String(
    getInObject<string>(configData, ['web_search', 'queries_file'], '') ?? '',
  )

  const wsRequestInterval = Number(
    getInObject<number>(configData, ['advanced', 'web_search', 'request_interval'], 1000),
  )
  const wsTimeout = Number(
    getInObject<number>(configData, ['advanced', 'web_search', 'timeout'], 20),
  )
  const wsMaxRetries = Number(
    getInObject<number>(configData, ['advanced', 'web_search', 'max_retries'], 2),
  )
  const wsUseProxy = Boolean(
    getInObject<boolean>(configData, ['advanced', 'web_search', 'use_proxy'], false),
  )
  const wsProxyUrl = String(
    getInObject<string>(configData, ['advanced', 'web_search', 'proxy_url'], '') ?? '',
  )

  const wsAdvancedCustomizedCount = useMemo(() => {
    let count = 0
    if (wsDedupDays !== 7) count += 1
    if (wsFetchCount !== 20) count += 1
    if (wsMinAuthority !== -1) count += 1
    if (!wsAllowUnknownAuth) count += 1
    if (wsNeedContent) count += 1
    if (wsQueriesFile.trim() !== '') count += 1
    if (providerLocalization.trim() !== '') count += 1
    if (wsRequestInterval !== 1000) count += 1
    if (wsTimeout !== 20) count += 1
    if (wsMaxRetries !== 2) count += 1
    if (wsUseProxy) count += 1
    if (wsProxyUrl.trim() !== '') count += 1
    return count
  }, [
    wsDedupDays,
    wsFetchCount,
    wsMinAuthority,
    wsAllowUnknownAuth,
    wsNeedContent,
    wsQueriesFile,
    providerLocalization,
    wsRequestInterval,
    wsTimeout,
    wsMaxRetries,
    wsUseProxy,
    wsProxyUrl,
  ])

  const searchDoc = useMemo(
    () => parseSearchQueries(files['search_queries.txt']),
    [files],
  )

  const [expandedTopicIndices, setExpandedTopicIndices] = useState<Record<number, boolean>>({})

  const globalExcludeTotal =
    searchDoc.globalExcludeWords.length + searchDoc.globalExcludeSites.length

  const commitSearchDoc = (updater: (prev: SearchQueriesDoc) => SearchQueriesDoc) => {
    const next = updater(searchDoc)
    setFileContent('search_queries.txt', serializeSearchQueries(next))
  }

  const handleAddSearchTopic = () => {
    const newIndex = searchDoc.topics.length
    const newTopic: SearchTopic = {
      id: uid('st'),
      name: t('新搜索主题 {v0}', 'Search Topic {v0}', { v0: newIndex + 1 }),
      queries: [t('人工智能 最新政策 site:gov.cn', 'AI policy updates')],
      excludeWords: [],
      excludeSites: [],
    }
    commitSearchDoc((prev) => ({
      ...prev,
      topics: [...prev.topics, newTopic],
    }))
    setExpandedTopicIndices((prev) => ({ ...prev, [newIndex]: true }))
    notify(t('已新增搜索主题', 'Added new search topic'), 'success')
    scrollAndFocusElement(`search-topic-card-${newIndex}`, {
      focusSelector: 'input[data-autofocus-topic="true"]',
      selectText: true,
    })
  }

  const handleSwapTopicExpanded = (a: number, b: number) => {
    setExpandedTopicIndices((prev) => ({
      ...prev,
      [a]: Boolean(prev[b]),
      [b]: Boolean(prev[a]),
    }))
  }

  const handleDeleteSearchTopic = (idx: number) => {
    setExpandedTopicIndices((prev) => {
      const next: Record<number, boolean> = {}
      for (const [k, v] of Object.entries(prev)) {
        const n = Number(k)
        if (!v || n === idx) continue
        next[n > idx ? n - 1 : n] = true
      }
      return next
    })
    commitSearchDoc((prev) => ({
      ...prev,
      topics: prev.topics.filter((_, i) => i !== idx),
    }))
  }

  const authorityOptions = useMemo(
    () => [
      {
        value: '-1',
        label: t('-1 · 不限制权威度（默认）', '-1 · No authority limit (Default)'),
      },
      {
        value: '0',
        label: t('0 级 · 保留基础收录站点', 'Level 0 · Basic indexed sites'),
      },
      {
        value: '1',
        label: t('1 级 · 常规资讯媒体', 'Level 1 · General news media'),
      },
      {
        value: '2',
        label: t('2 级 · 行业主流媒体（严肃财经推荐）', 'Level 2 · Mainstream industry media'),
      },
      {
        value: '3',
        label: t('3 级 · 权威媒体与官方机构（政策追踪推荐）', 'Level 3 · Authoritative & official'),
      },
      {
        value: '4',
        label: t('4 级 · 顶级官方信源（极严格）', 'Level 4 · Top-tier official only'),
      },
    ],
    [t],
  )

  return (
    <SectionShell
      sectionId="sources"
      stepNumber="STEP 01"
      title={t('信息来源管理', 'Data Sources')}
      subtitle={t(
        '按需启用热榜平台、RSS 订阅或定时联网搜索，快速勾选要追踪的情报来源。',
        'Enable hotlist platforms, RSS feeds, or scheduled web search to choose what to monitor.',
      )}
      docSlug="platforms"
      sourceFile={activeTab === 'search' ? 'search_queries.txt' : 'config.yaml'}
    >
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const nextTab = v as 'hotlist' | 'rss' | 'search'
          if (workspaceMode === 'pro') selectProSection('sources', nextTab)
          else setActiveTab(nextTab)
        }}
        className="space-y-5"
      >
        <TabsList className="w-full flex-wrap justify-start @min-[40rem]/section:w-auto">
          <TabsTrigger
            value="hotlist"
            data-source-tab="hotlist"
            data-enabled={platformsEnabled ? 'true' : 'false'}
            className={cn(!platformsEnabled && 'opacity-70 data-[state=active]:opacity-100')}
          >
            <span
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                platformsEnabled ? 'bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]' : 'border border-[var(--border-strong)] bg-transparent',
              )}
              aria-hidden="true"
            />
            <Flame className={cn('h-4 w-4', platformsEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-muted)]')} />
            <span>{t('热榜平台', 'Hotlist Platforms')}</span>
            <Badge tone={platformsEnabled ? 'success' : 'neutral'}>
              {platformsEnabled
                ? t('已开 {v0}/{v1}', 'ON {v0}/{v1}', { v0: enabledPlatformsCount, v1: platforms.length })
                : t('未开启', 'OFF')}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="rss"
            data-source-tab="rss"
            data-enabled={rssEnabled ? 'true' : 'false'}
            className={cn(!rssEnabled && 'opacity-70 data-[state=active]:opacity-100')}
          >
            <span
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                rssEnabled ? 'bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]' : 'border border-[var(--border-strong)] bg-transparent',
              )}
              aria-hidden="true"
            />
            <Rss className={cn('h-4 w-4', rssEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-muted)]')} />
            <span>{t('RSS 订阅', 'RSS Feeds')}</span>
            <Badge tone={rssEnabled ? 'success' : 'neutral'}>
              {rssEnabled
                ? t('已开 {v0}/{v1}', 'ON {v0}/{v1}', { v0: enabledFeedsCount, v1: feeds.length })
                : t('未开启', 'OFF')}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="search"
            data-source-tab="search"
            data-enabled={webSearchEnabled ? 'true' : 'false'}
            className={cn(!webSearchEnabled && 'opacity-70 data-[state=active]:opacity-100')}
          >
            <span
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                webSearchEnabled ? 'bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]' : 'border border-[var(--border-strong)] bg-transparent',
              )}
              aria-hidden="true"
            />
            <Globe className={cn('h-4 w-4', webSearchEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-muted)]')} />
            <span>{t('联网搜索', 'Web Search')}</span>
            <Badge tone={webSearchEnabled ? 'success' : 'neutral'}>
              {webSearchEnabled
                ? t('已开 {v0} 题', 'ON {v0}', { v0: searchDoc.topics.length })
                : t('未开启', 'OFF')}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ===================== TAB 1: HOTLIST PLATFORMS ===================== */}
        <TabsContent value="hotlist" className="space-y-5 outline-none">
          <ToggleSectionCard
            id="pro-anchor-hotlist"
            sourceTarget={{ file: 'config.yaml', path: ['platforms'] }}
            icon={<Flame className="h-5 w-5" />}
            title={t('启用热榜平台抓取', 'Enable Hotlist Platforms')}
            description={t(
              '自动汇总主流资讯、财经与社区热榜，可随时启停与排序。',
              'Aggregate mainstream news, finance, and social hotlists with drag reordering.',
            )}
            badge={
              <Badge tone={platformsEnabled ? 'brand' : 'neutral'}>
                {t('{v0} 个活跃', '{v0} active', { v0: enabledPlatformsCount })}
              </Badge>
            }
            checked={platformsEnabled}
            onCheckedChange={(val) => setConfigValue(['platforms', 'enabled'], val)}
          >
            <div className="flex flex-col gap-3 @min-[40rem]/section:flex-row @min-[40rem]/section:items-center @min-[40rem]/section:justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {t('平台列表（{v0}/{v1} 开启）', 'Platforms ({v0}/{v1} enabled)', { v0: enabledPlatformsCount, v1: platforms.length })}
                </h4>
                <InfoTooltip
                  content={t(
                    '拖动左侧手柄可调整展示优先级；点击「编辑」可修改显示名或设置 expected_domain 防劫持域名校验。',
                    'Drag the left handle to change priority; click Edit to customize the display name or expected_domain URL verification.',
                  )}
                >
                  <button
                    type="button"
                    className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                    aria-label={t('平台列表说明', 'Platform list help')}
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </InfoTooltip>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setPlatformModalTab('official')
                  setPlatformModalOpen(true)
                }}
              >
                <Plus className="h-4 w-4" />
                <span>{t('添加平台', 'Add Platform')}</span>
              </Button>
            </div>

            {platforms.length > 0 ? (
              <div className="space-y-3">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToVerticalAxis]}
                  onDragStart={handlePlatformDragStart}
                  onDragCancel={() => setActiveDragPlatformKey(null)}
                  onDragEnd={handlePlatformDragEnd}
                >
                  <SortableContext
                    items={visiblePlatformSortKeys}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1.5">
                      {visiblePlatforms.map((item, idx) => (
                        <SortablePlatformRow
                          key={visiblePlatformSortKeys[idx]}
                          rowId={`platform-row-${idx}`}
                          sortId={visiblePlatformSortKeys[idx]}
                          item={item}
                          onUpdate={(patch) => updatePlatformAt(idx, patch)}
                          onDelete={() => removePlatformAt(idx)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
                    {activeDragPlatform ? (
                      <div className="flex items-center gap-2.5 rounded-xl border border-[var(--brand-primary)] bg-[var(--bg-surface)] px-3 py-2 shadow-[var(--shadow-md)] ring-2 ring-[var(--brand-primary)]/20 cursor-grabbing">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--brand-primary)]">
                          <GripVertical className="h-4 w-4" />
                        </span>
                        <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {getLocalizedPlatformName(activeDragPlatform.id, activeDragPlatform.name, lang)}
                        </span>
                        <code className="shrink-0 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2 py-0.5 font-mono text-xs text-[var(--text-muted)]">
                          {activeDragPlatform.id}
                        </code>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>

                {hiddenPlatformsCount > 0 && (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setShowAllPlatforms(true)}
                    className="w-full border-dashed border-[var(--brand-border)] bg-[var(--brand-soft)]/35 text-[var(--brand-primary)] hover:bg-[var(--brand-soft)]"
                  >
                    <ChevronDown className="h-4 w-4" />
                    <span>
                      {t('展开剩余 {v0} 个平台', 'Show {v0} more platform(s)', { v0: hiddenPlatformsCount })}
                    </span>
                  </Button>
                )}

                {showAllPlatforms && platforms.length > DEFAULT_VISIBLE_PLATFORMS && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllPlatforms(false)}
                    className="w-full text-[var(--text-secondary)]"
                  >
                    <ChevronUp className="h-4 w-4" />
                    <span>
                      {t('收起列表，仅显示前 {v0} 个', 'Show first {v0} only', { v0: DEFAULT_VISIBLE_PLATFORMS })}
                    </span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]/50 px-5 py-8 text-center space-y-3">
                <p className="text-sm text-[var(--text-muted)]">
                  {t('当前尚未添加任何热榜平台', 'No hotlist platforms added yet')}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPlatformModalTab('official')
                    setPlatformModalOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('从官方列表添加平台', 'Browse Official Platforms')}</span>
                </Button>
              </div>
            )}
          </ToggleSectionCard>

          <AdvancedCollapsible
            id="pro-anchor-crawler-network"
            forceOpenSeq={visualFocusTarget?.anchor === 'pro-anchor-crawler-network' ? visualFocusTarget.seq : undefined}
            title={t('热榜爬虫 API 与网络代理（进阶）', 'Crawler API & Network Proxy (Advanced)')}
            description={t(
              '自定义接口地址、抓取间隔与本地代理',
              'Custom API endpoint, request interval, and local proxy',
            )}
            customizedCount={crawlerCustomizedCount}
          >
            <div className="divide-y divide-[var(--border-default)]">
              <SettingRow
                label={t('热榜数据 API 地址', 'Hotlist API URL')}
                envVar="PLATFORMS_API_URL"
                description={t('留空走官方接口，自建实例填入自定义地址。', 'Leave blank for default, or set a self-hosted URL.')}
                tooltip={t(
                  '如果你自行部署了 newsnow 服务，可填入 https://your-domain.com/api/s。',
                  'Enter https://your-domain.com/api/s if you run a self-hosted newsnow backend.',
                )}
              >
                <Input
                  value={platformsApiUrl}
                  onChange={(e) => setConfigValue(['platforms', 'api_url'], e.target.value)}
                  placeholder="https://your-domain.com/api/s"
                  className="font-mono text-sm @min-[40rem]/section:w-[300px]"
                  spellCheck={false}
                />
              </SettingRow>

              <SettingRow
                label={t('请求间隔（毫秒）', 'Request Interval (ms)')}
                description={t('相邻平台抓取间隔，默认 2000ms。', 'Delay between platform requests (default 2000ms).')}
                tooltip={t(
                  '适当保留请求间隔有助于避免触发上游平台频率限制。',
                  'Keeping a short spacing helps prevent upstream rate limiting.',
                )}
              >
                <Input
                  type="number"
                  min={100}
                  step={100}
                  value={crawlerInterval}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10)
                    setConfigValue(
                      ['advanced', 'crawler', 'request_interval'],
                      Number.isFinite(n) && n >= 0 ? n : 2000,
                    )
                  }}
                  className="font-mono text-sm @min-[40rem]/section:w-[160px]"
                />
              </SettingRow>

              <SettingRow
                label={t('启用抓取代理', 'Use Crawler Proxy')}
                description={t('仅本地受限网络开启，云端部署保持关闭。', 'Local restricted networks only; keep OFF on cloud.')}
              >
                <Switch
                  checked={crawlerUseProxy}
                  onCheckedChange={(v) => setConfigValue(['advanced', 'crawler', 'use_proxy'], v)}
                />
              </SettingRow>

              {deployMode === 'github_actions' && crawlerUseProxy && (
                <div className="py-3">
                  <Callout
                    tone="warning"
                    icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
                    title={t(
                      'GitHub Actions 下开启本地代理会导致抓取失败',
                      'Local proxy enabled while targeting GitHub Actions',
                    )}
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfigValue(['advanced', 'crawler', 'use_proxy'], false)}
                      >
                        {t('立即关闭', 'Turn Off')}
                      </Button>
                    }
                  >
                    {t(
                      '云端运行器无法访问本机 127.0.0.1 代理端口。',
                      'Cloud runners cannot reach localhost proxy ports such as 127.0.0.1.',
                    )}
                  </Callout>
                </div>
              )}

              <SettingRow
                label={t('默认代理地址', 'Default Proxy URL')}
                description={t('热榜默认代理，也可供 RSS 与搜索复用。', 'Default crawler proxy; fallback for RSS & search.')}
              >
                <Input
                  value={crawlerDefaultProxy}
                  onChange={(e) =>
                    setConfigValue(['advanced', 'crawler', 'default_proxy'], e.target.value)
                  }
                  placeholder="http://127.0.0.1:10801"
                  className="font-mono text-sm @min-[40rem]/section:w-[260px]"
                  spellCheck={false}
                />
              </SettingRow>
            </div>
          </AdvancedCollapsible>
        </TabsContent>

        {/* ===================== TAB 2: RSS FEEDS ===================== */}
        <TabsContent value="rss" className="space-y-5 outline-none">
          <ToggleSectionCard
            id="pro-anchor-rss"
            sourceTarget={{ file: 'config.yaml', path: ['rss'] }}
            icon={<Rss className="h-5 w-5" />}
            title={t('启用 RSS 订阅抓取', 'Enable RSS Subscriptions')}
            description={t(
              '按时间流追踪博客、外文媒体与关键词订阅源。',
              'Follow blogs, media outlets, and keyword feeds chronologically.',
            )}
            badge={
              <Badge tone={rssEnabled ? 'brand' : 'neutral'}>
                {t('{v0} 个活跃', '{v0} active', { v0: enabledFeedsCount })}
              </Badge>
            }
            checked={rssEnabled}
            onCheckedChange={(val) => setConfigValue(['rss', 'enabled'], val)}
          >
            {/* Freshness Filter Panel */}
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/50 px-5 py-4 divide-y divide-[var(--border-default)]">
              <SettingRow
                label={t('文章新鲜度过滤', 'Freshness Filter')}
                description={t('推送时跳过超龄旧文，避免反复刷屏。', 'Skip stale articles at push time.')}
                tooltip={t(
                  '仅在推送阶段过滤旧文章，所有抓取到的内容仍会正常存入本地 SQLite 数据库。',
                  'Only filters stale items during notification delivery; all articles are still archived in SQLite.',
                )}
              >
                <Switch
                  checked={freshnessEnabled}
                  onCheckedChange={(v) =>
                    setConfigValue(['rss', 'freshness_filter', 'enabled'], v)
                  }
                />
              </SettingRow>

              {freshnessEnabled && (
                <SettingRow
                  label={t('全局最大文章年龄（天）', 'Global Max Article Age (Days)')}
                  description={t('只推送最近 N 天内的文章，0 表示不限。', 'Push articles within N days (0 = unlimited).')}
                >
                  <Input
                    type="number"
                    min={0}
                    value={freshnessMaxAge}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10)
                      setConfigValue(
                        ['rss', 'freshness_filter', 'max_age_days'],
                        Number.isFinite(n) && n >= 0 ? n : 0,
                      )
                    }}
                    className="font-mono text-sm @min-[40rem]/section:w-[140px]"
                  />
                </SettingRow>
              )}
            </div>

            {/* Feeds List Header */}
            <div className="flex flex-col gap-3 @min-[40rem]/section:flex-row @min-[40rem]/section:items-center @min-[40rem]/section:justify-between">
              <h4 className="text-[15px] font-semibold text-[var(--text-primary)]">
                {t('订阅源列表（{v0}/{v1} 开启）', 'RSS Feeds ({v0}/{v1} enabled)', { v0: enabledFeedsCount, v1: feeds.length })}
              </h4>
              <Button variant="primary" size="sm" onClick={() => openAddRssModal()}>
                <Plus className="h-4 w-4" />
                <span>{t('添加自定义 RSS 源', 'Add Custom RSS Feed')}</span>
              </Button>
            </div>

            {/* Feeds Cards */}
            {feeds.length > 0 ? (
              <div className="space-y-2.5">
                {feeds.map((feed, idx) => (
                  <RssFeedCard
                    key={idx}
                    feed={feed}
                    index={idx}
                    total={feeds.length}
                    editing={Boolean(expandedFeedIndices[idx])}
                    onToggleEdit={() =>
                      setExpandedFeedIndices((prev) => ({ ...prev, [idx]: !prev[idx] }))
                    }
                    onMoveUp={() => moveFeedAt(idx, idx - 1)}
                    onMoveDown={() => moveFeedAt(idx, idx + 1)}
                    onUpdate={(updater) => updateFeedAt(idx, updater)}
                    onDelete={() => removeFeedAt(idx)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]/50 px-5 py-8 text-center space-y-3">
                <p className="text-sm text-[var(--text-muted)]">
                  {t('尚未配置任何 RSS 订阅源', 'No RSS feeds configured yet')}
                </p>
                <Button size="sm" variant="outline" onClick={() => openAddRssModal()}>
                  <Plus className="h-4 w-4" />
                  <span>{t('添加第一个 RSS 源', 'Add First RSS Feed')}</span>
                </Button>
              </div>
            )}

            {/* Collapsible RSS Inspiration Library */}
            <AdvancedCollapsible
              title={t('精选 RSS 灵感库与 Bing 关键词订阅器', 'Curated RSS Library & Bing Keyword Feed Builder')}
              description={t(
                '一键添加科技/财经源，或生成 Bing 关键词 RSS',
                'One-click curated feeds or Bing News keyword RSS',
              )}
              icon={<Sparkles className="h-4 w-4 text-[var(--brand-primary)]" />}
              defaultOpen={false}
            >
              {/* Quick Bing News Keyword Builder */}
              <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-soft)]/50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                    <Search className="h-4 w-4 text-[var(--brand-primary)]" />
                    <span>{t('快速生成 Bing 新闻关键词 RSS', 'Quick Bing News Keyword RSS')}</span>
                  </div>
                  <Badge tone="brand">{t('多词空格分隔', 'Space-separated')}</Badge>
                </div>

                <div className="flex flex-col gap-2.5 @min-[40rem]/section:flex-row @min-[40rem]/section:items-center">
                  <Input
                    value={bingKeyword}
                    onChange={(e) => setBingKeyword(e.target.value)}
                    placeholder={t('例如：人工智能 或 黄金价格 走势', 'e.g. AI Agent or Semiconductor')}
                    className="h-9 flex-1 bg-[var(--bg-surface)] text-sm"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleAddBingKeywordFeed(false)}
                      disabled={!bingKeyword.trim()}
                    >
                      <Plus className="h-4 w-4" />
                      <span>{t('直接添加', 'Add Now')}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddBingKeywordFeed(true)}
                      disabled={!bingKeyword.trim()}
                    >
                      <span>{t('自定义后添加', 'Customize')}</span>
                    </Button>
                  </div>
                </div>

                <div className="truncate font-mono text-xs text-[var(--text-muted)]">
                  https://www.bing.com/news/search?q=
                  {bingKeyword.trim().replace(/\s+/g, '+') || '...'}&amp;format=RSS
                </div>
              </div>

              {/* Inspiration Grid */}
              <div className="grid grid-cols-1 gap-3 @min-[40rem]/section:grid-cols-2">
                {RSS_INSPIRATIONS.map((item) => {
                  const alreadyAdded = feeds.some((f) => f.url === item.url || f.id === item.id)
                  const name = t(item.nameZh, item.nameEn)
                  const tag = t(item.tagZh, item.tagEn)
                  const bingMatch = item.url.match(/bing\.com\/news\/search\?q=([^&]+)/i)
                  const bingQuery = bingMatch ? decodeURIComponent(bingMatch[1]).replace(/\+/g, ' ') : null
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                            {name}
                          </span>
                          <Badge tone="neutral">{tag}</Badge>
                        </div>
                        <div className="truncate font-mono text-xs text-[var(--text-muted)]">
                          {item.url}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-default)] pt-3">
                        <span className="text-[13px] text-[var(--text-muted)]">
                          {item.maxAgeDays !== undefined
                            ? t('建议 {v0} 天', '{v0}d', { v0: item.maxAgeDays })
                            : t('跟随全局', 'Global')}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {bingQuery && (
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => setBingKeyword(bingQuery)}
                              title={t('载入上方关键词框快速修改', 'Load keyword into builder above')}
                            >
                              {t('改关键词', 'Edit Query')}
                            </Button>
                          )}
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() =>
                              openAddRssModal({
                                id: item.id,
                                name,
                                url: item.url,
                                maxAgeDays: item.maxAgeDays,
                              })
                            }
                          >
                            {t('填入表单', 'Fill Form')}
                          </Button>
                          <Button
                            size="xs"
                            variant={alreadyAdded ? 'outline' : 'primary'}
                            onClick={() => addInspirationDirectly(item)}
                          >
                            {alreadyAdded ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                <span>{t('再次添加', 'Add Again')}</span>
                              </>
                            ) : (
                              <>
                                <Plus className="h-3.5 w-3.5" />
                                <span>{t('直接添加', 'Add')}</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </AdvancedCollapsible>
          </ToggleSectionCard>

          {/* RSS Advanced Proxy & Timeout */}
          <AdvancedCollapsible
            id="pro-anchor-rss-network"
            forceOpenSeq={visualFocusTarget?.anchor === 'pro-anchor-rss-network' ? visualFocusTarget.seq : undefined}
            title={t('RSS 请求超时与代理（进阶）', 'RSS Timeout & Proxy (Advanced)')}
            description={t(
              '抓取频率、单源超时与专属代理',
              'Request spacing, timeout, and dedicated proxy',
            )}
            customizedCount={rssAdvancedCustomizedCount}
          >
            <div className="divide-y divide-[var(--border-default)]">
              <SettingRow
                label={t('请求间隔（毫秒）', 'Request Interval (ms)')}
                description={t('相邻 RSS 源抓取间隔，默认 1000ms。', 'Delay between RSS fetches (default 1000ms).')}
              >
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={rssInterval}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10)
                    setConfigValue(
                      ['advanced', 'rss', 'request_interval'],
                      Number.isFinite(n) && n >= 0 ? n : 1000,
                    )
                  }}
                  className="font-mono text-sm @min-[40rem]/section:w-[160px]"
                />
              </SettingRow>

              <SettingRow
                label={t('请求超时（秒）', 'Request Timeout (s)')}
                description={t('单源最大等待时间，默认 15 秒。', 'Per-feed timeout in seconds (default 15s).')}
              >
                <Input
                  type="number"
                  min={3}
                  max={120}
                  value={rssTimeout}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10)
                    setConfigValue(
                      ['advanced', 'rss', 'timeout'],
                      Number.isFinite(n) && n > 0 ? n : 15,
                    )
                  }}
                  className="font-mono text-sm @min-[40rem]/section:w-[160px]"
                />
              </SettingRow>

              <SettingRow
                label={t('RSS 启用代理', 'Use Proxy for RSS')}
                description={t('仅本地访问受限源时开启，云端请关闭。', 'Local proxy only; keep OFF on cloud.')}
              >
                <Switch
                  checked={rssUseProxy}
                  onCheckedChange={(v) => setConfigValue(['advanced', 'rss', 'use_proxy'], v)}
                />
              </SettingRow>

              {deployMode === 'github_actions' && rssUseProxy && (
                <div className="py-3">
                  <Callout
                    tone="warning"
                    icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
                    title={t(
                      'GitHub Actions 下不应开启 RSS 代理',
                      'RSS proxy should stay OFF in GitHub Actions',
                    )}
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfigValue(['advanced', 'rss', 'use_proxy'], false)}
                      >
                        {t('关闭 RSS 代理', 'Disable RSS Proxy')}
                      </Button>
                    }
                  >
                    {t(
                      '云端已可直连外网，开启本机代理将导致所有 RSS 请求超时。',
                      'GitHub Actions has direct internet access; a local proxy breaks RSS fetching.',
                    )}
                  </Callout>
                </div>
              )}

              <SettingRow
                label={t('RSS 专属代理地址', 'RSS Proxy URL')}
                description={t('留空时自动复用热榜默认代理。', 'Leave empty to reuse default crawler proxy.')}
              >
                <Input
                  value={rssProxyUrl}
                  onChange={(e) => setConfigValue(['advanced', 'rss', 'proxy_url'], e.target.value)}
                  placeholder={t('留空复用热榜默认代理', 'Empty = reuse default proxy')}
                  className="font-mono text-sm @min-[40rem]/section:w-[260px]"
                  spellCheck={false}
                />
              </SettingRow>
            </div>
          </AdvancedCollapsible>
        </TabsContent>

        {/* ===================== TAB 3: WEB SEARCH ===================== */}
        <TabsContent value="search" className="space-y-5 outline-none">
          <ToggleSectionCard
            id="pro-anchor-search"
            sourceTarget={{ file: 'config.yaml', path: ['web_search'] }}
            icon={<Globe className="h-5 w-5" />}
            title={t('启用定时联网搜索', 'Enable Scheduled Web Search')}
            description={t(
              '按搜索主题主动检索全网政策与行业动态，独立展示。',
              'Proactively search the web by topic with independent results.',
            )}
            badge={
              <Badge tone={webSearchEnabled ? 'brand' : 'neutral'}>
                {webSearchEnabled
                  ? t('已开启 · {v0} 个主题', 'ON · {v0} topics', { v0: searchDoc.topics.length })
                  : t('未开启 · {v0} 个主题', 'OFF · {v0} topics', { v0: searchDoc.topics.length })}
              </Badge>
            }
            checked={webSearchEnabled}
            forceExpanded={
              workspaceMode === 'pro' ||
              activeSourceFile === 'search_queries.txt' ||
              visualFocusTarget?.anchor === 'pro-anchor-search-queries' ||
              visualFocusTarget?.anchor === 'pro-anchor-search-engine'
            }
            onCheckedChange={(val) => setConfigValue(['web_search', 'enabled'], val)}
          >
            {!webSearchEnabled && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-soft)]/50 px-3.5 py-2 text-xs text-[var(--text-secondary)]">
                <span>
                  {t(
                    '当前总开关尚未开启，可先按下方 3 个步骤编辑搜索主题与规则，打开右上角开关即生效。',
                    'Master toggle is currently off — configure the 3 steps below anytime and flip the switch above when ready.',
                  )}
                </span>
              </div>
            )}

            {/* 3-Step Visual Locator Bar */}
            <nav
              aria-label={t('联网搜索配置步骤', 'Web search setup steps')}
              className="grid grid-cols-1 gap-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/75 p-1.5 @min-[34rem]/section:grid-cols-3"
            >
              {[
                {
                  step: '1/3',
                  anchor: 'pro-anchor-search-engine',
                  title: t('搜索模式与凭证', 'Mode & Engine'),
                  meta: queryMode === 'smart' ? 'smart · AI' : `direct · ${wsProvider}`,
                },
                {
                  step: '2/3',
                  anchor: 'pro-anchor-search-queries',
                  title: t('搜索主题管理', 'Search Topics'),
                  meta: t('{v0} 个主题', '{v0} topics', { v0: searchDoc.topics.length }),
                },
                {
                  step: '3/3',
                  anchor: 'pro-anchor-search-quality',
                  title: t('结果质量过滤', 'Quality Filter'),
                  meta: `Top ${maxItemsPerTopic} · ${wsMinScore.toFixed(2)}`,
                },
              ].map((item) => (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(item.anchor)
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      el.classList.remove('tr-focus-flash')
                      void el.offsetWidth
                      el.classList.add('tr-focus-flash')
                    }
                  }}
                  className="tr-focus-ring flex items-center justify-between gap-2 rounded-lg bg-[var(--bg-surface)] px-3 py-2 text-left shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--brand-border)] hover:bg-[var(--brand-soft)]/45 cursor-pointer"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 rounded bg-[var(--brand-soft)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--brand-primary)]">
                      {item.step}
                    </span>
                    <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
                      {item.title}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-[var(--text-muted)]">
                    {item.meta}
                  </span>
                </button>
              ))}
            </nav>

            {/* Step 1/3: Engine & Query Mode */}
            <div id="pro-anchor-search-engine" className="scroll-mt-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 rounded-md bg-[var(--brand-soft)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--brand-primary)]">
                    1/3
                  </span>
                  <h4 className="text-[15px] font-semibold text-[var(--text-primary)]">
                    {t('搜索模式与引擎凭证', 'Query Mode & Engine Credentials')}
                  </h4>
                  <InfoTooltip
                    content={t(
                      '直接搜索 (direct) 原样发送关键词且零额外 Token 消耗；智能提炼 (smart) 用共享大模型把自然语言长句提炼为短搜索词并当天缓存。',
                      'Direct Search sends queries as-is with zero extra LLM cost; Smart Refine converts long natural-language questions into concise queries with daily caching.',
                    )}
                  >
                    <button
                      type="button"
                      className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                      aria-label={t('搜索模式说明', 'Query mode info')}
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </InfoTooltip>
                </div>

                <div
                  role="tablist"
                  aria-label={t('搜索词处理模式', 'Query mode selector')}
                  className="grid w-full grid-cols-2 gap-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1 @min-[34rem]/section:w-auto @min-[34rem]/section:min-w-[300px]"
                >
                  {[
                    {
                      value: 'direct',
                      icon: Zap,
                      title: t('直接搜索', 'Direct Search'),
                      code: 'direct',
                    },
                    {
                      value: 'smart',
                      icon: Sparkles,
                      title: t('智能提炼', 'Smart Refine'),
                      code: 'smart',
                    },
                  ].map((opt) => {
                    const Icon = opt.icon
                    const selected = queryMode === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setConfigValue(['web_search', 'query_mode'], opt.value)}
                        className={cn(
                          'tr-focus-ring inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] transition-all cursor-pointer whitespace-nowrap',
                          selected
                            ? 'bg-[var(--bg-surface)] font-semibold text-[var(--brand-primary)] shadow-[var(--shadow-xs)] ring-1 ring-[var(--brand-border)]'
                            : 'font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]/70 hover:text-[var(--text-primary)]',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{opt.title}</span>
                        <code className="font-mono text-[11px] opacity-75">({opt.code})</code>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--bg-subtle)]/75 px-3 py-2 text-xs text-[var(--text-secondary)]">
                {queryMode === 'smart' ? (
                  <>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge tone="brand">{t('AI 提炼 · 当天缓存', 'AI Refined · Cached')}</Badge>
                      <span>
                        {t(
                          '自动用共享 AI 模型把长句问题提炼为精准短词再检索',
                          'Uses shared AI model to refine long questions into concise search terms',
                        )}
                      </span>
                    </div>
                    <code className="font-mono text-[11px] text-[var(--text-muted)]">query_mode: smart</code>
                  </>
                ) : (
                  <>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge tone="success">{t('推荐 · 零额外费用', 'Recommended · Zero Extra Cost')}</Badge>
                      <span>
                        {t(
                          '直接用你在主题里填写的搜索词检索，响应快且不消耗大模型 Token',
                          'Searches directly with your topic keywords — fast with zero LLM token cost',
                        )}
                      </span>
                    </div>
                    <code className="font-mono text-[11px] text-[var(--text-muted)]">query_mode: direct</code>
                  </>
                )}
              </div>

              <Card className="p-5 divide-y divide-[var(--border-default)]">
                <SettingRow
                  label={t('搜索服务提供商 (provider)', 'Search Provider (provider)')}
                  description={t(
                    '默认 deepseek 官方联网搜索引擎，也可切换其他兼容提供商标识。',
                    'Default is deepseek official web search; supports custom provider keys.',
                  )}
                >
                  <div className="flex items-center gap-2 @min-[40rem]/section:w-[300px]">
                    <Input
                      value={wsProvider}
                      onChange={(e) => {
                        const val = e.target.value.trim()
                        setConfigValue(['web_search', 'provider'], val || 'deepseek')
                      }}
                      placeholder="deepseek"
                      className="font-mono text-sm flex-1"
                      spellCheck={false}
                    />
                    {wsProvider !== 'deepseek' && (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => setConfigValue(['web_search', 'provider'], 'deepseek')}
                      >
                        deepseek
                      </Button>
                    )}
                  </div>
                </SettingRow>

                <SettingRow
                  label={
                    wsProvider === 'deepseek'
                      ? t('DeepSeek 搜索 API Key', 'DeepSeek Search API Key')
                      : t('{v0} 搜索 API Key', '{v0} Search API Key', { v0: wsProvider })
                  }
                  envVar="WEB_SEARCH_API_KEY"
                  description={
                    wsProvider === 'deepseek'
                      ? t('留空时若主模型也为 DeepSeek 将自动复用。', 'Reuses AI_API_KEY automatically if main model is DeepSeek.')
                      : t('留空时自动读取环境变量 WEB_SEARCH_API_KEY。', 'Reads WEB_SEARCH_API_KEY when left blank.')
                  }
                >
                  <SecretInput
                    value={providerApiKey}
                    onChange={(v) =>
                      setConfigValue(['web_search', 'providers', wsProvider, 'api_key'], v)
                    }
                    envVar="WEB_SEARCH_API_KEY"
                    placeholder="sk-..."
                    className="@min-[40rem]/section:w-[300px]"
                  />
                </SettingRow>

                <SettingRow
                  label={
                    wsProvider === 'deepseek'
                      ? t('DeepSeek API 地址', 'DeepSeek API Base')
                      : t('{v0} API 地址 (api_base)', '{v0} API Base', { v0: wsProvider })
                  }
                  description={t('默认官方地址，仅用兼容网关时修改。', 'Defaults to official API; change only for gateways.')}
                >
                  <Input
                    value={providerApiBase}
                    onChange={(e) =>
                      setConfigValue(
                        ['web_search', 'providers', wsProvider, 'api_base'],
                        e.target.value,
                      )
                    }
                    placeholder={wsProvider === 'deepseek' ? 'https://api.deepseek.com' : 'https://api.example.com'}
                    className="font-mono text-sm @min-[40rem]/section:w-[300px]"
                    spellCheck={false}
                  />
                </SettingRow>
              </Card>
            </div>

            {/* Step 2/3: Visual search_queries.txt Manager */}
            <div id="pro-anchor-search-queries" className="scroll-mt-4 space-y-4 border-t border-[var(--border-default)] pt-5">
              <div className="flex flex-col gap-3 @min-[40rem]/section:flex-row @min-[40rem]/section:items-center @min-[40rem]/section:justify-between">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="shrink-0 rounded-md bg-[var(--brand-soft)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--brand-primary)]">
                    2/3
                  </span>
                  <h4 className="text-[15px] font-semibold text-[var(--text-primary)]">
                    {t('搜索主题管理', 'Search Topics')}
                  </h4>
                  <Badge tone="outline" className="font-mono">
                    search_queries.txt
                  </Badge>
                  <Badge tone="brand">
                    {t('{v0} 个主题', '{v0} topics', { v0: searchDoc.topics.length })}
                  </Badge>
                  <InfoTooltip
                    content={t(
                      '点击任意主题展开编辑搜索词，修改实时同步至 search_queries.txt。',
                      'Click any topic to edit queries; changes sync live to search_queries.txt.',
                    )}
                  >
                    <button
                      type="button"
                      className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                      aria-label={t('搜索主题说明', 'Search topics info')}
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </InfoTooltip>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => jumpToSource('search_queries.txt')}
                  >
                    <Code2 className="h-3.5 w-3.5" />
                    <span>{t('查看文本', 'Raw Text')}</span>
                  </Button>
                  <Button size="xs" variant="primary" onClick={handleAddSearchTopic}>
                    <Plus className="h-3.5 w-3.5" />
                    <span>{t('新增搜索主题', 'Add Topic')}</span>
                  </Button>
                </div>
              </div>

              {/* [GLOBAL_FILTER] Collapsible Summary */}
              <AdvancedCollapsible
                defaultOpen={false}
                icon={<Ban className="h-4 w-4 text-red-500" />}
                title={t('全局屏蔽规则 [GLOBAL_FILTER]', 'Global Exclusions [GLOBAL_FILTER]')}
                description={
                  globalExcludeTotal > 0
                    ? t('已配置 {v0} 项全局屏蔽（{v1} 个词 · {v2} 个域名），点击展开编辑', '{v0} global exclusions ({v1} words · {v2} sites) — click to edit', { v0: globalExcludeTotal, v1: searchDoc.globalExcludeWords.length, v2: searchDoc.globalExcludeSites.length })
                    : t(
                        '对所有搜索主题生效，点击展开添加屏蔽词或屏蔽域名',
                        'Applies to all search topics — click to block words or domains',
                      )
                }
                customizedCount={globalExcludeTotal}
              >
                <div className="grid grid-cols-1 gap-4 @min-[48rem]/section:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text-primary)]">
                      {t('全局屏蔽词', 'Global Exclude Words')}
                    </label>
                    <TagChipEditor
                      items={searchDoc.globalExcludeWords}
                      tone="warning"
                      placeholder={t('如：培训班、广告推广', 'e.g. spam, sponsored')}
                      addLabel={t('添加', 'Add')}
                      onAdd={(w) =>
                        commitSearchDoc((prev) => ({
                          ...prev,
                          globalExcludeWords: [...prev.globalExcludeWords, w],
                        }))
                      }
                      onRemove={(i) =>
                        commitSearchDoc((prev) => ({
                          ...prev,
                          globalExcludeWords: prev.globalExcludeWords.filter((_, idx) => idx !== i),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text-primary)]">
                      {t('全局屏蔽域名 (-site:)', 'Global Exclude Sites (-site:)')}
                    </label>
                    <TagChipEditor
                      items={searchDoc.globalExcludeSites}
                      prefix="-site:"
                      tone="danger"
                      normalize={normalizeSiteInput}
                      placeholder={t('如：csdn.net、sohu.com', 'e.g. example-spam.com')}
                      addLabel={t('屏蔽', 'Block')}
                      onAdd={(s) =>
                        commitSearchDoc((prev) => ({
                          ...prev,
                          globalExcludeSites: [...prev.globalExcludeSites, s],
                        }))
                      }
                      onRemove={(i) =>
                        commitSearchDoc((prev) => ({
                          ...prev,
                          globalExcludeSites: prev.globalExcludeSites.filter((_, idx) => idx !== i),
                        }))
                      }
                    />
                  </div>
                </div>
              </AdvancedCollapsible>

              {/* Search Topic Cards */}
              {searchDoc.topics.length > 0 ? (
                <div className="space-y-3">
                  {searchDoc.topics.map((topic, idx) => (
                    <SearchTopicCard
                      key={idx}
                      index={idx}
                      total={searchDoc.topics.length}
                      topic={topic}
                      expanded={Boolean(expandedTopicIndices[idx])}
                      onToggleExpand={() =>
                        setExpandedTopicIndices((prev) => ({ ...prev, [idx]: !prev[idx] }))
                      }
                      onChange={(updated) =>
                        commitSearchDoc((prev) => ({
                          ...prev,
                          topics: prev.topics.map((item, i) => (i === idx ? updated : item)),
                        }))
                      }
                      onMoveUp={() => {
                        if (idx === 0) return
                        handleSwapTopicExpanded(idx, idx - 1)
                        commitSearchDoc((prev) => ({
                          ...prev,
                          topics: arrayMove(prev.topics, idx, idx - 1),
                        }))
                      }}
                      onMoveDown={() => {
                        if (idx >= searchDoc.topics.length - 1) return
                        handleSwapTopicExpanded(idx, idx + 1)
                        commitSearchDoc((prev) => ({
                          ...prev,
                          topics: arrayMove(prev.topics, idx, idx + 1),
                        }))
                      }}
                      onDelete={() => handleDeleteSearchTopic(idx)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]/50 px-5 py-8 text-center space-y-3">
                  <p className="text-sm text-[var(--text-muted)]">
                    {t('当前还没有搜索主题', 'No search topics defined yet')}
                  </p>
                  <Button size="sm" variant="outline" onClick={handleAddSearchTopic}>
                    <Plus className="h-4 w-4" />
                    <span>{t('创建第一个搜索主题', 'Create First Search Topic')}</span>
                  </Button>
                </div>
              )}
            </div>

            {/* Step 3/3: Core Quality Funnel */}
            <div id="pro-anchor-search-quality" className="scroll-mt-4 space-y-4 border-t border-[var(--border-default)] pt-5">
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded-md bg-[var(--brand-soft)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--brand-primary)]">
                  3/3
                </span>
                <h4 className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {t('结果质量控制', 'Result Quality Funnel')}
                </h4>
              </div>

              <Card className="p-5 divide-y divide-[var(--border-default)]">
                <SettingRow
                  label={t('每主题最多展示条数', 'Max Items Per Topic')}
                  description={t('单主题最终保留条数上限，0 为不限。', 'Max kept results per topic (0 = unlimited).')}
                  tooltip={t(
                    '可在单个主题内通过 @N 覆盖此全局设置。',
                    'You can override this per topic using @N.',
                  )}
                >
                  <Input
                    type="number"
                    min={0}
                    value={maxItemsPerTopic}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10)
                      setConfigValue(
                        ['web_search', 'max_items_per_topic'],
                        Number.isFinite(n) && n >= 0 ? n : 8,
                      )
                    }}
                    className="font-mono text-sm @min-[40rem]/section:w-[140px]"
                  />
                </SettingRow>

                <SettingRow
                  label={t('结果时效范围（天）', 'Freshness Window (Days)')}
                  description={t('仅保留最近 N 天发布的网页，0 为不限。', 'Keep pages from the last N days (0 = no limit).')}
                >
                  <Input
                    type="number"
                    min={0}
                    value={wsFreshnessDays}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10)
                      setConfigValue(
                        ['web_search', 'freshness_days'],
                        Number.isFinite(n) && n >= 0 ? n : 7,
                      )
                    }}
                    className="font-mono text-sm @min-[40rem]/section:w-[140px]"
                  />
                </SettingRow>

                <SettingRow
                  vertical
                  label={
                    <div className="flex items-center gap-2">
                      <span>{t('最低质量分门槛 (min_score)', 'Minimum Quality Score (min_score)')}</span>
                      <Badge tone="brand" className="font-mono">
                        {wsMinScore.toFixed(2)}
                      </Badge>
                    </div>
                  }
                  description={t('数值越高越严格，推荐 0.50 起步。', 'Higher is stricter; 0.50 is recommended.')}
                  tooltip={t(
                    '范围 0.0~1.0。0.50 对应 DeepSeek 官方推荐优质线，冷门话题可适当调低至 0.35。',
                    'Range 0.0–1.0. 0.50 is the official recommended threshold; lower to 0.35 for niche topics.',
                  )}
                >
                  <div className="space-y-3 pt-1">
                    <Slider
                      value={wsMinScore}
                      onValueChange={(v) =>
                        setConfigValue(['web_search', 'min_score'], Math.round(v * 100) / 100)
                      }
                      min={0}
                      max={1}
                      step={0.05}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-[var(--text-muted)]">
                      <span>0.00 ({t('不过滤', 'Off')})</span>
                      <span className="font-medium text-[var(--brand-primary)]">
                        0.50 ({t('官方推荐线', 'Recommended')})
                      </span>
                      <span>1.00 ({t('最严格', 'Strictest')})</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {[
                        { val: 0, label: t('0.00 不过滤', '0.00 Off') },
                        { val: 0.35, label: t('0.35 宽松', '0.35 Relaxed') },
                        { val: 0.5, label: t('0.50 官方推荐', '0.50 Recommended') },
                        { val: 0.65, label: t('0.65 严格精选', '0.65 Strict') },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setConfigValue(['web_search', 'min_score'], preset.val)}
                          className={cn(
                            'rounded-lg border px-3 py-1 text-[13px] transition-colors cursor-pointer',
                            Math.abs(wsMinScore - preset.val) < 0.01
                              ? 'border-[var(--brand-primary)] bg-[var(--brand-soft)] text-[var(--brand-primary)] font-medium'
                              : 'border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </SettingRow>

                <SettingRow
                  label={t('IM 推送附带搜索摘要', 'Show Snippets in IM Push')}
                  description={t(
                    '开启后飞书、钉钉、Telegram 等群消息中一并展示网页摘要（HTML 网页报告始终展示）。',
                    'Include result snippets inside IM notifications (HTML reports always include snippets).',
                  )}
                >
                  <Switch
                    checked={wsShowSnippet}
                    onCheckedChange={(v) =>
                      setConfigValue(['web_search', 'notification_show_snippet'], v)
                    }
                    ariaLabel={t('IM 推送附带搜索摘要', 'Show search snippets in IM')}
                  />
                </SettingRow>
              </Card>
            </div>
          </ToggleSectionCard>

          {/* Advanced Web Search Tuning */}
          <AdvancedCollapsible
            id="pro-anchor-search-network"
            forceOpenSeq={visualFocusTarget?.anchor === 'pro-anchor-search-network' ? visualFocusTarget.seq : undefined}
            title={t(
              '去重窗口、权威度与网络调优（进阶）',
              'Dedup Window, Authority & Network Tuning (Advanced)',
            )}
            description={t(
              '跨天去重、权威度分级、正文抓取与搜索代理',
              'Dedup days, authority levels, full-text fetch, and proxy/retries',
            )}
            customizedCount={wsAdvancedCustomizedCount}
          >
            <div className="divide-y divide-[var(--border-default)]">
              <SettingRow
                label={t('跨天去重窗口（天）', 'Deduplication Window (Days)')}
                description={t('N 天内搜到过的内容不再重复推送，0 为仅当天。', 'Suppress repeats from the last N days (0 = today only).')}
              >
                <Input
                  type="number"
                  min={0}
                  value={wsDedupDays}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10)
                    setConfigValue(
                      ['web_search', 'dedup_days'],
                      Number.isFinite(n) && n >= 0 ? n : 7,
                    )
                  }}
                  className="font-mono text-sm @min-[40rem]/section:w-[140px]"
                />
              </SettingRow>

              <SettingRow
                label={t('候选拉取条数 (fetch_count)', 'Candidate Fetch Count')}
                description={t('单次检索候选条数（1~50，默认 20）。', 'Candidates per query (1–50, default 20).')}
                tooltip={t(
                  '先多拉候选再走质量漏斗筛选，不会增加额外接口费用。',
                  'Fetching more candidates before filtering does not incur extra API charges.',
                )}
              >
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={wsFetchCount}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10)
                    setConfigValue(
                      ['web_search', 'fetch_count'],
                      Number.isFinite(n) ? Math.min(50, Math.max(1, n)) : 20,
                    )
                  }}
                  className="font-mono text-sm @min-[40rem]/section:w-[140px]"
                />
              </SettingRow>

              <SettingRow
                label={t('网站权威度门槛 (min_authority)', 'Site Authority Threshold')}
                description={t('越高越偏向官网与权威媒体。', 'Higher favors official & authoritative media.')}
                tooltip={t(
                  '追踪严肃政策或财经信息时，建议设为 2 或 3 级。',
                  'Use level 2 or 3 when tracking formal policy or financial news.',
                )}
              >
                <SelectField
                  value={String(wsMinAuthority)}
                  onValueChange={(v) =>
                    setConfigValue(['web_search', 'min_authority'], Number.parseInt(v, 10))
                  }
                  options={authorityOptions}
                  className="@min-[40rem]/section:w-[300px]"
                />
              </SettingRow>

              <SettingRow
                label={t('保留无权威评分站点', 'Allow Unknown Authority')}
                description={t('避免误杀刚发布的新闻或独立博客。', 'Avoid dropping freshly published unrated sites.')}
                tooltip={t(
                  '仅在 min_authority >= 0 时生效。',
                  'Applies only when min_authority >= 0.',
                )}
              >
                <Switch
                  checked={wsAllowUnknownAuth}
                  disabled={wsMinAuthority < 0}
                  onCheckedChange={(v) =>
                    setConfigValue(['web_search', 'allow_unknown_authority'], v)
                  }
                />
              </SettingRow>

              <SettingRow
                label={t('顺带抓取网页全文 (need_content)', 'Fetch Full Page Content')}
                description={t('默认关闭，常规推送使用摘要即可。', 'Off by default; snippets suffice for most summaries.')}
                tooltip={t(
                  '开启后将抓取完整网页正文，会显著增加存储体积与处理耗时。',
                  'Fetching full page text increases storage usage and processing time.',
                )}
              >
                <Switch
                  checked={wsNeedContent}
                  onCheckedChange={(v) => setConfigValue(['web_search', 'need_content'], v)}
                />
              </SettingRow>

              <SettingRow
                label={t('自定义任务文件 (queries_file)', 'Custom Queries File')}
                description={t('留空走默认 config/search_queries.txt。', 'Blank uses config/search_queries.txt.')}
                tooltip={t(
                  '自定义文件可放在 config/custom/search/ 目录下，此处填入文件名即可。',
                  'Place custom files in config/custom/search/ and specify the filename here.',
                )}
              >
                <Input
                  value={wsQueriesFile}
                  onChange={(e) => setConfigValue(['web_search', 'queries_file'], e.target.value)}
                  placeholder="search_queries.txt"
                  className="font-mono text-sm @min-[40rem]/section:w-[240px]"
                  spellCheck={false}
                />
              </SettingRow>

              <SettingRow
                label={t('搜索地区偏好 IP (localization)', 'Region Localization IP')}
                description={t('可选填 IP 影响地区偏好，留空自动。', 'Optional IP for region bias; blank = auto.')}
              >
                <Input
                  value={providerLocalization}
                  onChange={(e) =>
                    setConfigValue(
                      ['web_search', 'providers', wsProvider, 'localization'],
                      e.target.value,
                    )
                  }
                  placeholder={t('留空自动（可选 IP）', 'Optional IP address')}
                  className="font-mono text-sm @min-[40rem]/section:w-[240px]"
                  spellCheck={false}
                />
              </SettingRow>

              <div className="pt-4 pb-1">
                <span className="text-[13px] font-semibold text-[var(--text-secondary)]">
                  {t('联网搜索网络与代理参数 (advanced.web_search)', 'Search Network & Proxy (advanced.web_search)')}
                </span>
              </div>

              <SettingRow
                label={t('搜索请求间隔（毫秒）', 'Request Interval (ms)')}
                description={t('相邻两次搜索的间隔，默认 1000ms。', 'Delay between searches (default 1000ms).')}
              >
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={wsRequestInterval}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10)
                    setConfigValue(
                      ['advanced', 'web_search', 'request_interval'],
                      Number.isFinite(n) && n >= 0 ? n : 1000,
                    )
                  }}
                  className="font-mono text-sm @min-[40rem]/section:w-[140px]"
                />
              </SettingRow>

              <SettingRow
                label={t('单次搜索超时（秒）', 'Search Timeout (s)')}
                description={t('单次请求最大等待时间，默认 20 秒。', 'Per-request timeout in seconds (default 20s).')}
              >
                <Input
                  type="number"
                  min={3}
                  max={180}
                  value={wsTimeout}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10)
                    setConfigValue(
                      ['advanced', 'web_search', 'timeout'],
                      Number.isFinite(n) && n > 0 ? n : 20,
                    )
                  }}
                  className="font-mono text-sm @min-[40rem]/section:w-[140px]"
                />
              </SettingRow>

              <SettingRow
                label={t('最大重试次数 (max_retries)', 'Max Retries')}
                description={t('超时或限流时自动重试次数，默认 2 次。', 'Retries on timeout or rate limit (default 2).')}
              >
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={wsMaxRetries}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10)
                    setConfigValue(
                      ['advanced', 'web_search', 'max_retries'],
                      Number.isFinite(n) && n >= 0 ? n : 2,
                    )
                  }}
                  className="font-mono text-sm @min-[40rem]/section:w-[140px]"
                />
              </SettingRow>

              <SettingRow
                label={t('联网搜索启用代理', 'Use Proxy for Web Search')}
                description={t('默认直连，云端环境保持关闭。', 'Direct by default; keep OFF in cloud.')}
              >
                <Switch
                  checked={wsUseProxy}
                  onCheckedChange={(v) =>
                    setConfigValue(['advanced', 'web_search', 'use_proxy'], v)
                  }
                />
              </SettingRow>

              {deployMode === 'github_actions' && wsUseProxy && (
                <div className="py-3">
                  <Callout
                    tone="warning"
                    icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
                    title={t(
                      'GitHub Actions 下开启搜索代理会导致请求失败',
                      'Web Search proxy should stay OFF in GitHub Actions',
                    )}
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfigValue(['advanced', 'web_search', 'use_proxy'], false)}
                      >
                        {t('关闭代理', 'Disable Proxy')}
                      </Button>
                    }
                  >
                    {t(
                      '云端运行器可直接访问 DeepSeek API，无需经过本机代理。',
                      'Cloud runners reach DeepSeek API directly without a local proxy.',
                    )}
                  </Callout>
                </div>
              )}

              <SettingRow
                label={t('搜索专属代理地址', 'Web Search Proxy URL')}
                description={t('留空自动复用热榜默认代理。', 'Leave empty to reuse default crawler proxy.')}
              >
                <Input
                  value={wsProxyUrl}
                  onChange={(e) =>
                    setConfigValue(['advanced', 'web_search', 'proxy_url'], e.target.value)
                  }
                  placeholder={t('留空复用热榜默认代理', 'Empty = reuse default proxy')}
                  className="font-mono text-sm @min-[40rem]/section:w-[260px]"
                  spellCheck={false}
                />
              </SettingRow>
            </div>
          </AdvancedCollapsible>
        </TabsContent>
      </Tabs>

      {/* ===================== MODAL: ADD PLATFORM ===================== */}
      <ModalDialog
        open={platformModalOpen}
        onOpenChange={setPlatformModalOpen}
        title={t('添加热榜平台', 'Add Hotlist Platform')}
        description={t(
          '从官方清单一键加入，或手动录入自定义平台 ID。',
          'Pick from the official catalog or enter a custom platform ID.',
        )}
      >
        <Tabs
          value={platformModalTab}
          onValueChange={(v) => setPlatformModalTab(v as 'official' | 'custom')}
          className="space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="official">
                {t('从官方列表添加', 'Official Catalog')}
              </TabsTrigger>
              <TabsTrigger value="custom">
                {t('自定义平台 ID', 'Custom Platform ID')}
              </TabsTrigger>
            </TabsList>

            {platformModalTab === 'official' &&
              OFFICIAL_PLATFORMS.some((p) => !existingPlatformIds.has(p.id)) && (
                <Button size="sm" variant="outline" onClick={addAllMissingOfficial}>
                  <Plus className="h-4 w-4" />
                  <span>{t('补全全部未添加项', 'Add All Missing')}</span>
                </Button>
              )}
          </div>

          <TabsContent value="official" className="space-y-2.5 outline-none">
            <div className="grid grid-cols-1 gap-2.5 @min-[40rem]/section:grid-cols-2">
              {OFFICIAL_PLATFORMS.map((preset) => {
                const added = existingPlatformIds.has(preset.id)
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={added}
                    onClick={() => addOfficialPlatform(preset)}
                    className={cn(
                      'tr-focus-ring flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors',
                      added
                        ? 'border-[var(--border-default)] bg-[var(--bg-subtle)]/60 opacity-60 cursor-not-allowed'
                        : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--brand-primary)] hover:bg-[var(--brand-soft)]/50 cursor-pointer',
                    )}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {t(preset.name, preset.nameEn)}
                        </span>
                        <code className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-muted)]">
                          {preset.id}
                        </code>
                      </div>
                      {preset.expected_domain && (
                        <div className="flex items-center gap-1 font-mono text-xs text-[var(--text-muted)]">
                          <ShieldCheck className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                          <span>{preset.expected_domain}</span>
                        </div>
                      )}
                    </div>

                    {added ? (
                      <Badge tone="neutral">
                        <Check className="h-3.5 w-3.5" />
                        <span>{t('已添加', 'Added')}</span>
                      </Badge>
                    ) : (
                      <Badge tone="brand">
                        <Plus className="h-3.5 w-3.5" />
                        <span>{t('添加', 'Add')}</span>
                      </Badge>
                    )}
                  </button>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4 outline-none">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-primary)]">
                {t('平台唯一 ID（必填）', 'Platform ID (Required)')}
              </label>
              <Input
                value={customPlatId}
                onChange={(e) => setCustomPlatId(e.target.value)}
                placeholder={t('例如：hackernews, v2ex, juejin', 'e.g. hackernews, v2ex, juejin')}
                className="font-mono text-sm"
                spellCheck={false}
              />
              <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                {t(
                  '需与 newsnow 后端支持的平台 ID 一致。',
                  'Must match an ID supported by your newsnow API backend.',
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-primary)]">
                {t('显示名称', 'Display Name')}
              </label>
              <Input
                value={customPlatName}
                onChange={(e) => setCustomPlatName(e.target.value)}
                placeholder={t('例如：Hacker News', 'e.g. Hacker News')}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-primary)]">
                {t('安全校验域名 expected_domain（推荐）', 'Expected Domain (Recommended)')}
              </label>
              <Input
                value={customPlatDomain}
                onChange={(e) => setCustomPlatDomain(e.target.value)}
                placeholder={t('例如：ycombinator.com', 'e.g. ycombinator.com')}
                className="font-mono text-sm"
                spellCheck={false}
              />
              <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                {t(
                  '自动校验返回链接是否属于该主域名及子域名。',
                  'Verifies fetched URLs belong to this domain or its subdomains.',
                )}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setPlatformModalOpen(false)}>
                {t('取消', 'Cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddCustomPlatform}
                disabled={!customPlatId.trim()}
              >
                <Plus className="h-4 w-4" />
                <span>{t('确认添加', 'Add Platform')}</span>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </ModalDialog>

      {/* ===================== MODAL: ADD CUSTOM RSS ===================== */}
      <ModalDialog
        open={rssModalOpen}
        onOpenChange={setRssModalOpen}
        title={t('添加自定义 RSS 订阅源', 'Add Custom RSS Feed')}
        description={t(
          '填写 RSS / Atom 地址，可选填单源新鲜度天数。',
          'Enter an RSS or Atom URL with an optional freshness override.',
        )}
        maxWidthClass="max-w-lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setRssModalOpen(false)}>
              {t('取消', 'Cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddRssFeed}
              disabled={!newFeedUrl.trim()}
            >
              <Plus className="h-4 w-4" />
              <span>{t('添加到列表', 'Add Feed')}</span>
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">
              {t('订阅名称', 'Feed Name')}
            </label>
            <Input
              value={newFeedName}
              onChange={(e) => {
                const v = e.target.value
                setNewFeedName(v)
                if (!newFeedIdTouched) {
                  setNewFeedId(slugifyId(v || newFeedUrl, 'rss'))
                }
              }}
              placeholder={t('例如：Hacker News 首页', 'e.g. Hacker News Frontpage')}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">
              {t('RSS / Atom 地址（必填）', 'Feed URL (Required)')}
            </label>
            <Input
              value={newFeedUrl}
              onChange={(e) => {
                const v = e.target.value
                setNewFeedUrl(v)
                if (!newFeedIdTouched && !newFeedName.trim()) {
                  setNewFeedId(slugifyId(v, 'rss'))
                }
              }}
              placeholder="https://example.com/feed.xml"
              className="font-mono text-sm"
              spellCheck={false}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 @min-[40rem]/section:grid-cols-3 @min-[40rem]/section:items-end">
            <div className="space-y-1.5">
              <label className="flex min-h-[24px] items-center text-sm font-medium text-[var(--text-primary)]">
                {t('唯一标识 ID', 'Unique Feed ID')}
              </label>
              <Input
                value={newFeedId}
                onChange={(e) => {
                  setNewFeedIdTouched(true)
                  setNewFeedId(e.target.value)
                }}
                placeholder="hacker-news"
                className="font-mono text-sm"
                spellCheck={false}
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex min-h-[24px] items-center text-sm font-medium text-[var(--text-primary)]">
                {t('新鲜度天数（可选）', 'Max Age (Optional)')}
              </label>
              <Input
                type="number"
                min={0}
                value={newFeedMaxAge}
                onChange={(e) => setNewFeedMaxAge(e.target.value)}
                placeholder={t('留空走全局，0=不限', 'Blank=global, 0=none')}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex min-h-[24px] items-center text-sm font-medium text-[var(--text-primary)]">
                {t('条数上限（可选）', 'Max Items (Optional)')}
              </label>
              <Input
                type="number"
                min={1}
                value={newFeedMaxItems}
                onChange={(e) => setNewFeedMaxItems(e.target.value)}
                placeholder={t('留空不限制', 'Unlimited')}
                className="font-mono text-sm"
              />
            </div>
          </div>
        </div>
      </ModalDialog>
    </SectionShell>
  )
}
