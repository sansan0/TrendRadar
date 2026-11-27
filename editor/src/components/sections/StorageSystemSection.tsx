import * as React from 'react'
import {
  Bug,
  Check,
  Cloud,
  CloudDownload,
  Cpu,
  Database,
  FileCode2,
  FileText,
  Globe2,
  HardDrive,
  HelpCircle,
  Lock,
  RotateCcw,
  ShieldAlert,
  Wrench,
} from 'lucide-react'
import {
  Badge,
  Button,
  Callout,
  Card,
  Collapsible,
  CollapsibleContent,
  InfoTooltip,
  Input,
  SelectField,
  Switch,
} from '@/components/ui/primitives'
import {
  AdvancedCollapsible,
  SecretInput,
  SectionShell,
  SettingRow,
} from '@/components/shared/SharedControls'
import { useT } from '@/i18n'
import { COMMON_TIMEZONES } from '@/lib/presets'
import { cn } from '@/lib/utils'
import { getInObject } from '@/lib/yaml-doc'
import { useEditor } from '@/store/editor-store'

type StorageBackend = 'auto' | 'local' | 'remote'

const DEFAULT_VERSION_URLS = {
  version_check_url:
    'https://raw.githubusercontent.com/sansan0/TrendRadar/refs/heads/master/version',
  configs_version_check_url:
    'https://raw.githubusercontent.com/sansan0/TrendRadar/refs/heads/master/version_configs',
  mcp_version_check_url:
    'https://raw.githubusercontent.com/sansan0/TrendRadar/refs/heads/master/version_mcp',
} as const

const DEFAULT_BATCH_SIZES = {
  default: 4000,
  dingtalk: 20000,
  feishu: 30000,
  bark: 4000,
  slack: 4000,
} as const

const DEFAULT_FEISHU_SEPARATOR = '━━━━━━━━━━━━━━━━'

interface S3ProviderPreset {
  id: string
  labelZh: string
  labelEn: string
  endpoint: string
  region: string
}

const S3_PROVIDERS: S3ProviderPreset[] = [
  {
    id: 'r2',
    labelZh: 'Cloudflare R2',
    labelEn: 'Cloudflare R2',
    endpoint: 'https://<account_id>.r2.cloudflarestorage.com',
    region: 'auto',
  },
  {
    id: 'oss',
    labelZh: '阿里云 OSS',
    labelEn: 'Alibaba Cloud OSS',
    endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
    region: 'oss-cn-hangzhou',
  },
  {
    id: 'cos',
    labelZh: '腾讯云 COS',
    labelEn: 'Tencent Cloud COS',
    endpoint: 'https://cos.ap-guangzhou.myqcloud.com',
    region: 'ap-guangzhou',
  },
  {
    id: 'aws',
    labelZh: 'AWS S3',
    labelEn: 'AWS S3',
    endpoint: 'https://s3.us-east-1.amazonaws.com',
    region: 'us-east-1',
  },
]

export function StorageSystemSection() {
  const { configData, setConfigValue, patchConfigValues, notify, visualFocusTarget } = useEditor()
  const t = useT()

  // Card 1: App Runtime
  const timezone = String(getInObject(configData, ['app', 'timezone'], 'Asia/Shanghai') ?? '')
  const showVersionUpdate = getInObject<boolean>(configData, ['app', 'show_version_update'], true)
  const isPresetTz = COMMON_TIMEZONES.some((tz) => tz.value === timezone)
  const [customTzMode, setCustomTzMode] = React.useState(!isPresetTz)

  React.useEffect(() => {
    if (!isPresetTz && timezone.trim().length > 0) {
      setCustomTzMode(true)
    }
  }, [isPresetTz, timezone])

  // Card 2: Storage
  const backend = getInObject<StorageBackend>(configData, ['storage', 'backend'], 'auto')
  const formatSqlite = getInObject<boolean>(configData, ['storage', 'formats', 'sqlite'], true)
  const formatHtml = getInObject<boolean>(configData, ['storage', 'formats', 'html'], true)
  const formatTxt = getInObject<boolean>(configData, ['storage', 'formats', 'txt'], false)
  const localDataDir = String(getInObject(configData, ['storage', 'local', 'data_dir'], 'output') ?? '')
  const localRetention = Number(
    getInObject<number>(configData, ['storage', 'local', 'retention_days'], 0),
  )

  const remoteEndpoint = String(
    getInObject(configData, ['storage', 'remote', 'endpoint_url'], '') ?? '',
  )
  const remoteBucket = String(
    getInObject(configData, ['storage', 'remote', 'bucket_name'], '') ?? '',
  )
  const remoteAccessKey = String(
    getInObject(configData, ['storage', 'remote', 'access_key_id'], '') ?? '',
  )
  const remoteSecretKey = String(
    getInObject(configData, ['storage', 'remote', 'secret_access_key'], '') ?? '',
  )
  const remoteRegion = String(getInObject(configData, ['storage', 'remote', 'region'], '') ?? '')
  const remoteRetention = Number(
    getInObject<number>(configData, ['storage', 'remote', 'retention_days'], 0),
  )

  const pullEnabled = getInObject<boolean>(configData, ['storage', 'pull', 'enabled'], false)
  const pullDays = Number(getInObject<number>(configData, ['storage', 'pull', 'days'], 7))

  // Email linkage
  const emailFrom = String(
    getInObject(configData, ['notification', 'channels', 'email', 'from'], '') ?? '',
  ).trim()
  const emailTo = String(
    getInObject(configData, ['notification', 'channels', 'email', 'to'], '') ?? '',
  ).trim()
  const emailConfigured = Boolean(emailFrom || emailTo)

  const remoteConfiguredFields =
    [remoteEndpoint, remoteBucket, remoteAccessKey, remoteSecretKey, remoteRegion].filter(
      (x) => x.trim().length > 0,
    ).length +
    (remoteRetention > 0 ? 1 : 0) +
    (pullEnabled ? 1 : 0)

  // Bottom Advanced: Developer & System Ops
  const debugMode = getInObject<boolean>(configData, ['advanced', 'debug'], false)
  const maxAccountsPerChannel = Number(
    getInObject<number>(configData, ['advanced', 'max_accounts_per_channel'], 3),
  )
  const batchSendInterval = Number(
    getInObject<number>(configData, ['advanced', 'batch_send_interval'], 3),
  )
  const feishuSeparator = String(
    getInObject(configData, ['advanced', 'feishu_message_separator'], DEFAULT_FEISHU_SEPARATOR) ??
      '',
  )

  const batchDefault = Number(
    getInObject<number>(configData, ['advanced', 'batch_size', 'default'], DEFAULT_BATCH_SIZES.default),
  )
  const batchDingtalk = Number(
    getInObject<number>(configData, ['advanced', 'batch_size', 'dingtalk'], DEFAULT_BATCH_SIZES.dingtalk),
  )
  const batchFeishu = Number(
    getInObject<number>(configData, ['advanced', 'batch_size', 'feishu'], DEFAULT_BATCH_SIZES.feishu),
  )
  const batchBark = Number(
    getInObject<number>(configData, ['advanced', 'batch_size', 'bark'], DEFAULT_BATCH_SIZES.bark),
  )
  const batchSlack = Number(
    getInObject<number>(configData, ['advanced', 'batch_size', 'slack'], DEFAULT_BATCH_SIZES.slack),
  )

  const versionCheckUrl = String(
    getInObject(configData, ['advanced', 'version_check_url'], DEFAULT_VERSION_URLS.version_check_url) ?? '',
  )
  const configsVersionCheckUrl = String(
    getInObject(
      configData,
      ['advanced', 'configs_version_check_url'],
      DEFAULT_VERSION_URLS.configs_version_check_url,
    ) ?? '',
  )
  const mcpVersionCheckUrl = String(
    getInObject(
      configData,
      ['advanced', 'mcp_version_check_url'],
      DEFAULT_VERSION_URLS.mcp_version_check_url,
    ) ?? '',
  )

  const advancedCustomizedCount =
    (debugMode ? 1 : 0) +
    (maxAccountsPerChannel !== 3 ? 1 : 0) +
    (batchSendInterval !== 3 ? 1 : 0) +
    (feishuSeparator !== DEFAULT_FEISHU_SEPARATOR ? 1 : 0) +
    (batchDefault !== DEFAULT_BATCH_SIZES.default ? 1 : 0) +
    (batchDingtalk !== DEFAULT_BATCH_SIZES.dingtalk ? 1 : 0) +
    (batchFeishu !== DEFAULT_BATCH_SIZES.feishu ? 1 : 0) +
    (batchBark !== DEFAULT_BATCH_SIZES.bark ? 1 : 0) +
    (batchSlack !== DEFAULT_BATCH_SIZES.slack ? 1 : 0) +
    (versionCheckUrl !== DEFAULT_VERSION_URLS.version_check_url ? 1 : 0) +
    (configsVersionCheckUrl !== DEFAULT_VERSION_URLS.configs_version_check_url ? 1 : 0) +
    (mcpVersionCheckUrl !== DEFAULT_VERSION_URLS.mcp_version_check_url ? 1 : 0)

  const handleApplyS3Provider = (preset: S3ProviderPreset) => {
    patchConfigValues([
      { path: ['storage', 'remote', 'endpoint_url'], value: preset.endpoint },
      { path: ['storage', 'remote', 'region'], value: preset.region },
    ])
    notify(
      t('已填入 {v0} 端点示例，请按需替换占位符与密钥', 'Filled {v1} endpoint template — replace placeholders with your details', { v0: preset.labelZh, v1: preset.labelEn }),
      'success',
    )
  }

  const handleResetAdvanced = () => {
    patchConfigValues([
      { path: ['advanced', 'debug'], value: false },
      { path: ['advanced', 'max_accounts_per_channel'], value: 3 },
      { path: ['advanced', 'batch_send_interval'], value: 3 },
      { path: ['advanced', 'feishu_message_separator'], value: DEFAULT_FEISHU_SEPARATOR },
      { path: ['advanced', 'batch_size', 'default'], value: DEFAULT_BATCH_SIZES.default },
      { path: ['advanced', 'batch_size', 'dingtalk'], value: DEFAULT_BATCH_SIZES.dingtalk },
      { path: ['advanced', 'batch_size', 'feishu'], value: DEFAULT_BATCH_SIZES.feishu },
      { path: ['advanced', 'batch_size', 'bark'], value: DEFAULT_BATCH_SIZES.bark },
      { path: ['advanced', 'batch_size', 'slack'], value: DEFAULT_BATCH_SIZES.slack },
      { path: ['advanced', 'version_check_url'], value: DEFAULT_VERSION_URLS.version_check_url },
      {
        path: ['advanced', 'configs_version_check_url'],
        value: DEFAULT_VERSION_URLS.configs_version_check_url,
      },
      {
        path: ['advanced', 'mcp_version_check_url'],
        value: DEFAULT_VERSION_URLS.mcp_version_check_url,
      },
    ])
    notify(t('已恢复系统运维参数默认值', 'Reset system tuning options to defaults'), 'success')
  }

  const backendOptions: Array<{
    value: StorageBackend
    icon: React.ReactNode
    titleZh: string
    titleEn: string
    tagZh: string
    tagEn: string
    descZh: string
    descEn: string
  }> = [
    {
      value: 'auto',
      icon: <Cpu className="h-4 w-4" />,
      titleZh: '自动判断',
      titleEn: 'Auto Detect',
      tagZh: '推荐',
      tagEn: 'Recommended',
      descZh: '云端有配置走 S3，否则自动落盘本地。',
      descEn: 'Uses S3 on Actions when configured; local otherwise.',
    },
    {
      value: 'local',
      icon: <HardDrive className="h-4 w-4" />,
      titleZh: '纯本地存储',
      titleEn: 'Local Storage',
      tagZh: 'SQLite + 报告',
      tagEn: 'SQLite + Files',
      descZh: '数据与报告仅保存在本地磁盘目录。',
      descEn: 'Keeps SQLite databases and reports on local disk.',
    },
    {
      value: 'remote',
      icon: <Cloud className="h-4 w-4" />,
      titleZh: '强制云端 S3',
      titleEn: 'Remote S3',
      tagZh: 'R2 / OSS / COS',
      tagEn: 'S3 Compatible',
      descZh: '强制读写 Cloudflare R2 / S3 对象存储。',
      descEn: 'Forces S3-compatible storage (R2, OSS, COS, S3).',
    },
  ]

  const renderRemoteS3Content = () => (
    <div className="space-y-5">
      {/* Provider Quick-fill Chips */}
      <div className="space-y-2.5">
        <div className="text-sm font-medium text-[var(--text-secondary)]">
          {t('常见 S3 服务商端点一键填入', 'Quick-Fill S3 Endpoint Templates')}
        </div>
        <div className="flex flex-wrap gap-2">
          {S3_PROVIDERS.map((prov) => (
            <Button
              key={prov.id}
              variant="outline"
              size="xs"
              onClick={() => handleApplyS3Provider(prov)}
            >
              <Cloud className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
              <span>{t(prov.labelZh, prov.labelEn)}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* S3 Fields */}
      <div className="grid grid-cols-1 gap-4 @min-[40rem]/section:grid-cols-2">
        <div className="space-y-1.5 @min-[40rem]/section:col-span-2">
          <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <span>{t('服务端点 (endpoint_url)', 'Endpoint URL (endpoint_url)')}</span>
            <code className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-muted)]">
              S3_ENDPOINT_URL
            </code>
          </label>
          <Input
            value={remoteEndpoint}
            onChange={(e) => setConfigValue(['storage', 'remote', 'endpoint_url'], e.target.value)}
            placeholder="https://<account_id>.r2.cloudflarestorage.com"
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <span>{t('存储桶名称 (bucket_name)', 'Bucket Name')}</span>
            <code className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-muted)]">
              S3_BUCKET_NAME
            </code>
          </label>
          <Input
            value={remoteBucket}
            onChange={(e) => setConfigValue(['storage', 'remote', 'bucket_name'], e.target.value)}
            placeholder="trendradar-data"
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <span>{t('区域 Region（可选）', 'Region (optional)')}</span>
            <code className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-muted)]">
              S3_REGION
            </code>
          </label>
          <Input
            value={remoteRegion}
            onChange={(e) => setConfigValue(['storage', 'remote', 'region'], e.target.value)}
            placeholder="auto / us-east-1"
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <span>{t('访问密钥 ID', 'Access Key ID')}</span>
            <code className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-muted)]">
              S3_ACCESS_KEY_ID
            </code>
          </label>
          <SecretInput
            value={remoteAccessKey}
            onChange={(v) => setConfigValue(['storage', 'remote', 'access_key_id'], v)}
            placeholder="AKIA..."
            envVar="S3_ACCESS_KEY_ID"
          />
        </div>

        <div className="space-y-1.5">
          <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <span>{t('访问密钥', 'Secret Access Key')}</span>
            <code className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-muted)]">
              S3_SECRET_ACCESS_KEY
            </code>
          </label>
          <SecretInput
            value={remoteSecretKey}
            onChange={(v) => setConfigValue(['storage', 'remote', 'secret_access_key'], v)}
            placeholder="••••••••••••••••"
            envVar="S3_SECRET_ACCESS_KEY"
          />
        </div>
      </div>

      <div className="border-t border-[var(--border-default)] pt-3">
        <SettingRow
          label={t('云端保留天数 (retention_days)', 'Remote Retention Days')}
          description={t(
            '自动清理过期云端历史数据，0 为永久保留。',
            'Prune remote archives older than N days (0 keeps forever).',
          )}
        >
          <div className="flex items-center gap-2 @min-[40rem]/section:w-44">
            <Input
              type="number"
              min={0}
              max={3650}
              value={Number.isFinite(remoteRetention) ? remoteRetention : 0}
              onChange={(e) =>
                setConfigValue(
                  ['storage', 'remote', 'retention_days'],
                  Math.max(0, Math.floor(Number(e.target.value) || 0)),
                )
              }
              className="font-mono text-right"
            />
            <span className="shrink-0 text-[13px] text-[var(--text-muted)]">
              {remoteRetention === 0 ? t('永久', 'Forever') : t('天', 'days')}
            </span>
          </div>
        </SettingRow>
      </div>

      {/* MCP / Local Remote Pull */}
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/55 p-4 space-y-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <CloudDownload className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand-primary)]" />
            <div className="min-w-0 space-y-0.5">
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {t('MCP / 本地启动自动拉取 (storage.pull)', 'Auto-Pull Remote Data on Startup')}
              </div>
              <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                {t(
                  '本地运行 MCP 时自动从 S3 同步最近 N 天数据库。',
                  'Syncs recent N days from S3 on startup for local MCP.',
                )}
              </p>
            </div>
          </div>
          <Switch
            checked={pullEnabled}
            onCheckedChange={(v) => setConfigValue(['storage', 'pull', 'enabled'], v)}
            ariaLabel={t('启用启动时自动拉取云端数据', 'Enable startup pull from remote storage')}
          />
        </div>

        <Collapsible open={pullEnabled}>
          <CollapsibleContent className="tr-collapsible-content">
            <div className="border-t border-[var(--border-default)] pt-3.5">
              <SettingRow
                label={t('拉取最近天数 (storage.pull.days)', 'Days to Pull')}
                description={t(
                  '启动时同步最近多少天云端数据库到本地。',
                  'Number of recent days to pull down on startup.',
                )}
              >
                <div className="flex items-center gap-2 @min-[40rem]/section:w-40">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={Number.isFinite(pullDays) ? pullDays : 7}
                    onChange={(e) =>
                      setConfigValue(
                        ['storage', 'pull', 'days'],
                        Math.max(1, Math.floor(Number(e.target.value) || 7)),
                      )
                    }
                    className="font-mono text-right bg-[var(--bg-surface)]"
                  />
                  <span className="shrink-0 text-[13px] text-[var(--text-muted)]">
                    {t('天', 'days')}
                  </span>
                </div>
              </SettingRow>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  )

  return (
    <SectionShell
      sectionId="storage"
      stepNumber="STEP 06"
      title={t('存储与系统', 'Storage & System')}
      subtitle={t(
        '设置运行时区、本地/云端存储策略与底层运维参数。',
        'Set runtime timezone, local/cloud storage, and system tuning.',
      )}
      docSlug="storage"
      sourceFile="config.yaml"
    >
      {/* ====================================================================
       * Card 1: Basic Runtime Environment (app)
       * ================================================================== */}
      <Card id="pro-anchor-app" className="p-6 space-y-3">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2.5">
            <Globe2 className="h-5 w-5 text-[var(--brand-primary)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {t('基础运行环境', 'Runtime Environment')}
            </h2>
          </div>
          <code className="rounded-md bg-[var(--bg-muted)] px-2 py-0.5 font-mono text-xs text-[var(--text-muted)]">
            app
          </code>
        </div>

        <div className="divide-y divide-[var(--border-default)]">
          <SettingRow
            label={t('运行与调度时区', 'Runtime & Schedule Timezone')}
            description={t(
              '决定报告里的时间显示、按天存档的切分时间以及定时推送按哪个地区算时间。',
              'Controls report timestamps, daily archive cutoff, and schedule clock.',
            )}
            envVar="TIMEZONE"
          >
            <div className="w-full @min-[40rem]/section:w-80 space-y-2">
              {!customTzMode ? (
                <SelectField
                  value={isPresetTz ? timezone : '__custom__'}
                  onValueChange={(v) => {
                    if (v === '__custom__') {
                      setCustomTzMode(true)
                    } else {
                      setConfigValue(['app', 'timezone'], v)
                    }
                  }}
                  options={[
                    ...COMMON_TIMEZONES.map((tz) => ({
                      value: tz.value,
                      label: t(tz.labelZh, tz.labelEn),
                      hint: tz.value,
                    })),
                    {
                      value: '__custom__',
                      label: t('自定义 IANA 时区名称...', 'Custom IANA timezone...'),
                      hint: t('如 Europe/Paris, America/Chicago', 'e.g. Europe/Paris, America/Chicago'),
                    },
                  ]}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    value={timezone}
                    onChange={(e) => setConfigValue(['app', 'timezone'], e.target.value)}
                    placeholder="Asia/Shanghai"
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCustomTzMode(false)
                      if (!isPresetTz) setConfigValue(['app', 'timezone'], 'Asia/Shanghai')
                    }}
                  >
                    {t('常用列表', 'Presets')}
                  </Button>
                </div>
              )}
            </div>
          </SettingRow>

          <SettingRow
            label={t('报告显示版本更新提示', 'Show Version Update Notice')}
            description={t(
              '检测到新版本时在报告顶部展示升级提醒。',
              'Show an upgrade notice in reports when updates arrive.',
            )}
            tooltip={t(
              '仅在 GitHub Actions 环境下生效，本地或 Docker 运行时自动静默。',
              'Applies on GitHub Actions only; stays silent in local or Docker runs.',
            )}
          >
            <Switch
              checked={showVersionUpdate}
              onCheckedChange={(v) => setConfigValue(['app', 'show_version_update'], v)}
              ariaLabel={t('显示版本更新提示', 'Show version update notice')}
            />
          </SettingRow>
        </div>
      </Card>

      {/* ====================================================================
       * Card 2: Data Storage Strategy (storage)
       * ================================================================== */}
      <Card id="pro-anchor-storage" className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2.5">
            <Database className="h-5 w-5 text-[var(--brand-primary)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {t('数据存储策略', 'Data Storage Strategy')}
            </h2>
          </div>
          <code className="rounded-md bg-[var(--bg-muted)] px-2 py-0.5 font-mono text-xs text-[var(--text-muted)]">
            storage
          </code>
        </div>

        {/* Storage Backend Single-Row Switcher + Progressive Summary */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {t('存储后端模式', 'Storage Backend')}
              </span>
              <code className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                storage.backend
              </code>
              <InfoTooltip
                content={t(
                  '自动选择：GitHub Actions 配好 S3 时优先写云端，否则回退本地；选择远程云存储时将在下方展开 S3 / Cloudflare R2 配置。',
                  'Auto prefers S3 in cloud workflows when configured and falls back to local SQLite; selecting Remote expands S3 / Cloudflare R2 settings below.',
                )}
              >
                <button
                  type="button"
                  className="tr-focus-ring inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--brand-primary)] cursor-help"
                  aria-label={t('存储后端说明', 'Storage backend info')}
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </InfoTooltip>
            </div>

            <div
              role="tablist"
              aria-label={t('存储后端模式切换', 'Storage backend selector')}
              className="grid w-full grid-cols-3 gap-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1 @min-[36rem]/section:w-auto"
            >
              {backendOptions.map((opt) => {
                const active = backend === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setConfigValue(['storage', 'backend'], opt.value)}
                    className={cn(
                      'tr-focus-ring inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-all cursor-pointer whitespace-nowrap',
                      active
                        ? 'bg-[var(--bg-surface)] font-semibold text-[var(--brand-primary)] shadow-[var(--shadow-xs)] ring-1 ring-[var(--brand-border)]'
                        : 'font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]/70 hover:text-[var(--text-primary)]',
                    )}
                  >
                    {opt.icon}
                    <span className="truncate">{t(opt.titleZh, opt.titleEn)}</span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" />}
                  </button>
                )
              })}
            </div>
          </div>

          {(() => {
            const activeOpt = backendOptions.find((o) => o.value === backend) ?? backendOptions[0]
            return (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--bg-subtle)]/75 px-3 py-2 text-xs text-[var(--text-secondary)]">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Badge tone="brand">{t(activeOpt.tagZh, activeOpt.tagEn)}</Badge>
                  <span>{t(activeOpt.descZh, activeOpt.descEn)}</span>
                </div>
                <code className="font-mono text-[11px] text-[var(--text-muted)]">
                  {activeOpt.value}
                </code>
              </div>
            )
          })()}
        </div>

        {/* Output Formats Row */}
        <div className="space-y-3 border-t border-[var(--border-default)] pt-5">
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            {t('输出文件格式 (storage.formats)', 'Output Formats (storage.formats)')}
          </div>

          {emailConfigured && !formatHtml && (
            <Callout
              tone="danger"
              icon={<ShieldAlert className="h-4 w-4 text-red-500" />}
              title={t(
                '已配置邮件渠道，必须开启 HTML 报告',
                'Email channel active — HTML report must remain ON',
              )}
              action={
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => {
                    setConfigValue(['storage', 'formats', 'html'], true)
                    notify(t('已重新开启 HTML 报告生成', 'Re-enabled HTML report generation'), 'success')
                  }}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  <span>{t('一键开启 HTML', 'Enable HTML')}</span>
                </Button>
              }
            >
              {t(
                '邮件发送器直接读取 HTML 报告作为正文。',
                'Email delivery sends the generated HTML file directly.',
              )}
            </Callout>
          )}

          <div className="grid grid-cols-1 gap-3 @min-[36rem]/section:grid-cols-3">
            {/* SQLite (Locked ON when true; re-enableable if manually set false in YAML) */}
            <div
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors',
                formatSqlite
                  ? 'border-[var(--border-default)] bg-[var(--bg-subtle)]/70'
                  : 'border-red-500/50 bg-red-500/8',
              )}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Database className="h-4 w-4 text-[var(--brand-primary)] shrink-0" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">SQLite</span>
                  {formatSqlite ? (
                    <Badge tone="neutral">
                      <Lock className="h-3 w-3" />
                      <span>{t('锁定', 'Locked')}</span>
                    </Badge>
                  ) : (
                    <Badge tone="danger">
                      <span>{t('已误关 · 必开', 'Disabled · Req.')}</span>
                    </Badge>
                  )}
                </div>
                <p className="text-[13px] text-[var(--text-muted)]">
                  {formatSqlite
                    ? t('主数据库不可关闭', 'Primary database')
                    : t('点击右侧开关恢复启用', 'Click switch to re-enable')}
                </p>
              </div>
              <Switch
                checked={formatSqlite}
                onCheckedChange={(v) => {
                  if (v) setConfigValue(['storage', 'formats', 'sqlite'], true)
                }}
                disabled={formatSqlite}
                ariaLabel={t('SQLite 主数据库开关', 'SQLite primary database toggle')}
              />
            </div>

            {/* HTML */}
            <div
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors',
                formatHtml
                  ? 'border-[var(--brand-border)] bg-[var(--brand-soft)]/40'
                  : 'border-[var(--border-default)] bg-[var(--bg-base)]/60',
              )}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <FileCode2 className="h-4 w-4 text-[var(--brand-primary)] shrink-0" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">HTML</span>
                  {emailConfigured && (
                    <Badge tone={formatHtml ? 'success' : 'danger'}>
                      {t('邮件必需', 'Email Req.')}
                    </Badge>
                  )}
                </div>
                <p className="text-[13px] text-[var(--text-muted)]">
                  {t('网页报告与邮件正文', 'Web report & email')}
                </p>
              </div>
              <Switch
                checked={formatHtml}
                onCheckedChange={(v) => setConfigValue(['storage', 'formats', 'html'], v)}
                ariaLabel={t('开启 HTML 报告', 'Enable HTML output')}
              />
            </div>

            {/* TXT */}
            <div
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors',
                formatTxt
                  ? 'border-[var(--brand-border)] bg-[var(--brand-soft)]/40'
                  : 'border-[var(--border-default)] bg-[var(--bg-base)]/60',
              )}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-[var(--brand-primary)] shrink-0" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">TXT</span>
                </div>
                <p className="text-[13px] text-[var(--text-muted)]">
                  {t('导出纯文本快照', 'Plain-text snapshots')}
                </p>
              </div>
              <Switch
                checked={formatTxt}
                onCheckedChange={(v) => setConfigValue(['storage', 'formats', 'txt'], v)}
                ariaLabel={t('开启 TXT 快照', 'Enable TXT snapshot')}
              />
            </div>
          </div>
        </div>

        {/* Local Storage Settings */}
        <div className="border-t border-[var(--border-default)] pt-5 space-y-2">
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            {t('本地存储设置 (storage.local)', 'Local Storage Settings (storage.local)')}
          </div>
          <div className="divide-y divide-[var(--border-default)]">
            <SettingRow
              label={t('本地数据目录 (data_dir)', 'Local Data Directory')}
              description={t(
                '存放数据库与报告文件的磁盘目录路径。',
                'Disk directory for SQLite archives and reports.',
              )}
            >
              <Input
                value={localDataDir}
                onChange={(e) => setConfigValue(['storage', 'local', 'data_dir'], e.target.value)}
                placeholder="output"
                className="font-mono text-sm @min-[40rem]/section:w-56"
              />
            </SettingRow>

            <SettingRow
              label={t('本地保留天数 (retention_days)', 'Local Retention Days')}
              description={t(
                '自动清理超过 N 天的历史目录，0 为永久保留。',
                'Auto-delete archives older than N days (0 keeps forever).',
              )}
            >
              <div className="flex items-center gap-2 @min-[40rem]/section:w-44">
                <Input
                  type="number"
                  min={0}
                  max={3650}
                  value={Number.isFinite(localRetention) ? localRetention : 0}
                  onChange={(e) =>
                    setConfigValue(
                      ['storage', 'local', 'retention_days'],
                      Math.max(0, Math.floor(Number(e.target.value) || 0)),
                    )
                  }
                  className="font-mono text-right"
                />
                <span className="shrink-0 text-[13px] text-[var(--text-muted)]">
                  {localRetention === 0 ? t('永久保留', 'Forever') : t('天', 'days')}
                </span>
              </div>
            </SettingRow>
          </div>
        </div>

        {/* Cloud S3 / R2 Progressive Disclosure: Expanded ONLY in remote mode; collapsed in auto & local */}
        <div id="pro-anchor-storage-remote" className="scroll-mt-4 border-t border-[var(--border-default)] pt-5">
          {backend === 'remote' ? (
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-soft)]/35 p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Cloud className="h-5 w-5 text-[var(--brand-primary)]" />
                  <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
                    {t('云端对象存储（S3 / R2）与 MCP 数据拉取', 'Cloud Object Storage (S3 / R2) & MCP Pull')}
                  </h3>
                  <code className="rounded bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-xs text-[var(--text-muted)]">
                    storage.remote
                  </code>
                </div>
                <Badge tone="brand">
                  {t('当前模式必填', 'Required in remote mode')}
                </Badge>
              </div>
              {renderRemoteS3Content()}
            </div>
          ) : (
            <AdvancedCollapsible
              forceOpenSeq={visualFocusTarget?.anchor === 'pro-anchor-storage-remote' ? visualFocusTarget.seq : undefined}
              sourceTarget={{ file: 'config.yaml', path: ['storage', 'remote'] }}
              title={t('云端对象存储（S3 / R2）与 MCP 数据拉取', 'Cloud Object Storage (S3 / R2) & MCP Pull')}
              description={
                backend === 'auto'
                  ? t(
                      'auto 模式默认走本地；需同步 R2 / S3 或配置 MCP 拉取时展开',
                      'Optional in auto mode; expand for S3 / R2 or MCP startup pull',
                    )
                  : t(
                      '当前为纯本地模式；如需预填 S3 或 MCP 云端拉取可展开',
                      'Local mode active; expand to pre-configure S3 or MCP pull',
                    )
              }
              customizedCount={remoteConfiguredFields}
              icon={<Cloud className="h-4 w-4" />}
            >
              {renderRemoteS3Content()}
            </AdvancedCollapsible>
          )}
        </div>
      </Card>

      {/* ====================================================================
       * Bottom AdvancedCollapsible: Developer Debug & Internal Ops Tuning
       * ================================================================== */}
      <AdvancedCollapsible
        id="pro-anchor-advanced"
        forceOpenSeq={visualFocusTarget?.anchor === 'pro-anchor-advanced' ? visualFocusTarget.seq : undefined}
        title={t('开发者调试与内部运维调优', 'Developer Debug & Ops Tuning')}
        description={t(
          '调试日志、单渠道账号上限、分批阈值与版本检查端点（advanced）',
          'Debug logs, channel cap, batch thresholds, and version URLs (advanced)',
        )}
        customizedCount={advancedCustomizedCount}
        icon={<Bug className="h-4 w-4" />}
      >
        <div className="space-y-5">
          {advancedCustomizedCount > 0 && (
            <div className="flex justify-end">
              <Button variant="ghost" size="xs" onClick={handleResetAdvanced}>
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{t('恢复运维参数默认值', 'Reset Ops Defaults')}</span>
              </Button>
            </div>
          )}

          <div className="divide-y divide-[var(--border-default)]">
            <SettingRow
              label={t('调试详细日志 (advanced.debug)', 'Verbose Debug Mode')}
              description={t(
                '输出详细抓取、分析与推送诊断日志，排查问题时开启。',
                'Outputs verbose diagnostics for troubleshooting.',
              )}
            >
              <Switch
                checked={debugMode}
                onCheckedChange={(v) => setConfigValue(['advanced', 'debug'], v)}
                ariaLabel={t('开启调试日志', 'Enable debug logging')}
              />
            </SettingRow>

            <SettingRow
              label={t('单渠道最大账号上限', 'Max Accounts per Channel')}
              description={t(
                '每个通知渠道分号拼接的最大并发账号数（默认 3）。',
                'Max semicolon-separated accounts per channel (default 3).',
              )}
            >
              <div className="flex items-center gap-2 @min-[40rem]/section:w-40">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={Number.isFinite(maxAccountsPerChannel) ? maxAccountsPerChannel : 3}
                  onChange={(e) =>
                    setConfigValue(
                      ['advanced', 'max_accounts_per_channel'],
                      Math.max(1, Math.floor(Number(e.target.value) || 3)),
                    )
                  }
                  className="font-mono text-right"
                />
                <span className="shrink-0 text-[13px] text-[var(--text-muted)]">
                  {t('个', 'accts')}
                </span>
              </div>
            </SettingRow>

            <SettingRow
              label={t('分批发送间隔 (batch_send_interval)', 'Batch Send Interval')}
              description={t(
                '长消息拆批发送的等待秒数，防限流（默认 3 秒）。',
                'Seconds between split batches to avoid rate limits (default 3s).',
              )}
            >
              <div className="flex items-center gap-2 @min-[40rem]/section:w-40">
                <Input
                  type="number"
                  min={0}
                  max={60}
                  value={Number.isFinite(batchSendInterval) ? batchSendInterval : 3}
                  onChange={(e) =>
                    setConfigValue(
                      ['advanced', 'batch_send_interval'],
                      Math.max(0, Number(e.target.value) || 0),
                    )
                  }
                  className="font-mono text-right"
                />
                <span className="shrink-0 text-[13px] text-[var(--text-muted)]">
                  {t('秒', 'sec')}
                </span>
              </div>
            </SettingRow>

            <SettingRow
              label={t('飞书消息分割线字符', 'Feishu Message Separator')}
              description={t(
                '飞书推送卡片内区分板块的分割线文本。',
                'Divider string between blocks in Feishu messages.',
              )}
            >
              <Input
                value={feishuSeparator}
                onChange={(e) =>
                  setConfigValue(['advanced', 'feishu_message_separator'], e.target.value)
                }
                placeholder={DEFAULT_FEISHU_SEPARATOR}
                className="font-mono text-sm @min-[40rem]/section:w-64"
              />
            </SettingRow>
          </div>

          {/* Batch Size Byte Limits */}
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/50 p-4 space-y-3.5">
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                {t('消息分批字节上限 (advanced.batch_size)', 'Message Payload Byte Caps')}
              </h4>
              <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                {t(
                  '各 IM 平台单条消息最大字节阈值，通常保持默认即可。',
                  'Per-platform byte threshold before splitting (keep defaults).',
                )}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 @min-[40rem]/section:grid-cols-5">
              {(
                [
                  { key: 'default', label: 'default', val: batchDefault, def: DEFAULT_BATCH_SIZES.default },
                  { key: 'dingtalk', label: 'dingtalk', val: batchDingtalk, def: DEFAULT_BATCH_SIZES.dingtalk },
                  { key: 'feishu', label: 'feishu', val: batchFeishu, def: DEFAULT_BATCH_SIZES.feishu },
                  { key: 'bark', label: 'bark', val: batchBark, def: DEFAULT_BATCH_SIZES.bark },
                  { key: 'slack', label: 'slack', val: batchSlack, def: DEFAULT_BATCH_SIZES.slack },
                ] as const
              ).map((item) => (
                <div key={item.key} className="space-y-1.5">
                  <label className="block font-mono text-xs text-[var(--text-secondary)]">
                    {item.label}
                  </label>
                  <Input
                    type="number"
                    min={500}
                    max={100000}
                    step={500}
                    value={Number.isFinite(item.val) ? item.val : item.def}
                    onChange={(e) =>
                      setConfigValue(
                        ['advanced', 'batch_size', item.key],
                        Math.max(500, Math.floor(Number(e.target.value) || item.def)),
                      )
                    }
                    className="h-9 font-mono text-sm text-right bg-[var(--bg-surface)]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Version Check URLs */}
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/50 p-4 space-y-3.5">
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                {t('版本检查端点 URL', 'Version Check Endpoints')}
              </h4>
              <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                {t(
                  '主程序、配置与 MCP 的远端版本清单地址，可改镜像源。',
                  'Remote raw URLs for app, configs, and MCP update checks.',
                )}
              </p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block font-mono text-xs text-[var(--text-secondary)]">
                  version_check_url
                </label>
                <Input
                  value={versionCheckUrl}
                  onChange={(e) =>
                    setConfigValue(['advanced', 'version_check_url'], e.target.value)
                  }
                  className="h-9 font-mono text-sm bg-[var(--bg-surface)]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block font-mono text-xs text-[var(--text-secondary)]">
                  configs_version_check_url
                </label>
                <Input
                  value={configsVersionCheckUrl}
                  onChange={(e) =>
                    setConfigValue(['advanced', 'configs_version_check_url'], e.target.value)
                  }
                  className="h-9 font-mono text-sm bg-[var(--bg-surface)]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block font-mono text-xs text-[var(--text-secondary)]">
                  mcp_version_check_url
                </label>
                <Input
                  value={mcpVersionCheckUrl}
                  onChange={(e) =>
                    setConfigValue(['advanced', 'mcp_version_check_url'], e.target.value)
                  }
                  className="h-9 font-mono text-sm bg-[var(--bg-surface)]"
                />
              </div>
            </div>
          </div>
        </div>
      </AdvancedCollapsible>
    </SectionShell>
  )
}
