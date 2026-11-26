import { strToU8, zipSync } from 'fflate'
import type { ConfigFileKey, ConfigFilesMap } from './types.ts'
import { ALL_CONFIG_FILES } from './types.ts'
import { getInObject, parseYamlSafe, setYamlValues, type YamlPatch, type YamlPath } from './yaml-doc.ts'

export interface SecretFieldSpec {
  envKey: string
  path: YamlPath
  labelZh: string
  labelEn: string
  category: 'notification' | 'ai' | 'search' | 'storage'
  sensitive?: boolean
}

export const SECRET_FIELD_SPECS: SecretFieldSpec[] = [
  { envKey: 'FEISHU_WEBHOOK_URL', path: ['notification', 'channels', 'feishu', 'webhook_url'], labelZh: '飞书 Webhook', labelEn: 'Feishu Webhook', category: 'notification', sensitive: true },
  { envKey: 'DINGTALK_WEBHOOK_URL', path: ['notification', 'channels', 'dingtalk', 'webhook_url'], labelZh: '钉钉 Webhook', labelEn: 'DingTalk Webhook', category: 'notification', sensitive: true },
  { envKey: 'WEWORK_WEBHOOK_URL', path: ['notification', 'channels', 'wework', 'webhook_url'], labelZh: '企业微信 Webhook', labelEn: 'WeWork Webhook', category: 'notification', sensitive: true },
  { envKey: 'TELEGRAM_BOT_TOKEN', path: ['notification', 'channels', 'telegram', 'bot_token'], labelZh: 'Telegram Bot Token', labelEn: 'Telegram Bot Token', category: 'notification', sensitive: true },
  { envKey: 'TELEGRAM_CHAT_ID', path: ['notification', 'channels', 'telegram', 'chat_id'], labelZh: 'Telegram Chat ID', labelEn: 'Telegram Chat ID', category: 'notification', sensitive: false },
  { envKey: 'EMAIL_FROM', path: ['notification', 'channels', 'email', 'from'], labelZh: '发件人邮箱', labelEn: 'Email From', category: 'notification', sensitive: false },
  { envKey: 'EMAIL_PASSWORD', path: ['notification', 'channels', 'email', 'password'], labelZh: '邮箱密码/授权码', labelEn: 'Email Password', category: 'notification', sensitive: true },
  { envKey: 'EMAIL_TO', path: ['notification', 'channels', 'email', 'to'], labelZh: '收件人邮箱', labelEn: 'Email To', category: 'notification', sensitive: false },
  { envKey: 'NTFY_TOPIC', path: ['notification', 'channels', 'ntfy', 'topic'], labelZh: 'ntfy 主题', labelEn: 'ntfy Topic', category: 'notification', sensitive: false },
  { envKey: 'NTFY_TOKEN', path: ['notification', 'channels', 'ntfy', 'token'], labelZh: 'ntfy 令牌', labelEn: 'ntfy Token', category: 'notification', sensitive: true },
  { envKey: 'BARK_URL', path: ['notification', 'channels', 'bark', 'url'], labelZh: 'Bark 推送 URL', labelEn: 'Bark URL', category: 'notification', sensitive: true },
  { envKey: 'SLACK_WEBHOOK_URL', path: ['notification', 'channels', 'slack', 'webhook_url'], labelZh: 'Slack Webhook', labelEn: 'Slack Webhook', category: 'notification', sensitive: true },
  { envKey: 'GENERIC_WEBHOOK_URL', path: ['notification', 'channels', 'generic_webhook', 'webhook_url'], labelZh: '通用 Webhook URL', labelEn: 'Generic Webhook URL', category: 'notification', sensitive: true },
  { envKey: 'AI_API_KEY', path: ['ai', 'api_key'], labelZh: 'AI 模型 API Key', labelEn: 'AI Model API Key', category: 'ai', sensitive: true },
  { envKey: 'WEB_SEARCH_API_KEY', path: ['web_search', 'providers', 'deepseek', 'api_key'], labelZh: '联网搜索 API Key', labelEn: 'Web Search API Key', category: 'search', sensitive: true },
  { envKey: 'S3_ENDPOINT_URL', path: ['storage', 'remote', 'endpoint_url'], labelZh: 'S3 端点 URL', labelEn: 'S3 Endpoint URL', category: 'storage', sensitive: false },
  { envKey: 'S3_BUCKET_NAME', path: ['storage', 'remote', 'bucket_name'], labelZh: 'S3 存储桶名', labelEn: 'S3 Bucket Name', category: 'storage', sensitive: false },
  { envKey: 'S3_ACCESS_KEY_ID', path: ['storage', 'remote', 'access_key_id'], labelZh: 'S3 Access Key ID', labelEn: 'S3 Access Key ID', category: 'storage', sensitive: true },
  { envKey: 'S3_SECRET_ACCESS_KEY', path: ['storage', 'remote', 'secret_access_key'], labelZh: 'S3 Secret Access Key', labelEn: 'S3 Secret Access Key', category: 'storage', sensitive: true },
]

const secretSpecByPath = new Map(SECRET_FIELD_SPECS.map((spec) => [JSON.stringify(spec.path), spec]))

export function secretEnvForPath(file: ConfigFileKey, path: YamlPath): string | undefined {
  if (file !== 'config.yaml') return undefined
  const direct = secretSpecByPath.get(JSON.stringify(path))
  if (direct) return direct.envKey
  if (path.length === 4 && path[0] === 'web_search' && path[1] === 'providers' && path[3] === 'api_key') {
    return 'WEB_SEARCH_API_KEY'
  }
  return undefined
}

export function isSensitiveField(file: ConfigFileKey, path: YamlPath): boolean {
  const spec = file === 'config.yaml' ? secretSpecByPath.get(JSON.stringify(path)) : undefined
  if (spec) return Boolean(spec.sensitive)
  return path.some((part) =>
    typeof part === 'string' && /(?:^|_)(password|secret|token|api_key|access_key_id|secret_access_key|authorization|webhook_url)$/i.test(part),
  )
}

export interface ExtractedSecret {
  envKey: string
  value: string
  labelZh: string
  labelEn: string
  category: SecretFieldSpec['category']
}

export function extractSecrets(configYaml: string): ExtractedSecret[] {
  const { data } = parseYamlSafe<Record<string, unknown>>(configYaml)
  if (!data) return []
  const result: ExtractedSecret[] = []
  const seenEnvKeys = new Set<string>()
  for (const spec of SECRET_FIELD_SPECS) {
    const raw = getInObject<unknown>(data, spec.path, '')
    const val = String(raw ?? '').trim()
    if (val) {
      seenEnvKeys.add(spec.envKey)
      result.push({
        envKey: spec.envKey,
        value: val,
        labelZh: spec.labelZh,
        labelEn: spec.labelEn,
        category: spec.category,
      })
    }
  }
  const wsProviders = getInObject<unknown>(data, ['web_search', 'providers'], null)
  if (wsProviders && typeof wsProviders === 'object' && !Array.isArray(wsProviders)) {
    for (const [provKey, provObj] of Object.entries(wsProviders as Record<string, unknown>)) {
      if (provKey === 'deepseek' || !provObj || typeof provObj !== 'object') continue
      const val = String((provObj as Record<string, unknown>).api_key ?? '').trim()
      if (val && !seenEnvKeys.has('WEB_SEARCH_API_KEY')) {
        seenEnvKeys.add('WEB_SEARCH_API_KEY')
        result.push({
          envKey: 'WEB_SEARCH_API_KEY',
          value: val,
          labelZh: `联网搜索 API Key (${provKey})`,
          labelEn: `Web Search API Key (${provKey})`,
          category: 'search',
        })
      }
    }
  }
  return result
}

export function sanitizeConfigYaml(configYaml: string): string {
  const { data } = parseYamlSafe<Record<string, unknown>>(configYaml)
  if (!data) return configYaml
  const patches: YamlPatch[] = []
  for (const spec of SECRET_FIELD_SPECS) {
    const raw = getInObject<unknown>(data, spec.path, '')
    if (String(raw ?? '').trim()) {
      patches.push({ path: spec.path, value: '' })
    }
  }
  const wsProviders = getInObject<unknown>(data, ['web_search', 'providers'], null)
  if (wsProviders && typeof wsProviders === 'object' && !Array.isArray(wsProviders)) {
    for (const [provKey, provObj] of Object.entries(wsProviders as Record<string, unknown>)) {
      if (provKey === 'deepseek' || !provObj || typeof provObj !== 'object') continue
      if (String((provObj as Record<string, unknown>).api_key ?? '').trim()) {
        patches.push({ path: ['web_search', 'providers', provKey, 'api_key'], value: '' })
      }
    }
  }
  if (patches.length === 0) return configYaml
  return setYamlValues(configYaml, patches)
}

export interface DockerEnvOptions {
  webserverPort?: string
  cronSchedule?: string
  runMode?: 'cron' | 'once'
  immediateRun?: boolean
  mcpHost?: string
  mcpPort?: string
}

export const DEFAULT_DOCKER_ENV_OPTIONS: Required<DockerEnvOptions> = {
  webserverPort: '8080',
  cronSchedule: '*/30 * * * *',
  runMode: 'cron',
  immediateRun: true,
  mcpHost: '',
  mcpPort: '',
}

function quoteEnvValue(val: string): string {
  if (/[\s#"'`$\\;]/.test(val)) {
    return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return val
}

function envAssignment(key: string, val: string): string {
  const trimmed = val.trim()
  return trimmed ? `${key}=${quoteEnvValue(trimmed)}` : `${key}=`
}

/**
 * Generates ONLY the non-empty secret/credential lines extracted from config.yaml.
 * Safe to merge line-by-line into an existing docker/.env without overwriting
 * customized WEBSERVER_PORT, CRON_SCHEDULE, RUN_MODE, MCP_PORT, etc.
 */
export function generateDotEnvSnippet(configYaml: string): string {
  const secrets = extractSecrets(configYaml)
  if (secrets.length === 0) {
    return '# 当前 config.yaml 未填写任何密钥或 Webhook 变量。\n'
  }
  const lines: string[] = [
    '# TrendRadar 已填写的密钥与通道变量（建议按行补充合并至已有 docker/.env，勿整文件覆盖）',
    '# 修改 docker/.env 后需执行: cd docker && docker compose up -d --force-recreate',
    '',
  ]
  for (const item of secrets) {
    lines.push(`${item.envKey}=${quoteEnvValue(item.value)}`)
  }
  return lines.join('\n') + '\n'
}

/**
 * Generates a complete docker/.env file aligned 1:1 with the repository's docker/.env template,
 * pre-filling credentials extracted from config.yaml and preserving all Docker runtime settings.
 * Non-secret switches/models (AI_ANALYSIS_ENABLED, AI_MODEL, etc.) stay blank so config/config.yaml
 * remains the single source of truth and takes effect immediately without recreating containers.
 */
export function generateDotEnv(
  configYaml: string,
  _includeEmptyPlaceholders = true,
  dockerOpts?: DockerEnvOptions,
): string {
  const { data } = parseYamlSafe<Record<string, unknown>>(configYaml)
  const secrets = extractSecrets(configYaml)
  const secretMap = new Map(secrets.map((item) => [item.envKey, item.value]))

  const getYamlStr = (path: YamlPath): string =>
    data ? String(getInObject<unknown>(data, path, '') ?? '').trim() : ''

  const opts: Required<DockerEnvOptions> = {
    webserverPort: (dockerOpts?.webserverPort ?? DEFAULT_DOCKER_ENV_OPTIONS.webserverPort).trim() || '8080',
    cronSchedule: (dockerOpts?.cronSchedule ?? DEFAULT_DOCKER_ENV_OPTIONS.cronSchedule).trim() || '*/30 * * * *',
    runMode: dockerOpts?.runMode === 'once' ? 'once' : 'cron',
    immediateRun: dockerOpts?.immediateRun ?? DEFAULT_DOCKER_ENV_OPTIONS.immediateRun,
    mcpHost: (dockerOpts?.mcpHost ?? '').trim(),
    mcpPort: (dockerOpts?.mcpPort ?? '').trim(),
  }

  const weworkMsgType = secretMap.get('WEWORK_WEBHOOK_URL') ? getYamlStr(['notification', 'channels', 'wework', 'msg_type']) : ''
  const emailSmtpServer = secretMap.get('EMAIL_FROM') ? getYamlStr(['notification', 'channels', 'email', 'smtp_server']) : ''
  const emailSmtpPort = secretMap.get('EMAIL_FROM') ? getYamlStr(['notification', 'channels', 'email', 'smtp_port']) : ''
  const ntfyServerRaw = secretMap.get('NTFY_TOPIC') ? getYamlStr(['notification', 'channels', 'ntfy', 'server_url']) : ''
  const ntfyServerUrl = ntfyServerRaw && ntfyServerRaw !== 'https://ntfy.sh' ? ntfyServerRaw : ''
  const genericTemplate = secretMap.get('GENERIC_WEBHOOK_URL') ? getYamlStr(['notification', 'channels', 'generic_webhook', 'payload_template']) : ''
  const s3Region = secretMap.get('S3_BUCKET_NAME') ? getYamlStr(['storage', 'remote', 'region']) : ''
  const webSearchKey = secretMap.get('WEB_SEARCH_API_KEY') ?? ''

  const lines: string[] = [
    '# ============================================',
    '# TrendRadar Docker 环境变量文件 (docker/.env)',
    '# 请勿提交包含密钥的 .env 到公开仓库',
    '# 已有 docker/.env 时建议按行合并，避免覆盖自定义端口或定时表达式',
    '# 修改后需重建容器生效: cd docker && docker compose up -d --force-recreate',
    '# ============================================',
    '',
    '# ============================================',
    '# Web 服务器配置',
    '# ============================================',
    '',
    '# Web 服务器端口（默认 8080，可自定义避免冲突）',
    '# cron 模式下自动启动，通过 http://localhost:{WEBSERVER_PORT} 访问报告',
    `WEBSERVER_PORT=${opts.webserverPort}`,
    '',
    '# ============================================',
    '# 通知渠道配置（多账号用 ; 分隔）',
    '# ============================================',
    '',
    '# 飞书机器人 webhook URL（多账号用 ; 分隔）',
    envAssignment('FEISHU_WEBHOOK_URL', secretMap.get('FEISHU_WEBHOOK_URL') ?? ''),
    '# Telegram Bot Token（多账号用 ; 分隔，需与 chat_id 数量一致）',
    envAssignment('TELEGRAM_BOT_TOKEN', secretMap.get('TELEGRAM_BOT_TOKEN') ?? ''),
    '# Telegram Chat ID（多账号用 ; 分隔，需与 bot_token 数量一致）',
    envAssignment('TELEGRAM_CHAT_ID', secretMap.get('TELEGRAM_CHAT_ID') ?? ''),
    '# 钉钉机器人 webhook URL（多账号用 ; 分隔）',
    envAssignment('DINGTALK_WEBHOOK_URL', secretMap.get('DINGTALK_WEBHOOK_URL') ?? ''),
    '# 企业微信机器人 webhook URL（多账号用 ; 分隔）',
    envAssignment('WEWORK_WEBHOOK_URL', secretMap.get('WEWORK_WEBHOOK_URL') ?? ''),
    '# 企业微信消息类型（markdown 或 text，留空则跟随 config.yaml）',
    envAssignment('WEWORK_MSG_TYPE', weworkMsgType),
    '',
    '# 邮件配置（邮箱已支持多收件人，逗号分隔）',
    envAssignment('EMAIL_FROM', secretMap.get('EMAIL_FROM') ?? ''),
    envAssignment('EMAIL_PASSWORD', secretMap.get('EMAIL_PASSWORD') ?? ''),
    envAssignment('EMAIL_TO', secretMap.get('EMAIL_TO') ?? ''),
    envAssignment('EMAIL_SMTP_SERVER', emailSmtpServer),
    envAssignment('EMAIL_SMTP_PORT', emailSmtpPort),
    '',
    '# ntfy 推送配置（多账号用 ; 分隔，topic 和 token 数量需一致）',
    '# ntfy 服务器地址（留空则默认使用 https://ntfy.sh）',
    envAssignment('NTFY_SERVER_URL', ntfyServerUrl),
    '# ntfy 主题名称（多账号用 ; 分隔）',
    envAssignment('NTFY_TOPIC', secretMap.get('NTFY_TOPIC') ?? ''),
    '# 可选：访问令牌（用于私有主题，多账号用 ; 分隔）',
    envAssignment('NTFY_TOKEN', secretMap.get('NTFY_TOKEN') ?? ''),
    '',
    '# Bark 推送配置（多账号用 ; 分隔）',
    envAssignment('BARK_URL', secretMap.get('BARK_URL') ?? ''),
    '',
    '# Slack 推送配置（多账号用 ; 分隔）',
    envAssignment('SLACK_WEBHOOK_URL', secretMap.get('SLACK_WEBHOOK_URL') ?? ''),
    '',
    '# 通用 Webhook 配置（多账号用 ; 分隔）',
    envAssignment('GENERIC_WEBHOOK_URL', secretMap.get('GENERIC_WEBHOOK_URL') ?? ''),
    '# JSON 模板，支持 {title} 和 {content} 占位符',
    envAssignment('GENERIC_WEBHOOK_TEMPLATE', genericTemplate),
    '',
    '# ============================================',
    '# AI 配置（ai_analysis 和 ai_translation 共享模型配置）',
    '# 说明：以下开关/模型项默认留空，由 config/config.yaml 统一控制（改完即刻生效）',
    '# ============================================',
    '',
    '# 是否启用 AI 分析 (true/false，留空跟随 config.yaml)',
    'AI_ANALYSIS_ENABLED=',
    '# AI API Key（启用 AI 功能时需要）',
    envAssignment('AI_API_KEY', secretMap.get('AI_API_KEY') ?? ''),
    '# 模型名称（留空跟随 config.yaml）',
    'AI_MODEL=',
    '# 自定义 API 端点（留空跟随 config.yaml）',
    'AI_API_BASE=',
    '',
    '# ============================================',
    '# 远程存储配置（S3 兼容协议，支持 R2/OSS/COS/S3 等）',
    '# ============================================',
    '',
    envAssignment('S3_ENDPOINT_URL', secretMap.get('S3_ENDPOINT_URL') ?? ''),
    envAssignment('S3_BUCKET_NAME', secretMap.get('S3_BUCKET_NAME') ?? ''),
    envAssignment('S3_ACCESS_KEY_ID', secretMap.get('S3_ACCESS_KEY_ID') ?? ''),
    envAssignment('S3_SECRET_ACCESS_KEY', secretMap.get('S3_SECRET_ACCESS_KEY') ?? ''),
    envAssignment('S3_REGION', s3Region),
    '',
    '# ============================================',
    '# MCP Server 配置',
    '# ============================================',
    '',
    '# MCP 监听地址（默认 127.0.0.1 仅本机访问，改 0.0.0.0 允许外部访问）',
    opts.mcpHost ? envAssignment('MCP_HOST', opts.mcpHost) : '# MCP_HOST=127.0.0.1',
    '# MCP 端口（默认 3333，如与其他服务冲突可修改）',
    opts.mcpPort ? envAssignment('MCP_PORT', opts.mcpPort) : '# MCP_PORT=3333',
    '',
    '# ============================================',
    '# 运行配置',
    '# ============================================',
    '',
    '# 定时任务表达式，默认每 30 分钟执行一次',
    `CRON_SCHEDULE=${opts.cronSchedule}`,
    '# 运行模式：cron/once',
    `RUN_MODE=${opts.runMode}`,
    '# 启动时立即执行一次',
    `IMMEDIATE_RUN=${opts.immediateRun ? 'true' : 'false'}`,
  ]

  if (webSearchKey) {
    lines.push(
      '',
      '# ============================================',
      '# 联网搜索 API Key（如用 DeepSeek 可自动复用 AI_API_KEY）',
      '# 注意：如需在 Docker 中经由环境变量注入，请确认 docker-compose.yml 的 environment 已透传 WEB_SEARCH_API_KEY',
      '# ============================================',
      envAssignment('WEB_SEARCH_API_KEY', webSearchKey),
    )
  }

  return lines.join('\n') + '\n'
}

export function buildConfigZipBlob(
  files: ConfigFilesMap,
  options: {
    selectedFiles?: ConfigFileKey[]
    sanitizeSecrets: boolean
    includeDotEnv: boolean
    dockerEnvOptions?: DockerEnvOptions
  },
): Blob {
  const chosen = options.selectedFiles && options.selectedFiles.length > 0
    ? options.selectedFiles
    : ALL_CONFIG_FILES

  const entries: Record<string, Uint8Array> = {}
  for (const key of chosen) {
    const content =
      key === 'config.yaml' && options.sanitizeSecrets
        ? sanitizeConfigYaml(files[key])
        : files[key]
    entries[`config/${key}`] = strToU8(content)
  }

  if (options.includeDotEnv) {
    entries['docker/.env'] = strToU8(generateDotEnv(files['config.yaml'], true, options.dockerEnvOptions))
  }

  const zipped = zipSync(entries, { level: 6 })
  const buffer = new ArrayBuffer(zipped.byteLength)
  new Uint8Array(buffer).set(zipped)
  return new Blob([buffer], { type: 'application/zip' })
}
