import { useId, useState, type FormEvent } from 'react'
import { ArrowRight, BellRing, Filter, HelpCircle, LayoutList, Radio } from 'lucide-react'
import { GuidedPipeline, type GuidedStage } from '@/components/guided/GuidedPipeline'
import { GuidedTrialFiles } from '@/components/guided/GuidedTrialFiles'
import { appendStarterTopic } from '@/components/guided/starter-topic'
import { SecretInput } from '@/components/shared/SharedControls'
import { Button, Callout, Card, InfoTooltip, Input, Switch } from '@/components/ui/primitives'
import { useT } from '@/i18n'
import type { ConfigFileKey } from '@/lib/types'
import { cn } from '@/lib/utils'
import { STAGE_FOR_GUIDED_STAGE, stageStyleVars } from '@/lib/workflow-stages'
import { getInObject } from '@/lib/yaml-doc'
import { useEditor } from '@/store/editor-store'

function TopicInput({ ai }: { ai: boolean }) {
  const { files, setFileContent } = useEditor()
  const t = useT()
  const id = useId()
  const [draft, setDraft] = useState('')
  const [feedback, setFeedback] = useState('')
  const file = ai ? 'ai_interests.txt' : 'frequency_words.txt'

  function submit(e: FormEvent) {
    e.preventDefault()
    const topic = draft.trim()
    if (!topic) return
    const result = appendStarterTopic(files[file], file, topic)
    if (result.status !== 'added') {
      setFeedback(result.status === 'duplicate'
        ? t('配置中已包含这个关注项，可以直接复制试跑。', 'This item is already in your file. You can copy it now.')
        : ai ? t('请输入一行自然语言兴趣描述。', 'Enter an interest on one line.')
          : t('在这里输入一个普通关键词；+必含 / !排除 / 正则可在完整筛选设置中添加。', 'Enter a plain keyword here. Use full filter settings for +required / !exclude rules.'))
      return
    }
    setFileContent(file, result.content)
    setDraft('')
    setFeedback(t('已写入「{v0}」，可直接复制下方 {v1} 试跑。', 'Added “{v0}” to {v1}.', { v0: topic, v1: file }))
  }
  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor={id} className="text-sm font-semibold text-[var(--text-primary)]">
        {ai ? t('快速添加一条关注兴趣', 'Add an interest direction') : t('快速添加一个关注关键词', 'Add a keyword to watch')}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Input id={id} className="min-w-[10rem] flex-1" value={draft} placeholder={ai ? t('例如：大模型开源发布与算力芯片进展', 'e.g. Open-source LLM releases and GPU news') : t('例如：具身智能', 'e.g. robotics')}
          onChange={(e) => { setDraft(e.target.value); setFeedback('') }} />
        <Button type="submit" variant="primary" size="md" disabled={!draft.trim()}>{t('添加', 'Add')}</Button>
      </div>
      <p className="text-xs leading-relaxed text-[var(--text-muted)]" role="status">
        {feedback || (draft.trim()
          ? t('按回车或点击「添加」即可写入试跑文件，不影响已有词组。', 'Press Enter or Add to append without overwriting existing rules.')
          : ai ? t('用一句自然语言告诉 AI 你想追踪什么话题。', 'Describe the stories you want AI to select.')
            : t('命中该词的热榜与 RSS 标题将进入你的简报。', 'Headlines containing this word will be matched into your briefing.'))}
      </p>
    </form>
  )
}

const QUICK_CHANNELS = [
  { id: 'feishu', labelZh: '飞书机器人', labelEn: 'Feishu Bot', path: ['notification', 'channels', 'feishu', 'webhook_url'], env: 'FEISHU_WEBHOOK_URL', placeholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/...' },
  { id: 'wework', labelZh: '企业微信', labelEn: 'WeCom Bot', path: ['notification', 'channels', 'wework', 'webhook_url'], env: 'WEWORK_WEBHOOK_URL', placeholder: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...' },
  { id: 'dingtalk', labelZh: '钉钉机器人', labelEn: 'DingTalk Bot', path: ['notification', 'channels', 'dingtalk', 'webhook_url'], env: 'DINGTALK_WEBHOOK_URL', placeholder: 'https://oapi.dingtalk.com/robot/send?access_token=...' },
] as const

export function GuidedStarter() {
  const { configData, configError, setActiveSection, setConfigValue, jumpToSource } = useEditor()
  const t = useT()
  const id = useId()
  const [stage, setStage] = useState<GuidedStage>('sources')
  const [quickChannel, setQuickChannel] = useState<(typeof QUICK_CHANNELS)[number]['id']>('feishu')

  const ai = getInObject<string>(configData, ['filter', 'method'], 'keyword') === 'ai'
  const customInterests = ai && String(getInObject(configData, ['ai_filter', 'interests_file'], '') ?? '').trim()
  const file: ConfigFileKey = stage === 'filter' && !customInterests
    ? (ai ? 'ai_interests.txt' : 'frequency_words.txt')
    : 'config.yaml'

  const sources = [
    { key: 'platforms', title: t('热榜平台 (11 站)', 'Hotlists'), enabled: true },
    { key: 'rss', title: t('RSS 订阅', 'RSS feeds'), enabled: true },
    { key: 'web_search', title: t('定时联网搜索', 'Web search'), enabled: false },
  ]

  const stageTabs: Array<{ key: GuidedStage; icon: typeof Radio; zh: string; en: string }> = [
    { key: 'sources', icon: Radio, zh: '挑来源', en: 'Sources' },
    { key: 'filter', icon: Filter, zh: '加关注词', en: 'Keywords' },
    { key: 'report', icon: LayoutList, zh: '选推送模式', en: 'Report Mode' },
    { key: 'push', icon: BellRing, zh: '填机器人 Webhook', en: 'Bot Webhook' },
  ]

  const activeFlowStage = STAGE_FOR_GUIDED_STAGE[stage]

  const fullLabel = stage === 'sources'
    ? t('打开完整「01 信息来源」管理热榜 / RSS / 搜索词', 'Open full "01 Data Sources" settings')
    : stage === 'filter'
      ? t('打开完整「02 内容筛选」配置词组语法与标题沙盒', 'Open full "02 Content Filter" & sandbox')
      : stage === 'report'
        ? t('打开完整「04 报告与版面」调整区域排序', 'Open full "04 Report & Layout" settings')
        : t('打开完整「05 推送与定时」配置全部 9 大渠道与时间线', 'Open full "05 Push & Schedule" settings')

  const activeQuickChannel = QUICK_CHANNELS.find((c) => c.id === quickChannel) ?? QUICK_CHANNELS[0]
  const quickWebhookVal = String(getInObject(configData, [...activeQuickChannel.path], '') ?? '')

  return (
    <div className="space-y-4">
      <GuidedPipeline section="onboarding" activeStage={stage} onChoose={setStage} />

      <Card className="space-y-5 p-4 sm:p-6">
        {/* Stage Picker Pills (color-coded to match the 3-stage pipeline above, without competing 1-4 numbers) */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border-default)] pb-3.5" role="tablist" aria-label={t('快速体验环节', 'Quick setup tabs')}>
          {stageTabs.map((item) => {
            const Icon = item.icon
            const active = stage === item.key
            const tabStage = STAGE_FOR_GUIDED_STAGE[item.key]
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                data-stage={tabStage}
                aria-selected={active}
                style={stageStyleVars(tabStage)}
                onClick={() => setStage(item.key)}
                className={cn(
                  'tr-focus-ring inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer',
                  active
                    ? 'border-[var(--stage-solid)] bg-[var(--stage-solid)] text-white shadow-[0_4px_10px_-4px_var(--stage-ring)]'
                    : 'border-transparent bg-[var(--stage-soft)]/55 text-[var(--stage-text)] hover:border-[var(--stage-border)] hover:bg-[var(--stage-soft)]',
                )}
              >
                <Icon size={13} />
                <span>{t(item.zh, item.en)}</span>
              </button>
            )
          })}
        </div>

        {configError ? (
          <Callout tone="warning" action={<Button size="xs" onClick={() => jumpToSource('config.yaml')}>{t('修正源码', 'Fix source')}</Button>}>
            {t('请先在源码中修正 config.yaml 的语法，再继续可视化编辑。', 'Fix the syntax in config.yaml before editing visually.')}
          </Callout>
        ) : stage === 'sources' ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-[var(--text-primary)]">
              {t('下次运行要从哪些渠道抓取新闻？', 'Which sources should the next run collect?')}
            </legend>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {sources.map(({ key, title, enabled }) => {
                const checked = Boolean(getInObject(configData, [key, 'enabled'], enabled))
                return (
                  <label
                    key={key}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-sm font-medium transition-colors cursor-pointer',
                      checked
                        ? 'border-[var(--brand-border)] bg-[var(--brand-soft)]/45 text-[var(--text-primary)]'
                        : 'border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)]',
                    )}
                  >
                    <span>{title}</span>
                    <Switch checked={checked} ariaLabel={title} onCheckedChange={(value) => setConfigValue([key, 'enabled'], value)} />
                  </label>
                )
              })}
            </div>
            {Boolean(getInObject(configData, ['web_search', 'enabled'], false)) && (
              <p className="text-xs text-[var(--text-muted)]">
                {t('已开启联网搜索：运行时需配置搜索 API Key（如 DeepSeek Key），主题词在 search_queries.txt 中定义。', 'Web search enabled: provide a search provider key at runtime; topics live in search_queries.txt.')}
              </p>
            )}
          </fieldset>
        ) : stage === 'filter' ? (
          customInterests ? (
            <div className="space-y-2 text-sm">
              <label htmlFor={id} className="block font-semibold">{t('AI 筛选最低相关度分', 'Minimum AI filter score')}</label>
              <div className="flex items-center gap-3">
                <input id={id} type="range" min="0" max="1" step="0.05"
                  value={getInObject(configData, ['ai_filter', 'min_score'], 0.7)}
                  onChange={(e) => setConfigValue(['ai_filter', 'min_score'], Number(e.target.value))} />
                <output htmlFor={id} className="font-mono font-semibold">{getInObject(configData, ['ai_filter', 'min_score'], 0.7)}</output>
              </div>
              <p className="break-words text-xs text-[var(--text-muted)]">
                {t('当前从 config/custom/ai/{v0} 读取自定义兴趣文件。分数越高过滤越严格。', 'Reading custom interests from config/custom/ai/{v0}. Higher scores narrow results.', { v0: customInterests })}
              </p>
            </div>
          ) : (
            <TopicInput key={file} ai={ai} />
          )
        ) : stage === 'report' ? (
          <div className="space-y-2.5">
            <label htmlFor={id} className="block text-sm font-semibold text-[var(--text-primary)]">
              {t('希望每次推送展示哪个范围的新闻？', 'Which stories belong in each report?')}
            </label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {([
                { val: 'daily', zh: '当日汇总 (daily)', descZh: '汇总当天出现过的全部匹配热点', en: 'Daily Digest', descEn: 'All matched stories today' },
                { val: 'current', zh: '当前榜单 (current)', descZh: '只看此时此刻仍在榜上的热点', en: 'Current Ranking', descEn: 'Currently trending matches' },
                { val: 'incremental', zh: '增量监控 (incremental)', descZh: '只推首次新出现的内容，零重复', en: 'Incremental Only', descEn: 'Newly discovered items only' },
              ] as const).map((opt) => {
                const selected = getInObject(configData, ['report', 'mode'], 'current') === opt.val
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setConfigValue(['report', 'mode'], opt.val)}
                    className={cn(
                      'tr-focus-ring rounded-xl border p-3.5 text-left transition-all cursor-pointer',
                      selected
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-soft)]/55'
                        : 'border-[var(--border-default)] bg-[var(--bg-base)] hover:border-[var(--border-strong)]',
                    )}
                  >
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{t(opt.zh, opt.en)}</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">{t(opt.descZh, opt.descEn)}</div>
                  </button>
                )
              })}
            </div>
            {Boolean(getInObject(configData, ['schedule', 'enabled'], false)) && (
              <p className="text-xs text-[var(--text-muted)]">
                {t('提示：当前已开启定时调度，timeline.yaml 中的具体时段可单独覆盖报告模式。', 'Scheduling is enabled; specific time windows in timeline.yaml can override this mode.')}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {t('填入群机器人 Webhook 地址', 'Bot Webhook URL')}
                </span>
                <InfoTooltip
                  content={t(
                    '如需配置 Telegram、邮件、Bark、ntfy、Slack 等更多渠道，点击下方「打开完整推送与定时」即可。',
                    'For Telegram, Email, Bark, ntfy, Slack, or Generic Webhooks, open full Push & Schedule settings below.',
                  )}
                >
                  <button
                    type="button"
                    className="inline-flex items-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] cursor-help"
                    aria-label={t('更多渠道说明', 'More channels')}
                  >
                    <HelpCircle size={14} />
                  </button>
                </InfoTooltip>
              </div>
              <div className="inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-0.5">
                {QUICK_CHANNELS.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setQuickChannel(ch.id)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors',
                      quickChannel === ch.id
                        ? 'bg-[var(--bg-surface)] text-[var(--brand-primary)] shadow-[var(--shadow-xs)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                    )}
                  >
                    {t(ch.labelZh, ch.labelEn)}
                  </button>
                ))}
              </div>
            </div>
            <SecretInput
              value={quickWebhookVal}
              onChange={(v) => setConfigValue([...activeQuickChannel.path], v)}
              placeholder={activeQuickChannel.placeholder}
              envVar={activeQuickChannel.env}
            />
          </div>
        )}

        <div className="border-t border-[var(--border-default)] pt-4 space-y-3">
          <GuidedTrialFiles key={file} section="onboarding" defaultFile={file} choices={[file]} inline />
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              style={stageStyleVars(activeFlowStage)}
              onClick={() => setActiveSection(stage)}
              className="tr-focus-ring inline-flex cursor-pointer items-center gap-1.5 rounded-md text-[13px] font-semibold text-[var(--stage-text)] hover:underline"
            >
              <span>{fullLabel}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}
