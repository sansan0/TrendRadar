import type { ConfigFilesMap, DeployMode, HealthIssue, RegionKey } from './types.ts'
import { ALL_REGIONS } from './types.ts'
import { parseFrequencyWords, testTitlesAgainstFrequency } from './frequency-parser.ts'
import { parseTimelinePresets, validateTimelinePreset } from './timeline-engine.ts'
import { getInObject, parseConfigYaml, type YamlParseResult } from './yaml-doc.ts'

function splitAccounts(val: unknown): string[] {
  const s = String(val ?? '').trim()
  if (!s) return []
  return s.split(';').map((x) => x.trim())
}

function localizeParseErrMsg(msg: string, lang: 'zh' | 'en'): string {
  if (lang === 'en' && msg === '配置文件最外层必须是键值映射（mapping）。') {
    return 'Top-level YAML value must be a key-value mapping.'
  }
  return msg
}

export function runHealthCheck(
  files: ConfigFilesMap,
  deployMode: DeployMode,
  parsed?: { config: YamlParseResult; timeline: YamlParseResult },
): HealthIssue[] {
  const issues: HealthIssue[] = []

  // 1. YAML syntax checks
  const cfgParsed = parsed?.config ?? parseConfigYaml(files['config.yaml'])
  if (cfgParsed.error) {
    issues.push({
      id: 'yaml-config-syntax',
      severity: 'error',
      section: 'onboarding',
      file: 'config.yaml',
      titleZh: 'config.yaml 存在 YAML 语法错误',
      titleEn: 'YAML syntax error in config.yaml',
      descZh: `第 ${cfgParsed.error.line ?? '?'} 行附近：${localizeParseErrMsg(cfgParsed.error.message, 'zh')}`,
      descEn: `Near line ${cfgParsed.error.line ?? '?'}: ${localizeParseErrMsg(cfgParsed.error.message, 'en')}`,
    })
  }

  const tlParsed = parsed?.timeline ?? parseConfigYaml(files['timeline.yaml'])
  if (tlParsed.error) {
    issues.push({
      id: 'yaml-timeline-syntax',
      severity: 'error',
      section: 'push',
      file: 'timeline.yaml',
      titleZh: 'timeline.yaml 存在 YAML 语法错误',
      titleEn: 'YAML syntax error in timeline.yaml',
      descZh: `第 ${tlParsed.error.line ?? '?'} 行附近：${localizeParseErrMsg(tlParsed.error.message, 'zh')}`,
      descEn: `Near line ${tlParsed.error.line ?? '?'}: ${localizeParseErrMsg(tlParsed.error.message, 'en')}`,
    })
  }

  const cfg = cfgParsed.data
  if (cfg) {
    const platformsEnabled = getInObject<boolean>(cfg, ['platforms', 'enabled'], true)
    const rssEnabled = getInObject<boolean>(cfg, ['rss', 'enabled'], true)
    const searchEnabled = getInObject<boolean>(cfg, ['web_search', 'enabled'], false)

    for (const [group, key] of [['platforms', 'sources'], ['rss', 'feeds']] as const) {
      const rows = getInObject<unknown>(cfg, [group, key], undefined)
      if (rows !== undefined && (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== 'object' || typeof (row as { id?: unknown }).id !== 'string' || !String((row as { id?: string }).id).trim()))) {
        issues.push({
          id: `invalid-${group}-list`, severity: 'error', section: 'sources', file: 'config.yaml',
          titleZh: `${group}.${key} 存在未完成或格式错误的来源`, titleEn: `Invalid entries in ${group}.${key}`,
          descZh: '来源必须是列表，每项应为包含非空 id 的键值映射；可在表单或源码中修正。',
          descEn: 'Use a list of mappings, each containing a non-empty id.',
        })
      } else if (Array.isArray(rows)) {
        const seenIds = new Set<string>()
        const dupIds = new Set<string>()
        for (const row of rows as Array<Record<string, unknown>>) {
          const id = String(row.id ?? '').trim()
          if (seenIds.has(id)) dupIds.add(id)
          seenIds.add(id)
        }
        if (dupIds.size > 0) {
          issues.push({
            id: `duplicate-${group}-id`,
            severity: 'warning',
            section: 'sources',
            file: 'config.yaml',
            titleZh: `${group}.${key} 存在重复的来源 ID：${[...dupIds].join(', ')}`,
            titleEn: `Duplicate ID(s) in ${group}.${key}: ${[...dupIds].join(', ')}`,
            descZh: '每个来源的 id 应当唯一，避免数据归档与独立展示区引用冲突。',
            descEn: 'Each source id should be unique to avoid collisions in storage and standalone display.',
          })
        }
        if (group === 'rss' && rows.some((row) => (row as { enabled?: boolean }).enabled !== false && !String((row as { url?: unknown }).url ?? '').trim())) {
          issues.push({
            id: 'rss-empty-url',
            severity: 'error',
            section: 'sources',
            file: 'config.yaml',
            titleZh: '已启用的 RSS 订阅源缺少订阅地址 (url)',
            titleEn: 'Enabled RSS feed is missing its URL',
            descZh: '请为所有启用的 RSS 订阅源填写有效的 HTTP/HTTPS 订阅地址，或暂时停用该源。',
            descEn: 'Provide a valid feed URL for every enabled RSS feed or disable the incomplete entry.',
          })
        }
      }
    }

    // Primary SQLite storage must remain enabled
    const sqliteEnabled = getInObject<boolean>(cfg, ['storage', 'formats', 'sqlite'], true)
    if (sqliteEnabled === false) {
      issues.push({
        id: 'sqlite-required',
        severity: 'error',
        section: 'storage',
        file: 'config.yaml',
        titleZh: '主存储 SQLite 被关闭 (storage.formats.sqlite = false)',
        titleEn: 'Primary SQLite storage is disabled (storage.formats.sqlite = false)',
        descZh: 'TrendRadar 依赖 SQLite 存储抓取记录、去重状态与历史数据，请保持开启。',
        descEn: 'TrendRadar relies on SQLite for deduplication and history archiving. Keep it enabled.',
        fixLabelZh: '立即恢复开启 SQLite',
        fixLabelEn: 'Re-enable SQLite',
        fixKey: 'enable_sqlite_format',
      })
    }

    if (!platformsEnabled && !rssEnabled && !searchEnabled) {
      issues.push({
        id: 'no-sources-enabled',
        severity: 'error',
        section: 'sources',
        file: 'config.yaml',
        titleZh: '所有数据源均已关闭',
        titleEn: 'All data sources are disabled',
        descZh: '热榜平台、RSS 订阅和联网搜索全部处于关闭状态，程序运行后将没有任何可抓取的数据。',
        descEn: 'Hotlist platforms, RSS feeds, and Web Search are all off. TrendRadar will collect nothing.',
      })
    }

    // AI Analysis enabled but display region disabled -> wastes tokens
    const aiAnalysisEnabled = getInObject<boolean>(cfg, ['ai_analysis', 'enabled'], false)
    const regionAiAnalysis = getInObject<boolean>(cfg, ['display', 'regions', 'ai_analysis'], true)
    if (aiAnalysisEnabled && !regionAiAnalysis) {
      issues.push({
        id: 'ai-analysis-hidden-token-waste',
        severity: 'warning',
        section: 'report',
        file: 'config.yaml',
        titleZh: 'AI 分析已开启，但推送展示区被隐藏（会白耗 Token）',
        titleEn: 'AI Analysis runs while its display region is hidden',
        descZh: '后端仍会调用大模型分析并产生费用，但最终推送中不会显示 AI 分析模块。建议开启展示区或关闭 AI 分析。',
        descEn: 'The LLM is still called and billed, yet the AI analysis block is hidden from notifications.',
        fixLabelZh: '一键开启 AI 分析展示区',
        fixLabelEn: 'Enable AI analysis region',
        fixKey: 'enable_region_ai_analysis',
      })
    }

    // Region switch ON but missing from region_order
    const rawOrder = getInObject<unknown>(cfg, ['display', 'region_order'], [])
    const regionOrder = Array.isArray(rawOrder) ? rawOrder : []
    const missingInOrder: RegionKey[] = []
    for (const r of ALL_REGIONS) {
      const enabled = getInObject<boolean>(cfg, ['display', 'regions', r], false)
      if (enabled && !regionOrder.includes(r)) {
        missingInOrder.push(r)
      }
    }
    if (missingInOrder.length > 0) {
      issues.push({
        id: 'region-missing-from-order',
        severity: 'warning',
        section: 'report',
        file: 'config.yaml',
        titleZh: `已启用的展示区域不在排序列表中：${missingInOrder.join(', ')}`,
        titleEn: `Enabled regions missing from region_order: ${missingInOrder.join(', ')}`,
        descZh: '仅开启 display.regions 开关但未加入 region_order 时，推送和报告不会渲染该区域。',
        descEn: 'Enabled regions omitted from display.region_order will not be rendered.',
        fixLabelZh: '一键补全排序列表',
        fixLabelEn: 'Add missing regions to order',
        fixKey: 'fix_region_order',
      })
    }

    // Email configured while HTML format disabled + incomplete email credentials check
    const emailFrom = String(getInObject(cfg, ['notification', 'channels', 'email', 'from'], '') ?? '').trim()
    const emailPassword = String(getInObject(cfg, ['notification', 'channels', 'email', 'password'], '') ?? '').trim()
    const emailTo = String(getInObject(cfg, ['notification', 'channels', 'email', 'to'], '') ?? '').trim()
    const htmlEnabled = getInObject<boolean>(cfg, ['storage', 'formats', 'html'], true)
    if ((emailFrom || emailTo) && !htmlEnabled) {
      issues.push({
        id: 'email-requires-html',
        severity: 'error',
        section: 'storage',
        file: 'config.yaml',
        titleZh: '邮件推送依赖 HTML 报告，但 storage.formats.html 已关闭',
        titleEn: 'Email channel requires storage.formats.html = true',
        descZh: 'TrendRadar 发送邮件时直接读取生成的 HTML 报告文件，关闭 html 会导致邮件推送报错失败。',
        descEn: 'Email delivery reads the generated HTML report; disabling HTML will cause email sending to fail.',
        fixLabelZh: '立即开启 HTML 报告',
        fixLabelEn: 'Enable HTML output',
        fixKey: 'enable_html_format',
      })
    }
    if ((emailFrom || emailPassword || emailTo) && (!emailFrom || !emailTo)) {
      issues.push({
        id: 'email-incomplete',
        severity: 'warning',
        section: 'push',
        file: 'config.yaml',
        titleZh: '邮件渠道配置尚未填齐发件人或收件人',
        titleEn: 'Email channel is missing sender or recipient address',
        descZh: '邮件推送需同时配置发件人 (from)、授权码 (password，或通过环境变量注入) 与收件人 (to)。',
        descEn: 'Email delivery requires both sender (from), password (or EMAIL_PASSWORD env), and recipient (to).',
      })
    }

    // Telegram / ntfy pairing checks
    const tgTokens = splitAccounts(getInObject(cfg, ['notification', 'channels', 'telegram', 'bot_token'], ''))
    const tgChats = splitAccounts(getInObject(cfg, ['notification', 'channels', 'telegram', 'chat_id'], ''))
    if ((tgTokens.length > 0 || tgChats.length > 0) && tgTokens.length !== tgChats.length) {
      issues.push({
        id: 'telegram-pair-mismatch',
        severity: 'error',
        section: 'push',
        file: 'config.yaml',
        titleZh: 'Telegram Bot Token 与 Chat ID 数量不一致',
        titleEn: 'Telegram Bot Token & Chat ID count mismatch',
        descZh: `当前检测到 ${tgTokens.length} 个 Token 与 ${tgChats.length} 个 Chat ID。多账号配对数量不一致会导致整个 Telegram 渠道被跳过。`,
        descEn: `Found ${tgTokens.length} token(s) and ${tgChats.length} chat ID(s). Mismatched pairs cause the entire channel to be skipped.`,
      })
    }

    const ntfyTopics = splitAccounts(getInObject(cfg, ['notification', 'channels', 'ntfy', 'topic'], ''))
    const ntfyRawToken = String(getInObject(cfg, ['notification', 'channels', 'ntfy', 'token'], '') ?? '').trim()
    const ntfyTokens = ntfyRawToken ? ntfyRawToken.split(';') : []
    if (ntfyTopics.length > 0 && ntfyTokens.length > 0 && ntfyTopics.length !== ntfyTokens.length) {
      issues.push({
        id: 'ntfy-pair-mismatch',
        severity: 'error',
        section: 'push',
        file: 'config.yaml',
        titleZh: 'ntfy Topic 与 Token 配对数量不一致',
        titleEn: 'ntfy Topic & Token count mismatch',
        descZh: `配置了 ${ntfyTopics.length} 个 Topic 但填写了 ${ntfyTokens.length} 段 Token。若部分主题无 Token 请用空段占位（如 ";token2"）。`,
        descEn: `${ntfyTopics.length} topic(s) vs ${ntfyTokens.length} token segment(s). Use empty semicolon slots (e.g. ";token2") for public topics.`,
      })
    }

    // AI Model format & relay check
    const filterMethod = getInObject<string>(cfg, ['filter', 'method'], 'keyword')
    const aiTransEnabled = getInObject<boolean>(cfg, ['ai_translation', 'enabled'], false)
    const searchSmart = searchEnabled && getInObject<string>(cfg, ['web_search', 'query_mode'], 'direct') === 'smart'
    const anyAiUsed = aiAnalysisEnabled || aiTransEnabled || filterMethod === 'ai' || searchSmart
    const aiModel = String(getInObject(cfg, ['ai', 'model'], '') ?? '').trim()
    const aiBase = String(getInObject(cfg, ['ai', 'api_base'], '') ?? '').trim()

    if (anyAiUsed) {
      if (!aiModel || !aiModel.includes('/')) {
        issues.push({
          id: 'ai-model-format',
          severity: 'error',
          section: 'ai',
          file: 'config.yaml',
          titleZh: 'AI 模型格式必须为 "提供商/模型名"',
          titleEn: 'AI model must follow "provider/model" format',
          descZh: `当前值 "${aiModel || '(空)'}" 缺少斜杠前缀（如 deepseek/deepseek-v4-flash 或 openai/gpt-4o），LiteLLM 会直接校验失败。`,
          descEn: `Current value "${aiModel || '(empty)'}" lacks a provider prefix (e.g. deepseek/deepseek-v4-flash).`,
        })
      } else if (aiBase && !aiModel.startsWith('openai/') && !aiModel.startsWith('azure/') && !aiModel.startsWith('ollama/')) {
        issues.push({
          id: 'ai-relay-prefix',
          severity: 'warning',
          section: 'ai',
          file: 'config.yaml',
          titleZh: '填写了自定义 API 中转地址，建议模型前加 openai/ 前缀',
          titleEn: 'Custom api_base usually requires an "openai/" model prefix',
          descZh: `当前 api_base 为 "${aiBase}"，而模型为 "${aiModel}"。绝大多数中转站使用 OpenAI 兼容协议，建议改为 openai/${aiModel.split('/').slice(1).join('/') || aiModel}。`,
          descEn: `With custom api_base "${aiBase}", LiteLLM typically expects "openai/<model>" for OpenAI-compatible relays.`,
        })
      }
    }

    // AI Translation scope vs display regions mismatch
    if (aiTransEnabled) {
      const scopePairs: Array<[string, RegionKey]> = [
        ['hotlist', 'hotlist'],
        ['rss', 'rss'],
        ['web_search', 'web_search'],
        ['standalone', 'standalone'],
      ]
      const shadowed = scopePairs
        .filter(
          ([sc, reg]) =>
            getInObject<boolean>(cfg, ['ai_translation', 'scope', sc], false) &&
            !getInObject<boolean>(cfg, ['display', 'regions', reg], false),
        )
        .map(([sc]) => sc)
      if (shadowed.length > 0) {
        issues.push({
          id: 'translation-scope-hidden',
          severity: 'info',
          section: 'ai',
          file: 'config.yaml',
          titleZh: `翻译范围已勾选但对应展示区未开启：${shadowed.join(', ')}`,
          titleEn: `Translation enabled for hidden display region(s): ${shadowed.join(', ')}`,
          descZh: 'display.regions 关闭的区域后端会自动跳过翻译；如需展示并翻译这些区域，请在「报告与版面」中开启。',
          descEn: 'Regions disabled in display.regions are automatically skipped by translation.',
        })
      }
    }

    // Weight sum check
    const wRank = Number(getInObject(cfg, ['advanced', 'weight', 'rank'], 0.6))
    const wFreq = Number(getInObject(cfg, ['advanced', 'weight', 'frequency'], 0.3))
    const wHot = Number(getInObject(cfg, ['advanced', 'weight', 'hotness'], 0.1))
    const wSum = wRank + wFreq + wHot
    if (Math.abs(wSum - 1) > 0.015) {
      issues.push({
        id: 'weight-sum-mismatch',
        severity: 'warning',
        section: 'report',
        file: 'config.yaml',
        titleZh: `热榜排序三项权重之和应为 1.0（当前为 ${wSum.toFixed(2)}）`,
        titleEn: `Ranking weights should sum to 1.0 (currently ${wSum.toFixed(2)})`,
        descZh: 'rank + frequency + hotness 建议总和为 1.0，避免综合热度分值偏离预期。',
        descEn: 'rank + frequency + hotness should add up to 1.0 for consistent scoring.',
        fixLabelZh: '自动归一化为 1.0',
        fixLabelEn: 'Normalize to 1.0',
        fixKey: 'normalize_weights',
      })
    }

    // GitHub Actions specific checks
    if (deployMode === 'github_actions') {
      const rssProxy = getInObject<boolean>(cfg, ['advanced', 'rss', 'use_proxy'], false)
      const wsProxy = getInObject<boolean>(cfg, ['advanced', 'web_search', 'use_proxy'], false)
      if (rssProxy || wsProxy) {
        issues.push({
          id: 'gha-proxy-trap',
          severity: 'error',
          section: 'sources',
          file: 'config.yaml',
          titleZh: 'GitHub Actions 环境下 RSS / 联网搜索不应开启本地代理',
          titleEn: 'Disable local proxy for RSS / Web Search on GitHub Actions',
          descZh: '热榜会自动忽略 Actions 代理，但 RSS 和联网搜索仍会尝试连接代理地址（如 127.0.0.1），导致云端抓取失败。',
          descEn: 'Unlike hotlists, RSS and Web Search honor use_proxy in GitHub Actions and will fail against local proxies.',
          fixLabelZh: '一键关闭所有代理',
          fixLabelEn: 'Disable all proxies',
          fixKey: 'disable_proxies',
        })
      }

      const wsProvider = String(getInObject(cfg, ['web_search', 'provider'], 'deepseek') || 'deepseek')
      const secretPaths: Array<[string, string[]]> = [
        ['AI API Key', ['ai', 'api_key']],
        ['Web Search Key', ['web_search', 'providers', wsProvider, 'api_key']],
        ['Feishu Webhook', ['notification', 'channels', 'feishu', 'webhook_url']],
        ['DingTalk Webhook', ['notification', 'channels', 'dingtalk', 'webhook_url']],
        ['WeWork Webhook', ['notification', 'channels', 'wework', 'webhook_url']],
        ['Telegram Bot Token', ['notification', 'channels', 'telegram', 'bot_token']],
        ['Email Password', ['notification', 'channels', 'email', 'password']],
        ['ntfy Token', ['notification', 'channels', 'ntfy', 'token']],
        ['Bark URL', ['notification', 'channels', 'bark', 'url']],
        ['Slack Webhook', ['notification', 'channels', 'slack', 'webhook_url']],
        ['Generic Webhook', ['notification', 'channels', 'generic_webhook', 'webhook_url']],
        ['S3 Access Key ID', ['storage', 'remote', 'access_key_id']],
        ['S3 Secret Key', ['storage', 'remote', 'secret_access_key']],
      ]
      const exposed = secretPaths
        .filter(([, p]) => String(getInObject(cfg, p, '') ?? '').trim().length > 0)
        .map(([label]) => label)

      if (exposed.length > 0) {
        issues.push({
          id: 'gha-secrets-in-yaml',
          severity: 'warning',
          section: 'push',
          file: 'config.yaml',
          titleZh: `检测到 ${exposed.length} 项敏感密钥直接写在 config.yaml 中`,
          titleEn: `${exposed.length} secret(s) detected in config.yaml`,
          descZh: `包含：${exposed.slice(0, 4).join('、')}${exposed.length > 4 ? ' 等' : ''}。GitHub 仓库切勿提交明文密钥，请在「导出配置」中开启自动脱敏并改用 GitHub Secrets。`,
          descEn: `Detected: ${exposed.slice(0, 4).join(', ')}. Enable sanitization in Export Center and move them to GitHub Secrets.`,
        })
      }

      const storageBackend = getInObject<string>(cfg, ['storage', 'backend'], 'auto')
      const s3Ready = [
        ['storage', 'remote', 'endpoint_url'],
        ['storage', 'remote', 'bucket_name'],
        ['storage', 'remote', 'access_key_id'],
        ['storage', 'remote', 'secret_access_key'],
      ].every((p) => String(getInObject(cfg, p, '') ?? '').trim().length > 0)
      if (storageBackend === 'remote' && !s3Ready) {
        issues.push({
          id: 's3-incomplete',
          severity: 'warning',
          section: 'storage',
          file: 'config.yaml',
          titleZh: '远程存储已选 remote，但 S3 必填四项尚未配齐',
          titleEn: 'Remote storage selected without complete S3 credentials',
          descZh: '需填写 Endpoint、Bucket、Access Key、Secret Key（或通过 GitHub Secrets 注入）。',
          descEn: 'Provide Endpoint, Bucket, Access Key, and Secret Key (or inject via GitHub Secrets).',
        })
      }
    }

    // Timeline active preset validation
    const scheduleEnabled = getInObject<boolean>(cfg, ['schedule', 'enabled'], false)
    const activePresetKey = getInObject<string>(cfg, ['schedule', 'preset'], 'morning_evening')
    if (scheduleEnabled && !tlParsed.error) {
      const { presets, error: structureErrorEn } = parseTimelinePresets(files['timeline.yaml'], 'en')
      const activePreset = presets.find((p) => p.key === activePresetKey)
      if (structureErrorEn) {
        const structureErrorZh = parseTimelinePresets(files['timeline.yaml'], 'zh').error ?? structureErrorEn
        issues.push({
          id: 'timeline-structure', severity: 'error', section: 'push', file: 'timeline.yaml',
          titleZh: '时间线配置结构有误', titleEn: 'Invalid timeline structure',
          descZh: `请在源码中修正：${structureErrorZh}。`, descEn: `Fix ${structureErrorEn} in the source.`,
        })
      } else if (!activePreset) {
        issues.push({
          id: 'timeline-missing-preset',
          severity: 'error',
          section: 'push',
          file: 'timeline.yaml',
          titleZh: `找不到调度预设 "${activePresetKey}"`,
          titleEn: `Schedule preset "${activePresetKey}" not found in timeline.yaml`,
          descZh: 'config.yaml 中指定的 schedule.preset 在 timeline.yaml 里不存在，启动将报错。',
          descEn: 'The active schedule.preset in config.yaml does not exist in timeline.yaml.',
        })
      } else {
        const tlIssues = validateTimelinePreset(activePreset.key, activePreset.config)
        for (const ti of tlIssues) {
          if (ti.type === 'short_window' && deployMode !== 'github_actions') continue
          issues.push({
            id: `tl-${ti.type}-${ti.periodKey ?? ti.day ?? 'all'}`,
            severity: ti.type === 'short_window' ? 'info' : 'error',
            section: 'push',
            file: 'timeline.yaml',
            titleZh:
              ti.type === 'short_window'
                ? `时段 "${ti.periodKey}" 小于 2 小时（GitHub Actions 存在延迟风险）`
                : `时间线配置异常：${ti.detailZh}`,
            titleEn:
              ti.type === 'short_window'
                ? `Period "${ti.periodKey}" is under 2h (risky on GitHub Actions)`
                : `Timeline error: ${ti.detailEn}`,
            descZh:
              ti.type === 'short_window'
                ? 'GitHub Actions 定时触发存在随机延迟，建议时段窗口至少保留 2 小时裕量。'
                : '请前往「推送与定时」检查时间线时段与日计划映射，否则后端启动校验会直接退出。',
            descEn:
              ti.type === 'short_window'
                ? 'GitHub Actions cron can be delayed; keep period windows at least 2 hours wide.'
                : 'Fix this period/day_plan issue under Push & Schedule to prevent startup failure.',
          })
        }

        // Check backend trap: period sets filter_method: "ai" while global filter.method != "ai"
        if (filterMethod !== 'ai') {
          const periodUsesAi =
            activePreset.config.default.filter_method === 'ai' ||
            Object.values(activePreset.config.periods).some((p) => p?.filter_method === 'ai')
          if (periodUsesAi) {
            issues.push({
              id: 'timeline-ai-filter-trap',
              severity: 'warning',
              section: 'push',
              file: 'timeline.yaml',
              titleZh: '时间线设置了 AI 筛选，但全局 filter.method 仍为 keyword',
              titleEn: 'Timeline sets filter_method=ai while global filter.method is keyword',
              descZh: '后端当前实现中，全局 filter.method 未设为 ai 时，时段级 filter_method: ai 会静默回退到关键词模式。',
              descEn: 'In the current backend, period-level filter_method: ai falls back to keyword unless global filter.method is "ai".',
            })
          }
        }
      }
    }
  }

  // Frequency words regex check
  const freqDoc = parseFrequencyWords(files['frequency_words.txt'])
  const { regexWarnings } = testTitlesAgainstFrequency(freqDoc, [])
  if (regexWarnings.length > 0) {
    issues.push({
      id: 'frequency-invalid-regex',
      severity: 'warning',
      section: 'filter',
      file: 'frequency_words.txt',
      titleZh: `关键词配置中有 ${regexWarnings.length} 条无效正则表达式`,
      titleEn: `${regexWarnings.length} invalid regex pattern(s) in frequency_words.txt`,
      descZh: `如 /${regexWarnings[0].pattern}/（${regexWarnings[0].error}）。后端运行时会静默降级为纯文本字面量匹配。`,
      descEn: `e.g. /${regexWarnings[0].pattern}/ (${regexWarnings[0].error}). Backend falls back to plain literal matching.`,
    })
  }

  // Prompt template placeholder integrity checks
  const analysisPrompt = files['ai_analysis_prompt.txt'] || ''
  if (!analysisPrompt.includes('[system]') || !analysisPrompt.includes('[user]') || !analysisPrompt.includes('{news_content}')) {
    issues.push({
      id: 'prompt-analysis-contract',
      severity: 'warning',
      section: 'ai',
      file: 'ai_analysis_prompt.txt',
      titleZh: 'AI 分析提示词缺少必要区块或占位符',
      titleEn: 'AI analysis prompt is missing required markers or placeholders',
      descZh: '请确保保留 [system]、[user] 分隔标记以及 {news_content} 核心占位符，否则分析调用可能异常。',
      descEn: 'Keep [system], [user] headers and the {news_content} placeholder intact.',
    })
  }

  const transPrompt = files['ai_translation_prompt.txt'] || ''
  if (!transPrompt.includes('[system]') || !transPrompt.includes('[user]') || !transPrompt.includes('{content}') || !transPrompt.includes('{target_language}')) {
    issues.push({
      id: 'prompt-translation-contract',
      severity: 'warning',
      section: 'ai',
      file: 'ai_translation_prompt.txt',
      titleZh: 'AI 翻译提示词缺少必要占位符',
      titleEn: 'AI translation prompt is missing required placeholders',
      descZh: '请确保保留 [system]、[user] 以及 {target_language}、{content} 占位符，否则翻译结果会错位。',
      descEn: 'Keep [system], [user], {target_language}, and {content} placeholders intact.',
    })
  }

  return issues
}
