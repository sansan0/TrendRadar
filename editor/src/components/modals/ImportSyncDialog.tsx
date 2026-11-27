import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  CloudDownload,
  FileUp,
  HelpCircle,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import {
  Badge,
  Button,
  Callout,
  InfoTooltip,
  ModalDialog,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/primitives'
import { LANGUAGE_META, tr, useT } from '@/i18n'
import { BUNDLED_CONFIG_VERSIONS } from '@/lib/defaults'
import {
  checkAllFileVersions,
  fetchRemoteConfigFiles,
  type FileVersionStatus,
  type RemoteSourceInfo,
} from '@/lib/remote-sync'
import { ALL_CONFIG_FILES, type ConfigFileKey, type ConfigFilesMap, type Lang } from '@/lib/types'
import { cn, extractFileVersion } from '@/lib/utils'
import { useEditor } from '@/store/editor-store'

function formatRelativeTime(ts: number, now: number, lang: Lang): string {
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000))
  if (diffSec < 60) return tr(lang, '刚刚', 'just now')
  const mins = Math.floor(diffSec / 60)
  if (mins < 60) return tr(lang, '{mins} 分钟前', '{mins}m ago', { mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return tr(lang, '{hours} 小时前', '{hours}h ago', { hours })
  const days = Math.floor(hours / 24)
  if (days < 30) return tr(lang, '{days} 天前', '{days}d ago', { days })
  try {
    return new Intl.DateTimeFormat(LANGUAGE_META[lang].intlLocale, {
      month: 'short',
      day: 'numeric',
    }).format(new Date(ts))
  } catch {
    return new Date(ts).toLocaleDateString()
  }
}

function formatExactTime(ts: number, lang: Lang): string {
  try {
    return new Intl.DateTimeFormat(LANGUAGE_META[lang].intlLocale, {
      year: 'numeric',
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

function matchUploadedFileKey(filename: string): ConfigFileKey | null {
  const lower = filename.toLowerCase()
  if (lower.includes('config') && (lower.endsWith('.yaml') || lower.endsWith('.yml'))) return 'config.yaml'
  if (lower.includes('timeline') && (lower.endsWith('.yaml') || lower.endsWith('.yml'))) return 'timeline.yaml'
  if (lower.includes('frequency')) return 'frequency_words.txt'
  if (lower.includes('search_quer')) return 'search_queries.txt'
  if (lower.includes('ai_interest')) return 'ai_interests.txt'
  if (lower.includes('analysis_prompt')) return 'ai_analysis_prompt.txt'
  if (lower.includes('translation_prompt')) return 'ai_translation_prompt.txt'
  return null
}

export function ImportSyncDialog() {
  const {
    importOpen,
    setImportOpen,
    importDefaultTab,
    files,
    loadFiles,
    configOrigin,
    setConfigOrigin,
    setChangesRequest,
    lang,
    notify,
  } = useEditor()
  const t = useT()

  const [tab, setTab] = useState<'remote' | 'local'>(importDefaultTab)
  useEffect(() => {
    if (importOpen) setTab(importDefaultTab)
  }, [importOpen, importDefaultTab])

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [checking, setChecking] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [versionStatuses, setVersionStatuses] = useState<FileVersionStatus[] | null>(null)
  const [checkedSource, setCheckedSource] = useState<RemoteSourceInfo | null>(null)
  const [checkedAt, setCheckedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [syncError, setSyncError] = useState<string | null>(null)
  const [selectedRemote, setSelectedRemote] = useState<ConfigFileKey[]>(ALL_CONFIG_FILES)
  const [useAsBaseline, setUseAsBaseline] = useState(true)

  useEffect(() => {
    if (!importOpen) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [importOpen])

  const handleLocalFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const loaded: Partial<ConfigFilesMap> = {}
    const skipped: string[] = []

    for (const file of Array.from(fileList)) {
      const key = matchUploadedFileKey(file.name)
      if (!key) {
        skipped.push(file.name)
        continue
      }
      loaded[key] = await file.text()
    }

    const count = Object.keys(loaded).length
    if (count > 0) {
      loadFiles(loaded, useAsBaseline)
      setConfigOrigin({ kind: 'local', updatedAt: Date.now() })
      notify(
        t('已导入 {v0} 个配置文件：{v1}', 'Imported {v0} file(s): {v1}', { v0: count, v1: Object.keys(loaded).join(', ') }),
        'success',
      )
      setImportOpen(false)
    } else if (skipped.length > 0) {
      notify(
        t('未能识别文件名：{v0}', 'Unrecognized file(s): {v0}', { v0: skipped.join(', ') }),
        'warning',
      )
    }
  }

  const handleCheckVersions = async () => {
    setChecking(true)
    setSyncError(null)
    try {
      const res = await checkAllFileVersions(files)
      const ts = Date.now()
      setVersionStatuses(res.statuses)
      setCheckedSource(res.source)
      setCheckedAt(ts)
      setNow(ts)
      const outdated = res.statuses.filter((s) => s.status === 'outdated').length
      const viaText = res.source.kind === 'github'
        ? 'GitHub'
        : t('jsDelivr 镜像 ({v0})', 'jsDelivr ({v0})', { v0: res.source.host })
      notify(
        outdated > 0
          ? t('发现 {v0} 个文件可更新（来源：{v1}）', '{v0} file(s) have updates (via {v1})', { v0: outdated, v1: viaText })
          : t('当前已是最新版本（来源：{v0}）', 'All files are up to date (via {v0})', { v0: viaText }),
        outdated > 0 ? 'warning' : 'success',
      )
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err))
    } finally {
      setChecking(false)
    }
  }

  const handlePullRemote = async (keys: ConfigFileKey[]) => {
    if (keys.length === 0) return
    setPulling(true)
    setSyncError(null)
    try {
      const { files: fetched, source } = await fetchRemoteConfigFiles(keys, lang)
      const ts = Date.now()
      loadFiles(fetched, true)
      setCheckedSource(source)
      setCheckedAt(ts)
      setNow(ts)
      setConfigOrigin({
        kind: 'remote',
        provider: source.kind,
        host: source.host,
        updatedAt: ts,
      })
      notify(
        source.kind === 'github'
          ? t(`已从 GitHub 拉取最新配置`, `Pulled latest config from GitHub`)
          : t(
              `已从 jsDelivr 镜像拉取配置（镜像可能有短暂延迟）`,
              `Pulled config via jsDelivr mirror (cache may lag slightly)`,
            ),
        'success',
      )
      setImportOpen(false)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err))
    } finally {
      setPulling(false)
    }
  }

  const activeRemoteSource: RemoteSourceInfo | null =
    checkedSource ??
    (configOrigin.kind === 'remote'
      ? { kind: configOrigin.provider, host: configOrigin.host }
      : null)

  const activeTimestamp: number | null =
    configOrigin.kind === 'remote'
      ? configOrigin.updatedAt
      : checkedAt ?? (configOrigin.kind === 'local' ? configOrigin.updatedAt : null)

  const remoteMirrorTooltip = (
    <div className="space-y-1.5">
      <div>1. {t('优先从 GitHub 直连拉取最新配置。', 'Pulls directly from GitHub first.')}</div>
      <div>2. {t('若网络无法直连 GitHub，会自动切换至 jsDelivr 镜像。', 'Switches to jsDelivr mirrors automatically if GitHub is unreachable.')}</div>
      <div>3. {t('镜像带有缓存：刚提交 commit 后可能会有短暂延迟，尚未同步到最新内容。', 'Mirrors use caching: recent commits may take a short while to sync.')}</div>
    </div>
  )

  return (
    <ModalDialog
      open={importOpen}
      onOpenChange={setImportOpen}
      title={t('拉取与导入配置', 'Pull & Import Config')}
      maxWidthClass="max-w-2xl"
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'remote' | 'local')}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="remote">
            <CloudDownload className="h-3.5 w-3.5" />
            <span>{t('加载官网最新配置', 'Official Latest')}</span>
          </TabsTrigger>
          <TabsTrigger value="local">
            <FileUp className="h-3.5 w-3.5" />
            <span>{t('导入本地文件', 'Import Local Files')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="local" className="mt-4 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              void handleLocalFiles(e.dataTransfer.files)
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer',
              dragging
                ? 'border-[var(--brand-primary)] bg-[var(--brand-soft)]'
                : 'border-[var(--border-strong)] bg-[var(--bg-subtle)]/50 hover:border-[var(--brand-primary)]/60',
            )}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-primary)]">
              <FileUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {t('点击选择，或将 config/ 里的文件拖拽至此', 'Click to browse or drop config files here')}
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {t('支持一次拖入多个 .yaml / .txt 配置文件', 'Supports multiple .yaml and .txt config files')}
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".yaml,.yml,.txt"
              className="hidden"
              onChange={(e) => void handleLocalFiles(e.target.files)}
            />
          </div>

          <label className="flex items-center gap-2 px-1 text-xs text-[var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={useAsBaseline}
              onChange={(e) => setUseAsBaseline(e.target.checked)}
              className="h-4 w-4 rounded accent-[var(--brand-primary)] cursor-pointer"
            />
            <span>
              {t('将导入的文件设为对比起点', 'Use imported files as comparison starting point')}
              <span className="ml-1 text-[var(--text-muted)]">
                {t('（后续「改动与恢复」只显示新改的内容）', '(only highlights edits made afterwards)')}
              </span>
            </span>
          </label>

          <div className="flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
            <div className="text-[13.5px] font-medium text-[var(--text-primary)]">
              {t('恢复官方默认配置', 'Restore Official Defaults')}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setImportOpen(false)
                setChangesRequest({ restoreAll: true })
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t('一键恢复', 'Reset All')}</span>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="remote" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <span>
                {configOrigin.kind === 'remote'
                  ? t('拉取来源：', 'Pulled from:')
                  : checkedSource
                    ? t('检测来源：', 'Checked via:')
                    : t('当前配置：', 'Current config:')}
              </span>
              {activeRemoteSource ? (
                <>
                  <Badge tone={activeRemoteSource.kind === 'github' ? 'success' : 'warning'}>
                    {activeRemoteSource.kind === 'github'
                      ? 'GitHub'
                      : t('jsDelivr 镜像 ({v0})', 'jsDelivr ({v0})', { v0: activeRemoteSource.host })}
                  </Badge>
                  {activeTimestamp !== null && (
                    <span
                      className="text-[var(--text-muted)]"
                      title={formatExactTime(activeTimestamp, lang)}
                    >
                      · {formatRelativeTime(activeTimestamp, now, lang)}
                    </span>
                  )}
                  {activeRemoteSource.kind === 'jsdelivr' && (
                    <span className="text-[var(--text-muted)]">
                      · {t('镜像可能有延迟', 'Mirror may lag')}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Badge tone="outline">
                    {configOrigin.kind === 'local'
                      ? t('本地导入', 'Local import')
                      : t('网页内置模板', 'Built-in template')}
                  </Badge>
                  {activeTimestamp !== null && (
                    <span
                      className="text-[var(--text-muted)]"
                      title={formatExactTime(activeTimestamp, lang)}
                    >
                      · {formatRelativeTime(activeTimestamp, now, lang)}
                    </span>
                  )}
                </>
              )}
              <InfoTooltip content={remoteMirrorTooltip}>
                <button
                  type="button"
                  className="inline-flex items-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                  aria-label={t('拉取来源说明', 'Fetch source info')}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </InfoTooltip>
            </div>

            <Button size="sm" variant="outline" onClick={handleCheckVersions} disabled={checking}>
              {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              <span>{t('检查更新', 'Check Updates')}</span>
            </Button>
          </div>

          {syncError && (
            <Callout tone="danger" title={t('拉取失败（仍可直接使用内置配置）', 'Fetch failed (built-in templates remain available)')}>
              {syncError}
            </Callout>
          )}

          <div className="divide-y divide-[var(--border-default)] rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
            {ALL_CONFIG_FILES.map((file) => {
              const localVer = extractFileVersion(files[file])
              const bundledVer = BUNDLED_CONFIG_VERSIONS[file]
              const statusRow = versionStatuses?.find((s) => s.file === file)
              const checked = selectedRemote.includes(file)
              return (
                <div key={file} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedRemote((prev) =>
                          prev.includes(file) ? prev.filter((k) => k !== file) : [...prev, file],
                        )
                      }
                      className="h-4 w-4 accent-[var(--brand-primary)] cursor-pointer"
                    />
                    <span className="font-mono text-xs font-medium text-[var(--text-primary)] truncate">
                      {file}
                    </span>
                  </label>

                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    <span className="font-mono text-[var(--text-muted)]">
                      {t('当前', 'Current')}: v{localVer ?? '?'}
                    </span>
                    {statusRow ? (
                      statusRow.status === 'outdated' ? (
                        <Badge tone="warning">→ v{statusRow.remoteVersion}</Badge>
                      ) : statusRow.status === 'up_to_date' ? (
                        <Badge tone="success">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>v{statusRow.remoteVersion}</span>
                        </Badge>
                      ) : (
                        <Badge tone="outline">v{statusRow.remoteVersion ?? '?'}</Badge>
                      )
                    ) : (
                      <Badge tone="outline">
                        {t('内置', 'Bundled')} v{bundledVer ?? '?'}
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={pulling || selectedRemote.length === 0}
              onClick={() => void handlePullRemote(selectedRemote)}
            >
              {pulling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudDownload className="h-3.5 w-3.5" />}
              <span>
                {t('拉取已选 ({v0})', 'Pull Selected ({v0})', { v0: selectedRemote.length })}
              </span>
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </ModalDialog>
  )
}
