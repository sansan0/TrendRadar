import { useMemo, useRef, useState } from 'react'
import {
  Archive,
  BookmarkPlus,
  Check,
  Clock,
  Download,
  FileDiff,
  FileText,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { Badge, Button, Input, ModalDialog } from '@/components/ui/primitives'
import { LANGUAGE_META, useT } from '@/i18n'
import { buildConfigZipBlob } from '@/lib/exporter'
import { ALL_CONFIG_FILES, type ConfigFileKey, type Lang } from '@/lib/types'
import { cn, downloadBlobFile, downloadTextFile } from '@/lib/utils'
import { useEditor } from '@/store/editor-store'

interface DiffLine {
  kind: 'same' | 'added' | 'removed'
  lineOld?: number
  lineNew?: number
  text: string
}

function buildLineDiff(baseText: string, compareText: string): DiffLine[] {
  const a = baseText.replace(/\r\n/g, '\n').split('\n')
  const b = compareText.replace(/\r\n/g, '\n').split('\n')
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push({ kind: 'same', lineOld: i + 1, lineNew: j + 1, text: a[i] })
      i++
      j++
    } else {
      let matchA = -1
      let matchB = -1
      for (let look = 1; look <= 10; look++) {
        if (matchA === -1 && i + look < a.length && j < b.length && a[i + look] === b[j]) {
          matchA = i + look
        }
        if (matchB === -1 && j + look < b.length && i < a.length && b[j + look] === a[i]) {
          matchB = j + look
        }
      }
      if (matchB !== -1 && (matchA === -1 || matchB - j <= matchA - i)) {
        while (j < matchB) {
          out.push({ kind: 'added', lineNew: j + 1, text: b[j] })
          j++
        }
      } else if (matchA !== -1) {
        while (i < matchA) {
          out.push({ kind: 'removed', lineOld: i + 1, text: a[i] })
          i++
        }
      } else {
        if (i < a.length) {
          out.push({ kind: 'removed', lineOld: i + 1, text: a[i] })
          i++
        }
        if (j < b.length) {
          out.push({ kind: 'added', lineNew: j + 1, text: b[j] })
          j++
        }
      }
    }
  }
  return out
}

function formatDateTime(ts: number, lang: Lang): string {
  try {
    return new Intl.DateTimeFormat(LANGUAGE_META[lang].intlLocale, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(ts))
  } catch {
    return new Date(ts).toLocaleString()
  }
}

export function VersionsDialog() {
  const {
    versionsOpen,
    setVersionsOpen,
    snapshots,
    activeSnapshotId,
    files,
    saveSnapshot,
    overwriteSnapshot,
    loadSnapshot,
    renameSnapshot,
    deleteSnapshot,
    importSnapshotsJson,
    lang,
    notify,
  } = useEditor()
  const t = useT()

  const [newName, setNewName] = useState('')
  const [newNote, setNewNote] = useState('')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<ConfigFileKey>('config.yaml')
  const [viewMode, setViewMode] = useState<'content' | 'diff'>('content')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const filteredSnapshots = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return snapshots
    return snapshots.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.note.toLowerCase().includes(q) ||
        s.summary.schedulePreset.toLowerCase().includes(q),
    )
  }, [search, snapshots])

  const effectiveSelected = useMemo(() => {
    if (selectedId) {
      const found = snapshots.find((s) => s.id === selectedId)
      if (found) return found
    }
    return filteredSnapshots[0] ?? snapshots[0] ?? null
  }, [filteredSnapshots, selectedId, snapshots])

  const diffFilesCount = useMemo(() => {
    if (!effectiveSelected) return 0
    return ALL_CONFIG_FILES.filter((k) => effectiveSelected.files[k] !== files[k]).length
  }, [effectiveSelected, files])

  const previewDiff = useMemo(() => {
    if (!effectiveSelected || viewMode !== 'diff') return []
    return buildLineDiff(files[previewFile], effectiveSelected.files[previewFile])
  }, [effectiveSelected, files, previewFile, viewMode])

  const handleSaveNew = () => {
    const fallbackName = t(
      '版本 {num} ({time})',
      'Version {num} ({time})',
      { num: snapshots.length + 1, time: formatDateTime(Date.now(), lang) },
    )
    const created = saveSnapshot(newName.trim() || fallbackName, newNote)
    setSelectedId(created.id)
    setNewName('')
    setNewNote('')
  }

  const handleExportAllJson = () => {
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        app: 'TrendRadar Config Studio',
        snapshots,
      },
      null,
      2,
    )
    downloadTextFile('trendradar-saved-versions.json', payload, 'application/json;charset=utf-8')
    notify(t('已备份导出 {v0} 个版本', 'Backed up {v0} version(s)', { v0: snapshots.length }), 'success')
  }

  const handleImportJsonFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await file.text()
      const count = importSnapshotsJson(text)
      if (count === 0) {
        notify(t('文件中未找到有效配置版本', 'No valid versions found in file'), 'warning')
      }
    } catch {
      notify(t('无法解析版本备份 JSON 文件', 'Failed to parse backup JSON'), 'danger')
    }
  }

  return (
    <ModalDialog
      open={versionsOpen}
      onOpenChange={setVersionsOpen}
      title={t('保存配置', 'Saved Configs')}
      description={t(
        '仅保存在当前浏览器本地，不会上传服务器；可存多套方案随时切换。',
        'Saved locally in your browser and never uploaded; keep multiple setups to switch anytime.',
      )}
      maxWidthClass="max-w-5xl"
    >
      <div className="space-y-4">
        {/* Save Current Workspace Bar */}
        <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-soft)]/50 p-4">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1.2fr_1.4fr_auto]">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNew()
              }}
              placeholder={t('起个名字（如：日常版、AI 深度版，可留空）', 'Setup name (e.g. Daily, AI Deep — optional)')}
              className="bg-[var(--bg-surface)]"
            />
            <Input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNew()
              }}
              placeholder={t('备注（可选）', 'Optional note')}
              className="bg-[var(--bg-surface)]"
            />
            <Button variant="primary" size="md" onClick={handleSaveNew} className="shrink-0">
              <Save className="h-4 w-4" />
              <span>{t('保存', 'Save')}</span>
            </Button>
          </div>
        </div>

        {/* Main Split Version Browser */}
        {snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]/40 py-12 text-center px-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-muted)]">
              <Save className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="text-[15px] font-semibold text-[var(--text-primary)]">
                {t('还没有手动保存过配置', 'No saved setups yet')}
              </div>
              <p className="text-[13px] text-[var(--text-muted)] max-w-md">
                {t(
                  '点击上方「保存」即可把当前配置存下来，方便之后随时找回或切换不同方案。',
                  'Click Save above to keep a copy of your current setup and switch anytime.',
                )}
              </p>
            </div>
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{t('导入备份 (.json)', 'Import Backup (.json)')}</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[310px_minmax(0,1fr)]">
            {/* Left: Saved Versions List */}
            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/40 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('搜索 {v0} 个版本...', 'Search {v0} versions...', { v0: snapshots.length })}
                  className="h-9 pl-8 text-xs bg-[var(--bg-surface)]"
                />
              </div>

              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-0.5">
                {filteredSnapshots.map((snap) => {
                  const isSelected = effectiveSelected?.id === snap.id
                  const isCurrent = activeSnapshotId === snap.id
                  const isEditing = editingId === snap.id

                  return (
                    <div
                      key={snap.id}
                      onClick={() => !isEditing && setSelectedId(snap.id)}
                      className={cn(
                        'group group/row rounded-xl border p-3 transition-all cursor-pointer',
                        isSelected
                          ? 'border-[var(--brand-primary)] bg-[var(--bg-surface)] shadow-[var(--shadow-xs)]'
                          : 'border-[var(--border-default)] bg-[var(--bg-surface)]/75 hover:border-[var(--border-strong)]',
                      )}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Input
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                renameSnapshot(snap.id, editingName)
                                setEditingId(null)
                              } else if (e.key === 'Escape') {
                                setEditingId(null)
                              }
                            }}
                            className="h-8 text-xs"
                          />
                          <Button
                            size="icon"
                            variant="primary"
                            className="h-8 w-8 shrink-0"
                            onClick={() => {
                              renameSnapshot(snap.id, editingName)
                              setEditingId(null)
                            }}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                  {snap.name}
                                </span>
                                {isCurrent && <Badge tone="brand">{t('当前', 'Active')}</Badge>}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                                <Clock className="h-3 w-3 shrink-0" />
                                <span>{formatDateTime(snap.updatedAt, lang)}</span>
                              </div>
                            </div>
                            <div
                              className="flex items-center gap-0.5 shrink-0 opacity-75 group-hover:opacity-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(snap.id)
                                  setEditingName(snap.name)
                                }}
                                className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                                title={t('重命名', 'Rename')}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteSnapshot(snap.id)}
                                className="tr-hover-delete rounded-md p-1 text-[var(--text-muted)] hover:bg-red-500/12 hover:text-red-500 cursor-pointer"
                                title={t('删除此版本', 'Delete')}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {snap.note && (
                            <p className="mt-1.5 line-clamp-2 text-xs text-[var(--text-secondary)]">
                              {snap.note}
                            </p>
                          )}

                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            <Badge tone="neutral">
                              {t('{v0} 源', '{v0} src', { v0: snap.summary.enabledSources })}
                            </Badge>
                            <Badge tone="neutral">
                              {snap.summary.filterMethod === 'ai' ? 'AI' : t('关键词', 'KW')}
                            </Badge>
                            <Badge tone={snap.summary.aiEnabled ? 'success' : 'outline'}>
                              {snap.summary.aiEnabled ? t('AI 开', 'AI On') : t('无 AI', 'No AI')}
                            </Badge>
                            {snap.summary.scheduleEnabled && (
                              <Badge tone="outline">{snap.summary.schedulePreset}</Badge>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Backup / Restore Entire Snapshot Library */}
              <div className="flex items-center justify-between gap-2 border-t border-[var(--border-default)] pt-2.5">
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => importInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>{t('导入备份', 'Import')}</span>
                </Button>
                <Button size="xs" variant="ghost" onClick={handleExportAllJson}>
                  <Download className="h-3.5 w-3.5" />
                  <span>{t('导出全部版本', 'Backup JSON')}</span>
                </Button>
              </div>
            </div>

            {/* Right: Non-Destructive Version Inspector & Diff Browser */}
            {effectiveSelected && (
              <div className="flex min-w-0 flex-col justify-between gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
                <div className="space-y-3 min-w-0">
                  {/* Inspector Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-default)] pb-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-[var(--text-primary)] truncate">
                          {effectiveSelected.name}
                        </h3>
                        <Badge tone={diffFilesCount > 0 ? 'warning' : 'success'}>
                          {diffFilesCount > 0
                            ? t('与当前有 {v0} 个文件不同', '{v0} file(s) differ from current', { v0: diffFilesCount })
                            : t('与当前编辑区一致', 'Matches current workspace')}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {effectiveSelected.note ||
                          t('保存于 {v0} · 部署环境：{v1} · 已配 {v2} 个推送渠道', 'Saved {v0} · Runtime: {v1} · {v2} channel(s)', { v0: formatDateTime(effectiveSelected.updatedAt, lang), v1: effectiveSelected.deployMode, v2: effectiveSelected.summary.configuredChannels })}
                      </p>
                    </div>

                    <div className="inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setViewMode('content')}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer',
                          viewMode === 'content'
                            ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] shadow-[var(--shadow-xs)]'
                            : 'text-[var(--text-muted)]',
                        )}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>{t('内容预览', 'Preview')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('diff')}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer',
                          viewMode === 'diff'
                            ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] shadow-[var(--shadow-xs)]'
                            : 'text-[var(--text-muted)]',
                        )}
                      >
                        <FileDiff className="h-3.5 w-3.5" />
                        <span>{t('对比当前差异', 'Diff vs Current')}</span>
                      </button>
                    </div>
                  </div>

                  {/* 7-File Selector Strip */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                    {ALL_CONFIG_FILES.map((fileKey) => {
                      const differs = effectiveSelected.files[fileKey] !== files[fileKey]
                      return (
                        <button
                          key={fileKey}
                          type="button"
                          onClick={() => setPreviewFile(fileKey)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-xs whitespace-nowrap transition-colors cursor-pointer',
                            previewFile === fileKey
                              ? 'bg-[var(--brand-soft)] font-semibold text-[var(--brand-primary)]'
                              : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]',
                          )}
                        >
                          <span>{fileKey}</span>
                          {differs && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                        </button>
                      )
                    })}
                  </div>

                  {/* Code / Diff Preview Area */}
                  <div className="h-[290px] overflow-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3 font-mono text-xs leading-6">
                    {viewMode === 'content' ? (
                      <pre className="m-0 whitespace-pre-wrap break-all text-[var(--text-primary)]">
                        {effectiveSelected.files[previewFile]}
                      </pre>
                    ) : previewDiff.every((r) => r.kind === 'same') ? (
                      <div className="flex h-full items-center justify-center text-[13px] font-sans text-[var(--text-muted)]">
                        {t('该文件与你当前正在编辑的内容完全一致。', 'Identical to your current workspace.')}
                      </div>
                    ) : (
                      previewDiff
                        .filter((r, idx, arr) => {
                          if (r.kind !== 'same') return true
                          for (let k = Math.max(0, idx - 2); k <= Math.min(arr.length - 1, idx + 2); k++) {
                            if (arr[k].kind !== 'same') return true
                          }
                          return false
                        })
                        .map((row, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              'flex gap-2 px-1.5 whitespace-pre-wrap break-all',
                              row.kind === 'added' && 'bg-teal-500/12 text-teal-800 dark:text-teal-200',
                              row.kind === 'removed' && 'bg-red-500/12 text-red-800 dark:text-red-200 line-through opacity-80',
                              row.kind === 'same' && 'text-[var(--text-muted)]',
                            )}
                          >
                            <span className="w-7 shrink-0 select-none text-right opacity-50">
                              {row.lineOld ?? ''}
                            </span>
                            <span className="w-7 shrink-0 select-none text-right opacity-50">
                              {row.lineNew ?? ''}
                            </span>
                            <span className="w-3 shrink-0 select-none font-bold">
                              {row.kind === 'added' ? '+' : row.kind === 'removed' ? '-' : ' '}
                            </span>
                            <span className="flex-1">{row.text || ' '}</span>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Bottom Action Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-default)] pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => overwriteSnapshot(effectiveSelected.id)}
                      title={t('用你当前编辑区的内容覆盖保存到这个版本', 'Overwrite this version with current edits')}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>{t('用当前内容更新', 'Update With Current')}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const blob = buildConfigZipBlob(effectiveSelected.files, {
                          sanitizeSecrets: effectiveSelected.deployMode === 'github_actions',
                          includeDotEnv: false,
                        })
                        downloadBlobFile(`${effectiveSelected.name.replace(/[^\w\u4e00-\u9fa5-]+/g, '_')}.zip`, blob)
                        notify(t('已导出版本「{v0}」压缩包', 'Exported "{v0}" ZIP', { v0: effectiveSelected.name }), 'success')
                      }}
                    >
                      <Archive className="h-3.5 w-3.5" />
                      <span>{t('导出此版本 ZIP', 'Export ZIP')}</span>
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {diffFilesCount > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          loadSnapshot(effectiveSelected.id, true)
                          setVersionsOpen(false)
                        }}
                      >
                        <BookmarkPlus className="h-3.5 w-3.5" />
                        <span>{t('先备份当前再切换', 'Backup & Switch')}</span>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        loadSnapshot(effectiveSelected.id, false)
                        setVersionsOpen(false)
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{t('加载此版本', 'Load Version')}</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <input
          ref={importInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            void handleImportJsonFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
    </ModalDialog>
  )
}
