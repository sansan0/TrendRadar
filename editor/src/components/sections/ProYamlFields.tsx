import { useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ChevronDown, ChevronRight, CornerUpLeft, Plus, Trash2 } from 'lucide-react'
import { parseDocument, type Document } from 'yaml'
import { SecretInput } from '@/components/shared/SharedControls'
import { Button, Callout, Input, Switch, Textarea } from '@/components/ui/primitives'
import { useT } from '@/i18n'
import { isSensitiveField, secretEnvForPath } from '@/lib/exporter'
import {
  getLocalizedPlatformName,
  getLocalizedRssFeedName,
  getLocalizedTimelinePeriodName,
  getLocalizedTimelinePresetName,
} from '@/lib/presets'
import { cn } from '@/lib/utils'
import { describeYamlFieldHint } from '@/lib/yaml-change-impact'
import type { YamlPath } from '@/lib/yaml-doc'
import { formatFieldPath, getFieldReferences, getYamlFieldTree, type YamlField } from '@/lib/yaml-fields'
import { useEditor } from '@/store/editor-store'

interface FieldActions {
  onNavigate: (path: YamlPath) => void
  onChange: (path: YamlPath, value: unknown) => void
  onRemove?: (path: YamlPath) => void
}

interface FieldView extends FieldActions {
  file: 'config.yaml' | 'timeline.yaml'
  path: YamlPath
  revealSeq: number
  onReveal?: (path: YamlPath) => void
}

function parseInput(text: string): unknown {
  if (text.trim() === '') return ''
  const doc = parseDocument(text)
  if (doc.errors.length) throw doc.errors[0]
  return doc.toJS()
}

function NewMember({ field, onChange, onNavigate, onClose }: FieldActions & { field: YamlField; onClose?: () => void }) {
  const t = useT()
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const isList = field.kind === 'list'
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const key = isList ? field.children.length : name.trim()
    if (!isList && field.children.some((child) => child.name === key)) {
      setError(t('这个字段名已存在。', 'This key already exists.'))
      return
    }
    try {
      const nextValue = parseInput(value)
      const path = [...field.path, key]
      onChange(path, nextValue)
      onNavigate(path)
      onClose?.()
    } catch {
      setError(t('请输入有效的 YAML 值。', 'Enter a valid YAML value.'))
    }
  }
  return (
    <form onSubmit={submit} className="min-w-0 space-y-2 border-t border-[var(--border-default)] bg-[var(--bg-subtle)] p-3">
      {!isList && (
        <Input
          aria-label={t('新字段名', 'New key')}
          placeholder={t('字段名', 'Key')}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError('')
          }}
          className="h-9 font-mono text-xs"
        />
      )}
      <Input
        aria-label={t('新值', 'New value')}
        placeholder={t('值，例如 zhihu、true、[] 或 {}', 'Value, e.g. zhihu, true, [] or {}')}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setError('')
        }}
        className="h-9 font-mono text-xs"
      />
      {error && <p role="alert" className="text-xs text-[var(--status-danger)]">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="xs" variant="primary" type="submit" disabled={!isList && !name.trim()}>{t('添加', 'Add')}</Button>
        {onClose && <Button size="xs" type="button" onClick={onClose}>{t('取消', 'Cancel')}</Button>}
      </div>
    </form>
  )
}

function NumberValue({ value, name, onChange }: { value: number; name: string; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<{ number: number; text: string } | null>(null)
  const shown = draft && Object.is(draft.number, value) ? draft.text : String(value)
  return (
    <Input
      aria-label={name}
      inputMode="decimal"
      value={shown}
      className="h-9 font-mono text-sm"
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        const text = e.target.value
        const number = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) ? Number(text) : NaN
        const valid = Number.isFinite(number)
        setDraft({ text, number: valid ? number : value })
        if (valid && !Object.is(number, value)) onChange(number)
      }}
    />
  )
}

function NullValue({ name, onChange }: { name: string; onChange: (value: unknown) => void }) {
  const [text, setText] = useState('')
  const [invalid, setInvalid] = useState(false)
  const submit = () => {
    if (!text.trim()) return
    try {
      const value = parseInput(text)
      onChange(value)
      setText('')
      setInvalid(false)
    } catch {
      setInvalid(true)
    }
  }
  return (
    <Input
      aria-label={name}
      aria-invalid={invalid}
      placeholder="null"
      value={text}
      className="h-9 font-mono text-sm"
      onChange={(e) => {
        setText(e.target.value)
        setInvalid(false)
      }}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit()
      }}
    />
  )
}

function ScalarValue({ field, view }: { field: YamlField; view: FieldView }) {
  const { path, value } = field
  const name = formatFieldPath(path)
  const update = (next: unknown) => view.onChange(path, next)
  if (isSensitiveField(view.file, path)) {
    return <SecretInput value={String(value ?? '')} onChange={update} placeholder={name} envVar={secretEnvForPath(view.file, path)}
      className="min-w-0 max-w-full [overflow-wrap:anywhere] [&_input]:min-w-0" />
  }
  if (typeof value === 'boolean') return <Switch ariaLabel={name} checked={value} onCheckedChange={update} />
  if (typeof value === 'number') return <NumberValue name={name} value={value} onChange={update} />
  if (value == null) return <NullValue name={name} onChange={update} />
  const props = { 'aria-label': name, value: String(value), spellCheck: false, className: 'font-mono text-sm' }
  return String(value).includes('\n')
    ? <Textarea {...props} rows={4} onChange={(e) => update(e.target.value)} />
    : <Input {...props} className="h-9 font-mono text-sm" onChange={(e) => update(e.target.value)} />
}

function FieldRow({ field, view, references }: {
  field: YamlField
  view: FieldView
  references: ReturnType<typeof getFieldReferences>
}) {
  const t = useT()
  const { lang } = useEditor()
  const { path, revealSeq, onNavigate, onRemove } = view
  const isRoot = field.path.length === 1
  const isListEntry = typeof field.path.at(-1) === 'number'
  const isCollection = field.kind === 'map' || field.kind === 'list'
  const isOnPath = field.path.every((key, index) => key === path[index])
  const selected = isOnPath && field.path.length === path.length
  const [fold, setFold] = useState({ open: isRoot || (view.file === 'config.yaml' && field.path.length === 2 && !isListEntry), seq: -1 })
  const [adding, setAdding] = useState(false)
  const open = fold.open || adding || (isOnPath && (!selected || (revealSeq > 0 && fold.seq !== revealSeq)))
  useLayoutEffect(() => {
    if (isCollection && isOnPath && revealSeq > 0) {
      setFold((previous) => previous.open ? previous : { open: true, seq: revealSeq })
    }
  }, [isCollection, isOnPath, revealSeq])
  const select = () => {
    if (!selected) onNavigate(field.path)
  }
  const toggle = () => {
    setFold({ open: !open, seq: revealSeq })
    setAdding(false)
  }
  const rawIdChild = isListEntry && field.kind === 'map'
    ? String(field.children.find((child) => child.name === 'id')?.value ?? '')
    : ''
  const rawNameChild = field.kind === 'map'
    ? field.children.find((child) => child.name === 'name')?.value
    : undefined
  const label = (() => {
    if (isListEntry && field.kind === 'map') {
      const nameStr = typeof rawNameChild === 'string' ? rawNameChild : undefined
      if (view.file === 'config.yaml' && field.path[0] === 'platforms' && field.path[1] === 'sources' && rawIdChild) {
        return getLocalizedPlatformName(rawIdChild, nameStr, lang)
      }
      if (view.file === 'config.yaml' && field.path[0] === 'rss' && field.path[1] === 'feeds' && rawIdChild) {
        return getLocalizedRssFeedName(rawIdChild, nameStr, lang)
      }
      return rawNameChild ?? rawIdChild
    }
    if (view.file === 'timeline.yaml' && field.kind === 'map') {
      const nameStr = typeof rawNameChild === 'string' ? rawNameChild : undefined
      if (field.path[0] === 'presets' && field.path.length === 2 && typeof field.path[1] === 'string') {
        return getLocalizedTimelinePresetName(field.path[1], nameStr, lang)
      }
      if (
        ((field.path[0] === 'presets' && field.path[2] === 'periods' && field.path.length === 4) ||
          (field.path[0] === 'custom' && field.path[1] === 'periods' && field.path.length === 3)) &&
        typeof field.path.at(-1) === 'string'
      ) {
        return getLocalizedTimelinePeriodName(String(field.path.at(-1)), nameStr, lang)
      }
    }
    return null
  })()
  const hint = !isRoot
    ? describeYamlFieldHint(view.file, field.path, field.value, field.comment, lang)
    : ''
  const canDeleteField = Boolean(
    onRemove &&
      !isRoot &&
      (isListEntry ||
        field.path[0] === 'presets' ||
        (field.path[0] === 'ai' && field.path[1] === 'extra_params' && field.path.length >= 3) ||
        (view.file === 'timeline.yaml' && field.path.length >= 3)),
  )
  const canAddMember =
    field.kind === 'list' ||
    (field.kind === 'map' &&
      (field.children.length === 0 ||
        (view.file === 'config.yaml' && field.path[0] === 'ai' && field.path[1] === 'extra_params') ||
        (view.file === 'timeline.yaml' &&
          ((field.path[0] === 'presets' &&
            (field.path.length === 1 ||
              (field.path.length === 3 && (field.path[2] === 'periods' || field.path[2] === 'day_plans')))) ||
            (field.path[0] === 'custom' &&
              field.path.length === 2 &&
              (field.path[1] === 'periods' || field.path[1] === 'day_plans'))))))
  const count = field.children.length
  const id = JSON.stringify(field.path)
  const target = references.targets.get(id)
  const referenced = references.referenced.has(id)
  const type = field.kind === 'scalar' ? (field.value === null ? 'null' : typeof field.value) : field.kind
  const inlineSwitch = field.kind === 'scalar' && typeof field.value === 'boolean' && !isSensitiveField(view.file, field.path)

  const fieldLabel = (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <code
          className={cn(
            'min-w-0 max-w-full font-mono font-semibold text-[var(--text-primary)] [overflow-wrap:anywhere]',
            isRoot ? 'text-[14.5px]' : 'text-[13px]',
          )}
          title={`${formatFieldPath(field.path)} · ${type}`}
        >
          {field.name}
        </code>
        {typeof label === 'string' && (
          <span className="min-w-0 max-w-full text-[13.5px] font-medium text-[var(--text-primary)] [overflow-wrap:anywhere]">
            {label}
          </span>
        )}
        {isCollection && (
          <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--text-muted)]">
            {t('{v0} 项', '{v0} items', { v0: count })}
          </span>
        )}
      </div>
      {hint && (
        <p title={field.comment} className="mt-1 text-xs leading-relaxed text-[var(--text-muted)] [overflow-wrap:anywhere]">
          {hint}
        </p>
      )}
    </div>
  )

  const actionButtons = (canAddMember || (canDeleteField && onRemove)) ? (
    <div className="flex shrink-0 items-center justify-end gap-1">
      {canAddMember && (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 text-[var(--text-muted)] hover:text-[var(--brand-primary)]"
          aria-label={t('向 {v0} 添加条目', 'Add an entry to {v0}', { v0: field.name })}
          title={t('向 {v0} 添加条目', 'Add an entry to {v0}', { v0: field.name })}
          onClick={(e) => {
            e.stopPropagation()
            setAdding(!adding)
            setFold({ open: true, seq: revealSeq })
          }}
        >
          <Plus size={15} />
        </Button>
      )}
      {canDeleteField && onRemove && (
        <Button
          size="icon"
          variant="ghost"
          className="tr-hover-delete h-7 w-7 shrink-0 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-[var(--status-danger)]"
          aria-label={t('删除 {v0}', 'Remove {v0}', { v0: formatFieldPath(field.path) })}
          title={referenced ? t('先移除对此字段的 YAML 引用', 'Remove the YAML references to this field first') : t('删除', 'Remove')}
          disabled={referenced}
          onClick={(event) => {
            event.stopPropagation()
            onNavigate(field.path.slice(0, -1))
            onRemove(field.path)
          }}
        >
          <Trash2 size={14} />
        </Button>
      )}
    </div>
  ) : null

  return (
    <div
      className={cn(
        'min-w-0',
        isCollection && isListEntry && 'my-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/35',
      )}
    >
      <div
        data-field-path={id}
        data-current-field={selected || undefined}
        onClick={select}
        onFocus={isCollection ? undefined : select}
        className={cn(
          'group/row min-w-0 transition-colors',
          isRoot
            ? 'flex items-center justify-between gap-3 border-b border-[var(--border-default)] px-2 pb-3 pt-1'
            : isCollection
              ? cn(
                  'flex items-center justify-between gap-3 rounded-xl px-3 py-2.5',
                  selected ? 'bg-[var(--brand-soft)]/80 ring-1 ring-[var(--brand-border)]' : 'hover:bg-[var(--bg-subtle)]/50',
                )
              : inlineSwitch
                ? cn(
                    'flex items-center justify-between gap-4 rounded-xl px-3 py-3',
                    selected ? 'bg-[var(--brand-soft)]/80 ring-1 ring-[var(--brand-border)]' : 'hover:bg-[var(--bg-subtle)]/40',
                  )
                : cn(
                    'flex flex-col gap-2.5 rounded-xl px-3 py-3 @min-[44rem]/yaml:grid @min-[44rem]/yaml:grid-cols-[minmax(0,1fr)_minmax(240px,44%)_auto] @min-[44rem]/yaml:items-center @min-[44rem]/yaml:gap-4',
                    selected ? 'bg-[var(--brand-soft)]/80 ring-1 ring-[var(--brand-border)]' : 'hover:bg-[var(--bg-subtle)]/40',
                  ),
        )}
      >
        {isCollection ? (
          <>
            <button
              type="button"
              aria-expanded={open}
              onClick={toggle}
              className="tr-focus-ring flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded text-left"
            >
              {open ? <ChevronDown size={15} className="shrink-0 text-[var(--text-muted)]" /> : <ChevronRight size={15} className="shrink-0 text-[var(--text-muted)]" />}
              {fieldLabel}
            </button>
            {actionButtons}
          </>
        ) : inlineSwitch ? (
          <>
            <div className="min-w-0 flex-1">{fieldLabel}</div>
            <div className="flex shrink-0 items-center gap-2">
              <ScalarValue field={field} view={view} />
              {actionButtons}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2 min-w-0">
              <div className="min-w-0 flex-1">{fieldLabel}</div>
              <div className="@min-[44rem]/yaml:hidden">{actionButtons}</div>
            </div>
            <div className="flex w-full min-w-0 items-center [&>input]:min-w-0 [&>textarea]:min-w-0">
              {field.kind === 'alias' ? (
                <Button
                  size="xs"
                  disabled={!target}
                  className="min-w-0 max-w-full"
                  title={t('定位引用的定义 *{v0}', 'Go to anchor *{v0}', { v0: field.value })}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (target) (view.onReveal ?? onNavigate)(target)
                  }}
                >
                  <CornerUpLeft size={14} className="shrink-0" /> <code className="min-w-0 truncate">*{String(field.value)}</code>
                </Button>
              ) : (
                <ScalarValue field={field} view={view} />
              )}
            </div>
            <div className="hidden @min-[44rem]/yaml:flex">{actionButtons}</div>
          </>
        )}
      </div>
      {isCollection && open && (
        <div
          className={cn(
            'min-w-0',
            isRoot
              ? 'mt-1 divide-y divide-[var(--border-default)]/55'
              : isListEntry
                ? 'border-t border-[var(--border-default)]/70 px-2 py-1.5 divide-y divide-[var(--border-default)]/45'
                : 'ml-3 mt-1 mb-2 border-l border-[var(--border-default)] pl-3 space-y-1',
          )}
        >
          {adding && <NewMember {...view} field={field} onClose={() => setAdding(false)} />}
          {field.children.map((child) => <FieldRow key={JSON.stringify(child.path)} field={child} view={view} references={references} />)}
        </div>
      )}
    </div>
  )
}

export function ProYamlFields({ doc, alignToTop = false, ...view }: FieldView & { doc: Document | null; alignToTop?: boolean }) {
  const t = useT()
  const container = useRef<HTMLDivElement>(null)
  const lastReveal = useRef<number | null>(null)
  const tree = useMemo(() => doc ? getYamlFieldTree(doc) : null, [doc])
  const references = useMemo(() => getFieldReferences(tree), [tree])
  const root = tree?.children.find((child) => child.path[0] === view.path[0]) ?? tree?.children[0]

  useLayoutEffect(() => {
    if (view.revealSeq === 0 || lastReveal.current === view.revealSeq) return
    const selected = container.current?.querySelector<HTMLElement>('[data-current-field="true"]')
    const pane = container.current?.closest('main')
    if (!pane || !selected) return
    lastReveal.current = view.revealSeq
    const row = selected.getBoundingClientRect()
    const bounds = pane.getBoundingClientRect()
    if (alignToTop || row.top < bounds.top + 8 || row.bottom > bounds.bottom - 8) {
      pane.scrollTop += row.top - bounds.top - 12
    }
  }, [view.revealSeq, view.path, tree, alignToTop])

  if (!tree) return <Callout tone="warning">{t('修正左侧 YAML 语法后即可继续编辑字段。', 'Fix the YAML syntax to continue editing fields.')}</Callout>
  if (doc?.contents == null || (tree.kind === 'map' && !root)) {
    return <NewMember {...view} field={tree} />
  }
  if (!root || tree.kind !== 'map') {
    return <Callout>{t('配置文件最外层应为键值映射，请在左侧调整其结构。', 'Use a mapping at the top level of the configuration file.')}</Callout>
  }
  return (
    <div ref={container} className="@container/yaml min-w-0 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5 sm:p-5 shadow-[var(--shadow-xs)]">
      <FieldRow key={JSON.stringify([view.file, root.path])} field={root} view={view} references={references} />
    </div>
  )
}
