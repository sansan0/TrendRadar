import * as React from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Building2,
  CalendarRange,
  Check,
  Clock,
  Copy,
  Hash,
  HelpCircle,
  Info,
  Layers,
  Mail,
  MessageSquare,
  Moon,
  Plus,
  Radio,
  RotateCcw,
  Send,
  SendHorizontal,
  ShieldAlert,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Trash2,
  Webhook,
  Wrench,
  X,
} from 'lucide-react'
import {
  Badge,
  Button,
  Callout,
  Card,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  InfoTooltip,
  Input,
  ModalDialog,
  SelectField,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@/components/ui/primitives'
import {
  AdvancedCollapsible,
  SecretInput,
  SectionShell,
  SettingRow,
  ToggleSectionCard,
} from '@/components/shared/SharedControls'
import { useT } from '@/i18n'
import {
  getLocalizedTimelinePeriodName,
  getLocalizedTimelinePresetDesc,
  getLocalizedTimelinePresetName,
} from '@/lib/presets'
import {
  buildDaySegments,
  deleteCustomPreset,
  duplicatePreset,
  getPresetBasePath,
  parseTimelinePresets,
  resolveEffectiveBehavior,
  timeToMinutes,
  updatePresetField,
  validateTimelinePreset,
  type TimelineParsedPreset,
  type TimelineVisualSegment,
} from '@/lib/timeline-engine'
import type { TimelineBehavior, TimelinePeriod } from '@/lib/types'
import { cn, uid } from '@/lib/utils'
import { scrollAndFocusElement } from '@/lib/scroll-focus'
import {
  getInObject,
  parseYamlSafe,
  setYamlValues,
  type YamlPatch,
} from '@/lib/yaml-doc'
import { useEditor } from '@/store/editor-store'

/* ============================================================================
 * Notification Channels Metadata & Multi-Account Helpers
 * ========================================================================== */

type ChannelId =
  | 'feishu'
  | 'dingtalk'
  | 'wework'
  | 'telegram'
  | 'email'
  | 'ntfy'
  | 'bark'
  | 'slack'
  | 'generic_webhook'

interface ChannelMeta {
  id: ChannelId
  icon: React.ReactNode
  nameZh: string
  nameEn: string
  descZh: string
  descEn: string
}

const CHANNELS: ChannelMeta[] = [
  {
    id: 'feishu',
    icon: <MessageSquare className="h-4 w-4" />,
    nameZh: '飞书',
    nameEn: 'Feishu / Lark',
    descZh: '飞书群自定义机器人卡片推送',
    descEn: 'Group custom bot webhook messages',
  },
  {
    id: 'dingtalk',
    icon: <Send className="h-4 w-4" />,
    nameZh: '钉钉',
    nameEn: 'DingTalk',
    descZh: '钉钉群机器人 Markdown 推送',
    descEn: 'DingTalk group bot markdown push',
  },
  {
    id: 'wework',
    icon: <Building2 className="h-4 w-4" />,
    nameZh: '企业微信',
    nameEn: 'WeWork',
    descZh: '群机器人或个人微信应用推送',
    descEn: 'Group bot or WeCom personal app',
  },
  {
    id: 'telegram',
    icon: <SendHorizontal className="h-4 w-4" />,
    nameZh: 'Telegram',
    nameEn: 'Telegram',
    descZh: 'Bot 频道与私聊即时推送',
    descEn: 'Bot channel and direct chat push',
  },
  {
    id: 'email',
    icon: <Mail className="h-4 w-4" />,
    nameZh: '邮件',
    nameEn: 'Email',
    descZh: '富文本 HTML 简报邮件投递',
    descEn: 'Rich HTML briefing emails',
  },
  {
    id: 'ntfy',
    icon: <Radio className="h-4 w-4" />,
    nameZh: 'ntfy',
    nameEn: 'ntfy',
    descZh: '轻量开源发布/订阅消息推送',
    descEn: 'Lightweight open-source pub-sub push',
  },
  {
    id: 'bark',
    icon: <Smartphone className="h-4 w-4" />,
    nameZh: 'Bark',
    nameEn: 'Bark',
    descZh: 'iOS 设备原生极速推送通知',
    descEn: 'Fast native push notifications for iOS',
  },
  {
    id: 'slack',
    icon: <Hash className="h-4 w-4" />,
    nameZh: 'Slack',
    nameEn: 'Slack',
    descZh: 'Slack Incoming Webhook 频道推送',
    descEn: 'Slack Incoming Webhook channels',
  },
  {
    id: 'generic_webhook',
    icon: <Webhook className="h-4 w-4" />,
    nameZh: '通用 Webhook',
    nameEn: 'Generic Webhook',
    descZh: 'Discord、Matrix、IFTTT 等自定义 JSON',
    descEn: 'Custom JSON for Discord, Matrix, IFTTT',
  },
]

const BUILTIN_PRESETS = new Set([
  'always_on',
  'morning_evening',
  'office_hours',
  'night_owl',
  'custom',
])

const WEEKDAYS = [
  { day: 1, zh: '周一', en: 'Mon' },
  { day: 2, zh: '周二', en: 'Tue' },
  { day: 3, zh: '周三', en: 'Wed' },
  { day: 4, zh: '周四', en: 'Thu' },
  { day: 5, zh: '周五', en: 'Fri' },
  { day: 6, zh: '周六', en: 'Sat' },
  { day: 7, zh: '周日', en: 'Sun' },
] as const

function splitSemicolon(raw: unknown): string[] {
  const s = String(raw ?? '').trim()
  if (!s) return []
  return s.split(';').map((x) => x.trim())
}

function getChannelStatus(
  configData: Record<string, unknown>,
  channelId: ChannelId,
): { configured: boolean; count: number; hasError: boolean } {
  const base = ['notification', 'channels', channelId]
  if (channelId === 'email') {
    const from = String(getInObject(configData, [...base, 'from'], '') ?? '').trim()
    const to = String(getInObject(configData, [...base, 'to'], '') ?? '').trim()
    const recipients = to
      ? to
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
      : []
    const configured = Boolean(from || recipients.length > 0)
    const hasError = configured && (!from || recipients.length === 0)
    return { configured, count: configured ? Math.max(1, recipients.length) : 0, hasError }
  }
  if (channelId === 'telegram') {
    const tokens = splitSemicolon(getInObject(configData, [...base, 'bot_token'], ''))
    const chats = splitSemicolon(getInObject(configData, [...base, 'chat_id'], ''))
    const mismatch = (tokens.length > 0 || chats.length > 0) && tokens.length !== chats.length
    const count = Math.min(tokens.length, chats.length)
    return { configured: tokens.length > 0 || chats.length > 0, count, hasError: mismatch }
  }
  if (channelId === 'ntfy') {
    const topics = splitSemicolon(getInObject(configData, [...base, 'topic'], ''))
    const rawToken = String(getInObject(configData, [...base, 'token'], '') ?? '').trim()
    const tokens = rawToken ? rawToken.split(';') : []
    const mismatch = topics.length > 0 && tokens.length > 0 && topics.length !== tokens.length
    return { configured: topics.length > 0, count: topics.length, hasError: mismatch }
  }
  const fieldKey = channelId === 'bark' ? 'url' : 'webhook_url'
  const items = splitSemicolon(getInObject(configData, [...base, fieldKey], '')).filter(Boolean)
  return { configured: items.length > 0, count: items.length, hasError: false }
}

/* ---------------- Single-Field Multi-Account Editor ---------------- */
interface MultiSecretAccountListProps {
  rawValue: string
  onCommit: (nextSerialized: string) => void
  label: string
  placeholder: string
  envVar: string
  maxAccounts: number
}

function MultiSecretAccountList({
  rawValue,
  onCommit,
  label,
  placeholder,
  envVar,
  maxAccounts,
}: MultiSecretAccountListProps) {
  const t = useT()
  const parseRows = (val: string) => {
    const parts = splitSemicolon(val).filter(Boolean)
    return parts.length > 0 ? parts : ['']
  }

  const [rows, setRows] = React.useState<string[]>(() => parseRows(rawValue))
  const lastSerializedRef = React.useRef<string>(
    parseRows(rawValue)
      .map((x) => x.trim())
      .filter(Boolean)
      .join(';'),
  )

  React.useEffect(() => {
    const incomingNorm = splitSemicolon(rawValue).filter(Boolean).join(';')
    if (incomingNorm !== lastSerializedRef.current) {
      lastSerializedRef.current = incomingNorm
      setRows(parseRows(rawValue))
    }
  }, [rawValue])

  const commitRows = (nextRows: string[]) => {
    setRows(nextRows)
    const serialized = nextRows
      .map((x) => x.trim())
      .filter(Boolean)
      .join(';')
    lastSerializedRef.current = serialized
    onCommit(serialized)
  }

  const activeCount = rows.filter((r) => r.trim().length > 0).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
          <code className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-muted)]">
            {envVar}
          </code>
          <Badge tone={activeCount > maxAccounts ? 'warning' : 'neutral'}>
            {activeCount} / {maxAccounts}
          </Badge>
          <InfoTooltip
            content={t(
              '多账号会自动用英文分号 ; 拼接写回 config.yaml，无需手动输入分隔符。',
              'Multiple accounts are automatically joined with semicolons (;) in config.yaml.',
            )}
          >
            <button
              type="button"
              className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
              aria-label={t('多账号说明', 'Multi-account info')}
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </InfoTooltip>
        </div>
        <Button
          variant="outline"
          size="xs"
          onClick={() => setRows((prev) => [...prev, ''])}
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{t('添加账号', 'Add Account')}</span>
        </Button>
      </div>

      {activeCount > maxAccounts && (
        <Callout
          tone="warning"
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
        >
          {t('已填 {v0} 个账号，超出单渠道上限（{v1}），超出部分会被忽略。', '{v0} accounts exceed max_accounts_per_channel ({v1}); extras are ignored.', { v0: activeCount, v1: maxAccounts })}
        </Callout>
      )}

      <div className="space-y-2.5">
        {rows.map((val, idx) => (
          <div key={idx} className="group/row flex items-start gap-2.5">
            <div className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--bg-muted)] font-mono text-xs font-semibold text-[var(--text-muted)]">
              {idx + 1}
            </div>
            <div className="min-w-0 flex-1">
              <SecretInput
                value={val}
                onChange={(nextVal) => {
                  const next = [...rows]
                  next[idx] = nextVal
                  commitRows(next)
                }}
                placeholder={placeholder}
                envVar={envVar}
              />
            </div>
            {rows.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="tr-hover-delete mt-0.5 shrink-0 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500"
                onClick={() => {
                  const next = rows.filter((_, i) => i !== idx)
                  commitRows(next.length > 0 ? next : [''])
                }}
                aria-label={t('删除此账号', 'Remove account')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Telegram Paired Accounts Editor ---------------- */
interface TelegramPair {
  token: string
  chatId: string
}

function TelegramAccountsEditor({
  rawTokens,
  rawChats,
  maxAccounts,
  onCommit,
}: {
  rawTokens: string
  rawChats: string
  maxAccounts: number
  onCommit: (nextTokens: string, nextChats: string) => void
}) {
  const t = useT()

  const parsePairs = (tokStr: string, chatStr: string): TelegramPair[] => {
    const toks = splitSemicolon(tokStr)
    const chats = splitSemicolon(chatStr)
    const len = Math.max(toks.length, chats.length)
    if (len === 0) return [{ token: '', chatId: '' }]
    return Array.from({ length: len }, (_, i) => ({
      token: toks[i] ?? '',
      chatId: chats[i] ?? '',
    }))
  }

  const [pairs, setPairs] = React.useState<TelegramPair[]>(() => parsePairs(rawTokens, rawChats))
  const lastSigRef = React.useRef(`${rawTokens}|||${rawChats}`)

  React.useEffect(() => {
    const sig = `${rawTokens}|||${rawChats}`
    if (sig !== lastSigRef.current) {
      lastSigRef.current = sig
      setPairs(parsePairs(rawTokens, rawChats))
    }
  }, [rawTokens, rawChats])

  const commitPairs = (nextPairs: TelegramPair[]) => {
    setPairs(nextPairs)
    const active = nextPairs.filter((p) => p.token.trim() || p.chatId.trim())
    const nextTokens = active.map((p) => p.token.trim()).join(';')
    const nextChats = active.map((p) => p.chatId.trim()).join(';')
    lastSigRef.current = `${nextTokens}|||${nextChats}`
    onCommit(nextTokens, nextChats)
  }

  const activeCount = pairs.filter((p) => p.token.trim() || p.chatId.trim()).length

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {t('机器人配对列表', 'Telegram Bot Account Pairs')}
          </span>
          <Badge tone={activeCount > maxAccounts ? 'warning' : 'neutral'}>
            {activeCount} / {maxAccounts}
          </Badge>
          <InfoTooltip
            content={t(
              '按对管理可确保 bot_token 与 chat_id 分号段数始终一致，避免配对错位。',
              'Pairing guarantees matching semicolon counts between bot_token and chat_id.',
            )}
          >
            <button
              type="button"
              className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
              aria-label={t('配对说明', 'Pairing info')}
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </InfoTooltip>
        </div>
        <Button
          variant="outline"
          size="xs"
          onClick={() => setPairs((prev) => [...prev, { token: '', chatId: '' }])}
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{t('添加账号对', 'Add Bot Pair')}</span>
        </Button>
      </div>

      <div className="space-y-3">
        {pairs.map((pair, idx) => {
          const incomplete =
            (pair.token.trim().length > 0 && !pair.chatId.trim()) ||
            (!pair.token.trim() && pair.chatId.trim().length > 0)
          return (
            <div
              key={idx}
              className={cn(
                'group/row rounded-xl border p-4 space-y-3 bg-[var(--bg-base)]/60',
                incomplete ? 'border-amber-500/45' : 'border-[var(--border-default)]',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={incomplete ? 'warning' : 'neutral'}>
                    {t('账号对 #{v0}', 'Pair #{v0}', { v0: idx + 1 })}
                  </Badge>
                  {incomplete && (
                    <span className="text-[13px] text-amber-600 dark:text-amber-400">
                      {t('请同时补全 Bot Token 与 Chat ID', 'Fill both Bot Token and Chat ID')}
                    </span>
                  )}
                </div>
                {pairs.length > 1 && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="tr-hover-delete text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500"
                    onClick={() => {
                      const next = pairs.filter((_, i) => i !== idx)
                      commitPairs(next.length > 0 ? next : [{ token: '', chatId: '' }])
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{t('移除', 'Remove')}</span>
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 @min-[40rem]/section:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)]">
                    <span>{t('机器人令牌 (Bot Token)', 'Bot Token')}</span>
                    <code className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs">
                      TELEGRAM_BOT_TOKEN
                    </code>
                  </label>
                  <SecretInput
                    value={pair.token}
                    onChange={(v) => {
                      const next = [...pairs]
                      next[idx] = { ...next[idx], token: v }
                      commitPairs(next)
                    }}
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    envVar="TELEGRAM_BOT_TOKEN"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)]">
                    <span>{t('会话 / 频道 ID (Chat ID)', 'Chat ID')}</span>
                    <code className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs">
                      TELEGRAM_CHAT_ID
                    </code>
                  </label>
                  <Input
                    value={pair.chatId}
                    onChange={(e) => {
                      const next = [...pairs]
                      next[idx] = { ...next[idx], chatId: e.target.value }
                      commitPairs(next)
                    }}
                    placeholder="-1001234567890"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------- ntfy Paired Topics Editor ---------------- */
interface NtfyTopicPair {
  topic: string
  token: string
}

function NtfyAccountsEditor({
  serverUrl,
  rawTopics,
  rawTokens,
  maxAccounts,
  onServerUrlChange,
  onCommitPairs,
}: {
  serverUrl: string
  rawTopics: string
  rawTokens: string
  maxAccounts: number
  onServerUrlChange: (val: string) => void
  onCommitPairs: (nextTopics: string, nextTokens: string) => void
}) {
  const t = useT()

  const parsePairs = (topicStr: string, tokenStr: string): NtfyTopicPair[] => {
    const topics = splitSemicolon(topicStr)
    const tokens = tokenStr.trim() ? tokenStr.split(';').map((x) => x.trim()) : []
    const len = Math.max(topics.length, tokens.length)
    if (len === 0) return [{ topic: '', token: '' }]
    return Array.from({ length: len }, (_, i) => ({
      topic: topics[i] ?? '',
      token: tokens[i] ?? '',
    }))
  }

  const [pairs, setPairs] = React.useState<NtfyTopicPair[]>(() => parsePairs(rawTopics, rawTokens))
  const lastSigRef = React.useRef(`${rawTopics}|||${rawTokens}`)

  React.useEffect(() => {
    const sig = `${rawTopics}|||${rawTokens}`
    if (sig !== lastSigRef.current) {
      lastSigRef.current = sig
      setPairs(parsePairs(rawTopics, rawTokens))
    }
  }, [rawTopics, rawTokens])

  const commitPairs = (nextPairs: NtfyTopicPair[]) => {
    setPairs(nextPairs)
    const active = nextPairs.filter((p) => p.topic.trim() || p.token.trim())
    const nextTopics = active.map((p) => p.topic.trim()).join(';')
    const anyToken = active.some((p) => p.token.trim().length > 0)
    const nextTokens = anyToken ? active.map((p) => p.token.trim()).join(';') : ''
    lastSigRef.current = `${nextTopics}|||${nextTokens}`
    onCommitPairs(nextTopics, nextTokens)
  }

  const activeCount = pairs.filter((p) => p.topic.trim()).length

  return (
    <div className="space-y-4">
      <SettingRow
        label={t('ntfy 服务器地址', 'ntfy Server URL')}
        description={t(
          '默认官方 https://ntfy.sh，也支持自托管实例。',
          'Defaults to https://ntfy.sh or your self-hosted server.',
        )}
        envVar="NTFY_SERVER_URL"
      >
        <Input
          value={serverUrl}
          onChange={(e) => onServerUrlChange(e.target.value)}
          placeholder="https://ntfy.sh"
          className="font-mono text-sm @min-[40rem]/section:w-72"
        />
      </SettingRow>

      <div className="space-y-3 border-t border-[var(--border-default)] pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {t('主题与访问令牌', 'Topics & Access Tokens')}
            </span>
            <Badge tone={activeCount > maxAccounts ? 'warning' : 'neutral'}>
              {activeCount} / {maxAccounts}
            </Badge>
            <InfoTooltip
              content={t(
                '混用公开与私有主题时，系统会自动用空分号占位对齐（例如 ";tk_secret"）。',
                'Mixed public/private topics are auto-aligned with empty semicolon slots.',
              )}
            >
              <button
                type="button"
                className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                aria-label={t('主题对齐说明', 'Alignment info')}
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </InfoTooltip>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={() => setPairs((prev) => [...prev, { topic: '', token: '' }])}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('添加主题', 'Add Topic')}</span>
          </Button>
        </div>

        <div className="space-y-2.5">
          {pairs.map((pair, idx) => (
            <div
              key={idx}
              className="group/row grid grid-cols-1 gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]/60 p-4 @min-[40rem]/section:grid-cols-[1fr_1fr_auto]"
            >
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
                  {t('主题名 #{v0}', 'Topic #{v0}', { v0: idx + 1 })}
                </label>
                <Input
                  value={pair.topic}
                  onChange={(e) => {
                    const next = [...pairs]
                    next[idx] = { ...next[idx], topic: e.target.value }
                    commitPairs(next)
                  }}
                  placeholder="trendradar-alerts"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
                  {t('访问令牌（公开留空）', 'Token (optional)')}
                </label>
                <SecretInput
                  value={pair.token}
                  onChange={(v) => {
                    const next = [...pairs]
                    next[idx] = { ...next[idx], token: v }
                    commitPairs(next)
                  }}
                  placeholder="tk_xxxxxxxx"
                  envVar="NTFY_TOKEN"
                />
              </div>
              {pairs.length > 1 && (
                <div className="flex items-end pb-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="tr-hover-delete text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500"
                    onClick={() => {
                      const next = pairs.filter((_, i) => i !== idx)
                      commitPairs(next.length > 0 ? next : [{ topic: '', token: '' }])
                    }}
                    aria-label={t('删除此主题', 'Remove topic')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Email Recipients Tag Editor ---------------- */
function EmailRecipientsInput({
  value,
  onChange,
}: {
  value: string
  onChange: (nextCommaStr: string) => void
}) {
  const t = useT()
  const [draft, setDraft] = React.useState('')

  const recipients = React.useMemo(
    () =>
      value
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    [value],
  )

  const addDraft = () => {
    const parts = draft
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    const merged = [...recipients]
    for (const p of parts) {
      if (!merged.includes(p)) merged.push(p)
    }
    onChange(merged.join(', '))
    setDraft('')
  }

  const removeRecipient = (email: string) => {
    onChange(recipients.filter((r) => r !== email).join(', '))
  }

  return (
    <div className="space-y-2.5 w-full">
      {recipients.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {recipients.map((addr) => (
            <span
              key={addr}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-border)] bg-[var(--brand-soft)] px-3 py-1 font-mono text-xs text-[var(--text-primary)]"
            >
              <span>{addr}</span>
              <button
                type="button"
                onClick={() => removeRecipient(addr)}
                className="rounded-full p-0.5 text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                aria-label={t('移除 {v0}', 'Remove {v0}', { v0: addr })}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              addDraft()
            }
          }}
          onBlur={() => {
            if (draft.trim()) addDraft()
          }}
          placeholder={t(
            '输入收件人邮箱按回车添加（支持逗号批量粘贴）',
            'Type email & press Enter (comma paste supported)',
          )}
          className="font-mono text-sm"
        />
        <Button variant="outline" size="sm" onClick={addDraft} disabled={!draft.trim()}>
          <Plus className="h-4 w-4" />
          <span>{t('添加', 'Add')}</span>
        </Button>
      </div>
    </div>
  )
}

/* ============================================================================
 * Timeline Visual Helpers (Solid Colors Only — Zero Gradients)
 * ========================================================================== */

function getSegmentStyleClass(behavior: { push: boolean; analyze: boolean; collect: boolean }) {
  if (behavior.push && behavior.analyze) {
    return 'bg-[#307da7] dark:bg-[#388cbe] text-white'
  }
  if (behavior.push) {
    return 'bg-teal-600 dark:bg-teal-600 text-white'
  }
  if (behavior.analyze) {
    return 'bg-amber-600 dark:bg-amber-500 text-white'
  }
  if (behavior.collect) {
    return 'bg-slate-600 dark:bg-slate-500 text-white'
  }
  return 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
}

function getDefaultBaseTrackClass(def: TimelineBehavior) {
  const eff = resolveEffectiveBehavior(def)
  if (eff.push && eff.analyze) {
    return 'bg-[#307da7]/14 dark:bg-[#388cbe]/18'
  }
  if (eff.push) {
    return 'bg-teal-600/15'
  }
  if (eff.analyze) {
    return 'bg-amber-500/15'
  }
  return 'bg-[var(--bg-subtle)]'
}

function formatDurationBadge(start: string, end: string): { mins: number; label: string } | null {
  const s = timeToMinutes(start)
  const e = timeToMinutes(end)
  if (s === null || e === null || s === e) return null
  const mins = s < e ? e - s : 1440 - s + e
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return { mins, label: m === 0 ? `${h}h` : `${h}h ${m}m` }
}

function isCrossMidnight(start: string, end: string): boolean {
  const s = timeToMinutes(start)
  const e = timeToMinutes(end)
  return s !== null && e !== null && s > e
}

function buildWeekMapPatches(
  rawYaml: string,
  presetKey: string,
  dayPlanAssignments: Array<{ day: number; planKey: string }>,
): YamlPatch[] {
  const basePath = getPresetBasePath(presetKey)
  const { doc } = parseYamlSafe(rawYaml)
  const existingMap = doc?.getIn([...basePath, 'week_map'], true)
  const hasFn =
    existingMap &&
    typeof existingMap === 'object' &&
    'has' in existingMap &&
    typeof (existingMap as { has: (k: unknown) => boolean }).has === 'function'
      ? (k: unknown) => (existingMap as { has: (key: unknown) => boolean }).has(k)
      : null

  return dayPlanAssignments.map(({ day, planKey }) => {
    const useStringKey = hasFn ? !hasFn(day) && hasFn(String(day)) : false
    return {
      path: [...basePath, 'week_map', useStringKey ? String(day) : day],
      value: planKey,
    }
  })
}

/* ============================================================================
 * Period Card Sub-component (Layer 3)
 * ========================================================================== */
interface PeriodEditorCardProps {
  periodKey: string
  period: TimelinePeriod
  defaultBehavior: TimelineBehavior
  globalFilterMethod: string
  selected: boolean
  onSelect: () => void
  onUpdateField: (fieldPath: Array<string | number>, value: unknown) => void
  onRemoveField: (fieldPath: Array<string | number>) => void
  onDelete: () => void
}

function PeriodEditorCard({
  periodKey,
  period,
  defaultBehavior,
  globalFilterMethod,
  selected,
  onSelect,
  onUpdateField,
  onRemoveField,
  onDelete,
}: PeriodEditorCardProps) {
  const t = useT()
  const [advOpen, setAdvOpen] = React.useState(false)

  const eff = resolveEffectiveBehavior(defaultBehavior, period)
  const crossMid = isCrossMidnight(period.start, period.end)
  const dur = formatDurationBadge(period.start, period.end)

  const searchTriState =
    period.search === undefined || period.search === null
      ? '__follow__'
      : period.search
        ? 'true'
        : 'false'

  const reportModeVal = period.report_mode ?? '__inherit__'
  const aiModeVal = period.ai_mode ?? '__inherit__'
  const filterMethodVal = period.filter_method ?? '__inherit__'

  const advOverrideCount =
    (period.filter_method ? 1 : 0) +
    (period.frequency_file ? 1 : 0) +
    (period.interests_file ? 1 : 0) +
    (period.search_file ? 1 : 0)

  const resetOnceSubkey = (sub: 'push' | 'analyze' | 'search') => {
    const currOnce = period.once ?? {}
    const remainingKeys = (['push', 'analyze', 'search'] as const).filter(
      (k) => k !== sub && currOnce[k] !== undefined,
    )
    if (remainingKeys.length === 0) {
      onRemoveField(['once'])
    } else {
      onRemoveField(['once', sub])
    }
  }

  const switchItems = [
    {
      key: 'collect',
      label: t('采集', 'Collect'),
      code: 'collect',
      checked: eff.collect,
      overridden: period.collect !== undefined,
      onReset: () => onRemoveField(['collect']),
      onChange: (v: boolean) => onUpdateField(['collect'], v),
    },
    {
      key: 'push',
      label: t('推送', 'Push'),
      code: 'push',
      checked: eff.push,
      overridden: period.push !== undefined,
      onReset: () => onRemoveField(['push']),
      onChange: (v: boolean) => onUpdateField(['push'], v),
    },
    {
      key: 'analyze',
      label: t('AI 分析', 'AI Analyze'),
      code: 'analyze',
      checked: eff.analyze,
      overridden: period.analyze !== undefined,
      onReset: () => onRemoveField(['analyze']),
      onChange: (v: boolean) => onUpdateField(['analyze'], v),
    },
    {
      key: 'once_push',
      label: t('仅推一次', 'Once Push'),
      code: 'once.push',
      checked: eff.oncePush,
      overridden: period.once?.push !== undefined,
      onReset: () => resetOnceSubkey('push'),
      onChange: (v: boolean) => onUpdateField(['once', 'push'], v),
    },
    {
      key: 'once_analyze',
      label: t('仅析一次', 'Once AI'),
      code: 'once.analyze',
      checked: eff.onceAnalyze,
      overridden: period.once?.analyze !== undefined,
      onReset: () => resetOnceSubkey('analyze'),
      onChange: (v: boolean) => onUpdateField(['once', 'analyze'], v),
    },
    {
      key: 'once_search',
      label: t('仅搜一次', 'Once Search'),
      code: 'once.search',
      checked: eff.onceSearch,
      overridden: period.once?.search !== undefined,
      onReset: () => resetOnceSubkey('search'),
      onChange: (v: boolean) => onUpdateField(['once', 'search'], v),
    },
  ]

  return (
    <div
      id={`period-card-${periodKey}`}
      onClick={onSelect}
      className={cn(
        'group/row rounded-xl border p-5 space-y-4 transition-all',
        selected
          ? 'border-[var(--brand-primary)] bg-[var(--bg-surface)] ring-1 ring-[var(--brand-border)] shadow-[var(--shadow-sm)]'
          : 'border-[var(--border-default)] bg-[var(--bg-base)]/60 hover:border-[var(--border-strong)]',
      )}
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
          <span
            className={cn(
              'h-2.5 w-2.5 shrink-0 rounded-full',
              eff.push && eff.analyze
                ? 'bg-[#307da7] dark:bg-[#388cbe]'
                : eff.push
                  ? 'bg-teal-600'
                  : eff.analyze
                    ? 'bg-amber-600 dark:bg-amber-500'
                    : 'bg-slate-500',
            )}
          />
          <Input
            value={period.name ?? ''}
            onChange={(e) => onUpdateField(['name'], e.target.value)}
            placeholder={periodKey}
            className="h-9 max-w-[220px] text-sm font-semibold"
          />
          <code className="rounded bg-[var(--bg-muted)] px-2 py-0.5 font-mono text-xs text-[var(--text-muted)]">
            {periodKey}
          </code>
          {crossMid && (
            <Badge tone="warning">
              <Moon className="h-3 w-3" />
              <span>{t('跨午夜', 'Cross-midnight')}</span>
            </Badge>
          )}
          {dur && (
            <Badge tone={dur.mins < 120 ? 'warning' : 'neutral'}>
              {dur.label}
            </Badge>
          )}
        </div>

        <Button
          variant="ghost"
          size="xs"
          className="tr-hover-delete text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>{t('删除', 'Delete')}</span>
        </Button>
      </div>

      {/* Time Range + Mode */}
      <div className="grid grid-cols-1 gap-3 @min-[40rem]/section:grid-cols-2 @min-[64rem]/section:grid-cols-5">
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
            {t('开始时间', 'Start (HH:MM)')}
          </label>
          <Input
            type="time"
            value={period.start || '09:00'}
            onChange={(e) => onUpdateField(['start'], e.target.value)}
            className="h-9 font-mono text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
            {t('结束时间', 'End (HH:MM)')}
          </label>
          <Input
            type="time"
            value={period.end || '11:00'}
            onChange={(e) => onUpdateField(['end'], e.target.value)}
            className="h-9 font-mono text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
            {t('报告模式 (report_mode)', 'Report Mode')}
          </label>
          <SelectField
            value={reportModeVal}
            onValueChange={(v) => {
              if (v === '__inherit__') onRemoveField(['report_mode'])
              else onUpdateField(['report_mode'], v)
            }}
            className="h-9 text-[13px]"
            options={[
              {
                value: '__inherit__',
                label: t('继承默认 ({v0})', 'Inherit ({v0})', { v0: defaultBehavior.report_mode ?? 'current' }),
              },
              { value: 'daily', label: t('当日汇总 (daily)', 'Daily Summary') },
              { value: 'current', label: t('当前榜单 (current)', 'Current Snapshot') },
              { value: 'incremental', label: t('增量监控 (incremental)', 'Incremental') },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
            {t('AI 模式 (ai_mode)', 'AI Mode')}
          </label>
          <SelectField
            value={aiModeVal}
            onValueChange={(v) => {
              if (v === '__inherit__') onRemoveField(['ai_mode'])
              else onUpdateField(['ai_mode'], v)
            }}
            className="h-9 text-[13px]"
            options={[
              {
                value: '__inherit__',
                label: t('继承默认 ({v0})', 'Inherit ({v0})', { v0: defaultBehavior.ai_mode ?? 'follow_report' }),
              },
              { value: 'follow_report', label: t('跟随报告 (follow_report)', 'Follow Report') },
              { value: 'daily', label: t('当日汇总 (daily)', 'Daily') },
              { value: 'current', label: t('当前榜单 (current)', 'Current') },
              { value: 'incremental', label: t('增量监控 (incremental)', 'Incremental') },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
            {t('联网搜索', 'Web Search')}
          </label>
          <SelectField
            value={searchTriState}
            onValueChange={(v) => {
              if (v === '__follow__') onRemoveField(['search'])
              else onUpdateField(['search'], v === 'true')
            }}
            className="h-9 text-[13px]"
            options={[
              { value: '__follow__', label: t('跟随采集 / 继承', 'Follow / Inherit') },
              { value: 'true', label: t('强制开启', 'Force ON') },
              { value: 'false', label: t('强制关闭', 'Force OFF') },
            ]}
          />
        </div>
      </div>

      {/* Behavior Switches + Once Controls (Uniform 2x3 / 3x2 Equal-Height Cards) */}
      <div className="grid grid-cols-2 gap-2.5 @min-[40rem]/section:grid-cols-3">
        {switchItems.map((sw) => (
          <div
            key={sw.key}
            className={cn(
              'flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 transition-colors',
              sw.overridden
                ? 'border-[var(--brand-border)] bg-[var(--bg-surface)]'
                : 'border-[var(--border-default)] bg-[var(--bg-surface)]/75',
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-medium text-[var(--text-primary)] whitespace-nowrap">
                  {sw.label}
                </span>
                {sw.overridden ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      sw.onReset()
                    }}
                    className="inline-flex items-center gap-0.5 rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--brand-primary)] hover:underline cursor-pointer"
                    title={t('当前已显式覆盖，点击恢复继承静默期默认值', 'Overridden — click to inherit from default')}
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    <span>{t('继承', 'Inherit')}</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {t('继承', 'Inherit')}
                  </span>
                )}
              </div>
              <div className="font-mono text-xs text-[var(--text-muted)] truncate">
                {sw.code}
              </div>
            </div>
            <Switch checked={sw.checked} onCheckedChange={sw.onChange} />
          </div>
        ))}
      </div>

      {/* Period-Level Advanced Overrides */}
      <Collapsible open={advOpen} onOpenChange={setAdvOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="tr-focus-ring inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>{t('高级覆盖项（词库 / AI 兴趣 / 筛选方式）', 'Advanced Overrides (Filter / Files)')}</span>
            {advOverrideCount > 0 && (
              <Badge tone="brand">{advOverrideCount}</Badge>
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="tr-collapsible-content">
          <div className="mt-3 space-y-3.5 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]/50 p-4">
            <div className="grid grid-cols-1 gap-3.5 @min-[40rem]/section:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
                  {t('时段筛选策略 (filter_method)', 'Period Filter Method')}
                </label>
                <SelectField
                  value={filterMethodVal}
                  onValueChange={(v) => {
                    if (v === '__inherit__') onRemoveField(['filter_method'])
                    else onUpdateField(['filter_method'], v)
                  }}
                  className="h-9 text-[13px]"
                  options={[
                    {
                      value: '__inherit__',
                      label: t('继承全局 ({v0})', 'Inherit global ({v0})', { v0: globalFilterMethod }),
                    },
                    { value: 'keyword', label: t('关键词匹配 (keyword)', 'Keyword (keyword)') },
                    { value: 'ai', label: t('AI 智能筛选 (ai)', 'AI Filter (ai)') },
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
                  {t('自定义关键词文件 (frequency_file)', 'Keyword File (frequency_file)')}
                </label>
                <Input
                  value={period.frequency_file ?? ''}
                  onChange={(e) => {
                    const v = e.target.value.trim()
                    if (!v) onRemoveField(['frequency_file'])
                    else onUpdateField(['frequency_file'], v)
                  }}
                  placeholder="tech.txt"
                  className="h-9 font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
                  {t('自定义 AI 兴趣文件 (interests_file)', 'AI Interests File (interests_file)')}
                </label>
                <Input
                  value={period.interests_file ?? ''}
                  onChange={(e) => {
                    const v = e.target.value.trim()
                    if (!v) onRemoveField(['interests_file'])
                    else onUpdateField(['interests_file'], v)
                  }}
                  placeholder="finance.txt"
                  className="h-9 font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
                  {t('自定义搜索任务文件 (search_file)', 'Search File (search_file)')}
                </label>
                <Input
                  value={period.search_file ?? ''}
                  onChange={(e) => {
                    const v = e.target.value.trim()
                    if (!v) onRemoveField(['search_file'])
                    else onUpdateField(['search_file'], v)
                  }}
                  placeholder="policy.txt"
                  className="h-9 font-mono text-sm"
                />
              </div>
            </div>

            {period.filter_method === 'ai' && globalFilterMethod !== 'ai' && (
              <Callout
                tone="warning"
                icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
              >
                {t(
                  '全局 filter.method 为 keyword，此处设为 ai 会回退关键词匹配，请先将全局筛选策略切为 ai。',
                  'Global filter.method is "keyword"; period filter_method: ai falls back unless global filter is set to "ai".',
                )}
              </Callout>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

/* ============================================================================
 * Main PushScheduleSection Component
 * ========================================================================== */
export function PushScheduleSection() {
  const {
    files,
    configData,
    lang,
    deployMode,
    setConfigValue,
    patchConfigValues,
    setFileContent,
    jumpToSource,
    activeSourceFile,
    visualFocusTarget,
    notify,
  } = useEditor()
  const t = useT()

  // Notification state
  const notificationEnabled = getInObject<boolean>(configData, ['notification', 'enabled'], true)
  const maxAccounts = Number(
    getInObject<number>(configData, ['advanced', 'max_accounts_per_channel'], 3),
  )
  const htmlFormatEnabled = getInObject<boolean>(configData, ['storage', 'formats', 'html'], true)
  const globalFilterMethod = getInObject<string>(configData, ['filter', 'method'], 'keyword')

  const channelStatuses = React.useMemo(() => {
    const map = {} as Record<ChannelId, { configured: boolean; count: number; hasError: boolean }>
    for (const ch of CHANNELS) {
      map[ch.id] = getChannelStatus(configData, ch.id)
    }
    return map
  }, [configData])

  const configuredChannelCount = CHANNELS.filter((c) => channelStatuses[c.id].configured).length

  const [selectedChannel, setSelectedChannel] = React.useState<ChannelId>(() => {
    const first = CHANNELS.find((c) => getChannelStatus(configData, c.id).configured)
    return first ? first.id : 'feishu'
  })

  // Schedule & Timeline state
  const scheduleEnabled = getInObject<boolean>(configData, ['schedule', 'enabled'], false)
  const activePresetKey = getInObject<string>(configData, ['schedule', 'preset'], 'morning_evening')

  const timelineParsed = React.useMemo(
    () => parseTimelinePresets(files['timeline.yaml'], lang),
    [files, lang],
  )
  const activePreset: TimelineParsedPreset | undefined = React.useMemo(
    () => timelineParsed.presets.find((p) => p.key === activePresetKey),
    [timelineParsed.presets, activePresetKey],
  )
  const activePresetDisplayName = activePreset
    ? getLocalizedTimelinePresetName(activePreset.key, activePreset.config.name, lang)
    : activePresetKey

  const timelineValidation = React.useMemo(() => {
    if (!activePreset) return []
    return validateTimelinePreset(activePreset.key, activePreset.config)
  }, [activePreset])

  // Layer 3 orchestrator state
  const [selectedPeriodKey, setSelectedPeriodKey] = React.useState<string | null>(null)
  const [orchestratorTab, setOrchestratorTab] = React.useState<'default' | 'periods' | 'week'>(
    'periods',
  )
  const [orchestratorOpenNonce, setOrchestratorOpenNonce] = React.useState(0)

  // Duplicate preset dialog state
  const [dupDialogOpen, setDupDialogOpen] = React.useState(false)
  const [dupKey, setDupKey] = React.useState('')
  const [dupName, setDupName] = React.useState('')
  const [dupDesc, setDupDesc] = React.useState('')
  const [defaultAdvOpen, setDefaultAdvOpen] = React.useState(false)

  React.useEffect(() => {
    if (!visualFocusTarget || visualFocusTarget.section !== 'push') return
    if (
      visualFocusTarget.channel &&
      CHANNELS.some((c) => c.id === visualFocusTarget.channel)
    ) {
      setSelectedChannel(visualFocusTarget.channel as ChannelId)
    }
    if (visualFocusTarget.timelineTab) {
      setOrchestratorTab(visualFocusTarget.timelineTab)
      setOrchestratorOpenNonce((n) => n + 1)
    }
  }, [visualFocusTarget])

  // Add day plan inline state
  const [newPlanKey, setNewPlanKey] = React.useState('')

  const updateTimelinePatches = React.useCallback(
    (patches: YamlPatch[]) => {
      const next = setYamlValues(files['timeline.yaml'], patches)
      setFileContent('timeline.yaml', next)
    },
    [files, setFileContent],
  )

  const updateActivePresetField = React.useCallback(
    (subPath: Array<string | number>, value: unknown) => {
      const next = updatePresetField(files['timeline.yaml'], activePresetKey, subPath, value)
      setFileContent('timeline.yaml', next)
    },
    [files, activePresetKey, setFileContent],
  )

  const removeActivePresetField = React.useCallback(
    (subPath: Array<string | number>) => {
      const basePath = getPresetBasePath(activePresetKey)
      updateTimelinePatches([{ path: [...basePath, ...subPath], remove: true }])
    },
    [activePresetKey, updateTimelinePatches],
  )

  const handleSelectPreset = (presetKey: string) => {
    setConfigValue(['schedule', 'preset'], presetKey)
    setSelectedPeriodKey(null)
  }

  const handleSegmentClick = (seg: TimelineVisualSegment) => {
    setSelectedPeriodKey(seg.periodKey)
    setOrchestratorTab('periods')
    setOrchestratorOpenNonce((n) => n + 1)
    setTimeout(() => {
      const el = document.getElementById(`period-card-${seg.periodKey}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 80)
  }

  const handleOpenDuplicate = () => {
    const baseKey = activePresetKey === 'custom' ? 'my_schedule' : `${activePresetKey}_copy`
    setDupKey(baseKey)
    setDupName(
      activePreset
        ? `${activePresetDisplayName} (${t('副本', 'Copy')})`
        : t('自定义副本', 'Custom Copy'),
    )
    setDupDesc(
      activePreset
        ? getLocalizedTimelinePresetDesc(activePreset.key, activePreset.config.description, lang)
        : '',
    )
    setDupDialogOpen(true)
  }

  const handleConfirmDuplicate = () => {
    const cleanKey = dupKey.trim().replace(/[^a-zA-Z0-9_]/g, '_')
    if (!cleanKey) {
      notify(t('请输入合法的英文模板 Key', 'Please enter a valid preset key'), 'warning')
      return
    }
    if (cleanKey === 'custom' || timelineParsed.presets.some((p) => p.key === cleanKey)) {
      notify(t('模板 Key "{v0}" 已存在', 'Preset key "{v0}" already exists', { v0: cleanKey }), 'warning')
      return
    }
    const nextYaml = duplicatePreset(
      files['timeline.yaml'],
      activePresetKey,
      cleanKey,
      dupName.trim() || cleanKey,
      dupDesc,
    )
    setFileContent('timeline.yaml', nextYaml)
    setConfigValue(['schedule', 'preset'], cleanKey)
    setDupDialogOpen(false)
    notify(t('已创建并切换到新模板 "{v0}"', 'Created and switched to "{v0}"', { v0: cleanKey }), 'success')
  }

  const handleDeletePreset = (key: string) => {
    if (BUILTIN_PRESETS.has(key)) return
    const nextYaml = deleteCustomPreset(files['timeline.yaml'], key)
    setFileContent('timeline.yaml', nextYaml)
    if (activePresetKey === key) {
      setConfigValue(['schedule', 'preset'], 'morning_evening')
    }
    notify(t('已删除自定义预设 "{v0}"', 'Deleted preset "{v0}"', { v0: key }), 'success')
  }

  const handleAddPeriod = () => {
    if (!activePreset) return
    const existingKeys = new Set(Object.keys(activePreset.config.periods))
    let idx = existingKeys.size + 1
    let key = `period_${idx}`
    while (existingKeys.has(key)) {
      idx += 1
      key = `period_${idx}`
    }
    const newPeriod: TimelinePeriod = {
      name: t('新时段 {v0}', 'Period {v0}', { v0: idx }),
      start: '09:00',
      end: '11:00',
      push: true,
      report_mode: 'current',
    }
    updateActivePresetField(['periods', key], newPeriod)
    setSelectedPeriodKey(key)
    setOrchestratorTab('periods')
    notify(t('已新增时段 "{v0}"，记得在日计划中勾选启用', 'Added period "{v0}" — enable it in a day plan', { v0: key }), 'success')
    scrollAndFocusElement(`period-card-${key}`, {
      focusSelector: 'input',
      selectText: true,
    })
  }

  const handleDeletePeriod = (periodKey: string) => {
    if (!activePreset) return
    const basePath = getPresetBasePath(activePresetKey)
    const patches: YamlPatch[] = [{ path: [...basePath, 'periods', periodKey], remove: true }]
    for (const [planKey, plan] of Object.entries(activePreset.config.day_plans)) {
      if (Array.isArray(plan?.periods) && plan.periods.includes(periodKey)) {
        patches.push({
          path: [...basePath, 'day_plans', planKey, 'periods'],
          value: plan.periods.filter((p) => p !== periodKey),
        })
      }
    }
    updateTimelinePatches(patches)
    if (selectedPeriodKey === periodKey) setSelectedPeriodKey(null)
  }

  const handleTogglePlanPeriod = (planKey: string, periodKey: string) => {
    if (!activePreset) return
    const current = activePreset.config.day_plans[planKey]?.periods ?? []
    const next = current.includes(periodKey)
      ? current.filter((p) => p !== periodKey)
      : [...current, periodKey]
    updateActivePresetField(['day_plans', planKey, 'periods'], next)
  }

  const handleMovePlanPeriod = (planKey: string, idx: number, dir: -1 | 1) => {
    if (!activePreset) return
    const current = [...(activePreset.config.day_plans[planKey]?.periods ?? [])]
    const nextIdx = idx + dir
    if (nextIdx < 0 || nextIdx >= current.length) return
    const swapped = [...current]
    const tmp = swapped[idx]
    swapped[idx] = swapped[nextIdx]
    swapped[nextIdx] = tmp
    updateActivePresetField(['day_plans', planKey, 'periods'], swapped)
  }

  const handleAddDayPlan = () => {
    if (!activePreset) return
    const cleanKey =
      newPlanKey.trim().replace(/[^a-zA-Z0-9_]/g, '_') || uid('plan')
    if (activePreset.config.day_plans[cleanKey]) {
      notify(t('日计划 "{v0}" 已存在', 'Day plan "{v0}" already exists', { v0: cleanKey }), 'warning')
      return
    }
    updateActivePresetField(['day_plans', cleanKey], { periods: [] })
    setNewPlanKey('')
    notify(t('已新增日计划 "{v0}"', 'Added day plan "{v0}"', { v0: cleanKey }), 'success')
    scrollAndFocusElement(`day-plan-card-${cleanKey}`)
  }

  const handleDeleteDayPlan = (planKey: string) => {
    if (!activePreset) return
    const allPlans = Object.keys(activePreset.config.day_plans)
    if (allPlans.length <= 1) return
    const fallbackPlan = allPlans.find((k) => k !== planKey)!
    const basePath = getPresetBasePath(activePresetKey)
    const reassignedDays = WEEKDAYS.filter(
      ({ day }) => activePreset.config.week_map[String(day)] === planKey,
    ).map(({ day }) => ({ day, planKey: fallbackPlan }))
    const patches: YamlPatch[] = [
      { path: [...basePath, 'day_plans', planKey], remove: true },
      ...buildWeekMapPatches(files['timeline.yaml'], activePresetKey, reassignedDays),
    ]
    updateTimelinePatches(patches)
  }

  const handleWeekUniform = () => {
    if (!activePreset) return
    const planKeys = Object.keys(activePreset.config.day_plans)
    const targetPlan = activePreset.config.week_map['1'] || planKeys[0]
    if (!targetPlan) return
    const patches = buildWeekMapPatches(
      files['timeline.yaml'],
      activePresetKey,
      WEEKDAYS.map(({ day }) => ({ day, planKey: targetPlan })),
    )
    updateTimelinePatches(patches)
    notify(t('全周 7 天已统一为 "{v0}"', 'All 7 days assigned to "{v0}"', { v0: targetPlan }), 'success')
  }

  const handleWeekWorkdayWeekend = () => {
    if (!activePreset) return
    const basePath = getPresetBasePath(activePresetKey)
    const plans = activePreset.config.day_plans
    const planKeys = Object.keys(plans)
    const firstPlanPeriods = planKeys[0] ? [...(plans[planKeys[0]]?.periods ?? [])] : []
    const patches: YamlPatch[] = []
    if (!plans.workday) {
      patches.push({ path: [...basePath, 'day_plans', 'workday'], value: { periods: firstPlanPeriods } })
    }
    if (!plans.weekend) {
      patches.push({ path: [...basePath, 'day_plans', 'weekend'], value: { periods: firstPlanPeriods } })
    }
    patches.push(
      ...buildWeekMapPatches(
        files['timeline.yaml'],
        activePresetKey,
        WEEKDAYS.map(({ day }) => ({
          day,
          planKey: day <= 5 ? 'workday' : 'weekend',
        })),
      ),
    )
    updateTimelinePatches(patches)
    notify(
      t('已设为工作日 (workday) 与周末 (weekend) 分离映射', 'Applied weekday (workday) / weekend split'),
      'success',
    )
  }

  /* ---------------- Channel Detail Renderer ---------------- */
  const renderChannelDetail = () => {
    const chBase = ['notification', 'channels', selectedChannel]

    if (selectedChannel === 'feishu') {
      return (
        <MultiSecretAccountList
          rawValue={String(getInObject(configData, [...chBase, 'webhook_url'], '') ?? '')}
          onCommit={(v) => setConfigValue([...chBase, 'webhook_url'], v)}
          label={t('飞书机器人 Webhook URL', 'Feishu Bot Webhook URL')}
          placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx"
          envVar="FEISHU_WEBHOOK_URL"
          maxAccounts={maxAccounts}
        />
      )
    }

    if (selectedChannel === 'dingtalk') {
      return (
        <MultiSecretAccountList
          rawValue={String(getInObject(configData, [...chBase, 'webhook_url'], '') ?? '')}
          onCommit={(v) => setConfigValue([...chBase, 'webhook_url'], v)}
          label={t('钉钉机器人 Webhook URL', 'DingTalk Bot Webhook URL')}
          placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxx"
          envVar="DINGTALK_WEBHOOK_URL"
          maxAccounts={maxAccounts}
        />
      )
    }

    if (selectedChannel === 'wework') {
      const msgType = getInObject<string>(configData, [...chBase, 'msg_type'], 'markdown')
      return (
        <div className="space-y-4">
          <MultiSecretAccountList
            rawValue={String(getInObject(configData, [...chBase, 'webhook_url'], '') ?? '')}
            onCommit={(v) => setConfigValue([...chBase, 'webhook_url'], v)}
            label={t('企业微信机器人 Webhook URL', 'WeWork Bot Webhook URL')}
            placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxx"
            envVar="WEWORK_WEBHOOK_URL"
            maxAccounts={maxAccounts}
          />
          <div className="border-t border-[var(--border-default)] pt-3">
            <SettingRow
              label={t('消息格式 (msg_type)', 'Message Format (msg_type)')}
              description={t(
                '群机器人选 markdown，个人微信应用选 text。',
                'Use markdown for group bots; text for personal apps.',
              )}
            >
              <div className="inline-flex rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1 gap-1">
                {(['markdown', 'text'] as const).map((mt) => (
                  <button
                    key={mt}
                    type="button"
                    onClick={() => setConfigValue([...chBase, 'msg_type'], mt)}
                    className={cn(
                      'tr-focus-ring rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all cursor-pointer whitespace-nowrap',
                      msgType === mt
                        ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] shadow-[var(--shadow-xs)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                    )}
                  >
                    {mt === 'markdown'
                      ? t('Markdown（群机器人）', 'Markdown (Bot)')
                      : t('纯文本（个人应用）', 'Plain Text (App)')}
                  </button>
                ))}
              </div>
            </SettingRow>
          </div>
        </div>
      )
    }

    if (selectedChannel === 'telegram') {
      return (
        <TelegramAccountsEditor
          rawTokens={String(getInObject(configData, [...chBase, 'bot_token'], '') ?? '')}
          rawChats={String(getInObject(configData, [...chBase, 'chat_id'], '') ?? '')}
          maxAccounts={maxAccounts}
          onCommit={(nextTokens, nextChats) =>
            patchConfigValues([
              { path: [...chBase, 'bot_token'], value: nextTokens },
              { path: [...chBase, 'chat_id'], value: nextChats },
            ])
          }
        />
      )
    }

    if (selectedChannel === 'email') {
      const emailFrom = String(getInObject(configData, [...chBase, 'from'], '') ?? '')
      const emailPassword = String(getInObject(configData, [...chBase, 'password'], '') ?? '')
      const emailTo = String(getInObject(configData, [...chBase, 'to'], '') ?? '')
      const smtpServer = String(getInObject(configData, [...chBase, 'smtp_server'], '') ?? '')
      const smtpPort = String(getInObject(configData, [...chBase, 'smtp_port'], '') ?? '')
      const emailConfigured = Boolean(emailFrom.trim() || emailTo.trim())
      const smtpCustomized = (smtpServer.trim() ? 1 : 0) + (smtpPort.trim() ? 1 : 0)

      return (
        <div className="space-y-4">
          {emailConfigured && !htmlFormatEnabled && (
            <Callout
              tone="danger"
              icon={<ShieldAlert className="h-4 w-4 text-red-500" />}
              title={t(
                '邮件推送需要开启 HTML 报告输出',
                'Email delivery requires storage.formats.html = true',
              )}
              action={
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => {
                    setConfigValue(['storage', 'formats', 'html'], true)
                    notify(t('已开启 HTML 报告生成', 'Enabled HTML report output'), 'success')
                  }}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  <span>{t('一键开启 HTML', 'Enable HTML')}</span>
                </Button>
              }
            >
              {t(
                '发信时直接发送 HTML 报告正文，关闭将导致失败。',
                'TrendRadar sends the HTML report as the email body.',
              )}
            </Callout>
          )}

          <div className="divide-y divide-[var(--border-default)]">
            <SettingRow
              label={t('发件人邮箱 (from)', 'Sender Email (from)')}
              description={t(
                '用于登录 SMTP 服务器的发件地址。',
                'Sender address for SMTP authentication.',
              )}
              envVar="EMAIL_FROM"
            >
              <Input
                value={emailFrom}
                onChange={(e) => setConfigValue([...chBase, 'from'], e.target.value)}
                placeholder="sender@example.com"
                className="font-mono text-sm @min-[40rem]/section:w-72"
              />
            </SettingRow>

            <SettingRow
              label={t('邮箱授权码 (password)', 'App Password (password)')}
              description={t(
                '请填写 SMTP 专用授权码或应用密码。',
                'Use an SMTP app password or authorization code.',
              )}
              envVar="EMAIL_PASSWORD"
            >
              <div className="@min-[40rem]/section:w-72">
                <SecretInput
                  value={emailPassword}
                  onChange={(v) => setConfigValue([...chBase, 'password'], v)}
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  envVar="EMAIL_PASSWORD"
                />
              </div>
            </SettingRow>

            <SettingRow
              label={t('收件人邮箱 (to)', 'Recipient Emails (to)')}
              description={t(
                '支持多个收件人，自动逗号分隔保存。',
                'Supports multiple comma-separated recipients.',
              )}
              envVar="EMAIL_TO"
              vertical
            >
              <EmailRecipientsInput
                value={emailTo}
                onChange={(v) => setConfigValue([...chBase, 'to'], v)}
              />
            </SettingRow>
          </div>

          <AdvancedCollapsible
            title={t('自定义 SMTP 服务器与端口', 'Custom SMTP Server & Port')}
            description={t(
              '留空自动识别 Gmail / QQ / 163 / Outlook 等 13 种常见邮箱',
              'Leave empty to auto-detect 13 major email providers',
            )}
            customizedCount={smtpCustomized}
          >
            <div className="grid grid-cols-1 gap-4 @min-[40rem]/section:grid-cols-2">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)]">
                  <span>{t('SMTP 服务器', 'SMTP Server')}</span>
                  <code className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs">
                    EMAIL_SMTP_SERVER
                  </code>
                </label>
                <Input
                  value={smtpServer}
                  onChange={(e) => setConfigValue([...chBase, 'smtp_server'], e.target.value)}
                  placeholder="smtp.example.com"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)]">
                  <span>{t('SMTP 端口', 'SMTP Port')}</span>
                  <code className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs">
                    EMAIL_SMTP_PORT
                  </code>
                </label>
                <Input
                  value={smtpPort}
                  onChange={(e) => setConfigValue([...chBase, 'smtp_port'], e.target.value)}
                  placeholder="465 / 587"
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </AdvancedCollapsible>
        </div>
      )
    }

    if (selectedChannel === 'ntfy') {
      return (
        <NtfyAccountsEditor
          serverUrl={String(
            getInObject(configData, [...chBase, 'server_url'], 'https://ntfy.sh') ?? '',
          )}
          rawTopics={String(getInObject(configData, [...chBase, 'topic'], '') ?? '')}
          rawTokens={String(getInObject(configData, [...chBase, 'token'], '') ?? '')}
          maxAccounts={maxAccounts}
          onServerUrlChange={(v) => setConfigValue([...chBase, 'server_url'], v)}
          onCommitPairs={(nextTopics, nextTokens) =>
            patchConfigValues([
              { path: [...chBase, 'topic'], value: nextTopics },
              { path: [...chBase, 'token'], value: nextTokens },
            ])
          }
        />
      )
    }

    if (selectedChannel === 'bark') {
      return (
        <MultiSecretAccountList
          rawValue={String(getInObject(configData, [...chBase, 'url'], '') ?? '')}
          onCommit={(v) => setConfigValue([...chBase, 'url'], v)}
          label={t('Bark 推送 URL', 'Bark Push URL')}
          placeholder="https://api.day.app/your_device_key"
          envVar="BARK_URL"
          maxAccounts={maxAccounts}
        />
      )
    }

    if (selectedChannel === 'slack') {
      return (
        <MultiSecretAccountList
          rawValue={String(getInObject(configData, [...chBase, 'webhook_url'], '') ?? '')}
          onCommit={(v) => setConfigValue([...chBase, 'webhook_url'], v)}
          label={t('Slack Incoming Webhook URL', 'Slack Incoming Webhook URL')}
          placeholder="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX"
          envVar="SLACK_WEBHOOK_URL"
          maxAccounts={maxAccounts}
        />
      )
    }

    // generic_webhook
    const payloadTemplate = String(
      getInObject(configData, [...chBase, 'payload_template'], '') ?? '',
    )
    return (
      <div className="space-y-4">
        <MultiSecretAccountList
          rawValue={String(getInObject(configData, [...chBase, 'webhook_url'], '') ?? '')}
          onCommit={(v) => setConfigValue([...chBase, 'webhook_url'], v)}
          label={t('通用 Webhook URL', 'Generic Webhook URL')}
          placeholder="https://discord.com/api/webhooks/xxxx/yyyy"
          envVar="GENERIC_WEBHOOK_URL"
          maxAccounts={maxAccounts}
        />

        <div className="border-t border-[var(--border-default)] pt-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <div className="text-sm font-medium text-[var(--text-primary)]">
                {t('JSON 请求体模板 (payload_template)', 'JSON Payload Template')}
              </div>
              <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                {t(
                  '支持 {title} 与 {content} 占位符，留空使用默认结构。',
                  'Supports {title} and {content}; leave blank for default JSON.',
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  setConfigValue([...chBase, 'payload_template'], '{"content": "{content}"}')
                  notify(t('已填入 Discord 推荐模板', 'Filled Discord template'), 'success')
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{t('Discord 示例', 'Discord Preset')}</span>
              </Button>
              {payloadTemplate && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setConfigValue([...chBase, 'payload_template'], '')}
                >
                  {t('清空', 'Clear')}
                </Button>
              )}
            </div>
          </div>

          <Textarea
            rows={3}
            value={payloadTemplate}
            onChange={(e) => setConfigValue([...chBase, 'payload_template'], e.target.value)}
            placeholder='{"content": "{content}"}'
            className="font-mono text-sm"
            spellCheck={false}
          />
        </div>
      </div>
    )
  }

  /* ---------------- Timeline Default Behavior Values ---------------- */
  const activeDefault = activePreset?.config.default ?? {}
  const defaultSearchTriState =
    activeDefault.search === undefined || activeDefault.search === null
      ? '__follow__'
      : activeDefault.search
        ? 'true'
        : 'false'

  const defaultSwitchItems = [
    {
      key: 'collect',
      label: t('采集', 'Collect'),
      code: 'collect',
      checked: activeDefault.collect ?? true,
      onChange: (v: boolean) => updateActivePresetField(['default', 'collect'], v),
    },
    {
      key: 'push',
      label: t('推送', 'Push'),
      code: 'push',
      checked: activeDefault.push ?? false,
      onChange: (v: boolean) => updateActivePresetField(['default', 'push'], v),
    },
    {
      key: 'analyze',
      label: t('AI 分析', 'AI Analyze'),
      code: 'analyze',
      checked: activeDefault.analyze ?? false,
      onChange: (v: boolean) => updateActivePresetField(['default', 'analyze'], v),
    },
    {
      key: 'once_push',
      label: t('仅推一次', 'Once Push'),
      code: 'once.push',
      checked: activeDefault.once?.push ?? false,
      onChange: (v: boolean) => updateActivePresetField(['default', 'once', 'push'], v),
    },
    {
      key: 'once_analyze',
      label: t('仅析一次', 'Once AI'),
      code: 'once.analyze',
      checked: activeDefault.once?.analyze ?? false,
      onChange: (v: boolean) => updateActivePresetField(['default', 'once', 'analyze'], v),
    },
    {
      key: 'once_search',
      label: t('仅搜一次', 'Once Search'),
      code: 'once.search',
      checked: activeDefault.once?.search ?? false,
      onChange: (v: boolean) => updateActivePresetField(['default', 'once', 'search'], v),
    },
  ]

  const periodEntries = activePreset ? Object.entries(activePreset.config.periods) : []
  const dayPlanEntries = activePreset ? Object.entries(activePreset.config.day_plans) : []
  const dayPlanOptions = dayPlanEntries.map(([planKey, plan]) => ({
    value: planKey,
    label: planKey,
    hint:
      plan.periods.length > 0
        ? plan.periods.join(', ')
        : t('无时段（全天默认）', 'No periods (default all day)'),
  }))

  const visibleValidationIssues = timelineValidation.filter(
    (it) => it.type !== 'short_window' || deployMode === 'github_actions',
  )

  return (
    <SectionShell
      sectionId="push"
      stepNumber="STEP 05"
      title={t('推送与定时', 'Push & Schedule')}
      subtitle={t(
        '配置通知推送渠道，并按需开启 7×24h 定时调度时间线。',
        'Configure notification channels and optional 7x24h scheduling.',
      )}
      docSlug="push-channels"
      sourceFile="timeline.yaml"
    >
      {/* ====================================================================
       * Upper Half: Notification Channels
       * ================================================================== */}
      <ToggleSectionCard
        id="pro-anchor-notification"
        icon={<Bell className="h-5 w-5" />}
        title={t('推送通知渠道', 'Notification Channels')}
        description={t(
          '推送总开关，开启后将发送至所有已配置渠道。',
          'Master toggle; sends reports to all configured channels.',
        )}
        badge={
          <Badge tone={configuredChannelCount > 0 ? 'success' : 'neutral'}>
            {configuredChannelCount > 0
              ? t('已配置 {v0} 个渠道', '{v0} configured', { v0: configuredChannelCount })
              : t('待配置渠道', 'No channel set')}
          </Badge>
        }
        checked={notificationEnabled}
        onCheckedChange={(v) => setConfigValue(['notification', 'enabled'], v)}
      >
        {/* Minimalist 9-Channel Grid (1 Row x 3 Cols -> 3x3 Matrix) */}
        <div className="grid grid-cols-1 gap-3 @min-[28rem]/section:grid-cols-2 @min-[38rem]/section:grid-cols-3">
          {CHANNELS.map((ch) => {
            const st = channelStatuses[ch.id]
            const active = selectedChannel === ch.id
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setSelectedChannel(ch.id)}
                className={cn(
                  'tr-focus-ring flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-all cursor-pointer',
                  active
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-soft)] shadow-[var(--shadow-xs)]'
                    : 'border-[var(--border-default)] bg-[var(--bg-base)]/60 hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]',
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
                      active
                        ? 'border-[var(--brand-border)] bg-[var(--bg-surface)] text-[var(--brand-primary)]'
                        : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-muted)]',
                    )}
                  >
                    {ch.icon}
                  </span>
                  <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {t(ch.nameZh, ch.nameEn)}
                  </span>
                </div>

                {st.hasError ? (
                  <Badge tone="danger" className="shrink-0">
                    {t('异常', 'Error')}
                  </Badge>
                ) : st.configured ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-teal-500/25 bg-teal-500/10 px-2.5 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300">
                    <span className="h-2 w-2 rounded-full bg-teal-500" />
                    <span>
                      {ch.id === 'email'
                        ? t('已配置', 'Ready')
                        : t('{v0} 账号', '{v0}', { v0: st.count })}
                    </span>
                  </span>
                ) : (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-[var(--border-strong)]"
                    aria-label={t('未配置', 'Not configured')}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Selected Channel Detail Panel */}
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/45 p-5 space-y-4">
          {(() => {
            const meta = CHANNELS.find((c) => c.id === selectedChannel)!
            return (
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border-default)] pb-3.5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[var(--brand-primary)]">{meta.icon}</span>
                    <h4 className="text-[15px] font-semibold text-[var(--text-primary)]">
                      {t('{v0} 渠道配置', '{v1} Settings', { v0: meta.nameZh, v1: meta.nameEn })}
                    </h4>
                    <code className="rounded bg-[var(--bg-muted)] px-2 py-0.5 font-mono text-xs text-[var(--text-muted)]">
                      notification.channels.{meta.id}
                    </code>
                  </div>
                  <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                    {t(meta.descZh, meta.descEn)}
                  </p>
                </div>
              </div>
            )
          })()}

          {renderChannelDetail()}
        </div>
      </ToggleSectionCard>

      {/* ====================================================================
       * Lower Half: Schedule & 7x24h Timeline Orchestrator
       * ================================================================== */}
      <ToggleSectionCard
        id="pro-anchor-timeline"
        sourceTarget={{ file: 'config.yaml', path: ['schedule'] }}
        icon={<Clock className="h-5 w-5" />}
        title={t('定时调度与 7×24h 时间线', 'Schedule & 7x24h Timeline')}
        description={t(
          '按星期与时段自动切换采集、分析与推送节奏。',
          'Automate collect, analysis, and push by weekday window.',
        )}
        badge={
          scheduleEnabled && activePreset ? (
            <Badge tone="brand">
              {activePresetDisplayName}
            </Badge>
          ) : undefined
        }
        checked={scheduleEnabled}
        forceExpanded={
          activeSourceFile === 'timeline.yaml' ||
          Boolean(visualFocusTarget?.timelineTab) ||
          visualFocusTarget?.anchor === 'pro-anchor-timeline-orchestrator'
        }
        onCheckedChange={(v) => setConfigValue(['schedule', 'enabled'], v)}
      >
        {!scheduleEnabled && (
          <Callout tone="info" title={t('时间线预览与提前编排', 'Timeline Preview Mode')}>
            {t(
              '当前定时调度总开关处于关闭状态，但你可以在此直接预览和编辑 timeline.yaml，随时打开上方开关即可按时间线自动调度。',
              'Schedule master toggle is currently off — you can still inspect and edit timeline.yaml here, then flip the toggle above when ready.',
            )}
          </Callout>
        )}
        {timelineParsed.error ? (
          <Callout
            tone="danger"
            icon={<ShieldAlert className="h-4 w-4 text-red-500" />}
            title={t('timeline.yaml 解析失败', 'Failed to parse timeline.yaml')}
            action={
              <Button variant="outline" size="xs" onClick={() => jumpToSource('timeline.yaml')}>
                {t('查看源码修复', 'Inspect YAML')}
              </Button>
            }
          >
            {timelineParsed.error}
          </Callout>
        ) : (
          <div className="space-y-6">
            {/* ---------------- Layer 1: Preset Card Grid ---------------- */}
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <h4 className="text-[15px] font-semibold text-[var(--text-primary)]">
                    {t('调度预设模板', 'Schedule Presets')}
                  </h4>
                  <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                    {t(
                      '点选模板即生效，底部色条预览周一 24h 节奏。',
                      'Pick a preset below; bar previews Monday 24h schedule.',
                    )}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenDuplicate}
                  disabled={!activePreset}
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>{t('复制为新模板', 'Duplicate Preset')}</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3.5 @min-[34rem]/section:grid-cols-2 @min-[46rem]/section:grid-cols-3">
                {timelineParsed.presets.map((preset) => {
                  const selected = preset.key === activePresetKey
                  const monSegments = buildDaySegments(preset.config, 1)
                  const canDelete = !BUILTIN_PRESETS.has(preset.key)
                  const displayPresetName = getLocalizedTimelinePresetName(
                    preset.key,
                    preset.config.name,
                    lang,
                  )
                  const displayPresetDesc = getLocalizedTimelinePresetDesc(
                    preset.key,
                    preset.config.description,
                    lang,
                  )
                  return (
                    <div
                      key={preset.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectPreset(preset.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleSelectPreset(preset.key)
                        }
                      }}
                      className={cn(
                        'tr-focus-ring group group/row relative flex flex-col justify-between gap-3.5 rounded-xl border p-4 text-left transition-all cursor-pointer',
                        selected
                          ? 'border-[var(--brand-primary)] bg-[var(--brand-soft)] shadow-[var(--shadow-xs)]'
                          : 'border-[var(--border-default)] bg-[var(--bg-base)]/60 hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]',
                      )}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
                              {displayPresetName}
                            </span>
                            {selected && (
                              <Check className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <code className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-muted)]">
                              {preset.key}
                            </code>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeletePreset(preset.key)
                                }}
                                className="tr-hover-delete rounded p-1 text-[var(--text-muted)] hover:bg-red-500/12 hover:text-red-500 cursor-pointer"
                                aria-label={t('删除预设 {v0}', 'Delete preset {v0}', { v0: preset.key })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        {displayPresetDesc && (
                          <p className="text-[13px] leading-relaxed text-[var(--text-muted)] line-clamp-2">
                            {displayPresetDesc}
                          </p>
                        )}
                      </div>

                      {/* Mini 24h Monday Bar (Solid Colors) */}
                      <div className="space-y-1.5">
                        <div
                          className={cn(
                            'relative h-2.5 w-full overflow-hidden rounded-full border border-[var(--border-default)]',
                            getDefaultBaseTrackClass(preset.config.default),
                          )}
                        >
                          {monSegments.map((seg, i) => (
                            <div
                              key={`${seg.periodKey}-${i}`}
                              className={cn(
                                'absolute top-0 bottom-0',
                                getSegmentStyleClass(seg.behavior),
                              )}
                              style={{
                                left: `${(seg.startMin / 1440) * 100}%`,
                                width: `${Math.max(1.8, ((seg.endMin - seg.startMin) / 1440) * 100)}%`,
                              }}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between font-mono text-xs text-[var(--text-muted)]">
                          <span>00:00</span>
                          <span>12:00</span>
                          <span>24:00</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {!activePreset ? (
              <Callout
                tone="danger"
                icon={<ShieldAlert className="h-4 w-4 text-red-500" />}
                title={t('找不到当前预设 "{v0}"', 'Preset "{v0}" not found in timeline.yaml', { v0: activePresetKey })}
                action={
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleSelectPreset('morning_evening')}
                  >
                    {t('切回 morning_evening', 'Switch to morning_evening')}
                  </Button>
                }
              >
                {t(
                  '请点选上方有效模板，或切回默认预设。',
                  'Select a valid preset above or revert to morning_evening.',
                )}
              </Callout>
            ) : (
              <>
                {/* ---------------- Layer 2: Interactive 7x24h Week Timeline ---------------- */}
                <Card className="p-5 space-y-4 bg-[var(--bg-base)]/50">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CalendarRange className="h-4 w-4 text-[var(--brand-primary)]" />
                      <h4 className="text-[15px] font-semibold text-[var(--text-primary)]">
                        {t('7×24h 周视图 · {v0}', '7x24h Weekly View · {v0}', { v0: activePresetDisplayName })}
                      </h4>
                    </div>

                    {/* Solid Color Legend */}
                    <div className="flex flex-wrap items-center gap-3.5 text-[13px] text-[var(--text-muted)]">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-sm bg-[#307da7] dark:bg-[#388cbe]" />
                        {t('推送 + AI', 'Push + AI')}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-sm bg-teal-600" />
                        {t('仅推送', 'Push Only')}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-sm bg-amber-600 dark:bg-amber-500" />
                        {t('静默 AI', 'Silent AI')}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-sm bg-slate-600 dark:bg-slate-500" />
                        {t('仅采集', 'Collect')}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Moon className="h-3.5 w-3.5" />
                        {t('跨午夜', 'Overnight')}
                      </span>
                    </div>
                  </div>

                  {/* Hour Ruler */}
                  <div className="grid grid-cols-[112px_1fr] items-center gap-3 @min-[40rem]/section:grid-cols-[148px_1fr]">
                    <div className="text-xs font-medium text-[var(--text-muted)]">
                      {t('星期 / 计划', 'Day / Plan')}
                    </div>
                    <div className="relative flex justify-between font-mono text-xs text-[var(--text-muted)] px-0.5">
                      <span>00:00</span>
                      <span>06:00</span>
                      <span>12:00</span>
                      <span>18:00</span>
                      <span>24:00</span>
                    </div>
                  </div>

                  {/* 7 Weekday Rows */}
                  <div className="space-y-2">
                    {WEEKDAYS.map(({ day, zh, en }) => {
                      const planKey = activePreset.config.week_map[String(day)] || '-'
                      const segments = buildDaySegments(activePreset.config, day)
                      const defEff = resolveEffectiveBehavior(activePreset.config.default)

                      return (
                        <div
                          key={day}
                          className="grid grid-cols-[112px_1fr] items-center gap-3 @min-[40rem]/section:grid-cols-[148px_1fr]"
                        >
                          <div className="flex items-center justify-between gap-1.5 min-w-0">
                            <span className="text-[13px] font-medium text-[var(--text-primary)] whitespace-nowrap">
                              {t(zh, en)}
                            </span>
                            <span className="truncate rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-muted)] max-w-[68px] @min-[40rem]/section:max-w-[92px]">
                              {planKey}
                            </span>
                          </div>

                          <div
                            className={cn(
                              'relative h-9 w-full overflow-hidden rounded-lg border border-[var(--border-default)]',
                              getDefaultBaseTrackClass(activePreset.config.default),
                            )}
                          >
                            {/* Subtle 6h vertical guides */}
                            <div className="pointer-events-none absolute inset-y-0 left-1/4 w-px bg-[var(--border-default)]" />
                            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-[var(--border-default)]" />
                            <div className="pointer-events-none absolute inset-y-0 left-3/4 w-px bg-[var(--border-default)]" />

                            {/* Default label when no period covers this day */}
                            {segments.length === 0 && (
                              <div className="pointer-events-none flex h-full items-center justify-center px-2 text-xs text-[var(--text-muted)]">
                                {t('全天默认：{v0}{v1} ({v2})', 'Default all day: {v3}{v1} ({v2})', { v0: defEff.push ? '推送' : '静默', v1: defEff.analyze ? ' + AI' : '', v2: defEff.reportMode, v3: defEff.push ? 'Push' : 'Quiet' })}
                              </div>
                            )}

                            {/* Period Segments (Solid Colors) */}
                            {segments.map((seg, idx) => {
                              const leftPct = (seg.startMin / 1440) * 100
                              const widthPct = Math.max(
                                1.5,
                                ((seg.endMin - seg.startMin) / 1440) * 100,
                              )
                              const periodObj = activePreset.config.periods[seg.periodKey]
                              const isSelected = selectedPeriodKey === seg.periodKey
                              const segDisplayName = getLocalizedTimelinePeriodName(
                                seg.periodKey,
                                seg.name,
                                lang,
                              )

                              return (
                                <InfoTooltip
                                  key={`${seg.periodKey}-${idx}`}
                                  content={
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between gap-3 font-semibold text-[13px]">
                                        <span>{segDisplayName}</span>
                                        <span className="font-mono text-xs opacity-85">
                                          {periodObj?.start ?? ''} - {periodObj?.end ?? ''}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs opacity-90">
                                        <span>
                                          {t('采集', 'Collect')}: {seg.behavior.collect ? t('开', 'ON') : t('关', 'OFF')}
                                        </span>
                                        <span>
                                          {t('搜索', 'Search')}: {seg.behavior.search ? t('开', 'ON') : t('关', 'OFF')}
                                        </span>
                                        <span>
                                          {t('分析', 'Analyze')}: {seg.behavior.analyze ? t('开', 'ON') : t('关', 'OFF')}
                                        </span>
                                        <span>
                                          {t('推送', 'Push')}: {seg.behavior.push ? t('开', 'ON') : t('关', 'OFF')}
                                        </span>
                                        <span className="col-span-2">
                                          {t('模式', 'Mode')}: <code className="font-mono">{seg.behavior.reportMode}</code>
                                          {seg.behavior.oncePush ? ` · ${t('仅推一次', 'once push')}` : ''}
                                        </span>
                                      </div>
                                      <div className="pt-0.5 text-xs text-sky-300">
                                        {t('点击色块展开编辑该时段', 'Click to edit this period')}
                                      </div>
                                    </div>
                                  }
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleSegmentClick(seg)}
                                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                    className={cn(
                                      'tr-focus-ring absolute top-0.5 bottom-0.5 flex items-center justify-center gap-1 overflow-hidden rounded-md px-2 text-xs font-medium shadow-xs transition-all hover:brightness-110 cursor-pointer',
                                      getSegmentStyleClass(seg.behavior),
                                      isSelected && 'ring-2 ring-white dark:ring-slate-950 z-10',
                                    )}
                                  >
                                    {seg.crossMidnight && (
                                      <Moon className="h-3 w-3 shrink-0 opacity-90" />
                                    )}
                                    {widthPct >= 8 && (
                                      <span className="truncate">{segDisplayName}</span>
                                    )}
                                  </button>
                                </InfoTooltip>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Live Validation Issues for Active Preset */}
                  {visibleValidationIssues.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {visibleValidationIssues.map((vi, idx) => (
                        <Callout
                          key={`${vi.type}-${vi.periodKey ?? ''}-${vi.day ?? idx}`}
                          tone={vi.type === 'short_window' ? 'info' : 'danger'}
                          icon={
                            vi.type === 'short_window' ? (
                              <Info className="h-4 w-4 text-[var(--brand-primary)]" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )
                          }
                        >
                          <span className="text-[13px]">
                            {t(vi.detailZh, vi.detailEn)}
                          </span>
                        </Callout>
                      ))}
                    </div>
                  )}
                </Card>

                {/* ---------------- Layer 3: Deep Timeline Orchestrator ---------------- */}
                <AdvancedCollapsible
                  id="pro-anchor-timeline-orchestrator"
                  defaultOpen
                  forceOpenSeq={orchestratorOpenNonce}
                  sourceTarget={{ file: 'timeline.yaml', path: getPresetBasePath(activePresetKey) }}
                  title={t('时间线深度编排（{v0}）', 'Timeline Orchestrator ({v0})', { v0: activePresetDisplayName })}
                  description={t(
                    '自定义静默期默认行为、时段积木、日计划与周映射',
                    'Edit quiet defaults, periods, day plans, and weekly mapping',
                  )}
                  icon={<Layers className="h-4 w-4" />}
                >
                  {/* Preset Metadata (name & description) */}
                  <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/45 p-4 @min-[48rem]/section:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
                        {t('当前模板名称 (name)', 'Preset Name (name)')}
                      </label>
                      <Input
                        value={activePreset.config.name ?? ''}
                        onChange={(e) => updateActivePresetField(['name'], e.target.value)}
                        placeholder={activePresetKey}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
                        {t('模板用途说明 (description)', 'Preset Description (description)')}
                      </label>
                      <Input
                        value={activePreset.config.description ?? ''}
                        onChange={(e) => {
                          const v = e.target.value
                          if (!v.trim()) removeActivePresetField(['description'])
                          else updateActivePresetField(['description'], v)
                        }}
                        placeholder={t('例如：工作日早晚各推一次，其余时间静默采集', 'e.g. Push morning & evening on weekdays')}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>

                  <Tabs
                    value={orchestratorTab}
                    onValueChange={(v) => setOrchestratorTab(v as 'default' | 'periods' | 'week')}
                    className="space-y-4"
                  >
                    <TabsList className="w-full @min-[40rem]/section:w-auto">
                      <TabsTrigger value="periods">
                        <span>{t('时段积木', 'Periods')}</span>
                        <Badge tone="neutral">{periodEntries.length}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="default">
                        <span>{t('静默期默认', 'Quiet Default')}</span>
                      </TabsTrigger>
                      <TabsTrigger value="week">
                        <span>{t('日计划与周映射', 'Plans & Week')}</span>
                        <Badge tone="neutral">{dayPlanEntries.length}</Badge>
                      </TabsTrigger>
                    </TabsList>

                    {/* Tab A: Quiet / Default Behavior */}
                    <TabsContent value="default" className="space-y-4">
                      <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                        {t(
                          '不在任何时段内时按这里的设置运行；各时段里没单独改过的开关也会默认跟这里一致。',
                          'Applies outside active periods, and acts as the default for any period setting left unset.',
                        )}
                      </p>

                      <div className="grid grid-cols-1 gap-4 @min-[48rem]/section:grid-cols-3">
                        <div className="space-y-1.5">
                          <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
                            {t('默认报告模式 (report_mode)', 'Default Report Mode')}
                          </label>
                          <SelectField
                            value={activeDefault.report_mode ?? 'current'}
                            onValueChange={(v) =>
                              updateActivePresetField(['default', 'report_mode'], v)
                            }
                            options={[
                              { value: 'daily', label: t('当日汇总 (daily)', 'Daily Summary') },
                              { value: 'current', label: t('当前榜单 (current)', 'Current Snapshot') },
                              { value: 'incremental', label: t('增量监控 (incremental)', 'Incremental') },
                            ]}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
                            {t('默认 AI 分析模式 (ai_mode)', 'Default AI Mode')}
                          </label>
                          <SelectField
                            value={activeDefault.ai_mode ?? '__global__'}
                            onValueChange={(v) => {
                              if (v === '__global__') removeActivePresetField(['default', 'ai_mode'])
                              else updateActivePresetField(['default', 'ai_mode'], v)
                            }}
                            options={[
                              { value: '__global__', label: t('跟随全局 ai_analysis.mode', 'Follow global ai_analysis.mode') },
                              { value: 'follow_report', label: t('跟随报告模式 (follow_report)', 'Follow Report (follow_report)') },
                              { value: 'daily', label: t('当日汇总 (daily)', 'Daily (daily)') },
                              { value: 'current', label: t('当前榜单 (current)', 'Current (current)') },
                              { value: 'incremental', label: t('增量监控 (incremental)', 'Incremental (incremental)') },
                            ]}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
                            {t('静默期联网搜索', 'Default Web Search')}
                          </label>
                          <SelectField
                            value={defaultSearchTriState}
                            onValueChange={(v) => {
                              if (v === '__follow__') removeActivePresetField(['default', 'search'])
                              else updateActivePresetField(['default', 'search'], v === 'true')
                            }}
                            options={[
                              { value: '__follow__', label: t('跟随采集开关（默认）', 'Follow collect (default)') },
                              { value: 'true', label: t('开启搜索 (true)', 'Enable search') },
                              { value: 'false', label: t('关闭搜索 (false)', 'Disable search') },
                            ]}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 @min-[40rem]/section:grid-cols-3">
                        {defaultSwitchItems.map((sw) => (
                          <label
                            key={sw.key}
                            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="text-[13px] font-medium text-[var(--text-primary)] whitespace-nowrap">
                                {sw.label}
                              </div>
                              <div className="font-mono text-xs text-[var(--text-muted)] truncate">
                                {sw.code}
                              </div>
                            </div>
                            <Switch checked={sw.checked} onCheckedChange={sw.onChange} />
                          </label>
                        ))}
                      </div>

                      {/* Default-Level Advanced Overrides */}
                      <Collapsible open={defaultAdvOpen} onOpenChange={setDefaultAdvOpen}>
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="tr-focus-ring inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            <span>
                              {t('静默期高级覆盖项（筛选方式 / 自定义词库与兴趣文件）', 'Default Overrides (Filter / Custom Files)')}
                            </span>
                            {(activeDefault.filter_method ||
                              activeDefault.frequency_file ||
                              activeDefault.interests_file ||
                              activeDefault.search_file) && <Badge tone="brand">{t('已设置', 'Set')}</Badge>}
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="tr-collapsible-content">
                          <div className="mt-3 grid grid-cols-1 gap-3.5 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]/50 p-4 @min-[40rem]/section:grid-cols-2">
                            <div className="space-y-1.5">
                              <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
                                {t('默认筛选策略 (filter_method)', 'Default Filter Method')}
                              </label>
                              <SelectField
                                value={activeDefault.filter_method ?? '__inherit__'}
                                onValueChange={(v) => {
                                  if (v === '__inherit__') removeActivePresetField(['default', 'filter_method'])
                                  else updateActivePresetField(['default', 'filter_method'], v)
                                }}
                                className="h-9 text-[13px]"
                                options={[
                                  { value: '__inherit__', label: t('跟随全局 ({v0})', 'Follow global ({v0})', { v0: globalFilterMethod }) },
                                  { value: 'keyword', label: t('关键词匹配 (keyword)', 'Keyword (keyword)') },
                                  { value: 'ai', label: t('AI 智能筛选 (ai)', 'AI Filter (ai)') },
                                ]}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
                                {t('默认关键词文件 (frequency_file)', 'Default Keyword File')}
                              </label>
                              <Input
                                value={activeDefault.frequency_file ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value.trim()
                                  if (!v) removeActivePresetField(['default', 'frequency_file'])
                                  else updateActivePresetField(['default', 'frequency_file'], v)
                                }}
                                placeholder="frequency_words.txt"
                                className="h-9 font-mono text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
                                {t('默认 AI 兴趣文件 (interests_file)', 'Default AI Interests File')}
                              </label>
                              <Input
                                value={activeDefault.interests_file ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value.trim()
                                  if (!v) removeActivePresetField(['default', 'interests_file'])
                                  else updateActivePresetField(['default', 'interests_file'], v)
                                }}
                                placeholder="ai_interests.txt"
                                className="h-9 font-mono text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-[13px] font-medium text-[var(--text-secondary)]">
                                {t('默认搜索任务文件 (search_file)', 'Default Search File')}
                              </label>
                              <Input
                                value={activeDefault.search_file ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value.trim()
                                  if (!v) removeActivePresetField(['default', 'search_file'])
                                  else updateActivePresetField(['default', 'search_file'], v)
                                }}
                                placeholder="search_queries.txt"
                                className="h-9 font-mono text-sm"
                              />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </TabsContent>

                    {/* Tab B: Period Building Blocks */}
                    <TabsContent value="periods" className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                          {t(
                            '定义可复用的时段积木；开始大于结束时自动识别跨午夜。',
                            'Define reusable windows; start > end marks overnight.',
                          )}
                        </p>
                        <Button variant="primary" size="sm" onClick={handleAddPeriod}>
                          <Plus className="h-4 w-4" />
                          <span>{t('新增时段', 'Add Period')}</span>
                        </Button>
                      </div>

                      {periodEntries.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[var(--border-strong)] p-6 text-center space-y-3">
                          <p className="text-[13px] text-[var(--text-muted)]">
                            {t(
                              '当前预设未划分时段，全天按静默期默认行为运行。',
                              'No periods defined; quiet default applies all 24h.',
                            )}
                          </p>
                          <Button variant="outline" size="sm" onClick={handleAddPeriod}>
                            <Plus className="h-4 w-4" />
                            <span>{t('创建第一个时段', 'Create First Period')}</span>
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3.5">
                          {periodEntries.map(([pKey, period]) => (
                            <PeriodEditorCard
                              key={pKey}
                              periodKey={pKey}
                              period={period}
                              defaultBehavior={activeDefault}
                              globalFilterMethod={globalFilterMethod}
                              selected={selectedPeriodKey === pKey}
                              onSelect={() => setSelectedPeriodKey(pKey)}
                              onUpdateField={(fieldPath, value) =>
                                updateActivePresetField(['periods', pKey, ...fieldPath], value)
                              }
                              onRemoveField={(fieldPath) =>
                                removeActivePresetField(['periods', pKey, ...fieldPath])
                              }
                              onDelete={() => handleDeletePeriod(pKey)}
                            />
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    {/* Tab C: Day Plans & Week Map */}
                    <TabsContent value="week" className="space-y-5">
                      {/* Day Plans */}
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <h5 className="text-sm font-semibold text-[var(--text-primary)]">
                              {t('日计划组装 (day_plans)', 'Day Plans (day_plans)')}
                            </h5>
                            <p className="text-[13px] text-[var(--text-muted)]">
                              {t('勾选每个日计划包含的时段。', 'Toggle periods included in each day plan.')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              value={newPlanKey}
                              onChange={(e) => setNewPlanKey(e.target.value)}
                              placeholder={t('新计划名如 holiday', 'Plan key')}
                              className="h-9 w-40 font-mono text-sm"
                            />
                            <Button variant="outline" size="sm" onClick={handleAddDayPlan}>
                              <Plus className="h-3.5 w-3.5" />
                              <span>{t('新增计划', 'Add Plan')}</span>
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          {dayPlanEntries.map(([planKey, plan]) => (
                            <div
                              key={planKey}
                              id={`day-plan-card-${planKey}`}
                              className="group/row rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]/60 p-4 space-y-2.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <code className="rounded bg-[var(--bg-muted)] px-2 py-0.5 font-mono text-xs font-semibold text-[var(--text-primary)]">
                                    {planKey}
                                  </code>
                                  <span className="text-[13px] text-[var(--text-muted)]">
                                    {t('已含 {v0} 个时段', '{v0} period(s)', { v0: plan.periods.length })}
                                  </span>
                                </div>
                                {dayPlanEntries.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    className="tr-hover-delete text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500"
                                    onClick={() => handleDeleteDayPlan(planKey)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {periodEntries.length === 0 ? (
                                  <span className="text-[13px] text-[var(--text-muted)]">
                                    {t('暂无可选时段积木。', 'No period blocks yet.')}
                                  </span>
                                ) : (
                                  periodEntries.map(([pKey, p]) => {
                                    const included = plan.periods.includes(pKey)
                                    const pDisplayName = getLocalizedTimelinePeriodName(pKey, p.name, lang)
                                    return (
                                      <button
                                        key={pKey}
                                        type="button"
                                        onClick={() => handleTogglePlanPeriod(planKey, pKey)}
                                        className={cn(
                                          'tr-focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all cursor-pointer',
                                          included
                                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                                            : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--brand-border)]',
                                        )}
                                      >
                                        {included && <Check className="h-3.5 w-3.5" />}
                                        <span>{pDisplayName}</span>
                                        <span className="font-mono text-xs opacity-80">
                                          {p.start}-{p.end}
                                        </span>
                                      </button>
                                    )
                                  })
                                )}
                              </div>

                              {plan.periods.length > 1 && (
                                <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border-default)]/70 pt-2.5 text-xs">
                                  <span className="text-[var(--text-muted)] mr-1">
                                    {t('执行与覆盖顺序（后者优先）：', 'Precedence order (later overrides earlier):')}
                                  </span>
                                  {plan.periods.map((pKey, pIdx) => {
                                    const pObj = activePreset.config.periods[pKey]
                                    const pDisplayName = getLocalizedTimelinePeriodName(pKey, pObj?.name, lang)
                                    return (
                                      <span
                                        key={`${planKey}-ord-${pKey}`}
                                        className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-[var(--text-secondary)]"
                                      >
                                        <span className="text-[var(--text-muted)]">#{pIdx + 1}</span>
                                        <span>{pDisplayName}</span>
                                        <button
                                          type="button"
                                          disabled={pIdx === 0}
                                          onClick={() => handleMovePlanPeriod(planKey, pIdx, -1)}
                                          className="rounded p-0.5 text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 cursor-pointer"
                                          title={t('前移', 'Move earlier')}
                                        >
                                          <ArrowLeft className="h-3 w-3" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={pIdx >= plan.periods.length - 1}
                                          onClick={() => handleMovePlanPeriod(planKey, pIdx, 1)}
                                          className="rounded p-0.5 text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 cursor-pointer"
                                          title={t('后移', 'Move later')}
                                        >
                                          <ArrowRight className="h-3 w-3" />
                                        </button>
                                      </span>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Week Map */}
                      <div className="space-y-3 border-t border-[var(--border-default)] pt-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <h5 className="text-sm font-semibold text-[var(--text-primary)]">
                              {t('周映射 (week_map)', 'Weekly Mapping (week_map)')}
                            </h5>
                            <p className="text-[13px] text-[var(--text-muted)]">
                              {t('为周一至周日分别指定日计划。', 'Assign a day plan to each weekday.')}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" size="xs" onClick={handleWeekUniform}>
                              {t('全周统一', 'Same All Week')}
                            </Button>
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={handleWeekWorkdayWeekend}
                            >
                              {t('工作日 / 周末分离', 'Weekday / Weekend')}
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 @min-[40rem]/section:grid-cols-4 @min-[64rem]/section:grid-cols-7">
                          {WEEKDAYS.map(({ day, zh, en }) => {
                            const currentPlan = activePreset.config.week_map[String(day)] ?? ''
                            const safeOptions =
                              currentPlan && !dayPlanOptions.some((o) => o.value === currentPlan)
                                ? [
                                    ...dayPlanOptions,
                                    {
                                      value: currentPlan,
                                      label: `${currentPlan} (${t('缺失', 'missing')})`,
                                    },
                                  ]
                                : dayPlanOptions
                            return (
                              <div
                                key={day}
                                className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]/60 p-2.5 space-y-2"
                              >
                                <div className="text-center text-[13px] font-semibold text-[var(--text-primary)]">
                                  {t(zh, en)}
                                </div>
                                <SelectField
                                  value={currentPlan || (safeOptions[0]?.value ?? '__none__')}
                                  onValueChange={(v) => {
                                    if (v === '__none__') return
                                    updateTimelinePatches(
                                      buildWeekMapPatches(files['timeline.yaml'], activePresetKey, [
                                        { day, planKey: v },
                                      ]),
                                    )
                                  }}
                                  className="h-9 px-2 text-xs font-mono"
                                  options={
                                    safeOptions.length > 0
                                      ? safeOptions
                                      : [{ value: '__none__', label: '-' }]
                                  }
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Overlap Policy */}
                      <div className="border-t border-[var(--border-default)] pt-4">
                        <SettingRow
                          label={t('时段重叠策略 (overlap.policy)', 'Overlap Policy')}
                          description={t(
                            '同一天两个时段有时间交集时的处理方式。',
                            'Behavior when two periods overlap on the same day.',
                          )}
                        >
                          <div className="inline-flex rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1 gap-1">
                            {(
                              [
                                {
                                  value: 'error_on_overlap',
                                  zh: '重叠报错（推荐）',
                                  en: 'Error on Overlap',
                                },
                                {
                                  value: 'last_wins',
                                  zh: '后者覆盖',
                                  en: 'Last Wins',
                                },
                              ] as const
                            ).map((opt) => {
                              const currentPolicy =
                                activePreset.config.overlap?.policy ?? 'error_on_overlap'
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() =>
                                    updateActivePresetField(['overlap', 'policy'], opt.value)
                                  }
                                  className={cn(
                                    'tr-focus-ring rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all cursor-pointer whitespace-nowrap',
                                    currentPolicy === opt.value
                                      ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] shadow-[var(--shadow-xs)]'
                                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                                  )}
                                >
                                  {t(opt.zh, opt.en)}
                                </button>
                              )
                            })}
                          </div>
                        </SettingRow>
                      </div>
                    </TabsContent>
                  </Tabs>
                </AdvancedCollapsible>
              </>
            )}
          </div>
        )}
      </ToggleSectionCard>

      {/* Duplicate Preset Modal */}
      <ModalDialog
        open={dupDialogOpen}
        onOpenChange={setDupDialogOpen}
        title={t('复制当前预设为新模板', 'Duplicate Schedule Preset')}
        description={t('基于 "{v0}" 创建新模板写入 timeline.yaml 并切换。', 'Clone "{v0}" as a new preset in timeline.yaml.', { v0: activePresetKey })}
        maxWidthClass="max-w-md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDupDialogOpen(false)}>
              {t('取消', 'Cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirmDuplicate}>
              <Copy className="h-3.5 w-3.5" />
              <span>{t('创建并切换', 'Create & Activate')}</span>
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              {t('模板标识 Key（英文、数字、下划线）', 'Preset Key (letters, digits, underscore)')}
            </label>
            <Input
              value={dupKey}
              onChange={(e) => setDupKey(e.target.value)}
              placeholder="my_workday_schedule"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              {t('模板显示名称', 'Display Name')}
            </label>
            <Input
              value={dupName}
              onChange={(e) => setDupName(e.target.value)}
              placeholder={t('例如：我的工作日简报', 'e.g. My Workday Briefing')}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              {t('模板用途说明（可选）', 'Description (Optional)')}
            </label>
            <Input
              value={dupDesc}
              onChange={(e) => setDupDesc(e.target.value)}
              placeholder={t('例如：工作日早晚推送，周末静默采集', 'e.g. Weekday morning & evening push')}
              className="text-sm"
            />
          </div>
        </div>
      </ModalDialog>
    </SectionShell>
  )
}
