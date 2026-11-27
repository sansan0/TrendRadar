import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BellRing,
  Code2,
  Columns2,
  Compass,
  Database,
  Download,
  Filter,
  HardDrive,
  History,
  LayoutList,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react'
import { ModalDialog } from '@/components/ui/primitives'
import { useT } from '@/i18n'
import type { ConfigFileKey } from '@/lib/types'
import { featureForSource, type SourceTarget } from '@/lib/pro-navigation'
import { cn } from '@/lib/utils'
import { useEditor } from '@/store/editor-store'

interface CommandEntry {
  id: string
  titleZh: string
  titleEn: string
  keywords: string
  categoryZh: string
  categoryEn: string
  icon: React.ReactNode
  run: () => void
}

export function CommandPalette() {
  const {
    commandOpen,
    setCommandOpen,
    setActiveSection,
    setWorkspaceMode,
    setVersionsOpen,
    setExportOpen,
    setImportOpen,
    jumpToSource,
    workspaceMode,
    openSourceTarget,
    focusVisual,
    setSourcesSubTab,
  } = useEditor()
  const t = useT()

  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)

  const entries: CommandEntry[] = useMemo(() => {
    const goTarget = (target: SourceTarget) => () => {
      const location = featureForSource(target.file, 'path' in target ? target.path : [])
      if (workspaceMode === 'pro') {
        openSourceTarget(target)
      } else if (location) {
        if (location.tab) setSourcesSubTab(location.tab)
        focusVisual(location.section, location.anchor, {
          channel: location.channel,
          filterMode: location.filterMode,
          timelineTab: location.timelineTab,
        })
      }
      setCommandOpen(false)
    }
    const goConfig = (key: string) => goTarget({ file: 'config.yaml', path: [key] })
    const openFile = (f: ConfigFileKey) => () => {
      jumpToSource(f)
      setCommandOpen(false)
    }

    return [
      {
        id: 'sec-onboard',
        titleZh: '快速上手与场景预设（进入引导模式）',
        titleEn: 'Quick Start & Presets (Guided Mode)',
        keywords: 'start preset guide onboarding 预设 引导',
        categoryZh: '步骤导航',
        categoryEn: 'Navigation',
        icon: <Compass className="h-4 w-4" />,
        run: () => {
          if (workspaceMode === 'pro') setWorkspaceMode('guided')
          setActiveSection('onboarding')
          setCommandOpen(false)
        },
      },
      { id: 'sec-platforms', titleZh: '热榜平台配置 (platforms)', titleEn: 'Hotlist Platforms', keywords: 'platforms zhihu weibo toutiao expected_domain 热榜 平台 域名校验', categoryZh: '信息来源', categoryEn: 'Sources', icon: <Database className="h-4 w-4" />, run: goConfig('platforms') },
      { id: 'sec-rss', titleZh: 'RSS 订阅源与新鲜度过滤', titleEn: 'RSS Feeds & Freshness', keywords: 'rss feed atom freshness_filter 订阅 博客', categoryZh: '信息来源', categoryEn: 'Sources', icon: <Database className="h-4 w-4" />, run: goConfig('rss') },
      { id: 'sec-websearch', titleZh: '联网搜索与 search_queries.txt', titleEn: 'Web Search & Queries', keywords: 'web_search deepseek search_queries min_score min_authority 联网搜索 质量漏斗', categoryZh: '信息来源', categoryEn: 'Sources', icon: <Database className="h-4 w-4" />, run: goConfig('web_search') },
      { id: 'sec-keywords', titleZh: '关键词筛选与 frequency_words.txt 沙盒', titleEn: 'Keywords & Match Sandbox', keywords: 'frequency_words regex alias filter 关键词 正则 排除 必含 测试', categoryZh: '内容筛选', categoryEn: 'Filter', icon: <Filter className="h-4 w-4" />, run: goTarget({ file: 'frequency_words.txt', line: 1 }) },
      { id: 'sec-aifilter', titleZh: 'AI 智能筛选与 ai_interests.txt', titleEn: 'AI Smart Filter & Interests', keywords: 'ai_filter ai_interests min_score reclassify 兴趣 自然语言', categoryZh: '内容筛选', categoryEn: 'Filter', icon: <Filter className="h-4 w-4" />, run: goTarget({ file: 'ai_interests.txt', line: 1 }) },
      { id: 'sec-aimodel', titleZh: 'AI 模型、API Key 与中转站向导', titleEn: 'AI Model, API Key & Relay', keywords: 'ai model api_key api_base openai deepseek gemini claude ollama litellm', categoryZh: 'AI 增强', categoryEn: 'AI', icon: <Sparkles className="h-4 w-4" />, run: goConfig('ai') },
      { id: 'sec-aianalysis', titleZh: 'AI 深度分析与 Prompt 提示词', titleEn: 'AI Analysis & Prompt', keywords: 'ai_analysis prompt max_news_for_analysis 提示词 分析', categoryZh: 'AI 增强', categoryEn: 'AI', icon: <Sparkles className="h-4 w-4" />, run: goConfig('ai_analysis') },
      { id: 'sec-aitrans', titleZh: 'AI 多语言翻译与范围', titleEn: 'AI Translation & Scope', keywords: 'ai_translation translate language scope 翻译', categoryZh: 'AI 增强', categoryEn: 'AI', icon: <Sparkles className="h-4 w-4" />, run: goConfig('ai_translation') },
      { id: 'sec-report', titleZh: '推送模式、区域排序与热榜权重', titleEn: 'Report Mode, Regions & Weights', keywords: 'report mode daily current incremental display region_order standalone weight 权重 排序 独立展示', categoryZh: '报告与版面', categoryEn: 'Report', icon: <LayoutList className="h-4 w-4" />, run: goConfig('report') },
      { id: 'sec-channels', titleZh: '推送通知渠道（飞书 / 钉钉 / 企微 / TG / 邮件等）', titleEn: 'Notification Channels', keywords: 'notification feishu dingtalk wework telegram email ntfy bark slack webhook 推送 通知 机器人', categoryZh: '推送与定时', categoryEn: 'Push', icon: <BellRing className="h-4 w-4" />, run: goConfig('notification') },
      { id: 'ch-feishu', titleZh: '飞书机器人 Webhook 配置', titleEn: 'Feishu Bot Webhook', keywords: 'feishu lark webhook 飞书 机器人', categoryZh: '通知渠道', categoryEn: 'Channels', icon: <BellRing className="h-4 w-4" />, run: goTarget({ file: 'config.yaml', path: ['notification', 'channels', 'feishu'] }) },
      { id: 'ch-wework', titleZh: '企业微信机器人 Webhook 与格式', titleEn: 'WeCom Bot Webhook & Format', keywords: 'wework wecom wechat markdown text 企业微信 企微 个人微信', categoryZh: '通知渠道', categoryEn: 'Channels', icon: <BellRing className="h-4 w-4" />, run: goTarget({ file: 'config.yaml', path: ['notification', 'channels', 'wework'] }) },
      { id: 'ch-dingtalk', titleZh: '钉钉机器人 Webhook 配置', titleEn: 'DingTalk Bot Webhook', keywords: 'dingtalk webhook 钉钉', categoryZh: '通知渠道', categoryEn: 'Channels', icon: <BellRing className="h-4 w-4" />, run: goTarget({ file: 'config.yaml', path: ['notification', 'channels', 'dingtalk'] }) },
      { id: 'ch-telegram', titleZh: 'Telegram Bot Token 与 Chat ID', titleEn: 'Telegram Bot & Chat ID', keywords: 'telegram tg bot_token chat_id 电报', categoryZh: '通知渠道', categoryEn: 'Channels', icon: <BellRing className="h-4 w-4" />, run: goTarget({ file: 'config.yaml', path: ['notification', 'channels', 'telegram'] }) },
      { id: 'ch-email', titleZh: '邮件推送 (SMTP / 发件人 / 收件人)', titleEn: 'Email SMTP Delivery', keywords: 'email smtp password from to 邮件 邮箱', categoryZh: '通知渠道', categoryEn: 'Channels', icon: <BellRing className="h-4 w-4" />, run: goTarget({ file: 'config.yaml', path: ['notification', 'channels', 'email'] }) },
      { id: 'ch-ntfy-bark-slack', titleZh: 'ntfy / Bark / Slack / 通用 Webhook', titleEn: 'ntfy / Bark / Slack / Generic Webhook', keywords: 'ntfy bark slack discord generic_webhook payload_template', categoryZh: '通知渠道', categoryEn: 'Channels', icon: <BellRing className="h-4 w-4" />, run: goTarget({ file: 'config.yaml', path: ['notification', 'channels', 'ntfy'] }) },
      { id: 'sec-timeline', titleZh: '调度系统与 timeline.yaml 时间线', titleEn: 'Schedule & 7×24 Timeline', keywords: 'schedule timeline preset morning_evening office_hours night_owl custom periods week_map 定时 调度 时间线 时段', categoryZh: '推送与定时', categoryEn: 'Push', icon: <BellRing className="h-4 w-4" />, run: goTarget({ file: 'timeline.yaml', path: [] }) },
      { id: 'sec-storage', titleZh: '时区、本地/S3 云存储、代理与高级运维', titleEn: 'Timezone, Storage (S3/R2) & Advanced', keywords: 'timezone storage s3 r2 oss cos bucket_name endpoint_url retention_days sqlite html pull mcp debug proxy 时区 存储 代理 调试 保留天数', categoryZh: '存储与系统', categoryEn: 'Storage', icon: <HardDrive className="h-4 w-4" />, run: goConfig('storage') },
      { id: 'sec-s3', titleZh: '云端对象存储 (Cloudflare R2 / S3) 与自动拉取', titleEn: 'Cloud S3 / R2 Storage & MCP Pull', keywords: 'remote s3 r2 endpoint_url bucket_name access_key_id secret_access_key pull 云存储', categoryZh: '存储与系统', categoryEn: 'Storage', icon: <HardDrive className="h-4 w-4" />, run: goTarget({ file: 'config.yaml', path: ['storage', 'remote'] }) },
      { id: 'sec-weights', titleZh: '热榜综合排序权重 (rank / frequency / hotness)', titleEn: 'Hotlist Ranking Weights', keywords: 'weight rank frequency hotness 排序 权重 热度', categoryZh: '报告与版面', categoryEn: 'Report', icon: <LayoutList className="h-4 w-4" />, run: goTarget({ file: 'config.yaml', path: ['advanced', 'weight'] }) },
      { id: 'act-mode-pro', titleZh: '切换到专业模式（左代码 · 右视觉分屏）', titleEn: 'Switch to Pro Mode (Code Left · Visual Right)', keywords: 'pro split code visual 专业 模式 分屏 代码', categoryZh: '工作台模式', categoryEn: 'Workspace', icon: <Columns2 className="h-4 w-4" />, run: () => { setWorkspaceMode('pro'); setCommandOpen(false) } },
      { id: 'act-mode-guided', titleZh: '切换到引导模式（逐步向导）', titleEn: 'Switch to Guided Mode (Step-by-Step)', keywords: 'guided onboarding wizard 引导 新手 向导', categoryZh: '工作台模式', categoryEn: 'Workspace', icon: <Sparkles className="h-4 w-4" />, run: () => { setWorkspaceMode('guided'); setCommandOpen(false) } },
      { id: 'act-versions', titleZh: '保存与切换配置方案', titleEn: 'Save & Switch Configs', keywords: 'save version snapshot history profile backup 保存 版本库 快照 历史 切换', categoryZh: '快捷动作', categoryEn: 'Actions', icon: <History className="h-4 w-4" />, run: () => { setVersionsOpen(true); setCommandOpen(false) } },
      { id: 'act-export', titleZh: '导出配置（ZIP / .env / Secrets）', titleEn: 'Export Config (ZIP / .env / Secrets)', keywords: 'export zip env secrets download sanitize 导出 下载 脱敏', categoryZh: '快捷动作', categoryEn: 'Actions', icon: <Download className="h-4 w-4" />, run: () => { setExportOpen(true); setCommandOpen(false) } },
      { id: 'act-import', titleZh: '拉取最新配置 / 导入本地文件', titleEn: 'Pull Official Latest / Import Local Files', keywords: 'import upload version check sync 导入 上传 拉取 版本', categoryZh: '快捷动作', categoryEn: 'Actions', icon: <Upload className="h-4 w-4" />, run: () => { setImportOpen(true); setCommandOpen(false) } },
      { id: 'file-config', titleZh: '查看源码：config.yaml', titleEn: 'Inspect source: config.yaml', keywords: 'source yaml config', categoryZh: '源码文件', categoryEn: 'Files', icon: <Code2 className="h-4 w-4" />, run: openFile('config.yaml') },
      { id: 'file-timeline', titleZh: '查看源码：timeline.yaml', titleEn: 'Inspect source: timeline.yaml', keywords: 'source yaml timeline', categoryZh: '源码文件', categoryEn: 'Files', icon: <Code2 className="h-4 w-4" />, run: openFile('timeline.yaml') },
      { id: 'file-freq', titleZh: '查看源码：frequency_words.txt', titleEn: 'Inspect source: frequency_words.txt', keywords: 'source frequency words', categoryZh: '源码文件', categoryEn: 'Files', icon: <Code2 className="h-4 w-4" />, run: openFile('frequency_words.txt') },
      { id: 'file-search', titleZh: '查看源码：search_queries.txt', titleEn: 'Inspect source: search_queries.txt', keywords: 'source search queries', categoryZh: '源码文件', categoryEn: 'Files', icon: <Code2 className="h-4 w-4" />, run: openFile('search_queries.txt') },
      { id: 'file-interests', titleZh: '查看源码：ai_interests.txt', titleEn: 'Inspect source: ai_interests.txt', keywords: 'source ai interests 兴趣', categoryZh: '源码文件', categoryEn: 'Files', icon: <Code2 className="h-4 w-4" />, run: openFile('ai_interests.txt') },
      { id: 'file-analysis-prompt', titleZh: '查看源码：ai_analysis_prompt.txt', titleEn: 'Inspect source: ai_analysis_prompt.txt', keywords: 'source ai analysis prompt 分析提示词', categoryZh: '源码文件', categoryEn: 'Files', icon: <Code2 className="h-4 w-4" />, run: openFile('ai_analysis_prompt.txt') },
      { id: 'file-trans-prompt', titleZh: '查看源码：ai_translation_prompt.txt', titleEn: 'Inspect source: ai_translation_prompt.txt', keywords: 'source ai translation prompt 翻译提示词', categoryZh: '源码文件', categoryEn: 'Files', icon: <Code2 className="h-4 w-4" />, run: openFile('ai_translation_prompt.txt') },
    ].filter((entry) => workspaceMode === 'pro' || (entry.id !== 'act-versions' && entry.id !== 'act-import'))
  }, [jumpToSource, setActiveSection, setCommandOpen, setExportOpen, setImportOpen, setVersionsOpen, setWorkspaceMode, workspaceMode, openSourceTarget, focusVisual, setSourcesSubTab])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(
      (e) =>
        e.titleZh.toLowerCase().includes(q) ||
        e.titleEn.toLowerCase().includes(q) ||
        e.keywords.toLowerCase().includes(q),
    )
  }, [entries, query])

  useEffect(() => {
    setSelectedIdx(0)
  }, [query, commandOpen])

  useEffect(() => {
    if (!commandOpen) setQuery('')
  }, [commandOpen])

  return (
    <ModalDialog
      open={commandOpen}
      onOpenChange={setCommandOpen}
      title={t('快速定位配置项', 'Quick Jump to Setting')}
      maxWidthClass="max-w-xl"
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIdx((i) => Math.min(filtered.length - 1, i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIdx((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter' && filtered[selectedIdx]) {
                e.preventDefault()
                filtered[selectedIdx].run()
              }
            }}
            placeholder={t('搜索配置项、文件或动作...', 'Search settings, files, or actions...')}
            className="tr-focus-ring outline-none h-10 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-base)] pl-9 pr-3 text-sm text-[var(--text-primary)] transition-[border-color,box-shadow] duration-150"
          />
        </div>

        <div className="max-h-[340px] space-y-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--text-muted)]">
              {t('没有找到匹配项，试试换个关键词', 'No matching items found')}
            </div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={item.run}
                onMouseEnter={() => setSelectedIdx(idx)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors cursor-pointer',
                  idx === selectedIdx
                    ? 'bg-[var(--brand-soft)] text-[var(--brand-primary)]'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-muted)]',
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="shrink-0 opacity-80">{item.icon}</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {t(item.titleZh, item.titleEn)}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {t(item.categoryZh, item.categoryEn)}
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </button>
            ))
          )}
        </div>
      </div>
    </ModalDialog>
  )
}
