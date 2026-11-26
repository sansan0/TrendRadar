import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, Check, Copy, Download, KeyRound, ShieldCheck } from 'lucide-react'
import { Badge, Button, Popover, PopoverPanel, PopoverTrigger, SelectField } from '@/components/ui/primitives'
import { useT } from '@/i18n'
import {
  buildConfigZipBlob,
  extractSecrets,
  generateDotEnvSnippet,
  sanitizeConfigYaml,
} from '@/lib/exporter'
import { trialFileNotices, trialFileOptions } from '@/lib/guided-trial'
import { parseTimelinePresets } from '@/lib/timeline-engine'
import { getOfficialDocUrl } from '@/lib/presets'
import { type ConfigFileKey, type DeployMode, type SectionId } from '@/lib/types'
import { copyToClipboard, downloadBlobFile, downloadTextFile } from '@/lib/utils'
import { useEditor } from '@/store/editor-store'

interface GuidedTrialFilesProps {
  section: SectionId
  defaultFile?: ConfigFileKey
  choices?: readonly ConfigFileKey[]
  inline?: boolean
}

export function GuidedTrialFiles({ section, defaultFile = 'config.yaml', choices, inline }: GuidedTrialFilesProps) {
  const { files, dirtyFiles, deployMode, setDeployMode, lang, configData, configError, timelineError, jumpToSource, notify } = useEditor()
  const t = useT()
  const options = useMemo(() => trialFileOptions(section, dirtyFiles, choices), [choices, dirtyFiles, section])
  const preferred = options.includes(defaultFile) ? defaultFile : options[0]
  const modified = options.filter((file) => dirtyFiles.includes(file))
  const previous = useRef({ files, preferred })
  const [selection, setSelection] = useState(modified.length === 1 ? modified[0] : preferred)
  const selected = options.includes(selection) ? selection : preferred
  const [copiedMap, setCopiedMap] = useState<Record<string, string>>({})
  const [copyErrorFile, setCopyErrorFile] = useState<ConfigFileKey | null>(null)
  const [hasCopiedAny, setHasCopiedAny] = useState(false)
  const [open, setOpen] = useState(false)

  const secrets = useMemo(() => extractSecrets(files['config.yaml']), [files])
  const hasSecrets = secrets.length > 0 && secrets.some((s) => s.category === 'notification' || s.category === 'ai' || s.category === 'search' || s.category === 'storage')
  const shouldSanitizeYaml = deployMode === 'github_actions' && hasSecrets

  const timelineStructureError = useMemo(() => parseTimelinePresets(files['timeline.yaml']).error, [files])
  const getFileInvalid = (file: ConfigFileKey) =>
    file === 'config.yaml'
      ? configError
      : file === 'timeline.yaml'
        ? timelineError ?? timelineStructureError
        : null

  const anyInvalid = Boolean(configError || timelineError || timelineStructureError)
  const invalid = getFileInvalid(selected) ?? (anyInvalid ? (configError ?? timelineError ?? timelineStructureError) : null)
  const notices = useMemo(() => trialFileNotices(configData, files['timeline.yaml'], selected, lang), [configData, files, selected, lang])

  useEffect(() => {
    const last = previous.current
    previous.current = { files, preferred }
    const edited = options.filter((file) => files[file] !== last.files[file])
    if (edited.length || last.preferred !== preferred) {
      setSelection(edited.length === 1 ? edited[0] : preferred)
    }
  }, [files, options, preferred])

  const getCopyText = (file: ConfigFileKey) =>
    file === 'config.yaml' && shouldSanitizeYaml ? sanitizeConfigYaml(files[file]) : files[file]

  async function copyFileItem(file: ConfigFileKey) {
    const text = getCopyText(file)
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopiedMap((prev) => ({ ...prev, [file]: files[file] }))
      setCopyErrorFile(null)
      setHasCopiedAny(true)
    } else {
      setCopyErrorFile(file)
    }
  }

  async function copyDotEnv() {
    const envText = generateDotEnvSnippet(files['config.yaml'])
    const ok = await copyToClipboard(envText)
    if (ok) {
      setCopiedMap((prev) => ({ ...prev, '__dotenv__': envText }))
      notify(t('已复制已填密钥片段（请按行合并至 docker/.env）', 'Copied filled env lines (merge into docker/.env)'), 'success')
    }
  }

  function downloadModifiedZip() {
    const targetList = modified.length > 0 ? modified : [selected]
    const blob = buildConfigZipBlob(files, {
      selectedFiles: targetList,
      sanitizeSecrets: shouldSanitizeYaml,
      includeDotEnv: false,
    })
    downloadBlobFile('trendradar-trial-config.zip', blob)
    setHasCopiedAny(true)
    notify(
      t('已打包下载 {v0} 个试跑配置文件', 'Downloaded {v0} trial file(s)', { v0: targetList.length }),
      'success',
    )
  }

  const isFileCopied = (file: ConfigFileKey) => copiedMap[file] === files[file]

  const actions = (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1 space-y-1">
          <span className="block text-xs font-medium text-[var(--text-secondary)]">
            {t('试跑配置文件', 'File to copy & try')}
          </span>
          <SelectField
            size="sm"
            value={selected}
            ariaLabel={t('试跑配置文件', 'File to copy & try')}
            onValueChange={(val) => setSelection(val as ConfigFileKey)}
            className="font-mono text-xs"
            options={options.map((file) => ({
              value: file,
              label: `${file}${dirtyFiles.includes(file) ? t(' · 已修改', ' · Edited') : ''}`,
            }))}
          />
        </div>
        <Button variant="primary" size="sm" onClick={() => void copyFileItem(selected)} disabled={Boolean(invalid)}>
          {isFileCopied(selected) ? <Check size={15} /> : <Copy size={15} />}
          <span>{isFileCopied(selected) ? t('已复制当前文件', 'Copied') : t('复制文件', 'Copy file')}</span>
        </Button>
        {modified.length > 1 && (
          <Button variant="outline" size="sm" onClick={downloadModifiedZip} disabled={Boolean(invalid)}>
            <Archive size={15} />
            <span>{t('打包已改 ({v0})', 'ZIP ({v0})', { v0: modified.length })}</span>
          </Button>
        )}
      </div>

      {/* Multi-file checklist so cross-file changes are never forgotten */}
      {modified.length > 1 && !invalid && (
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-soft)]/45 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-[var(--text-primary)]">
              {t('共有 {v0} 个文件已修改，请同步覆盖至 config/ 目录：', '{v0} files modified — update each in config/:', { v0: modified.length })}
            </span>
          </div>
          <div className="flex flex-col gap-1.5" data-modified-files-list="single-column">
            {modified.map((file) => {
              const done = isFileCopied(file)
              return (
                <button
                  key={file}
                  type="button"
                  onClick={() => void copyFileItem(file)}
                  className="tr-focus-ring flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-left text-xs transition-colors hover:border-[var(--brand-primary)] cursor-pointer"
                >
                  <code className="min-w-0 break-all font-mono text-[var(--text-primary)]">config/{file}</code>
                  <span className="inline-flex shrink-0 items-center gap-1 font-medium text-[var(--brand-primary)]">
                    {done ? <Check size={13} className="text-teal-500" /> : <Copy size={12} />}
                    <span>{done ? t('已拷', 'Done') : t('复制', 'Copy')}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {invalid && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
          <p role="alert" className="text-xs text-red-700 dark:text-red-300">
            {t('检测到 YAML 配置语法或结构错误，请先修正后再复制试跑。', 'Fix the YAML syntax or structure errors before copying for a trial run.')}
          </p>
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              setOpen(false)
              jumpToSource(configError ? 'config.yaml' : timelineError || timelineStructureError ? 'timeline.yaml' : selected)
            }}
          >
            {t('修正源码', 'Fix source')}
          </Button>
        </div>
      )}

      {notices.map((notice) => (
        <p key={notice} className="break-words text-xs leading-relaxed text-[var(--text-secondary)]">
          {notice}
        </p>
      ))}

      {copyErrorFile && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <p role="alert" className="text-xs text-amber-800 dark:text-amber-200">
            {t('浏览器未能直接写入剪贴板，可直接下载该文件。', 'Clipboard access was blocked. Download the file directly instead.')}
          </p>
          <Button size="xs" variant="outline" onClick={() => downloadTextFile(copyErrorFile, getCopyText(copyErrorFile))}>
            <Download size={13} />
            <span>{t('下载文件', 'Download')}</span>
          </Button>
        </div>
      )}

      {(hasCopiedAny || isFileCopied(selected)) && (
        <div className="space-y-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/60 p-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p role="status" className="font-medium text-[var(--text-primary)]">
              {t('下一步：粘贴覆盖项目的 ', 'Next: overwrite ')}
              <code className="font-mono text-[var(--brand-primary)]">config/{selected}</code>
              {shouldSanitizeYaml && (
                <Badge tone="success" className="ml-1.5">
                  <ShieldCheck size={11} />
                  <span>{t('已隐藏明文密钥', 'Keys cleared')}</span>
                </Badge>
              )}
            </p>
            <div className="inline-flex items-center gap-1.5">
              <span className="text-[var(--text-muted)] whitespace-nowrap">{t('运行方式', 'Target')}</span>
              <SelectField
                size="xs"
                value={deployMode}
                ariaLabel={t('运行方式', 'Target')}
                onValueChange={(val) => setDeployMode(val as DeployMode)}
                className="w-auto min-w-[126px] bg-[var(--bg-surface)] font-medium"
                options={[
                  { value: 'docker', label: 'Docker' },
                  { value: 'local', label: t('本地 Python', 'Local Python') },
                  { value: 'github_actions', label: 'GitHub Actions' },
                ]}
              />
            </div>
          </div>

          {hasSecrets && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-2">
              <span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]">
                <KeyRound size={13} className="text-[var(--brand-primary)] shrink-0" />
                {deployMode === 'github_actions'
                  ? t('检测到 {v0} 项配置参数建议填入仓库 Actions Secrets', '{v0} item(s) ready for GitHub Actions Secrets', { v0: secrets.length })
                  : deployMode === 'docker'
                    ? t('检测到 {v0} 项密钥，可按行合并至 docker/.env（改 .env 需重建容器生效）', '{v0} secret(s) — merge into docker/.env (recreate container to apply)', { v0: secrets.length })
                    : t('本地 Python 不会自动读取 .env，以上 {v0} 项保留在本地 config.yaml 即可生效', 'Local Python does not auto-load .env; keep these {v0} item(s) in local config.yaml', { v0: secrets.length })}
              </span>
              {deployMode === 'docker' && (
                <Button size="xs" variant="outline" onClick={() => void copyDotEnv()}>
                  {copiedMap['__dotenv__'] ? <Check size={12} className="text-teal-500" /> : <Copy size={12} />}
                  <span>{t('复制密钥行', 'Copy env lines')}</span>
                </Button>
              )}
            </div>
          )}

          {deployMode === 'github_actions' ? (
            <p>
              {t(
                '提交配置后，在 GitHub 仓库打开 Actions → Get Hot News → Run workflow 即可立即试跑；完成后回到本网页可继续接着配。',
                'Commit the config, then run Actions → Get Hot News → Run workflow. Return to this browser tab anytime to continue.',
              )}
            </p>
          ) : (
            <p>
              {deployMode === 'docker'
                ? t('在宿主机执行试跑命令：', 'Run a single pass in Docker: ')
                : t('在项目根目录执行试跑命令：', 'Run locally from project root: ')}
              <code className="ml-1 break-all rounded bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono font-semibold text-[var(--text-primary)]">
                {deployMode === 'docker' ? 'docker compose exec trendradar python -m trendradar' : 'uv run python -m trendradar'}
              </code>
            </p>
          )}
          <a href={getOfficialDocUrl('quick-start', lang)} target="_blank" rel="noopener noreferrer" className="inline-block font-medium text-[var(--brand-primary)] hover:underline">
            {t('查看首次部署图文说明 →', 'First-time deployment guide →')}
          </a>
        </div>
      )}
    </div>
  )

  if (inline) return actions
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-[var(--brand-border)] bg-[var(--brand-soft)]/55 text-[var(--brand-primary)] hover:bg-[var(--brand-soft)]">
          <Copy size={14} />
          <span>{t('复制去试跑', 'Copy & Try')}</span>
          {dirtyFiles.length > 0 && (
            <span className="rounded-full bg-[var(--brand-primary)]/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-none">
              {dirtyFiles.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverPanel align="end" className="max-h-[var(--radix-popover-content-available-height)] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto p-4">
        {actions}
        {hasCopiedAny && (
          <Button variant="ghost" size="xs" className="mt-2" onClick={() => setOpen(false)}>
            {t('收起并继续配置本步', 'Close and continue editing')}
          </Button>
        )}
      </PopoverPanel>
    </Popover>
  )
}
