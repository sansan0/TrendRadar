import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock, LocateFixed, RotateCcw, ShieldAlert, Undo2, Wrench } from 'lucide-react'
import {
  Badge,
  Button,
  Callout,
  ModalDialog,
  Popover,
  PopoverPanel,
  PopoverTrigger,
  SelectField,
} from '@/components/ui/primitives'
import { tr, useT } from '@/i18n'
import {
  compareTemplate,
  differsFromTemplate,
  restoreFieldChange,
  restoreTextChange,
  type ChangeKind,
  type FieldChange,
  type TextChange,
} from '@/lib/config-changes'
import { getMatchingDefaultFiles } from '@/lib/defaults'
import { featureForSource, isYamlFile } from '@/lib/pro-navigation'
import { ALL_CONFIG_FILES, type ConfigFileKey, type Lang } from '@/lib/types'
import { cn } from '@/lib/utils'
import type { YamlPath } from '@/lib/yaml-doc'
import { formatFieldPath } from '@/lib/yaml-fields'
import { useEditor, type ChangesRequest, type EditLogMap, type EditStamp } from '@/store/editor-store'

function isPathPrefix(prefix: YamlPath, full: YamlPath): boolean {
  if (prefix.length > full.length) return false
  for (let i = 0; i < prefix.length; i++) {
    if (String(prefix[i]) !== String(full[i])) return false
  }
  return true
}

function lookupYamlStamp(editLog: EditLogMap, file: ConfigFileKey, path: YamlPath): EditStamp {
  const exact = editLog[`yaml::${file}::${JSON.stringify(path)}`]
  if (exact) return exact

  const prefixKey = `yaml::${file}::`
  let best: EditStamp | null = null
  for (const [k, stamp] of Object.entries(editLog)) {
    if (!k.startsWith(prefixKey)) continue
    try {
      const loggedPath = JSON.parse(k.slice(prefixKey.length)) as YamlPath
      if (Array.isArray(loggedPath) && (isPathPrefix(loggedPath, path) || isPathPrefix(path, loggedPath))) {
        if (!best || stamp.stepId > best.stepId) best = stamp
      }
    } catch {}
  }
  return best ?? editLog[`file::${file}`] ?? { stepId: 0, at: 0 }
}

function lookupTextStamp(
  editLog: EditLogMap,
  file: ConfigFileKey,
  item: TextChange,
): EditStamp {
  const sig = (item.after.length ? item.after : item.before).join('\n')
  const exact = editLog[`text::${file}::${item.kind}::${sig}`]
  if (exact) return exact
  const byLine = editLog[`textline::${file}::${item.newStart}`]
  if (byLine) return byLine
  return editLog[`file::${file}`] ?? { stepId: 0, at: 0 }
}

function formatEditTime(ts: number, now: number, lang: Lang): string {
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000))
  const d = new Date(ts)
  const nowDate = new Date(now)
  const sameDay =
    d.getFullYear() === nowDate.getFullYear() &&
    d.getMonth() === nowDate.getMonth() &&
    d.getDate() === nowDate.getDate()

  const pad = (n: number) => String(n).padStart(2, '0')
  const clockSec = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  const clockMin = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const datePart = `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${clockMin}`

  if (diffSec < 60) {
    return tr(lang, '{clock} · 刚刚', '{clock} (just now)', { clock: clockSec })
  }
  const mins = Math.floor(diffSec / 60)
  if (mins < 60) {
    return tr(lang, '{clock} · {mins} 分钟前', '{clock} ({mins}m ago)', { clock: clockMin, mins })
  }
  const hours = Math.floor(mins / 60)
  if (sameDay) {
    return tr(lang, '{clock} · {hours} 小时前', '{clock} ({hours}h ago)', { clock: clockMin, hours })
  }
  const days = Math.floor(hours / 24)
  if (days < 7) {
    return tr(lang, '{date} · {days} 天前', '{date} ({days}d ago)', { date: datePart, days })
  }
  return datePart
}

interface OrderedChangeEntry<T> {
  item: T
  stamp: EditStamp
  seqNum: number
  isLatestStep: boolean
  sameStepCount: number
}

function orderChangesNewestFirst<T>(items: T[], getStamp: (item: T) => EditStamp): OrderedChangeEntry<T>[] {
  const stamped = items.map((item, origIdx) => ({ item, stamp: getStamp(item), origIdx }))
  const stepCounts = new Map<number, number>()
  let maxStepId = 0
  for (const entry of stamped) {
    const sid = entry.stamp.stepId
    stepCounts.set(sid, (stepCounts.get(sid) ?? 0) + 1)
    if (sid > maxStepId) maxStepId = sid
  }

  stamped.sort((a, b) => {
    if (a.stamp.stepId === 0 && b.stamp.stepId !== 0) return 1
    if (b.stamp.stepId === 0 && a.stamp.stepId !== 0) return -1
    if (b.stamp.stepId !== a.stamp.stepId) return b.stamp.stepId - a.stamp.stepId
    if (b.stamp.at !== a.stamp.at) return b.stamp.at - a.stamp.at
    return a.origIdx - b.origIdx
  })

  const total = stamped.length
  return stamped.map((entry, idx) => ({
    item: entry.item,
    stamp: entry.stamp,
    seqNum: total - idx,
    isLatestStep: maxStepId > 0 && entry.stamp.stepId === maxStepId,
    sameStepCount: entry.stamp.stepId > 0 ? (stepCounts.get(entry.stamp.stepId) ?? 1) : 1,
  }))
}

type PendingRestore =
  | { scope: 'all' }
  | { scope: 'file' }
  | { scope: 'field'; id: string; item: FieldChange; raw: string }
  | { scope: 'text'; id: string; item: TextChange; raw: string }

function InlineRestorePopover({
  open,
  onOpenChange,
  prompt,
  onConfirm,
  side = 'bottom',
  align = 'end',
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  prompt: string
  onConfirm: () => void
  side?: 'top' | 'bottom'
  align?: 'start' | 'center' | 'end'
  children: React.ReactNode
}) {
  const t = useT()
  // Note: PopoverPanel portals into document.body right next to the clicked trigger button
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverPanel
        side={side}
        align={align}
        sideOffset={6}
        className="z-[1450] w-auto max-w-[290px] rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-3 shadow-[var(--shadow-popover)]"
      >
        <div className="space-y-2.5">
          <p role="status" className="text-xs font-medium leading-relaxed text-[var(--text-primary)]">
            {prompt}
          </p>
          <div className="flex items-center justify-end gap-1.5">
            <Button size="xs" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('取消', 'Cancel')}
            </Button>
            <Button size="xs" variant="primary" onClick={onConfirm}>
              {t('确认恢复', 'Confirm restore')}
            </Button>
          </div>
        </div>
      </PopoverPanel>
    </Popover>
  )
}

function ChangeRow({
  seqNum,
  isTopRow,
  timeText,
  sameStepCount,
  title,
  codeLabel,
  effect,
  kind,
  before,
  after,
  confirmOpen,
  onConfirmOpenChange,
  onConfirmRestore,
  onLocate,
}: {
  seqNum: number
  isTopRow: boolean
  timeText?: string
  sameStepCount: number
  title?: string
  codeLabel: string
  effect: string
  kind: ChangeKind
  before?: string
  after?: string
  confirmOpen: boolean
  onConfirmOpenChange: (open: boolean) => void
  onConfirmRestore: () => void
  onLocate?: () => void
}) {
  const t = useT()
  const status = { added: t('新增', 'Added'), removed: t('移除', 'Removed'), changed: t('修改', 'Changed') }
  const showSeparateCode = Boolean(title && title !== codeLabel)

  return (
    <li
      className={cn(
        'group rounded-xl border bg-[var(--bg-surface)] p-3.5 transition-all hover:border-[var(--brand-border)] hover:shadow-[var(--shadow-xs)]',
        confirmOpen ? 'border-[var(--brand-primary)] ring-1 ring-[var(--brand-border)]' : 'border-[var(--border-default)]',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span
            data-change-seq={`#${seqNum}`}
            title={isTopRow ? t('第 {v0} 项改动（最新）', 'Change #{v0} (latest)', { v0: seqNum }) : t('第 {v0} 项改动', 'Change #{v0}', { v0: seqNum })}
            className={cn(
              'inline-flex h-5 min-w-[26px] shrink-0 items-center justify-center rounded-md px-1.5 font-mono text-[11px] font-bold tabular-nums',
              isTopRow
                ? 'bg-[var(--brand-primary)] text-white'
                : 'border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]',
            )}
          >
            #{seqNum}
          </span>
          <Badge tone={kind === 'added' ? 'success' : kind === 'removed' ? 'danger' : 'brand'}>
            {status[kind]}
          </Badge>
          {title && (
            <strong className="text-[13.5px] font-semibold text-[var(--text-primary)]">
              {title}
            </strong>
          )}
          <code
            className={cn(
              'min-w-0 break-all font-mono text-xs',
              showSeparateCode
                ? 'rounded bg-[var(--bg-muted)] px-1.5 py-0.5 text-[var(--text-muted)]'
                : 'font-semibold text-[var(--text-primary)]',
            )}
          >
            {codeLabel}
          </code>
          {timeText && (
            <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--text-muted)]">
              <Clock size={11} className="shrink-0 opacity-75" />
              <span>{timeText}</span>
              {sameStepCount > 1 && (
                <span className="rounded bg-[var(--bg-subtle)] px-1 py-0.2 text-[10.5px]">
                  {t('同次操作', 'Same batch')}
                </span>
              )}
            </span>
          )}
        </div>

        <div
          className={cn(
            'flex shrink-0 items-center gap-1.5 transition-opacity duration-150',
            confirmOpen
              ? 'opacity-100'
              : 'opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100',
          )}
        >
          <InlineRestorePopover
            open={confirmOpen}
            onOpenChange={onConfirmOpenChange}
            prompt={t('要把这一项改回原来的设置吗？', 'Restore this item to its original setting?')}
            onConfirm={onConfirmRestore}
          >
            <Button size="xs" variant="outline">
              <RotateCcw size={13} /> {t('恢复此项', 'Restore')}
            </Button>
          </InlineRestorePopover>
          {onLocate && (
            <Button size="xs" variant="outline" onClick={onLocate} title={t('跳转到此项配置位置', 'Jump to this setting')}>
              <LocateFixed size={13} /> {t('定位', 'Locate')}
            </Button>
          )}
        </div>
      </div>

      <p className="mt-1.5 break-words text-[13px] leading-relaxed text-[var(--text-secondary)]">
        {effect}
      </p>

      <div className="mt-2.5 grid min-w-0 gap-2 sm:grid-cols-2">
        {[
          [t('改动前（原值）', 'Before'), before],
          [t('改动后（现在）', 'Now'), after],
        ].map(([name, value]) => (
          <div key={name} className="min-w-0 rounded-lg border border-[var(--border-default)]/70 bg-[var(--bg-subtle)] px-3 py-2">
            <div className="mb-1 text-[11px] font-medium text-[var(--text-muted)]">{name}</div>
            {value === undefined ? (
              <span className="text-xs text-[var(--text-muted)]">—</span>
            ) : (
              <pre className="m-0 whitespace-pre-wrap break-all font-mono text-xs text-[var(--text-primary)]">
                {value || t('（空行）', '(blank line)')}
              </pre>
            )}
          </div>
        ))}
      </div>
    </li>
  )
}

export function ChangesDialog({
  request,
  onClose,
}: {
  request: ChangesRequest
  onClose: () => void
}) {
  const t = useT()
  const {
    files,
    baselineFiles,
    templateLang,
    lang,
    changedFromDefaults,
    dirtyFiles,
    hasCustomBaseline,
    issues,
    applyQuickFix,
    setFileContent,
    resetFile,
    resetAll,
    canUndoFile,
    getFileUndoCount,
    undoFile,
    editLog,
    activeSourceFile,
    workspaceMode,
    openSourceTarget,
    jumpToSource,
    focusVisual,
    setSourcesSubTab,
    notify,
  } = useEditor()

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  const [compareMode, setCompareMode] = useState<'defaults' | 'baseline'>('defaults')
  const defaults = useMemo(() => getMatchingDefaultFiles(files, templateLang), [files, templateLang])
  const referenceMap = compareMode === 'baseline' && hasCustomBaseline ? baselineFiles : defaults
  const modified = compareMode === 'baseline' && hasCustomBaseline ? dirtyFiles : changedFromDefaults

  const latestModifiedFile = useMemo(() => {
    if (modified.length === 0) return null
    return [...modified].sort((a, b) => {
      const sa = editLog[`file::${a}`]?.stepId ?? 0
      const sb = editLog[`file::${b}`]?.stepId ?? 0
      return sb - sa
    })[0]
  }, [editLog, modified])

  const [file, setFile] = useState<ConfigFileKey>(request.file ?? latestModifiedFile ?? activeSourceFile)
  const [pending, setPending] = useState<PendingRestore | null>(() => {
    if (request.restoreAll && changedFromDefaults.length) return { scope: 'all' }
    return request.restoreFile && modified.includes(file) ? { scope: 'file' } : null
  })

  const initial = referenceMap[file]
  const current = files[file]
  const diff = useMemo(
    () => (differsFromTemplate(initial, current) ? compareTemplate(file, initial, current, lang) : null),
    [file, initial, current, lang],
  )

  const yamlEntries = useMemo(() => {
    if (!diff || diff.type !== 'yaml') return []
    return orderChangesNewestFirst(diff.items, (item) => lookupYamlStamp(editLog, file, item.path))
  }, [diff, editLog, file])

  const textEntries = useMemo(() => {
    if (!diff || diff.type !== 'text') return []
    return orderChangesNewestFirst(diff.items, (item) => lookupTextStamp(editLog, file, item))
  }, [diff, editLog, file])

  const totalItemsCount = diff && diff.type !== 'invalid' ? diff.items.length : 0
  const distinctStepsCount = useMemo(() => {
    const entries = diff?.type === 'yaml' ? yamlEntries : diff?.type === 'text' ? textEntries : []
    const steps = new Set<number>()
    for (const entry of entries) {
      steps.add(entry.stamp.stepId)
    }
    return steps.size
  }, [diff?.type, yamlEntries, textEntries])

  const fileUndoCount = getFileUndoCount(file)
  const fileCanUndo = canUndoFile(file)

  const fileIssues = useMemo(
    () => issues.filter((iss) => iss.file === file && (iss.severity === 'error' || iss.severity === 'warning')),
    [issues, file],
  )

  const locateField = (item: FieldChange) => {
    onClose()
    if (isYamlFile(file)) {
      if (workspaceMode === 'pro') {
        openSourceTarget({ file, path: item.path })
      } else {
        const loc = featureForSource(file, item.path)
        if (loc) {
          if (loc.tab) setSourcesSubTab(loc.tab)
          focusVisual(loc.section, loc.anchor, {
            channel: loc.channel,
            filterMode: loc.filterMode,
            timelineTab: loc.timelineTab,
          })
        } else {
          jumpToSource(file)
        }
      }
    }
  }

  const locateText = (item: TextChange) => {
    onClose()
    const line = item.newStart + 1
    if (workspaceMode === 'pro') {
      openSourceTarget({ file, line })
    } else {
      jumpToSource(file, line)
    }
  }

  const confirm = () => {
    if (!pending) return
    setPending(null)
    if (pending.scope === 'all') {
      resetAll()
      return
    }
    if (pending.scope === 'file') {
      if (compareMode === 'baseline' && hasCustomBaseline) {
        resetFile(file, 'baseline')
      } else {
        resetFile(file)
      }
      return
    }
    if (pending.raw !== current) {
      notify(t('文件已更新，请重新选择要恢复的改动。', 'The file changed. Select the change again.'), 'warning')
      return
    }
    const next =
      pending.scope === 'text'
        ? restoreTextChange(current, pending.item)
        : restoreFieldChange(initial, current, pending.item)
    if (next !== current) {
      setFileContent(file, next)
      notify(t('已恢复该项。', 'The change was restored.'), 'success')
    } else {
      notify(
        t('此项与其他字段有关联，可恢复整个文件。', 'This field is referenced by other fields. You can restore the file.'),
        'warning',
      )
    }
  }

  const fileRestorePrompt =
    compareMode === 'baseline' && hasCustomBaseline
      ? t('要把 {v0} 恢复成刚导入时的内容吗？', 'Restore {v0} to the imported version?', { v0: file })
      : t('要把 {v0} 恢复成默认设置吗？', 'Restore {v0} to its default?', { v0: file })

  return (
    <ModalDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={t('改动与恢复', 'Changes & Restore')}
      maxWidthClass="max-w-3xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <InlineRestorePopover
            side="top"
            align="start"
            open={pending?.scope === 'all'}
            onOpenChange={(open) => setPending(open ? { scope: 'all' } : null)}
            prompt={t('要把全部配置文件都恢复成默认设置吗？', 'Restore all config files to defaults?')}
            onConfirm={confirm}
          >
            <Button size="sm" variant="ghost" disabled={!changedFromDefaults.length}>
              <RotateCcw size={14} /> {t('恢复全部初始配置', 'Restore all defaults')}
            </Button>
          </InlineRestorePopover>
          <Button size="sm" variant="outline" onClick={onClose}>
            {t('关闭', 'Close')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        {/* Top File Selector + Per-File Step Undo + File Restore */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <SelectField
              size="sm"
              ariaLabel={t('对比文件', 'File to compare')}
              value={file}
              onValueChange={(val) => {
                setFile(val as ConfigFileKey)
                setPending(null)
              }}
              className="w-auto min-w-[210px] max-w-full bg-[var(--bg-surface)] font-mono text-xs"
              options={ALL_CONFIG_FILES.map((key) => {
                const keyIssues = issues.filter((i) => i.file === key && i.severity === 'error').length
                const suffix =
                  (modified.includes(key) ? t(' · 已修改', ' · Modified') : '') +
                  (keyIssues > 0 ? t(' · 有错误', ' · Error') : '')
                return {
                  value: key,
                  label: `${key}${suffix}`,
                }
              })}
            />
            <span className="text-xs text-[var(--text-muted)]">
              {totalItemsCount > 0
                ? distinctStepsCount > 1
                  ? t('共 {v0} 项改动 · 分 {v1} 次修改（序号越大越新）', '{v0} change(s) across {v1} edits (# high to low)', { v0: totalItemsCount, v1: distinctStepsCount })
                  : totalItemsCount > 1
                    ? t('共 {v0} 项改动（序号越大越新）', '{v0} changes (# high to low)', { v0: totalItemsCount })
                    : t('共 {v0} 项改动', '{v0} change', { v0: totalItemsCount })
                : t('{v0} 个文件有改动', '{v0} modified file(s)', { v0: modified.length })}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasCustomBaseline && (
              <div className="inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setCompareMode('defaults')
                    setPending(null)
                  }}
                  className={cn(
                    'rounded-md px-2 py-1 font-medium cursor-pointer',
                    compareMode === 'defaults'
                      ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] shadow-[var(--shadow-xs)]'
                      : 'text-[var(--text-muted)]',
                  )}
                >
                  {t('对比官方默认', 'vs Default')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCompareMode('baseline')
                    setPending(null)
                  }}
                  className={cn(
                    'rounded-md px-2 py-1 font-medium cursor-pointer',
                    compareMode === 'baseline'
                      ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] shadow-[var(--shadow-xs)]'
                      : 'text-[var(--text-muted)]',
                  )}
                >
                  {t('对比刚导入的文件', 'vs Imported')}
                </button>
              </div>
            )}
            {fileCanUndo && (
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  setPending(null)
                  undoFile(file)
                }}
                title={t('按时间从新到旧撤回 {v0} 最近一次修改（共可撤回 {v1} 次）', 'Undo most recent edit in {v0} ({v1} step(s) available)', { v0: file, v1: fileUndoCount })}
              >
                <Undo2 size={13} />
                <span>{t('撤回最近一次', 'Undo latest')}</span>
                <span className="rounded-full bg-[var(--brand-soft)] px-1.5 py-0.2 font-mono text-[11px] font-semibold leading-tight tabular-nums text-[var(--brand-primary)]">
                  {fileUndoCount}
                </span>
              </Button>
            )}
            <InlineRestorePopover
              open={pending?.scope === 'file'}
              onOpenChange={(open) => setPending(open ? { scope: 'file' } : null)}
              prompt={fileRestorePrompt}
              onConfirm={confirm}
            >
              <Button size="xs" variant="outline" disabled={!diff}>
                <RotateCcw size={13} />
                <span>{t('恢复此文件', 'Restore file')}</span>
              </Button>
            </InlineRestorePopover>
          </div>
        </div>

        {/* Health Issues Linked to This File (Helps users spot "where I broke it") */}
        {fileIssues.length > 0 && (
          <div className="space-y-2">
            {fileIssues.map((iss) => (
              <Callout
                key={iss.id}
                tone={iss.severity === 'error' ? 'danger' : 'warning'}
                icon={
                  iss.severity === 'error' ? (
                    <ShieldAlert className="h-4 w-4 text-red-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )
                }
                title={t(iss.titleZh, iss.titleEn)}
                action={
                  <div className="flex items-center gap-1.5">
                    {iss.fixKey && (
                      <Button size="xs" variant="outline" onClick={() => applyQuickFix(iss.fixKey!)}>
                        <Wrench className="h-3 w-3" />
                        <span>{t(iss.fixLabelZh!, iss.fixLabelEn!)}</span>
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        onClose()
                        focusVisual(iss.section)
                      }}
                    >
                      {t('去修改', 'Inspect')}
                    </Button>
                  </div>
                }
              >
                {t(iss.descZh, iss.descEn)}
              </Callout>
            ))}
          </div>
        )}

        {!diff ? (
          <p className="rounded-xl bg-[var(--bg-subtle)] p-4 text-sm text-[var(--text-secondary)]">
            {compareMode === 'baseline' && hasCustomBaseline
              ? t('这个文件自导入后还没有做新改动。', 'No new edits made since importing this file.')
              : t('这个文件还没有改动过，和官方默认设置一样。', 'This file matches the official default settings.')}
          </p>
        ) : diff.type === 'invalid' ? (
          <Callout
            tone="warning"
            action={
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  onClose()
                  jumpToSource(file, diff.line)
                }}
              >
                {t('打开源码修正', 'Fix in source')}
              </Button>
            }
          >
            {t('YAML 语法有误{v0}。可直接点击右上角「恢复此文件」回到初始配置，或打开源码修正后逐项查看。', 'Invalid YAML{v1}. Restore the file or fix the syntax in source to inspect individual fields.', { v0: diff.line ? `（第 ${diff.line} 行）` : '', v1: diff.line ? ` on line ${diff.line}` : '' })}
          </Callout>
        ) : diff.type === 'yaml' ? (
          yamlEntries.length ? (
            <ul className="m-0 list-none space-y-2.5 p-0">
              {yamlEntries.map((entry, idx) => {
                const { item, stamp, seqNum, sameStepCount } = entry
                const rowId = JSON.stringify([item.path, item.kind, Boolean(item.isReorder)])
                return (
                  <ChangeRow
                    key={rowId}
                    seqNum={seqNum}
                    isTopRow={idx === 0}
                    timeText={stamp.at > 0 ? formatEditTime(stamp.at, now, lang) : t('已有改动', 'Existing change')}
                    sameStepCount={sameStepCount}
                    title={item.title}
                    codeLabel={formatFieldPath(item.path) || file}
                    effect={item.effect}
                    kind={item.kind}
                    before={item.beforeDisplay ?? item.before}
                    after={item.afterDisplay ?? item.after}
                    confirmOpen={pending?.scope === 'field' && pending.id === rowId}
                    onConfirmOpenChange={(open) =>
                      setPending(open ? { scope: 'field', id: rowId, item, raw: current } : null)
                    }
                    onConfirmRestore={confirm}
                    onLocate={() => locateField(item)}
                  />
                )
              })}
            </ul>
          ) : (
            <p className="rounded-xl bg-[var(--bg-subtle)] p-4 text-sm text-[var(--text-secondary)]">
              {t(
                '所有实际生效的配置值都没变，只是文件中的注释、空格或换行有调整。',
                'Effective settings are unchanged; only comments, whitespace, or line breaks were adjusted.',
              )}
            </p>
          )
        ) : (
          <ul className="m-0 list-none space-y-2.5 p-0">
            {textEntries.map((entry, idx) => {
              const { item, stamp, seqNum, sameStepCount } = entry
              const rowId = `${item.oldStart}/${item.newStart}`
              const lines = item.kind === 'removed' ? item.removed : item.added
              const from = (item.kind === 'removed' ? item.oldStart : item.newStart) + 1
              const pos = lines > 1 ? `${from}–${from + lines - 1}` : String(from)
              const label =
                item.kind === 'removed'
                  ? t('原内容第 {v0} 行', 'Original line {v0}', { v0: pos })
                  : t('当前第 {v0} 行', 'Current line {v0}', { v0: pos })
              return (
                <ChangeRow
                  key={rowId}
                  seqNum={seqNum}
                  isTopRow={idx === 0}
                  timeText={stamp.at > 0 ? formatEditTime(stamp.at, now, lang) : t('已有改动', 'Existing change')}
                  sameStepCount={sameStepCount}
                  codeLabel={label}
                  effect={item.effect}
                  kind={item.kind}
                  before={item.removed ? item.before.join('\n') : undefined}
                  after={item.added ? item.after.join('\n') : undefined}
                  confirmOpen={pending?.scope === 'text' && pending.id === rowId}
                  onConfirmOpenChange={(open) =>
                    setPending(open ? { scope: 'text', id: rowId, item, raw: current } : null)
                  }
                  onConfirmRestore={confirm}
                  onLocate={() => locateText(item)}
                />
              )
            })}
          </ul>
        )}
      </div>
    </ModalDialog>
  )
}
