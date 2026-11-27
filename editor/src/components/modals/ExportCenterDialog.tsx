import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  ChevronDown,
  Container,
  Copy,
  Download,
  FileCode2,
  HelpCircle,
  Info,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Wrench,
} from 'lucide-react'
import {
  Badge,
  Button,
  Callout,
  InfoTooltip,
  Input,
  ModalDialog,
  SelectField,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/primitives'
import { useT } from '@/i18n'
import {
  buildConfigZipBlob,
  DEFAULT_DOCKER_ENV_OPTIONS,
  extractSecrets,
  generateDotEnv,
  generateDotEnvSnippet,
  sanitizeConfigYaml,
  type DockerEnvOptions,
} from '@/lib/exporter'
import { ALL_CONFIG_FILES, type ConfigFileKey } from '@/lib/types'
import { cn, copyToClipboard, downloadBlobFile, downloadTextFile } from '@/lib/utils'
import { useEditor } from '@/store/editor-store'

export function ExportCenterDialog() {
  const {
    exportOpen,
    setExportOpen,
    files,
    dirtyFiles,
    issues,
    applyQuickFix,
    setActiveSection,
    deployMode,
    setDeployMode,
    notify,
  } = useEditor()
  const t = useT()

  const [sanitizeSecrets, setSanitizeSecrets] = useState(deployMode === 'github_actions')
  // Default OFF so users with an existing docker/.env never accidentally overwrite custom ports/cron
  const [includeDotEnv, setIncludeDotEnv] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<ConfigFileKey[]>(ALL_CONFIG_FILES)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [dockerEnvOpts, setDockerEnvOpts] = useState<Required<DockerEnvOptions>>(DEFAULT_DOCKER_ENV_OPTIONS)
  const [dockerParamsOpen, setDockerParamsOpen] = useState(false)

  useEffect(() => {
    setSanitizeSecrets(deployMode === 'github_actions')
  }, [deployMode])

  const configYaml = files['config.yaml']
  const secrets = useMemo(() => (exportOpen ? extractSecrets(configYaml) : []), [configYaml, exportOpen])
  const dotEnvContent = useMemo(
    () => (exportOpen ? generateDotEnv(configYaml, true, dockerEnvOpts) : ''),
    [configYaml, dockerEnvOpts, exportOpen],
  )
  const dotEnvSnippet = useMemo(
    () => (exportOpen ? generateDotEnvSnippet(configYaml) : ''),
    [configYaml, exportOpen],
  )
  const hasWebSearchKey = secrets.some((s) => s.envKey === 'WEB_SEARCH_API_KEY')

  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')

  const toggleFile = (file: ConfigFileKey) => {
    setSelectedFiles((prev) =>
      prev.includes(file) ? prev.filter((f) => f !== file) : [...prev, file],
    )
  }

  const getExportedContent = (file: ConfigFileKey) =>
    file === 'config.yaml' && sanitizeSecrets ? sanitizeConfigYaml(files[file]) : files[file]

  const handleCopy = async (key: string, text: string, label: string) => {
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopiedKey(key)
      notify(t('已复制 {v0}', 'Copied {v0}', { v0: label }), 'success')
      setTimeout(() => setCopiedKey(null), 1600)
    }
  }

  const handleDownloadZip = () => {
    if (selectedFiles.length === 0) {
      notify(t('请至少选择一个要导出的文件', 'Select at least one file'), 'warning')
      return
    }
    const blob = buildConfigZipBlob(files, {
      selectedFiles,
      sanitizeSecrets,
      includeDotEnv,
      dockerEnvOptions: dockerEnvOpts,
    })
    downloadBlobFile('trendradar-config.zip', blob)
    notify(
      t(
        includeDotEnv
          ? `已打包下载 ${selectedFiles.length} 个配置文件及完整 docker/.env`
          : `已打包下载 ${selectedFiles.length} 个配置文件`,
        includeDotEnv
          ? `Downloaded ZIP with ${selectedFiles.length} file(s) and docker/.env`
          : `Downloaded ZIP with ${selectedFiles.length} file(s)`,
      ),
      'success',
    )
  }

  const dockerSummaryParts = [
    `${t('端口', 'Port')} ${dockerEnvOpts.webserverPort || '8080'}`,
    dockerEnvOpts.cronSchedule || '*/30 * * * *',
    dockerEnvOpts.runMode,
  ]
  if (dockerEnvOpts.mcpPort.trim()) {
    dockerSummaryParts.push(`MCP ${dockerEnvOpts.mcpPort.trim()}`)
  }

  return (
    <ModalDialog
      open={exportOpen}
      onOpenChange={setExportOpen}
      title={t('导出配置', 'Export Config')}
      maxWidthClass="max-w-3xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="text-xs text-[var(--text-muted)]">
            {t('已选 {v0} / {v1} 个配置文件{v2}', '{v0} / {v1} config files{v2}', { v0: selectedFiles.length, v1: ALL_CONFIG_FILES.length, v2: includeDotEnv ? ' + docker/.env' : '' })}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setExportOpen(false)}>
              {t('关闭', 'Close')}
            </Button>
            <Button variant="primary" onClick={handleDownloadZip}>
              <Archive className="h-4 w-4" />
              <span>{t('打包下载 config.zip', 'Download config.zip')}</span>
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3.5">
        {/* 1. Health Check Summary */}
        {errors.length === 0 && warnings.length === 0 ? (
          <Callout
            tone="success"
            icon={<CheckCircle2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
            title={t('配置检查通过，可直接导出', 'All checks passed — ready to export')}
            className="py-2"
          />
        ) : (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              {t('发现 {v0} 项错误 · {v1} 项提醒', '{v0} error(s) · {v1} warning(s)', { v0: errors.length, v1: warnings.length })}
            </div>
            <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
              {[...errors, ...warnings].map((iss) => (
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
                          setActiveSection(iss.section)
                          setExportOpen(false)
                        }}
                      >
                        {t('定位', 'Go')}
                      </Button>
                    </div>
                  }
                >
                  {t(iss.descZh, iss.descEn)}
                </Callout>
              ))}
            </div>
          </div>
        )}

        {/* 2. Concise Single-Line Take-Effect Strip (Details tucked neatly into ? tooltip) */}
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-soft)]/55 px-3.5 py-2 text-xs text-[var(--text-secondary)]">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <Info className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" />
            <span>
              <strong className="font-semibold text-[var(--text-primary)]">config/</strong>{' '}
              {t('覆盖后下次运行直接生效，无需重启', 'takes effect on next run — no restart')}
            </span>
            <span className="text-[var(--border-strong)]" aria-hidden="true">|</span>
            <span>
              <strong className="font-semibold text-[var(--text-primary)]">docker/.env</strong>{' '}
              {t('修改后需重建容器生效', 'requires container recreate')}
            </span>
          </div>
          <InfoTooltip
            side="bottom"
            content={
              <div className="space-y-1.5 text-xs leading-relaxed">
                <div>
                  <strong className="text-white">config/ {t('目录', 'files')}</strong>：
                  {t(
                    'Docker 通过目录挂载实时读取，每次定时或手动运行自动重新加载，无需重启容器；本地 uv run 与 GitHub Actions 均在下一次运行生效。',
                    'Bind-mounted in Docker and reloaded every run (no restart needed). Local uv and GitHub Actions pick it up on the next run.',
                  )}
                </div>
                <div>
                  <strong className="text-white">docker/.env</strong>：
                  {t(
                    '仅在创建容器时注入环境变量（docker compose restart 不会重载 .env），修改后须执行 cd docker && docker compose up -d --force-recreate 重建容器。',
                    'Loaded only when creating containers (docker compose restart will NOT reload .env). Run "cd docker && docker compose up -d --force-recreate".',
                  )}
                </div>
                <div>
                  <strong className="text-white">{t('本地 Python', 'Local Python')}</strong>：
                  {t(
                    '未内置 python-dotenv，不会自动读取 .env 文件；本地运行直接写在本地 config/config.yaml 即可（切勿提交公开仓库）。',
                    'Does not auto-load .env files; keep keys in local config/config.yaml without committing them.',
                  )}
                </div>
              </div>
            }
          >
            <button
              type="button"
              aria-label={t('查看详细生效说明', 'View detailed reload rules')}
              className="tr-focus-ring inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--brand-primary)] hover:bg-[var(--bg-surface)]/80 cursor-help"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </InfoTooltip>
        </div>

        {/* 3. Compact Security & ZIP Toggles (Secondary explanations in ? tooltips) */}
        <div className="divide-y divide-[var(--border-default)] rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/60">
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[13px] font-medium text-[var(--text-primary)]">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
              <span>{t('导出时清空 config.yaml 中的密码与密钥', 'Clear passwords & keys from config.yaml')}</span>
              {secrets.length > 0 && (
                <Badge tone="brand">{t('已识别 {v0} 项', '{v0} found', { v0: secrets.length })}</Badge>
              )}
              <InfoTooltip
                content={t(
                  '防止上传公开仓库泄露密钥；清空后的密钥仍可在下方「Docker .env」或「GitHub Secrets」独立页签一键复制。',
                  'Prevents leaking secrets in public repos; cleared keys remain available in the Docker .env and GitHub Secrets tabs below.',
                )}
              >
                <button
                  type="button"
                  aria-label={t('脱敏说明', 'Sanitization details')}
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </InfoTooltip>
            </div>
            <Switch checked={sanitizeSecrets} onCheckedChange={setSanitizeSecrets} />
          </div>

          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[13px] text-[var(--text-secondary)]">
              <Container className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              <span>{t('打包 config.zip 时附带完整 docker/.env', 'Include full docker/.env in config.zip')}</span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {t('（仅建议首次 Docker 部署）', '(fresh Docker setup only)')}
              </span>
              <InfoTooltip
                content={t(
                  '默认关闭，防止解压直接覆盖你已修改过的 docker/.env（如端口、定时表达式）；已有容器建议到「Docker .env」页签按行合并密钥。',
                  'Off by default so extracting does not overwrite an existing docker/.env; existing setups should merge filled lines from the Docker .env tab.',
                )}
              >
                <button
                  type="button"
                  aria-label={t('附带 .env 说明', 'Include .env details')}
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </InfoTooltip>
            </div>
            <Switch checked={includeDotEnv} onCheckedChange={setIncludeDotEnv} />
          </div>
        </div>

        {/* 4. Export Tabs (4 cleanly separated tabs) */}
        <Tabs defaultValue="files">
          <TabsList className="w-full flex-wrap justify-start">
            <TabsTrigger value="files">
              <Download className="h-3.5 w-3.5" />
              <span>{t('配置文件', 'Config Files')}</span>
            </TabsTrigger>
            <TabsTrigger value="dotenv">
              <Container className="h-3.5 w-3.5" />
              <span>{t('Docker .env', 'Docker .env')}</span>
            </TabsTrigger>
            <TabsTrigger value="secrets">
              <KeyRound className="h-3.5 w-3.5" />
              <span>
                {t('GitHub Secrets', 'GitHub Secrets')}
                {secrets.length > 0 && ` (${secrets.length})`}
              </span>
            </TabsTrigger>
            <TabsTrigger value="deploy">
              <Terminal className="h-3.5 w-3.5" />
              <span>{t('生效步骤', 'How to Apply')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Individual config/ Files */}
          <TabsContent value="files" className="mt-3 space-y-2">
            <div className="flex items-center justify-end gap-2.5 text-xs text-[var(--text-muted)]">
              <button
                type="button"
                className="underline hover:text-[var(--brand-primary)] cursor-pointer"
                onClick={() => setSelectedFiles(ALL_CONFIG_FILES)}
              >
                {t('全选', 'Select all')}
              </button>
              {dirtyFiles.length > 0 && (
                <button
                  type="button"
                  className="underline hover:text-[var(--brand-primary)] cursor-pointer"
                  onClick={() => setSelectedFiles(dirtyFiles)}
                >
                  {t('仅选已修改', 'Modified only')}
                </button>
              )}
            </div>

            <div className="divide-y divide-[var(--border-default)] rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
              {ALL_CONFIG_FILES.map((fileKey) => {
                const checked = selectedFiles.includes(fileKey)
                const modified = dirtyFiles.includes(fileKey)
                const content = getExportedContent(fileKey)
                return (
                  <div
                    key={fileKey}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFile(fileKey)}
                        className="h-4 w-4 accent-[var(--brand-primary)] rounded cursor-pointer"
                      />
                      <span className="font-mono text-xs font-medium text-[var(--text-primary)] truncate">
                        config/{fileKey}
                      </span>
                      {modified && <Badge tone="brand">{t('已修改', 'Edited')}</Badge>}
                      {fileKey === 'config.yaml' && sanitizeSecrets && secrets.length > 0 && (
                        <Badge tone="success">{t('已清空密码密钥', 'Keys cleared')}</Badge>
                      )}
                    </label>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleCopy(fileKey, content, fileKey)}
                      >
                        {copiedKey === fileKey ? (
                          <Check className="h-3.5 w-3.5 text-teal-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>{t('复制', 'Copy')}</span>
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          downloadTextFile(fileKey, content)
                          notify(t('已下载 {v0}', 'Downloaded {v0}', { v0: fileKey }), 'success')
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>{t('下载', 'Save')}</span>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>

          {/* Tab 2: Dedicated Docker .env Configuration & Full Template */}
          <TabsContent value="dotenv" className="mt-3 space-y-3">
            {/* Compact 1-Line Anti-Overwrite Tip + ? Details */}
            <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3.5 py-2 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex min-w-0 items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span className="leading-snug">
                  {t(
                    '已有 docker/.env 请优先点「仅复制已填密钥」按行合并，避免覆盖自定义端口或定时。',
                    'Already have docker/.env? Use "Copy filled only" and merge line-by-line instead of overwriting.',
                  )}
                </span>
              </div>
              <InfoTooltip
                side="bottom"
                content={
                  <div className="space-y-1.5 text-xs leading-relaxed">
                    <div>
                      1. {t('仅用于 Docker Compose（docker/.env），本地 Python 不会自动读取 .env。', 'Used only by Docker Compose (docker/.env); local Python ignores .env.')}
                    </div>
                    <div>
                      2. {t('非密钥开关/模型项默认留空，以便继续由 config/config.yaml 实时控制。', 'Non-secret toggles/models stay blank so config/config.yaml stays live.')}
                    </div>
                    <div>
                      3. {t('修改 docker/.env 后请执行 cd docker && docker compose up -d --force-recreate（restart 不会重载 .env）。', 'After editing docker/.env, run "cd docker && docker compose up -d --force-recreate" (restart will not reload it).')}
                    </div>
                  </div>
                }
              >
                <button
                  type="button"
                  aria-label={t('查看 docker/.env 使用说明', 'View docker/.env usage details')}
                  className="tr-focus-ring inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-amber-700 hover:bg-amber-500/15 dark:text-amber-300 cursor-help"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </InfoTooltip>
            </div>

            {/* Collapsible Docker-only runtime parameters (clean summary by default so preview stays above fold) */}
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/50">
              <button
                type="button"
                onClick={() => setDockerParamsOpen((o) => !o)}
                aria-expanded={dockerParamsOpen}
                className="tr-focus-ring flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-2 text-left text-xs transition-colors hover:bg-[var(--bg-muted)]/60 cursor-pointer"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FileCode2 className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" />
                  <span className="font-semibold text-[var(--text-primary)]">
                    {t('自定义容器参数', 'Customize Docker Params')}
                  </span>
                  <span className="truncate font-mono text-[11px] text-[var(--text-muted)]">
                    {dockerSummaryParts.join(' · ')}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-transform duration-150',
                    dockerParamsOpen && 'rotate-180',
                  )}
                />
              </button>

              {dockerParamsOpen && (
                <div className="grid grid-cols-1 gap-2.5 border-t border-[var(--border-default)] p-3 sm:grid-cols-3">
                  <label className="space-y-1">
                    <span className="block font-mono text-[11px] text-[var(--text-muted)]">WEBSERVER_PORT</span>
                    <Input
                      value={dockerEnvOpts.webserverPort}
                      onChange={(e) => setDockerEnvOpts((o) => ({ ...o, webserverPort: e.target.value }))}
                      placeholder="8080"
                      className="h-8 font-mono text-xs"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block font-mono text-[11px] text-[var(--text-muted)]">CRON_SCHEDULE</span>
                    <Input
                      value={dockerEnvOpts.cronSchedule}
                      onChange={(e) => setDockerEnvOpts((o) => ({ ...o, cronSchedule: e.target.value }))}
                      placeholder="*/30 * * * *"
                      className="h-8 font-mono text-xs"
                    />
                  </label>
                  <div className="space-y-1">
                    <span className="block font-mono text-[11px] text-[var(--text-muted)]">RUN_MODE</span>
                    <SelectField
                      size="xs"
                      value={dockerEnvOpts.runMode}
                      ariaLabel="RUN_MODE"
                      onValueChange={(val) => setDockerEnvOpts((o) => ({ ...o, runMode: val === 'once' ? 'once' : 'cron' }))}
                      className="h-8 bg-[var(--bg-surface)] font-mono text-xs"
                      options={[
                        { value: 'cron', label: 'cron', hint: t('定时常驻 + Web 服务', 'Scheduled + Web') },
                        { value: 'once', label: 'once', hint: t('执行一次后退出', 'Run once') },
                      ]}
                    />
                  </div>
                  <label className="space-y-1">
                    <span className="block font-mono text-[11px] text-[var(--text-muted)]">MCP_HOST ({t('可选', 'optional')})</span>
                    <Input
                      value={dockerEnvOpts.mcpHost}
                      onChange={(e) => setDockerEnvOpts((o) => ({ ...o, mcpHost: e.target.value }))}
                      placeholder="127.0.0.1"
                      className="h-8 font-mono text-xs"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block font-mono text-[11px] text-[var(--text-muted)]">MCP_PORT ({t('可选', 'optional')})</span>
                    <Input
                      value={dockerEnvOpts.mcpPort}
                      onChange={(e) => setDockerEnvOpts((o) => ({ ...o, mcpPort: e.target.value }))}
                      placeholder="3333"
                      className="h-8 font-mono text-xs"
                    />
                  </label>
                  <div className="flex items-end justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-1.5">
                    <span className="font-mono text-[11px] text-[var(--text-secondary)]">IMMEDIATE_RUN</span>
                    <Switch
                      checked={dockerEnvOpts.immediateRun}
                      onCheckedChange={(checked) => setDockerEnvOpts((o) => ({ ...o, immediateRun: checked }))}
                      ariaLabel="IMMEDIATE_RUN"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Complete docker/.env preview + safe snippet copy */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {t('完整 docker/.env 预览', 'Full docker/.env Preview')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {secrets.length > 0 && (
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={() => handleCopy('dotenv_snippet', dotEnvSnippet, t('已填密钥片段', 'filled env lines'))}
                      title={t('仅复制非空密钥行，适合按行合并到已有 docker/.env', 'Copy only non-empty secret lines for safe merging')}
                    >
                      {copiedKey === 'dotenv_snippet' ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{t('仅复制已填密钥 ({v0})', 'Copy filled ({v0})', { v0: secrets.length })}</span>
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => handleCopy('dotenv', dotEnvContent, 'docker/.env')}
                  >
                    {copiedKey === 'dotenv' ? (
                      <Check className="h-3.5 w-3.5 text-teal-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{t('复制完整 .env', 'Copy full')}</span>
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      downloadTextFile('.env', dotEnvContent)
                      notify(t('已下载完整 .env（请保存至 docker/.env）', 'Downloaded full .env (place in docker/.env)'), 'success')
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{t('下载', 'Save')}</span>
                  </Button>
                </div>
              </div>
              <pre
                data-dotenv-preview="true"
                className="max-h-56 overflow-auto rounded-xl border border-[var(--border-default)] bg-[#0d1320] p-3.5 font-mono text-[11.5px] leading-relaxed text-slate-200"
              >
                {dotEnvContent}
              </pre>
            </div>
          </TabsContent>

          {/* Tab 3: Dedicated GitHub Actions Secrets */}
          <TabsContent value="secrets" className="mt-3 space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/60 px-3.5 py-2 text-xs text-[var(--text-secondary)]">
              <div className="flex min-w-0 items-center gap-2">
                <KeyRound className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" />
                <span className="leading-snug">
                  {t(
                    '前往仓库 Settings → Secrets and variables → Actions 逐项填入，下次运行自动生效。',
                    'Add each key under Repo Settings → Secrets and variables → Actions; applies on next run.',
                  )}
                </span>
              </div>
              <InfoTooltip
                side="bottom"
                content={t(
                  'GitHub Actions 不使用 .env 文件；公开仓库请务必开启上方「导出时清空 config.yaml 中的密码与密钥」，再把这里的变量填入仓库 Secrets。',
                  'GitHub Actions does not use .env. Keep secret sanitization ON for public repos and store keys in GitHub Secrets.',
                )}
              >
                <button
                  type="button"
                  aria-label={t('GitHub Secrets 说明', 'GitHub Secrets details')}
                  className="tr-focus-ring inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </InfoTooltip>
            </div>

            {secrets.length > 0 ? (
              <div className="space-y-2">
                <div className="divide-y divide-[var(--border-default)] rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
                  {secrets.map((sec) => (
                    <div key={sec.envKey} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-semibold text-[var(--brand-primary)]">
                            {sec.envKey}
                          </code>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {t(sec.labelZh, sec.labelEn)}
                          </span>
                        </div>
                        <div className="truncate font-mono text-[11px] text-[var(--text-muted)]">
                          {sec.value.slice(0, 6)}••••••{sec.value.slice(-3)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => handleCopy(`name_${sec.envKey}`, sec.envKey, sec.envKey)}
                        >
                          {copiedKey === `name_${sec.envKey}` ? (
                            <Check className="h-3.5 w-3.5 text-teal-500" />
                          ) : null}
                          <span>{t('复制变量名', 'Name')}</span>
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => handleCopy(`val_${sec.envKey}`, sec.value, `${sec.envKey} Value`)}
                        >
                          {copiedKey === `val_${sec.envKey}` ? (
                            <Check className="h-3.5 w-3.5 text-teal-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          <span>{t('复制值', 'Value')}</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {hasWebSearchKey && (
                  <p className="text-[11.5px] leading-relaxed text-[var(--text-muted)]">
                    {t(
                      '提示：DeepSeek 搜索会自动复用 AI_API_KEY；其他搜索引擎如需通过 Secrets 注入，请在 .github/workflows/crawler.yml 中映射 WEB_SEARCH_API_KEY。',
                      'Tip: DeepSeek search reuses AI_API_KEY automatically; other providers require mapping WEB_SEARCH_API_KEY in crawler.yml.',
                    )}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]/45 px-4 py-6 text-center text-xs text-[var(--text-muted)]">
                {t(
                  '当前 config.yaml 尚未填写通道 Webhook、AI Key、搜索 Key 或 S3 密钥；填写后此处会自动列出可一键复制的变量。',
                  'No webhooks, AI keys, search keys, or S3 credentials in config.yaml yet. Filled keys will appear here.',
                )}
              </div>
            )}
          </TabsContent>

          {/* Tab 4: Deploy Apply Guide */}
          <TabsContent value="deploy" className="mt-3 space-y-3">
            <div className="flex gap-2">
              {(
                [
                  ['docker', 'Docker Compose'],
                  ['github_actions', 'GitHub Actions'],
                  ['local', t('本地 Python (uv)', 'Local Python (uv)')],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDeployMode(mode)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                    deployMode === mode
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-soft)] text-[var(--brand-primary)]'
                      : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {deployMode === 'github_actions' && (
              <ol className="space-y-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/50 p-4 text-xs leading-relaxed text-[var(--text-secondary)] list-decimal pl-8">
                <li>
                  <strong className="text-[var(--text-primary)]">{t('替换 config/ 并推送', 'Update config/ and push')}</strong>：
                  {t('开启密钥脱敏后覆盖仓库 config/ 目录，推送后下次运行即生效。', 'Keep sanitization ON, overwrite config/, and push.')}
                </li>
                <li>
                  <strong className="text-[var(--text-primary)]">{t('填入 GitHub Secrets', 'Add GitHub Secrets')}</strong>：
                  {t('在「GitHub Secrets」页签复制变量并填入仓库 Settings → Secrets → Actions。', 'Copy keys from the GitHub Secrets tab into Repo Settings → Secrets → Actions.')}
                </li>
                <li>
                  <strong className="text-[var(--text-primary)]">{t('手动触发验证', 'Trigger a test run')}</strong>：
                  {t('打开 Actions → Get Hot News → Run workflow，约 1 分钟即可收到推送。', 'Run Actions → Get Hot News → Run workflow to verify delivery.')}
                </li>
              </ol>
            )}

            {deployMode === 'docker' && (
              <div className="space-y-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/50 p-4 text-xs">
                <ul className="space-y-1 text-[var(--text-secondary)] list-disc pl-4 leading-relaxed">
                  <li>
                    <strong className="text-[var(--text-primary)]">{t('只改了 config/', 'Edited config/ only')}</strong>：
                    {t('直接覆盖宿主机 config/，无需重启容器，下次执行即生效。', 'Overwrite host config/ — no restart needed.')}
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">{t('改动了 docker/.env', 'Edited docker/.env')}</strong>：
                    {t('必须重建容器才会重载环境变量（docker compose restart 不会生效）：', 'Recreate containers to reload env vars (docker compose restart will NOT reload .env):')}
                  </li>
                </ul>
                <pre className="overflow-auto rounded-lg bg-[#0d1320] p-3 font-mono text-[11.5px] text-slate-200">
{`# 改动 docker/.env 后重建容器：
cd docker && docker compose up -d --force-recreate

# 立即检查配置与测试推送（改 config/ 后可直接运行）：
docker compose exec trendradar python -m trendradar --doctor
docker compose exec trendradar python -m trendradar --test-notification`}
                </pre>
              </div>
            )}

            {deployMode === 'local' && (
              <div className="space-y-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/50 p-4 text-xs">
                <p className="leading-relaxed text-[var(--text-secondary)]">
                  {t(
                    '覆盖项目根目录的 config/ 后下次运行即生效（本地运行不会自动读取 .env，密钥直接保留在本地 config/config.yaml 即可，切勿提交公开仓库）：',
                    'Overwrite config/ and run directly (local Python does not auto-load .env; keep keys in local config/config.yaml without committing):',
                  )}
                </p>
                <pre className="overflow-auto rounded-lg bg-[#0d1320] p-3 font-mono text-[11.5px] text-slate-200">
{`uv run python -m trendradar --doctor
uv run python -m trendradar --test-notification
uv run python -m trendradar`}
                </pre>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ModalDialog>
  )
}
