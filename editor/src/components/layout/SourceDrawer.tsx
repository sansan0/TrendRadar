import { useEffect, useMemo, useRef, useState } from 'react'
import * as FileTabs from '@radix-ui/react-tabs'
import {
  Check,
  ChevronDown,
  Columns2,
  Copy,
  Download,
  FileCode2,
  FileDiff,
  FileText,
  Maximize2,
  Minimize2,
  PanelRightClose,
  Redo2,
  RotateCcw,
  Undo2,
  X,
} from 'lucide-react'
import { Badge, Button, Popover, PopoverPanel, PopoverTrigger } from '@/components/ui/primitives'
import { CodeEditor } from '@/components/shared/CodeEditor'
import { useT } from '@/i18n'
import { ALL_CONFIG_FILES, type ConfigFileKey } from '@/lib/types'
import { isYamlFile } from '@/lib/pro-navigation'
import { getMatchingDefaultFile } from '@/lib/defaults'
import { differsFromTemplate } from '@/lib/config-changes'
import { cn, copyToClipboard, downloadTextFile } from '@/lib/utils'
import { useEditor } from '@/store/editor-store'

interface DiffRow {
  type: 'same' | 'added' | 'removed'
  lineOld?: number
  lineNew?: number
  text: string
}

function computeSimpleLineDiff(oldText: string, newText: string): DiffRow[] {
  const a = oldText.replace(/\r\n/g, '\n').split('\n')
  const b = newText.replace(/\r\n/g, '\n').split('\n')
  const rows: DiffRow[] = []

  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      rows.push({ type: 'same', lineOld: i + 1, lineNew: j + 1, text: a[i] })
      i++
      j++
    } else {
      let foundA = -1
      let foundB = -1
      for (let look = 1; look <= 12; look++) {
        if (foundA === -1 && i + look < a.length && j < b.length && a[i + look] === b[j]) {
          foundA = i + look
        }
        if (foundB === -1 && j + look < b.length && i < a.length && b[j + look] === a[i]) {
          foundB = j + look
        }
      }
      if (foundB !== -1 && (foundA === -1 || foundB - j <= foundA - i)) {
        while (j < foundB) {
          rows.push({ type: 'added', lineNew: j + 1, text: b[j] })
          j++
        }
      } else if (foundA !== -1) {
        while (i < foundA) {
          rows.push({ type: 'removed', lineOld: i + 1, text: a[i] })
          i++
        }
      } else {
        if (i < a.length) {
          rows.push({ type: 'removed', lineOld: i + 1, text: a[i] })
          i++
        }
        if (j < b.length) {
          rows.push({ type: 'added', lineNew: j + 1, text: b[j] })
          j++
        }
      }
    }
  }
  return rows
}

interface FileMeta {
  key: ConfigFileKey
  shortLabel: string
  tab: [string, string]
  roleZh: string
  roleEn: string
  primary?: boolean
}

const FILE_METAS: FileMeta[] = [
  { key: 'config.yaml', shortLabel: 'config.yaml', tab: ['主配置', 'Config'], roleZh: '系统主配置', roleEn: 'Main config', primary: true },
  { key: 'frequency_words.txt', shortLabel: 'frequency_words', tab: ['关键词', 'Words'], roleZh: '关键词筛选规则', roleEn: 'Keyword rules', primary: true },
  { key: 'search_queries.txt', shortLabel: 'search_queries', tab: ['搜索词', 'Search'], roleZh: '联网搜索任务', roleEn: 'Web search topics', primary: true },
  { key: 'timeline.yaml', shortLabel: 'timeline.yaml', tab: ['时间线', 'Timing'], roleZh: '7×24h 时间线调度', roleEn: 'Schedule timeline', primary: true },
  { key: 'ai_interests.txt', shortLabel: 'ai_interests', tab: ['兴趣', 'Interests'], roleZh: 'AI 智能筛选兴趣', roleEn: 'AI filter interests' },
  { key: 'ai_analysis_prompt.txt', shortLabel: 'analysis_prompt', tab: ['分析 Prompt', 'Analysis'], roleZh: 'AI 分析提示词', roleEn: 'AI analysis prompt' },
  { key: 'ai_translation_prompt.txt', shortLabel: 'translation_prompt', tab: ['翻译 Prompt', 'Translate'], roleZh: 'AI 翻译提示词', roleEn: 'AI translation prompt' },
]

const PRIMARY_FILES = FILE_METAS.filter((f) => f.primary)
const EXTRA_AI_FILES = FILE_METAS.filter((f) => !f.primary)

const fileTabClass = 'tr-focus-ring relative inline-flex h-7 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs transition-colors cursor-pointer'
const currentTabClass = 'bg-[var(--bg-surface)] font-semibold text-[var(--brand-primary)] shadow-[inset_0_0_0_1px_var(--brand-border),var(--shadow-xs)]'
const idleTabClass = 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]/80 hover:text-[var(--text-primary)]'
const toolbarActionClass = 'h-7 w-7 gap-1 px-0 @md/source:w-auto @md/source:px-2'

const STORAGE_SOURCE_DRAWER_WIDTH = 'tr_editor_source_drawer_width'
const DEFAULT_DRAWER_WIDTH = 640

function readInitialDrawerWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_SOURCE_DRAWER_WIDTH)
    const num = raw ? Number(raw) : NaN
    if (Number.isFinite(num) && num >= 360 && num <= 1600) return num
  } catch {}
  return DEFAULT_DRAWER_WIDTH
}

export function SourcePanel({
  embedded = false,
  isFullscreen = false,
  onToggleFullscreen,
  onExitFullscreen,
}: {
  embedded?: boolean
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  onExitFullscreen?: () => void
}) {
  const {
    files,
    baselineFiles,
    templateLang,
    dirtyFiles,
    activeSourceFile,
    setActiveSourceFile,
    selectProFile,
    trackSourcePosition,
    syncProScrollLine,
    sourceViewMode,
    setSourceViewMode,
    sourceJumpLine,
    sourceFlash,
    setFileContent,
    setChangesRequest,
    theme,
    configError,
    timelineError,
    canUndoFile,
    canRedoFile,
    undoFile,
    redoFile,
    notify,
  } = useEditor()
  const t = useT()

  const [showDiff, setShowDiff] = useState(false)
  const [copied, setCopied] = useState(false)
  const [aiMenuOpen, setAiMenuOpen] = useState(false)

  const currentContent = files[activeSourceFile]
  const baselineContent = baselineFiles[activeSourceFile]
  const isYaml = isYamlFile(activeSourceFile)
  const isDirty = dirtyFiles.includes(activeSourceFile)
  const activeMeta = FILE_METAS.find((f) => f.key === activeSourceFile) ?? FILE_METAS[0]
  const activeIsExtra = EXTRA_AI_FILES.some((f) => f.key === activeSourceFile)
  const activeTab = activeIsExtra ? 'ai-files' : activeSourceFile
  const extraModifiedCount = EXTRA_AI_FILES.filter((f) => dirtyFiles.includes(f.key)).length

  const activeError =
    activeSourceFile === 'config.yaml'
      ? configError
      : activeSourceFile === 'timeline.yaml'
        ? timelineError
        : null

  const jumpSeq = sourceJumpLine?.seq
  useEffect(() => {
    if (embedded && jumpSeq !== undefined) setShowDiff(false)
  }, [embedded, jumpSeq])

  useEffect(() => {
    if (!isDirty && showDiff) setShowDiff(false)
  }, [isDirty, showDiff])

  const activeFileFlash = sourceFlash?.file === activeSourceFile ? sourceFlash : null
  const [flashBadgeLine, setFlashBadgeLine] = useState<number | null>(null)
  useEffect(() => {
    if (!activeFileFlash) return
    setFlashBadgeLine(activeFileFlash.startLine)
    const timer = window.setTimeout(() => setFlashBadgeLine(null), 2400)
    return () => window.clearTimeout(timer)
  }, [activeFileFlash?.seq, activeFileFlash?.startLine])

  const canUndoActive = canUndoFile(activeSourceFile)
  const canRedoActive = canRedoFile(activeSourceFile)
  const canRestoreDefault = differsFromTemplate(
    getMatchingDefaultFile(activeSourceFile, currentContent, templateLang),
    currentContent,
  )

  const diffRows = useMemo(() => {
    if (!showDiff) return []
    return computeSimpleLineDiff(baselineContent, currentContent)
  }, [showDiff, baselineContent, currentContent])

  const changedCount = useMemo(
    () => diffRows.filter((r) => r.type !== 'same').length,
    [diffRows],
  )

  const handleSelectFile = (key: ConfigFileKey) => {
    if (embedded) selectProFile(key)
    else setActiveSourceFile(key)
    setAiMenuOpen(false)
  }

  const handleCopy = async () => {
    const ok = await copyToClipboard(currentContent)
    if (ok) {
      setCopied(true)
      notify(t('已复制 {v0}', 'Copied {v0}', { v0: activeSourceFile }), 'success')
      setTimeout(() => setCopied(false), 1600)
    }
  }

  const ActiveIcon = isYaml ? FileCode2 : FileText

  return (
    <FileTabs.Root
      value={activeTab}
      activationMode="manual"
      className={embedded ? 'pro-source-pane' : 'flex h-full min-h-0 min-w-0 flex-col bg-[var(--bg-surface)]'}
    >
      {/* Row 1: Clean Single-Row Source Status + Actions (No duplicate file dropdown) */}
      <div className="pro-source-toolbar @container/source flex h-10 min-w-0 shrink-0 items-center justify-between gap-2 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3">
        <div className="flex min-w-0 items-center gap-2">
          <ActiveIcon className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" />
          <code className="truncate font-mono text-xs font-semibold text-[var(--text-primary)]" title={`config/${activeSourceFile}`}>
            <span className="hidden text-[var(--text-muted)] @sm/source:inline">config/</span>
            {activeSourceFile}
          </code>
          <span className="hidden truncate text-xs text-[var(--text-muted)] @lg/source:inline">
            · {t(activeMeta.roleZh, activeMeta.roleEn)}
          </span>
          {embedded && flashBadgeLine !== null && (
            <span className="hidden whitespace-nowrap rounded-md border border-teal-500/40 bg-teal-500/12 px-2 py-0.5 text-[11px] font-semibold text-teal-700 transition-colors dark:text-teal-300 @sm/source:inline">
              {t('已同步', 'Synced')}
            </span>
          )}
          {isDirty && (
            <Badge tone="brand" className="hidden @md/source:inline-flex">
              {t('已修改', 'Edited')}
            </Badge>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {canUndoActive && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => undoFile(activeSourceFile)}
              title={t('撤销', 'Undo')}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {canRedoActive && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => redoFile(activeSourceFile)}
              title={t('重做', 'Redo')}
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {(isDirty || showDiff) && (
            <Button
              variant={showDiff ? 'secondary' : 'ghost'}
              size="xs"
              className={toolbarActionClass}
              onClick={() => setShowDiff((d) => !d)}
              title={t(showDiff ? '返回编辑配置文件' : '查看改动了什么', showDiff ? 'Back to editing' : 'See what changed')}
            >
              <FileDiff className="h-3.5 w-3.5" />
              <span className="sr-only @md/source:not-sr-only">
                {showDiff ? t('返回编辑', 'Edit') : t('看改动', 'Changes')}
              </span>
            </Button>
          )}
          {!embedded && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="hidden h-7 w-7 xl:inline-flex"
                onClick={() => {
                  onExitFullscreen?.()
                  setSourceViewMode(sourceViewMode === 'split' && !isFullscreen ? 'drawer' : 'split')
                }}
                title={
                  sourceViewMode === 'split' && !isFullscreen
                    ? t('改为右侧悬浮窗', 'Switch to floating panel')
                    : t('并排固定在右侧，边看配置边改表单', 'Pin side-by-side on the right')
                }
              >
                {sourceViewMode === 'split' && !isFullscreen ? (
                  <PanelRightClose className="h-3.5 w-3.5" />
                ) : (
                  <Columns2 className="h-3.5 w-3.5" />
                )}
              </Button>
              {onToggleFullscreen && (
                <Button
                  variant={isFullscreen ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={onToggleFullscreen}
                  aria-label={isFullscreen ? t('退出全屏', 'Exit full screen') : t('全屏查看', 'Full screen')}
                  title={
                    isFullscreen
                      ? t('退出全屏，恢复右侧窗口宽度 (Esc)', 'Exit full screen (Esc)')
                      : t('全屏查看（占满整个浏览器屏幕）', 'Expand to fill the browser screen')
                  }
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  onExitFullscreen?.()
                  setSourceViewMode('closed')
                }}
                title={t('关闭配置文件窗口', 'Close file panel')}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Row 2: Horizontally Scrollable Single-Row File Tabs (Never truncates or wraps on narrow split) */}
      <FileTabs.List
        className="pro-source-files @container/source no-scrollbar flex h-9 min-w-0 shrink-0 flex-nowrap items-center gap-1 overflow-x-auto border-b border-[var(--border-default)] bg-[var(--bg-subtle)]/70 px-2"
        aria-label={t('配置文件标签页', 'Config file tabs')}
      >
        {PRIMARY_FILES.map((meta) => {
          const active = meta.key === activeSourceFile
          const modified = dirtyFiles.includes(meta.key)
          const Icon = meta.key.endsWith('.yaml') ? FileCode2 : FileText
          return (
            <FileTabs.Trigger
              key={meta.key}
              value={meta.key}
              aria-label={meta.key}
              onClick={() => handleSelectFile(meta.key)}
              onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault()
                  handleSelectFile(meta.key)
                }
              }}
              title={`config/${meta.key} — ${t(meta.roleZh, meta.roleEn)}`}
              className={cn(fileTabClass, active ? currentTabClass : idleTabClass)}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-75" />
              <span className="@min-[42rem]/source:hidden">{t(...meta.tab)}</span>
              <span className="hidden font-mono @min-[42rem]/source:inline">{meta.shortLabel}</span>
              {modified && (
                <span className="rounded bg-[var(--brand-primary)] px-1 py-0.5 font-sans text-[10px] font-semibold leading-none text-white">
                  {t('已改', 'Edited')}
                </span>
              )}
            </FileTabs.Trigger>
          )
        })}

        <Popover open={aiMenuOpen} onOpenChange={setAiMenuOpen}>
          <FileTabs.Trigger value="ai-files" asChild>
            <PopoverTrigger
              className={cn(fileTabClass, activeIsExtra ? currentTabClass : idleTabClass)}
              aria-label={t('切换 AI 兴趣与提示词文件', 'Switch AI interests and prompt files') + (activeIsExtra ? ' · ' + activeSourceFile : '')}
              title={activeIsExtra ? 'config/' + activeSourceFile : t('AI 兴趣与提示词', 'AI interests and prompts')}
              onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault()
                  setAiMenuOpen((open) => !open)
                }
              }}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 opacity-75" />
              <span>{activeIsExtra ? t(...activeMeta.tab) : t('AI 文本', 'AI Files')}</span>
              {extraModifiedCount > 0 && (
                <span className="rounded bg-[var(--brand-primary)] px-1 py-0.5 font-sans text-[10px] font-semibold leading-none text-white">
                  {t('已改 {v0}', '{v0} edited', { v0: extraModifiedCount })}
                </span>
              )}
              <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
            </PopoverTrigger>
          </FileTabs.Trigger>
          <PopoverPanel align="end" className="max-h-[var(--radix-popover-content-available-height)] w-[min(18rem,calc(100vw-1rem))] overflow-y-auto p-1.5">
            <div className="px-2.5 pb-1 pt-1 text-xs font-semibold text-[var(--text-muted)]">
              {t('AI 兴趣与提示词文件', 'AI Interests & Prompts')}
            </div>
            {EXTRA_AI_FILES.map((meta) => {
              const selected = meta.key === activeSourceFile
              const modified = dirtyFiles.includes(meta.key)
              return (
                <button
                  key={meta.key}
                  type="button"
                  title={'config/' + meta.key}
                  onClick={() => handleSelectFile(meta.key)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer',
                    selected
                      ? 'bg-[var(--brand-soft)] text-[var(--brand-primary)]'
                      : 'text-[var(--text-primary)] hover:bg-[var(--bg-muted)]',
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs font-semibold">{meta.key}</div>
                    <div className="truncate text-xs text-[var(--text-muted)]">
                      {t(meta.roleZh, meta.roleEn)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {modified && (
                      <span className="rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[var(--brand-primary)]">
                        {t('已修改', 'Edited')}
                      </span>
                    )}
                    {selected && <Check className="h-3.5 w-3.5 text-[var(--brand-primary)]" />}
                  </div>
                </button>
              )
            })}
          </PopoverPanel>
        </Popover>
      </FileTabs.List>

      <div className="pro-source-body flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg-surface)]">
        {activeError && (
          <div className="max-h-24 shrink-0 overflow-auto break-words border-b border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            <strong>{t('YAML 语法错误', 'YAML Syntax Error')}</strong>
            {activeError.line ? t('（第 {v0} 行）', ' (Line {v0})', { v0: activeError.line }) : ''}:{' '}
            {activeError.message === '配置文件最外层必须是键值映射（mapping）。'
              ? t('配置文件最外层必须是键值映射（mapping）。', 'Top-level YAML value must be a key-value mapping.')
              : activeError.message}
          </div>
        )}

        {/* Editor or Diff Area */}
        <FileTabs.Content value={activeTab} tabIndex={-1} className="min-h-0 min-w-0 flex-1 p-2.5">
          {showDiff ? (
            <div className="h-full overflow-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] font-mono text-xs leading-6">
              {changedCount === 0 ? (
                <div className="flex h-full items-center justify-center p-6 text-[13px] font-sans text-[var(--text-muted)]">
                  {t('这个文件还没有改动过，和默认内容一致。', 'Nothing has changed in this file yet.')}
                </div>
              ) : (
                diffRows
                  .filter((r, idx, arr) => {
                    if (r.type !== 'same') return true
                    for (let k = Math.max(0, idx - 2); k <= Math.min(arr.length - 1, idx + 2); k++) {
                      if (arr[k].type !== 'same') return true
                    }
                    return false
                  })
                  .map((row, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex gap-2 px-2.5 whitespace-pre-wrap break-all',
                        row.type === 'added' && 'bg-teal-500/12 text-teal-800 dark:text-teal-200',
                        row.type === 'removed' && 'bg-red-500/12 text-red-800 dark:text-red-200 line-through opacity-80',
                        row.type === 'same' && 'text-[var(--text-muted)]',
                      )}
                    >
                      <span className="w-8 shrink-0 select-none text-right opacity-50">
                        {row.lineOld ?? ''}
                      </span>
                      <span className="w-8 shrink-0 select-none text-right opacity-50">
                        {row.lineNew ?? ''}
                      </span>
                      <span className="w-3 shrink-0 select-none font-bold">
                        {row.type === 'added' ? '+' : row.type === 'removed' ? '-' : ' '}
                      </span>
                      <span className="flex-1">{row.text || ' '}</span>
                    </div>
                  ))
              )}
            </div>
          ) : (
            <CodeEditor
              key={activeSourceFile}
              value={currentContent}
              onChange={(val) => setFileContent(activeSourceFile, val, 'source')}
              editorHistory={{
                undo: () => undoFile(activeSourceFile),
                redo: () => redoFile(activeSourceFile),
              }}
              onSourcePosition={embedded ? (line, column) => trackSourcePosition(activeSourceFile, line, column) : undefined}
              onScrollLine={embedded ? (line) => syncProScrollLine(activeSourceFile, line) : undefined}
              language={isYaml ? 'yaml' : 'text'}
              theme={theme}
              jumpToLine={sourceJumpLine}
              flashLines={activeFileFlash}
            />
          )}
        </FileTabs.Content>

        {/* Footer Actions */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--border-default)] bg-[var(--bg-subtle)]/50 px-3 py-2">
          {canRestoreDefault ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setChangesRequest({ file: activeSourceFile, restoreFile: true })}
              title={t('把这个文件恢复成初始默认内容', 'Restore this file to its default content')}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t('恢复默认内容', 'Restore Default')}</span>
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="xs" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 text-teal-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? t('已复制', 'Copied') : t('复制', 'Copy')}</span>
            </Button>
            <Button
              variant="primary"
              size="xs"
              onClick={() => {
                downloadTextFile(activeSourceFile, currentContent)
                notify(t('已下载 {v0}', 'Downloaded {v0}', { v0: activeSourceFile }), 'success')
              }}
            >
              <Download className="h-3.5 w-3.5" />
              <span>{t('下载单文件', 'Download')}</span>
            </Button>
          </div>
        </div>
      </div>
    </FileTabs.Root>
  )
}

export function SourceDrawer() {
  const { sourceViewMode, setSourceViewMode, workspaceMode } = useEditor()
  const t = useT()
  const [canDock, setCanDock] = useState(() => window.matchMedia('(min-width: 80rem)').matches)
  const [drawerWidth, setDrawerWidth] = useState<number>(readInitialDrawerWidth)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const panelRef = useRef<HTMLElement | null>(null)
  const dragStartRef = useRef<{ startX: number; startWidth: number }>({ startX: 0, startWidth: DEFAULT_DRAWER_WIDTH })

  useEffect(() => {
    const query = window.matchMedia('(min-width: 80rem)')
    const update = () => setCanDock(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (sourceViewMode === 'closed') {
      setIsFullscreen(false)
    }
  }, [sourceViewMode])

  useEffect(() => {
    if (workspaceMode === 'pro' || sourceViewMode === 'closed') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('[data-radix-popper-content-wrapper]')) return
      if (isFullscreen) {
        e.preventDefault()
        setIsFullscreen(false)
      } else if (sourceViewMode === 'drawer' || !canDock) {
        e.preventDefault()
        setSourceViewMode('closed')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [workspaceMode, sourceViewMode, isFullscreen, canDock, setSourceViewMode])

  useEffect(() => {
    if (!dragging) return
    const isDockedSplit = sourceViewMode === 'split' && canDock && !isFullscreen
    const onMove = (e: MouseEvent) => {
      const minRightReserve = isDockedSplit ? 420 : 48
      const maxAllowed = Math.max(380, window.innerWidth - minRightReserve)
      const delta = dragStartRef.current.startX - e.clientX
      const next = Math.round(Math.max(360, Math.min(maxAllowed, dragStartRef.current.startWidth + delta)))
      setDrawerWidth(next)
      try {
        localStorage.setItem(STORAGE_SOURCE_DRAWER_WIDTH, String(next))
      } catch {}
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [dragging, sourceViewMode, canDock, isFullscreen])

  if (workspaceMode === 'pro' || sourceViewMode === 'closed') return null

  const startResize = (clientX: number) => {
    const currentW = panelRef.current?.getBoundingClientRect().width ?? drawerWidth
    dragStartRef.current = { startX: clientX, startWidth: currentW }
    setDragging(true)
  }

  const resetWidth = () => {
    setDrawerWidth(DEFAULT_DRAWER_WIDTH)
    try {
      localStorage.setItem(STORAGE_SOURCE_DRAWER_WIDTH, String(DEFAULT_DRAWER_WIDTH))
    } catch {}
  }

  const resizeHandle = !isFullscreen && (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t('拖动左边缘调整窗口宽度（双击恢复默认宽度）', 'Drag left edge to resize width (double-click to reset)')}
      title={t('左右拖动调整宽度 · 双击恢复默认', 'Drag to resize · Double-click to reset')}
      onMouseDown={(e) => {
        e.preventDefault()
        startResize(e.clientX)
      }}
      onDoubleClick={resetWidth}
      className={cn(
        'group absolute inset-y-0 -left-1 z-30 hidden w-2.5 cursor-col-resize items-center justify-center sm:flex',
      )}
    >
      <div
        className={cn(
          'h-full w-[2px] transition-colors group-hover:bg-[var(--brand-primary)]/60',
          dragging ? 'bg-[var(--brand-primary)]' : 'bg-transparent',
        )}
      />
      <div
        className={cn(
          'pointer-events-none absolute h-10 w-1 rounded-full transition-opacity',
          dragging
            ? 'bg-[var(--brand-primary)] opacity-100'
            : 'bg-[var(--border-strong)] opacity-0 group-hover:opacity-100',
        )}
      />
    </div>
  )

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[1300] flex bg-[var(--bg-surface)]">
        <section ref={panelRef} className="relative h-full w-full">
          <SourcePanel
            isFullscreen
            onToggleFullscreen={() => setIsFullscreen(false)}
            onExitFullscreen={() => setIsFullscreen(false)}
          />
        </section>
      </div>
    )
  }

  if (sourceViewMode === 'split' && canDock) {
    return (
      <section
        ref={panelRef}
        style={{ width: `min(${drawerWidth}px, calc(100vw - 420px))` }}
        className="relative hidden xl:block h-full min-w-[360px] shrink-0 border-l border-[var(--border-default)]"
      >
        {resizeHandle}
        <SourcePanel
          isFullscreen={false}
          onToggleFullscreen={() => setIsFullscreen(true)}
          onExitFullscreen={() => setIsFullscreen(false)}
        />
      </section>
    )
  }

  return (
    <div className="fixed inset-0 z-[1250] flex justify-end">
      <div
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
        onClick={() => setSourceViewMode('closed')}
      />
      <section
        ref={panelRef}
        style={{ width: `min(100vw, ${drawerWidth}px)` }}
        className="relative z-10 h-full max-w-full border-l border-[var(--border-default)] shadow-[var(--shadow-popover)]"
      >
        {resizeHandle}
        <SourcePanel
          isFullscreen={false}
          onToggleFullscreen={() => setIsFullscreen(true)}
          onExitFullscreen={() => setIsFullscreen(false)}
        />
      </section>
    </div>
  )
}

export { ALL_CONFIG_FILES }
