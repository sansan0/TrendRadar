import {
  getGroupDisplayName,
  parseFrequencyWords,
  testTitlesAgainstFrequency,
} from './frequency-parser.ts'
import { parseSearchQueries } from './search-parser.ts'
import { parseTimelinePresets } from './timeline-engine.ts'
import { ALL_REGIONS, type ConfigFilesMap, type FrequencyDoc, type Lang } from './types.ts'
import { getInObject, parseConfigYaml } from './yaml-doc.ts'

function matchTitleToFrequency(
  title: string,
  doc: FrequencyDoc,
): { matched: boolean; groupIndex?: number; groupName?: string } {
  const res = testTitlesAgainstFrequency(doc, [title]).results[0]
  if (!res || res.status !== 'matched') return { matched: false }
  return {
    matched: true,
    groupIndex: res.matchedGroupIndex,
    groupName: res.matchedGroupName,
  }
}
import {
  renderTrendRadarPreviewHtml,
  type PreviewAiAnalysis,
  type PreviewHotlistGroup,
  type PreviewHotlistTitle,
  type PreviewNewSourceGroup,
  type PreviewRegionId,
  type PreviewRssGroup,
  type PreviewSearchTopic,
  type PreviewStandaloneData,
  type RankTimelinePoint,
} from './preview-html-renderer.ts'

export interface WeightConfig {
  rank: number
  frequency: number
  hotness: number
}

export interface PreviewSummary {
  mode: 'daily' | 'current' | 'incremental'
  displayMode: 'keyword' | 'platform'
  filterMethod: 'keyword' | 'ai'
  timezone: string
  htmlFormatEnabled: boolean
  activeRegions: PreviewRegionId[]
  hotlistCount: number
  rssCount: number
  searchCount: number
  newCount: number
  standaloneCount: number
  aiEnabled: boolean
  aiHasKey: boolean
  translationEnabled: boolean
  scheduleEnabled: boolean
  schedulePreset: string
  configErrorMessage: string | null
}

export interface BuildPreviewResult {
  html: string
  summary: PreviewSummary
}

interface SampleHotItem {
  platformId: string
  titleZh: string
  titleEn: string
  ranks: number[]
  rankTimeline: RankTimelinePoint[]
  timeDisplay: string
  count: number
  url: string
  isNew: boolean
  inCurrentBatch: boolean
  aiTags: string[]
  aiScore: number
}

interface SampleRssItem {
  feedId: string
  titleZh: string
  titleEn: string
  ageHours: number
  author: string
  url: string
  isNew: boolean
  aiTags: string[]
  aiScore: number
}

const DEFAULT_STOCK_GROUP_NAMES = new Set([
  '胖东来',
  'DeepSeek',
  '华为',
  '比亚迪',
  '大疆',
  '宇树机器人',
  '智元机器人',
  '众擎机器人',
  '黑神话悟空',
  '影之刃零',
  '三体/流浪地球',
  '申奥',
  '京东',
  '字节跳动',
  '腾讯',
  '国产开源模型',
  '特斯拉',
  '英伟达',
  'AMD',
  '微软',
  '谷歌',
  '苹果',
  'OpenAI',
  'Claude',
  '中国',
  '东亚',
  '北美',
  '西欧',
  '俄罗斯',
  '印度',
  'AI 相关',
  '芯片',
  '水电',
  '光伏',
  '核能',
  '能源',
  '自动驾驶',
  '机器人',
  '机器狗',
  '具身智能',
  '航天',
  '量子',
  '脑机',
  '基因',
  '生产力',
])

const SAMPLE_HOT_POOL: SampleHotItem[] = [
  {
    platformId: 'zhihu',
    titleZh: 'DeepSeek 发布新一代开源大模型，推理成本再降 50% 引发开发者热议',
    titleEn: 'DeepSeek unveils next-gen open-source LLM with 50% lower inference cost',
    ranks: [1, 2, 1],
    rankTimeline: [
      { time: '08:00', rank: 4 },
      { time: '09:30', rank: 2 },
      { time: '11:00', rank: 1 },
    ],
    timeDisplay: '08:00~11:00',
    count: 6,
    url: 'https://www.zhihu.com/question/deepseek-next',
    isNew: true,
    inCurrentBatch: true,
    aiTags: ['AI 与大模型动态', '科技前沿'],
    aiScore: 0.96,
  },
  {
    platformId: 'toutiao',
    titleZh: 'DeepSeek 开源推理框架更新：长上下文吞吐量翻倍，多家云厂商火速上线',
    titleEn: 'DeepSeek open-source inference engine doubles long-context throughput across cloud vendors',
    ranks: [2, 5],
    rankTimeline: [
      { time: '08:00', rank: 5 },
      { time: '09:30', rank: 3 },
      { time: '11:00', rank: 2 },
    ],
    timeDisplay: '08:00~11:00',
    count: 4,
    url: 'https://www.toutiao.com/article/deepseek-engine-v2',
    isNew: true,
    inCurrentBatch: true,
    aiTags: ['AI 与大模型动态', '开发者工具'],
    aiScore: 0.94,
  },
  {
    platformId: 'cls-hot',
    titleZh: '深度求索生态合作伙伴扩容，金融与政企私有化部署需求激增',
    titleEn: 'DeepSeek partner ecosystem expands as financial and enterprise private deployments surge',
    ranks: [4, 7],
    rankTimeline: [
      { time: '08:00', rank: 7 },
      { time: '09:30', rank: null },
      { time: '11:00', rank: 4 },
    ],
    timeDisplay: '08:00~11:00',
    count: 3,
    url: 'https://www.cls.cn/detail/deepseek-enterprise',
    isNew: false,
    inCurrentBatch: true,
    aiTags: ['AI 与大模型动态', '宏观经济与金融'],
    aiScore: 0.89,
  },
  {
    platformId: 'bilibili-hot-search',
    titleZh: '本地部署 DeepSeek 满血量化版实测：消费级主机跑出生产级速度',
    titleEn: 'Hands-on local DeepSeek quantized deployment achieves production speed on consumer hardware',
    ranks: [6, 9],
    rankTimeline: [
      { time: '09:30', rank: 6 },
      { time: '11:00', rank: 9 },
    ],
    timeDisplay: '09:30~11:00',
    count: 2,
    url: 'https://www.bilibili.com/video/deepseek-local-quant',
    isNew: true,
    inCurrentBatch: true,
    aiTags: ['开发者工具', 'AI 与大模型动态'],
    aiScore: 0.87,
  },
  {
    platformId: 'wallstreetcn-hot',
    titleZh: '英伟达新一代 AI 芯片量产提速，半导体产业链业绩超预期',
    titleEn: 'NVIDIA accelerates next-gen AI chip production as semiconductor earnings beat expectations',
    ranks: [2, 3, 2],
    rankTimeline: [
      { time: '08:00', rank: 5 },
      { time: '09:30', rank: 3 },
      { time: '11:00', rank: 2 },
    ],
    timeDisplay: '08:00~11:00',
    count: 5,
    url: 'https://wallstreetcn.com/articles/nvidia-ai-chip',
    isNew: false,
    inCurrentBatch: true,
    aiTags: ['AI 与大模型动态', '芯片与半导体'],
    aiScore: 0.92,
  },
  {
    platformId: 'tieba',
    titleZh: 'RTX 显卡与本地 Ollama 部署 32B 模型显存占用实测分享',
    titleEn: 'Local Ollama 32B model VRAM benchmark on RTX desktop GPUs',
    ranks: [7, 11],
    rankTimeline: [
      { time: '09:30', rank: 11 },
      { time: '11:00', rank: 7 },
    ],
    timeDisplay: '09:30~11:00',
    count: 3,
    url: 'https://tieba.baidu.com/p/ollama-vram-bench',
    isNew: true,
    inCurrentBatch: true,
    aiTags: ['开发者工具', '芯片与半导体'],
    aiScore: 0.85,
  },
  {
    platformId: 'ifeng',
    titleZh: '黄仁勋最新演讲谈主权算力与数据中心能效拐点，机构上调算力预期',
    titleEn: 'Jensen Huang highlights sovereign compute and data center efficiency inflection',
    ranks: [5, 8],
    rankTimeline: [
      { time: '08:00', rank: 5 },
      { time: '11:00', rank: 8 },
    ],
    timeDisplay: '08:00~11:00',
    count: 2,
    url: 'https://finance.ifeng.com/nvidia-keynote',
    isNew: false,
    inCurrentBatch: true,
    aiTags: ['芯片与半导体', '宏观经济与金融'],
    aiScore: 0.86,
  },
  {
    platformId: 'toutiao',
    titleZh: '华为昇腾芯片生态公布全新算力方案，多家国产大模型宣布深度适配',
    titleEn: 'Huawei Ascend compute stack launches with broad domestic LLM adoption',
    ranks: [3, 6, 3],
    rankTimeline: [
      { time: '08:00', rank: 9 },
      { time: '09:30', rank: 5 },
      { time: '11:00', rank: 3 },
    ],
    timeDisplay: '08:00~11:00',
    count: 4,
    url: 'https://www.toutiao.com/article/huawei-ascend',
    isNew: true,
    inCurrentBatch: true,
    aiTags: ['芯片与半导体', 'AI 与大模型动态'],
    aiScore: 0.91,
  },
  {
    platformId: 'weibo',
    titleZh: '鸿蒙原生应用生态突破新里程碑，多款高频工具完成全场景适配',
    titleEn: 'HarmonyOS native app ecosystem reaches new milestone across multi-device tools',
    ranks: [4, 7],
    rankTimeline: [
      { time: '08:00', rank: 7 },
      { time: '11:00', rank: 4 },
    ],
    timeDisplay: '08:00~11:00',
    count: 3,
    url: 'https://weibo.com/harmonyos-apps',
    isNew: false,
    inCurrentBatch: true,
    aiTags: ['科技前沿'],
    aiScore: 0.83,
  },
  {
    platformId: 'douyin',
    titleZh: '余承东展示新一代智能座舱语音协同体验，实测响应延迟显著降低',
    titleEn: 'Huawei smart cockpit demo showcases low-latency voice collaboration',
    ranks: [8, 12],
    rankTimeline: [
      { time: '09:30', rank: 12 },
      { time: '11:00', rank: 8 },
    ],
    timeDisplay: '09:30~11:00',
    count: 2,
    url: 'https://www.douyin.com/video/huawei-cockpit',
    isNew: true,
    inCurrentBatch: true,
    aiTags: ['智能汽车与新能源'],
    aiScore: 0.8,
  },
  {
    platformId: 'baidu',
    titleZh: '国家发改委印发人工智能算力基础设施三年行动方案',
    titleEn: 'NDRC releases three-year action plan for AI compute infrastructure',
    ranks: [2, 4],
    rankTimeline: [
      { time: '08:00', rank: 4 },
      { time: '11:00', rank: 2 },
    ],
    timeDisplay: '08:00~11:00',
    count: 4,
    url: 'https://www.baidu.com/s?wd=ai-infra-plan',
    isNew: false,
    inCurrentBatch: true,
    aiTags: ['宏观经济与金融', 'AI 与大模型动态'],
    aiScore: 0.9,
  },
  {
    platformId: 'wallstreetcn-hot',
    titleZh: '港股科技板块资金回流明显，AI 应用商业化增速成为财报焦点',
    titleEn: 'Capital inflows return to Hong Kong tech as AI monetization dominates earnings',
    ranks: [5, 9],
    rankTimeline: [
      { time: '08:00', rank: 9 },
      { time: '11:00', rank: 5 },
    ],
    timeDisplay: '08:00~11:00',
    count: 3,
    url: 'https://wallstreetcn.com/articles/hk-tech-ai',
    isNew: false,
    inCurrentBatch: true,
    aiTags: ['宏观经济与金融', 'AI 与大模型动态'],
    aiScore: 0.84,
  },
  {
    platformId: 'zhihu',
    titleZh: '如何评价 MCP 协议与 AI Agent 在个人知识库工作流中的最新进展？',
    titleEn: 'Evaluating MCP and AI Agent workflows for personal knowledge automation',
    ranks: [3, 5],
    rankTimeline: [
      { time: '09:30', rank: 5 },
      { time: '11:00', rank: 3 },
    ],
    timeDisplay: '09:30~11:00',
    count: 3,
    url: 'https://www.zhihu.com/question/mcp-ai-agent',
    isNew: true,
    inCurrentBatch: true,
    aiTags: ['开发者工具', 'AI 与大模型动态'],
    aiScore: 0.93,
  },
  {
    platformId: 'weibo',
    titleZh: '比亚迪发布下一代智能驾驶与固态电池路线图，新能源汽车格局生变',
    titleEn: 'BYD unveils next-gen autonomous driving and solid-state battery roadmap for EVs',
    ranks: [3, 8, 5],
    rankTimeline: [
      { time: '08:00', rank: 8 },
      { time: '09:30', rank: null },
      { time: '11:00', rank: 5 },
    ],
    timeDisplay: '08:00~11:00',
    count: 3,
    url: 'https://weibo.com/byd-ev-roadmap',
    isNew: false,
    inCurrentBatch: true,
    aiTags: ['智能汽车与新能源'],
    aiScore: 0.85,
  },
  {
    platformId: 'cls-hot',
    titleZh: '比亚迪海外工厂交付创新高，供应链本土化带动单车毛利改善',
    titleEn: 'BYD overseas factory deliveries hit record high with stronger unit margins',
    ranks: [6, 10],
    rankTimeline: [
      { time: '09:30', rank: 10 },
      { time: '11:00', rank: 6 },
    ],
    timeDisplay: '09:30~11:00',
    count: 2,
    url: 'https://www.cls.cn/detail/byd-overseas',
    isNew: true,
    inCurrentBatch: true,
    aiTags: ['智能汽车与新能源', '宏观经济与金融'],
    aiScore: 0.81,
  },
  {
    platformId: 'bilibili-hot-search',
    titleZh: '实测多款开源编程 Agent：Claude 与主流大模型代码重构能力横向对比',
    titleEn: 'Hands-on coding agent benchmark comparing Claude and leading LLMs on refactoring',
    ranks: [4, 7],
    rankTimeline: [
      { time: '09:30', rank: 7 },
      { time: '11:00', rank: 4 },
    ],
    timeDisplay: '09:30~11:00',
    count: 3,
    url: 'https://www.bilibili.com/video/claude-coding-bench',
    isNew: true,
    inCurrentBatch: true,
    aiTags: ['AI 与大模型动态', '开发者工具'],
    aiScore: 0.94,
  },
  {
    platformId: 'zhihu',
    titleZh: 'Anthropic 发布长程工具调用评测报告，Claude 在复杂工程任务中表现如何？',
    titleEn: 'Anthropic publishes long-horizon tool-use benchmarks for Claude engineering workflows',
    ranks: [7, 10],
    rankTimeline: [
      { time: '08:00', rank: 10 },
      { time: '11:00', rank: 7 },
    ],
    timeDisplay: '08:00~11:00',
    count: 2,
    url: 'https://www.zhihu.com/question/anthropic-tool-use',
    isNew: false,
    inCurrentBatch: true,
    aiTags: ['AI 与大模型动态', '开发者工具'],
    aiScore: 0.88,
  },
  {
    platformId: 'thepaper',
    titleZh: '长三角机器人与具身智能产业集群加速落地，多地开放示范场景',
    titleEn: 'Yangtze River Delta robotics and embodied AI cluster expands real-world pilot zones',
    ranks: [6, 12],
    rankTimeline: [
      { time: '08:00', rank: 12 },
      { time: '11:00', rank: 6 },
    ],
    timeDisplay: '08:00~11:00',
    count: 3,
    url: 'https://www.thepaper.cn/newsDetail/embodied-ai',
    isNew: false,
    inCurrentBatch: true,
    aiTags: ['科技前沿'],
    aiScore: 0.82,
  },
  {
    platformId: 'douyin',
    titleZh: '宇树机器人展示复杂地形自主奔跑与搬运，工业巡检商用提速',
    titleEn: 'Unitree Robotics demonstrates autonomous terrain locomotion for industrial inspection',
    ranks: [5, 9],
    rankTimeline: [
      { time: '09:30', rank: 9 },
      { time: '11:00', rank: 5 },
    ],
    timeDisplay: '09:30~11:00',
    count: 2,
    url: 'https://www.douyin.com/video/unitree-demo',
    isNew: true,
    inCurrentBatch: true,
    aiTags: ['科技前沿'],
    aiScore: 0.84,
  },
  {
    platformId: 'cls-hot',
    titleZh: '先进制程芯片封装产能持续吃紧，存储与晶圆代工板块联动走强',
    titleEn: 'Advanced chip packaging capacity tightens as memory and foundry stocks rally',
    ranks: [3, 6],
    rankTimeline: [
      { time: '08:00', rank: 6 },
      { time: '11:00', rank: 3 },
    ],
    timeDisplay: '08:00~11:00',
    count: 3,
    url: 'https://www.cls.cn/detail/chip-packaging',
    isNew: true,
    inCurrentBatch: true,
    aiTags: ['芯片与半导体', '宏观经济与金融'],
    aiScore: 0.88,
  },
  {
    platformId: 'ifeng',
    titleZh: '全球主要央行增持黄金储备创阶段新高，宏观通胀与美元资产再定价',
    titleEn: 'Global central bank gold purchases hit new high amid macro repricing',
    ranks: [11, 15],
    rankTimeline: [
      { time: '08:00', rank: 11 },
      { time: '09:30', rank: 15 },
    ],
    timeDisplay: '08:00~09:30',
    count: 2,
    url: 'https://finance.ifeng.com/gold-reserves',
    isNew: false,
    inCurrentBatch: false,
    aiTags: ['宏观经济与金融'],
    aiScore: 0.72,
  },
]

const SAMPLE_RSS_POOL: SampleRssItem[] = [
  {
    feedId: 'hacker-news',
    titleZh: 'Show HN: 基于 SQLite 与 MCP 的轻量 AI 新闻聚合架构实践',
    titleEn: 'Show HN: Building a local-first AI news aggregator with SQLite and MCP',
    ageHours: 2,
    author: 'hn-editor',
    url: 'https://news.ycombinator.com/item?id=900001',
    isNew: true,
    aiTags: ['开发者工具', 'AI 与大模型动态'],
    aiScore: 0.93,
  },
  {
    feedId: 'hacker-news',
    titleZh: 'DeepSeek 与开源推理框架的量化优化笔记：单卡吞吐提升 2.3 倍',
    titleEn: 'Quantization notes for DeepSeek and open-source inference engines: 2.3x throughput',
    ageHours: 5,
    author: 'ml-systems',
    url: 'https://news.ycombinator.com/item?id=900002',
    isNew: true,
    aiTags: ['AI 与大模型动态'],
    aiScore: 0.91,
  },
  {
    feedId: 'hacker-news',
    titleZh: 'Claude Code 与终端自动化工作流实战：如何低成本维护个人开源仓库',
    titleEn: 'Claude Code and terminal automation workflows for maintaining open-source repos',
    ageHours: 11,
    author: 'dev-ops',
    url: 'https://news.ycombinator.com/item?id=900003',
    isNew: false,
    aiTags: ['开发者工具', 'AI 与大模型动态'],
    aiScore: 0.89,
  },
  {
    feedId: 'yahoo-finance',
    titleZh: '英伟达与云端算力资本开支跟踪：北美云厂商上调年度 AI 预算',
    titleEn: 'NVIDIA and cloud CapEx tracker: Hyperscalers raise annual AI budgets',
    ageHours: 4,
    author: 'Yahoo Finance',
    url: 'https://finance.yahoo.com/news/nvidia-cloud-ai-capex',
    isNew: true,
    aiTags: ['宏观经济与金融', '芯片与半导体'],
    aiScore: 0.88,
  },
  {
    feedId: 'yahoo-finance',
    titleZh: '半导体与芯片供应链季度前瞻：先进封装订单排期延至年底',
    titleEn: 'Semiconductor and chip supply chain outlook: advanced packaging booked through year-end',
    ageHours: 10,
    author: 'Yahoo Finance',
    url: 'https://finance.yahoo.com/news/chip-supply-outlook',
    isNew: false,
    aiTags: ['芯片与半导体', '宏观经济与金融'],
    aiScore: 0.84,
  },
  {
    feedId: 'ruanyifeng',
    titleZh: '科技爱好者周刊：AI Agent 工具链演进与终端自动化趋势',
    titleEn: 'Tech Enthusiast Weekly: AI Agent toolchains and terminal automation trends',
    ageHours: 14,
    author: '阮一峰',
    url: 'https://www.ruanyifeng.com/blog/weekly-ai-agents.html',
    isNew: true,
    aiTags: ['开发者工具', '科技前沿'],
    aiScore: 0.87,
  },
  {
    feedId: 'hacker-news',
    titleZh: '三年前的微服务架构复盘：为什么我们回到单体 SQLite 与本地 AI 检索',
    titleEn: 'Retrospective on microservices: why we moved back to single-node SQLite and local AI search',
    ageHours: 72,
    author: 'infra-notes',
    url: 'https://news.ycombinator.com/item?id=900005',
    isNew: false,
    aiTags: ['开发者工具'],
    aiScore: 0.71,
  },
]

/**
 * Exact mirror of trendradar/core/analyzer.py `calculate_news_weight`.
 */
export function calculateNewsWeight(
  ranks: number[],
  count: number,
  rankThreshold: number,
  weights: WeightConfig,
): number {
  const effectiveRanks = ranks.length > 0 ? ranks : [99]
  const rankScoreSum = effectiveRanks.reduce((sum, r) => sum + (11 - Math.min(r, 10)), 0)
  const highRankCount = effectiveRanks.filter((r) => r <= rankThreshold).length

  const rankWeight = (rankScoreSum / effectiveRanks.length) * 10
  const frequencyWeight = Math.min(count, 10) * 10
  const hotnessWeight = (highRankCount / effectiveRanks.length) * 100

  return (
    rankWeight * weights.rank +
    frequencyWeight * weights.frequency +
    hotnessWeight * weights.hotness
  )
}

function formatNowInTimezone(timezone: string): { short: string; full: string } {
  const now = new Date()
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now)
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
    const y = get('year')
    const m = get('month')
    const d = get('day')
    const h = get('hour') === '24' ? '00' : get('hour')
    const min = get('minute')
    return { short: `${m}-${d} ${h}:${min}`, full: `${y}-${m}-${d} ${h}:${min}` }
  } catch {
    const iso = now.toISOString()
    return { short: `${iso.slice(5, 10)} ${iso.slice(11, 16)}`, full: `${iso.slice(0, 10)} ${iso.slice(11, 16)}` }
  }
}

function formatAgeDisplay(ageHours: number, timezone: string): string {
  const dt = new Date(Date.now() - ageHours * 3600 * 1000)
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'Asia/Shanghai',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(dt)
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
    const h = get('hour') === '24' ? '00' : get('hour')
    return `${get('month')}-${get('day')} ${h}:${get('minute')}`
  } catch {
    return `${ageHours}h ago`
  }
}

function parseInterestLabels(raw: string): string[] {
  const labels: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) continue
    const cleaned = trimmed
      .replace(/^[-*•\d.]+\s*/, '')
      .replace(/[:：].*$/, '')
      .trim()
    if (cleaned.length >= 2 && cleaned.length <= 28 && !labels.includes(cleaned)) {
      labels.push(cleaned)
    }
    if (labels.length >= 6) break
  }
  return labels.length > 0 ? labels : ['AI 与大模型动态', '宏观经济与金融', '开发者工具']
}

function extractSyntheticTerm(pattern: string): string {
  const cleaned = pattern
    .replace(/^\/|\/[a-z]*$/gi, '')
    .replace(/[\\^$*+?.()|[\]{}]/g, ' ')
    .trim()
  return cleaned.split(/\s+/)[0] || pattern
}

function shouldTranslateScope(
  enabled: boolean,
  targetLang: string,
  scopeEnabled: boolean,
): 'en' | 'zh' | null {
  if (!enabled || !scopeEnabled) return null
  const low = targetLang.trim().toLowerCase()
  if (low.includes('en') || low.includes('英')) return 'en'
  if (low.includes('zh') || low.includes('中') || low.includes('chinese')) return 'zh'
  return 'en'
}

function pickTitle(
  item: { titleZh: string; titleEn: string },
  uiLang: Lang,
  translationTarget: 'en' | 'zh' | null,
): string {
  if (translationTarget === 'en') return item.titleEn
  if (translationTarget === 'zh') return item.titleZh
  return uiLang === 'en' ? item.titleEn : item.titleZh
}

export function buildLivePreviewReport(
  files: ConfigFilesMap,
  options: {
    lang: Lang
    wideMode: boolean
    darkMode: boolean
  },
): BuildPreviewResult {
  const parsed = parseConfigYaml(files['config.yaml'])
  const cfg = parsed.data ?? {}

  const timezone = String(getInObject(cfg, ['app', 'timezone'], 'Asia/Shanghai') || 'Asia/Shanghai')
  const htmlFormatEnabled = getInObject<boolean>(cfg, ['storage', 'formats', 'html'], true) !== false

  const rawMode = String(getInObject(cfg, ['report', 'mode'], 'current') || 'current').toLowerCase()
  const mode: 'daily' | 'current' | 'incremental' =
    rawMode === 'daily' || rawMode === 'incremental' || rawMode === 'current' ? rawMode : 'current'

  const rawDisplayMode = String(getInObject(cfg, ['report', 'display_mode'], 'keyword') || 'keyword').toLowerCase()
  const displayMode: 'keyword' | 'platform' = rawDisplayMode === 'platform' ? 'platform' : 'keyword'

  const rawFilterMethod = String(getInObject(cfg, ['filter', 'method'], 'keyword') || 'keyword').toLowerCase()
  const filterMethod: 'keyword' | 'ai' = rawFilterMethod === 'ai' ? 'ai' : 'keyword'
  const prioritySortEnabled = Boolean(getInObject(cfg, ['filter', 'priority_sort_enabled'], true))
  const aiFilterMinScore = Number(getInObject(cfg, ['ai_filter', 'min_score'], 0.7)) || 0

  const rankThreshold = Math.max(1, Number(getInObject(cfg, ['report', 'rank_threshold'], 5)) || 5)
  const maxNewsPerKeyword = Math.max(0, Number(getInObject(cfg, ['report', 'max_news_per_keyword'], 0)) || 0)
  const sortByPositionFirst = Boolean(getInObject(cfg, ['report', 'sort_by_position_first'], false))

  const weights: WeightConfig = {
    rank: Number(getInObject(cfg, ['advanced', 'weight', 'rank'], 0.6)) || 0,
    frequency: Number(getInObject(cfg, ['advanced', 'weight', 'frequency'], 0.3)) || 0,
    hotness: Number(getInObject(cfg, ['advanced', 'weight', 'hotness'], 0.1)) || 0,
  }

  // Regions & ordering
  const rawOrder = getInObject<unknown>(cfg, ['display', 'region_order'], ALL_REGIONS)
  const validRegionSet = new Set<string>(ALL_REGIONS)
  const regionOrder: PreviewRegionId[] = Array.isArray(rawOrder)
    ? rawOrder.filter((r): r is PreviewRegionId => typeof r === 'string' && validRegionSet.has(r))
    : ([...ALL_REGIONS] as PreviewRegionId[])

  const regionHotlist = getInObject<boolean>(cfg, ['display', 'regions', 'hotlist'], true) !== false
  const regionNewItems = getInObject<boolean>(cfg, ['display', 'regions', 'new_items'], false) === true
  const regionRss = getInObject<boolean>(cfg, ['display', 'regions', 'rss'], true) !== false
  const regionWebSearch = getInObject<boolean>(cfg, ['display', 'regions', 'web_search'], true) !== false
  const regionStandalone = getInObject<boolean>(cfg, ['display', 'regions', 'standalone'], false) === true
  const regionAiAnalysis = getInObject<boolean>(cfg, ['display', 'regions', 'ai_analysis'], true) !== false

  // Translation config
  const translationEnabled = Boolean(getInObject(cfg, ['ai_translation', 'enabled'], false))
  const translationLang = String(getInObject(cfg, ['ai_translation', 'language'], '中文') || '中文')
  const translateHotlist = shouldTranslateScope(
    translationEnabled,
    translationLang,
    Boolean(getInObject(cfg, ['ai_translation', 'scope', 'hotlist'], false)),
  )
  const translateRss = shouldTranslateScope(
    translationEnabled,
    translationLang,
    getInObject<boolean>(cfg, ['ai_translation', 'scope', 'rss'], true) !== false,
  )
  const translateSearch = shouldTranslateScope(
    translationEnabled,
    translationLang,
    Boolean(getInObject(cfg, ['ai_translation', 'scope', 'web_search'], false)),
  )
  const translateStandalone = shouldTranslateScope(
    translationEnabled,
    translationLang,
    getInObject<boolean>(cfg, ['ai_translation', 'scope', 'standalone'], true) !== false,
  )

  // Schedule metadata
  const scheduleEnabled = Boolean(getInObject(cfg, ['schedule', 'enabled'], false))
  const schedulePreset = String(getInObject(cfg, ['schedule', 'preset'], 'morning_evening') || 'morning_evening')
  if (scheduleEnabled) {
    // Parse to keep schedule engine live without crashing on partial edits
    parseTimelinePresets(files['timeline.yaml'])
  }

  // Platforms
  const platformsEnabled = getInObject<boolean>(cfg, ['platforms', 'enabled'], true) !== false
  const rawSources = getInObject<unknown>(cfg, ['platforms', 'sources'], [])
  const enabledPlatforms: Array<{ id: string; name: string }> = []
  if (platformsEnabled && Array.isArray(rawSources)) {
    for (const s of rawSources) {
      if (!s || typeof s !== 'object') continue
      const row = s as Record<string, unknown>
      if (row.enabled === false) continue
      const id = String(row.id ?? '').trim()
      if (!id) continue
      const name = String(row.name ?? id).trim() || id
      enabledPlatforms.push({ id, name })
    }
  }
  const platformNameById = new Map(enabledPlatforms.map((p) => [p.id, p.name]))

  // Build dynamic hotlist pool for enabled platforms (including custom user platforms)
  const hotPool: SampleHotItem[] = SAMPLE_HOT_POOL.filter((item) => platformNameById.has(item.platformId))
  for (const plat of enabledPlatforms) {
    if (!hotPool.some((item) => item.platformId === plat.id)) {
      hotPool.push({
        platformId: plat.id,
        titleZh: `${plat.name} 实时热点：AI 行业应用与开源生态最新动态`,
        titleEn: `${plat.name} Trending: Latest updates in AI applications and open-source`,
        ranks: [3, 5],
        rankTimeline: [
          { time: '09:30', rank: 5 },
          { time: '11:00', rank: 3 },
        ],
        timeDisplay: '09:30~11:00',
        count: 2,
        url: `https://example.com/${encodeURIComponent(plat.id)}`,
        isNew: true,
        inCurrentBatch: true,
        aiTags: ['AI 与大模型动态'],
        aiScore: 0.86,
      })
    }
  }

  // Parse frequency_words.txt and synthesize items for custom/unmatched user keyword groups so live edits immediately show up,
  // without flooding the default 33-group stock template with repetitive filler tabs.
  const parsedFreq = parseFrequencyWords(files['frequency_words.txt'])
  const firstPlatId = enabledPlatforms[0]?.id
  if (filterMethod === 'keyword' && firstPlatId && parsedFreq.groups.length > 0) {
    const naturallyMatchedIndices = new Set<number>()
    for (const item of hotPool) {
      const probe = pickTitle(item, options.lang, translateHotlist)
      const m = matchTitleToFrequency(probe, parsedFreq)
      if (m.matched && m.groupIndex !== undefined) {
        naturallyMatchedIndices.add(m.groupIndex)
      }
    }
    const isCompactCustomList = parsedFreq.groups.length <= 8
    let synthesizedCount = 0

    for (let gi = 0; gi < parsedFreq.groups.length; gi++) {
      if (naturallyMatchedIndices.has(gi)) continue
      const group = parsedFreq.groups[gi]
      const normalItems = group.items.filter((i) => i.kind === 'normal' && i.pattern.trim())
      const requiredItems = group.items.filter((i) => i.kind === 'required' && i.pattern.trim())
      if (normalItems.length === 0 && requiredItems.length === 0) continue

      const groupLabel = getGroupDisplayName(group).trim()
      const isCustomUserGroup = !DEFAULT_STOCK_GROUP_NAMES.has(groupLabel)
      const needsFallbackFloor = naturallyMatchedIndices.size + synthesizedCount < 3

      if (!isCompactCustomList && !isCustomUserGroup && !needsFallbackFloor) {
        continue
      }

      const terms = [
        ...requiredItems.map((it) => extractSyntheticTerm(it.pattern)),
        ...(normalItems[0] ? [extractSyntheticTerm(normalItems[0].pattern)] : []),
      ].filter(Boolean)
      const syntheticZh = `${terms.join(' ')} 最新动态与行业深度解读`
      const syntheticEn = `Latest ${terms.join(' ')} developments and industry analysis`
      const syntheticCandidate: SampleHotItem = {
        platformId: enabledPlatforms[gi % enabledPlatforms.length].id,
        titleZh: syntheticZh,
        titleEn: syntheticEn,
        ranks: [Math.min(2 + (gi % 6), 10)],
        rankTimeline: [
          { time: '09:30', rank: Math.min(5 + (gi % 6), 12) },
          { time: '11:00', rank: Math.min(2 + (gi % 6), 10) },
        ],
        timeDisplay: '09:30~11:00',
        count: 3,
        url: `https://example.com/topic/${gi + 1}`,
        isNew: true,
        inCurrentBatch: true,
        aiTags: [groupLabel || terms[0] || '自定义主题'],
        aiScore: 0.9,
      }
      // Only include if it actually passes the user's global filter & exclusions!
      const probeTitle = pickTitle(syntheticCandidate, options.lang, translateHotlist)
      const res = matchTitleToFrequency(probeTitle, parsedFreq)
      if (res.matched && res.groupIndex === gi) {
        hotPool.push(syntheticCandidate)
        synthesizedCount++
      }
    }
  }

  // Filter hotlist by mode (daily / current / incremental)
  const modeHotPool = hotPool.filter((item) => {
    if (mode === 'current') return item.inCurrentBatch
    if (mode === 'incremental') return item.isNew
    return true
  })

  // Group & rank hotlist
  let hotStats: PreviewHotlistGroup[] = []
  if (platformsEnabled && regionHotlist && enabledPlatforms.length > 0) {
    interface InternalGroup {
      word: string
      position: number
      maxCount: number
      totalMatched: number
      titles: PreviewHotlistTitle[]
    }
    const groupMap = new Map<string, InternalGroup>()

    const ensureGroup = (key: string, word: string, position: number, maxCount: number) => {
      let g = groupMap.get(key)
      if (!g) {
        g = { word, position, maxCount, totalMatched: 0, titles: [] }
        groupMap.set(key, g)
      }
      return g
    }

    if (filterMethod === 'ai') {
      const interestLabels = parseInterestLabels(files['ai_interests.txt'])
      for (const item of modeHotPool) {
        if (item.aiScore < aiFilterMinScore) continue
        const title = pickTitle(item, options.lang, translateHotlist)
        const tag =
          interestLabels.find((lbl) =>
            item.aiTags.some((t) => t.toLowerCase().includes(lbl.toLowerCase().slice(0, 2))),
          ) ??
          interestLabels[Math.abs(item.titleZh.length) % interestLabels.length]
        const pos = Math.max(0, interestLabels.indexOf(tag))
        const g = ensureGroup(tag, tag, pos, maxNewsPerKeyword)
        g.totalMatched++
        g.titles.push({
          title,
          sourceName: platformNameById.get(item.platformId) ?? item.platformId,
          matchedKeyword: tag,
          ranks: item.ranks,
          rankThreshold,
          rankTimeline: item.rankTimeline,
          timeDisplay: item.timeDisplay,
          count: item.count,
          url: item.url,
          isNew: item.isNew,
        })
      }
    } else if (parsedFreq.groups.length === 0) {
      // Allow-all mode (mirroring analyzer.py "全部新闻")
      const g = ensureGroup('__all__', '全部新闻', 0, maxNewsPerKeyword)
      for (const item of modeHotPool) {
        const title = pickTitle(item, options.lang, translateHotlist)
        const m = matchTitleToFrequency(title, parsedFreq)
        if (!m.matched) continue
        g.totalMatched++
        g.titles.push({
          title,
          sourceName: platformNameById.get(item.platformId) ?? item.platformId,
          matchedKeyword: '全部新闻',
          ranks: item.ranks,
          rankThreshold,
          rankTimeline: item.rankTimeline,
          timeDisplay: item.timeDisplay,
          count: item.count,
          url: item.url,
          isNew: item.isNew,
        })
      }
    } else {
      for (const item of modeHotPool) {
        const title = pickTitle(item, options.lang, translateHotlist)
        const m = matchTitleToFrequency(title, parsedFreq)
        if (!m.matched || m.groupIndex === undefined) continue
        const grpIdx = m.groupIndex
        const grp = parsedFreq.groups[grpIdx]
        if (!grp) continue
        const label = getGroupDisplayName(grp)
        const grpMax = grp.maxCount ?? 0
        const limit = grpMax > 0 ? grpMax : maxNewsPerKeyword
        const g = ensureGroup(grp.id, label, grpIdx, limit)
        g.totalMatched++
        g.titles.push({
          title,
          sourceName: platformNameById.get(item.platformId) ?? item.platformId,
          matchedKeyword: label,
          ranks: item.ranks,
          rankThreshold,
          rankTimeline: item.rankTimeline,
          timeDisplay: item.timeDisplay,
          count: item.count,
          url: item.url,
          isNew: item.isNew,
        })
      }
    }

    const sortItemTuple = (a: PreviewHotlistTitle, b: PreviewHotlistTitle) => {
      const wa = calculateNewsWeight(a.ranks, a.count, rankThreshold, weights)
      const wb = calculateNewsWeight(b.ranks, b.count, rankThreshold, weights)
      if (wb !== wa) return wb - wa
      const minA = a.ranks.length ? Math.min(...a.ranks) : 999
      const minB = b.ranks.length ? Math.min(...b.ranks) : 999
      if (minA !== minB) return minA - minB
      return b.count - a.count
    }

    const groupsArr = [...groupMap.values()].map((g) => {
      const sorted = [...g.titles].sort(sortItemTuple)
      const limited = g.maxCount > 0 ? sorted.slice(0, g.maxCount) : sorted
      return {
        word: g.word,
        position: g.position,
        count: filterMethod === 'ai' ? limited.length : g.totalMatched,
        titles: limited,
      }
    })

    if (displayMode === 'platform') {
      const byPlat = new Map<string, PreviewHotlistTitle[]>()
      const seen = new Set<string>()
      for (const g of groupsArr) {
        for (const t of g.titles) {
          const dedupKey = `${t.sourceName}::${t.title}`
          if (seen.has(dedupKey)) continue
          seen.add(dedupKey)
          const arr = byPlat.get(t.sourceName) ?? []
          arr.push(t)
          byPlat.set(t.sourceName, arr)
        }
      }
      hotStats = [...byPlat.entries()]
        .map(([platName, titles]) => ({
          word: platName,
          count: titles.length,
          titles: [...titles].sort(sortItemTuple),
        }))
        .sort((a, b) => b.count - a.count)
    } else {
      const posFirst = filterMethod === 'ai' ? prioritySortEnabled : sortByPositionFirst
      hotStats = groupsArr
        .sort((a, b) => {
          if (posFirst) {
            return a.position !== b.position ? a.position - b.position : b.count - a.count
          }
          return b.count !== a.count ? b.count - a.count : a.position - b.position
        })
        .map(({ word, count, titles }) => ({ word, count, titles }))
    }
  }

  // New hotlist items (hidden in incremental mode or when show_new_section is false)
  const newBySource = new Map<string, PreviewNewSourceGroup>()
  let totalNewCount = 0
  if (platformsEnabled && mode !== 'incremental') {
    for (const g of hotStats) {
      for (const item of g.titles) {
        if (!item.isNew) continue
        totalNewCount++
        let bucket = newBySource.get(item.sourceName)
        if (!bucket) {
          bucket = { sourceName: item.sourceName, titles: [] }
          newBySource.set(item.sourceName, bucket)
        }
        if (!bucket.titles.some((x) => x.title === item.title)) {
          bucket.titles.push({
            title: item.title,
            ranks: item.ranks,
            rankThreshold: item.rankThreshold,
            url: item.url,
          })
        }
      }
    }
  }
  const newTitles = [...newBySource.values()]
  const showNewSection = regionNewItems && mode !== 'incremental'

  // RSS
  const rssEnabled = Boolean(getInObject(cfg, ['rss', 'enabled'], false))
  const rawFeeds = getInObject<unknown>(cfg, ['rss', 'feeds'], [])
  const enabledFeeds: Array<{ id: string; name: string; maxAgeDays?: number }> = []
  if (rssEnabled && Array.isArray(rawFeeds)) {
    for (const f of rawFeeds) {
      if (!f || typeof f !== 'object') continue
      const row = f as Record<string, unknown>
      if (row.enabled === false) continue
      const id = String(row.id ?? '').trim()
      if (!id) continue
      enabledFeeds.push({
        id,
        name: String(row.name ?? id).trim() || id,
        maxAgeDays: typeof row.max_age_days === 'number' ? row.max_age_days : undefined,
      })
    }
  }
  const globalFreshnessEnabled = getInObject<boolean>(cfg, ['rss', 'freshness_filter', 'enabled'], true) !== false
  const globalMaxAgeDays = Number(getInObject(cfg, ['rss', 'freshness_filter', 'max_age_days'], 1)) || 0

  const rssPool: Array<SampleRssItem & { feedName: string }> = []
  for (const feed of enabledFeeds) {
    const matchedSamples = SAMPLE_RSS_POOL.filter((item) => item.feedId === feed.id)
    const itemsForFeed: SampleRssItem[] =
      matchedSamples.length > 0
        ? matchedSamples
        : [
            {
              feedId: feed.id,
              titleZh: `${feed.name}：最新深度文章与 AI 工程实践分享`,
              titleEn: `${feed.name}: Latest deep dive and AI engineering notes`,
              ageHours: 4,
              author: feed.name,
              url: `https://example.com/rss/${encodeURIComponent(feed.id)}`,
              isNew: true,
              aiTags: ['开发者工具', 'AI 与大模型动态'],
              aiScore: 0.88,
            },
          ]
    const feedMaxAge = feed.maxAgeDays !== undefined ? feed.maxAgeDays : globalMaxAgeDays
    for (const item of itemsForFeed) {
      if (globalFreshnessEnabled && feedMaxAge > 0 && item.ageHours > feedMaxAge * 24) continue
      if (mode === 'incremental' && !item.isNew) continue
      rssPool.push({ ...item, feedName: feed.name })
    }
  }

  const rssItems: PreviewRssGroup[] = []
  const rssNewItems: PreviewRssGroup[] = []
  if (rssEnabled && regionRss && rssPool.length > 0) {
    const rssGroupMap = new Map<string, PreviewRssGroup>()
    const rssNewMap = new Map<string, PreviewRssGroup>()
    const interestLabels = filterMethod === 'ai' ? parseInterestLabels(files['ai_interests.txt']) : []
    for (const item of rssPool) {
      if (filterMethod === 'ai' && item.aiScore < aiFilterMinScore) continue
      const title = pickTitle(item, options.lang, translateRss)
      let groupName = '全部 RSS'
      if (filterMethod === 'ai') {
        groupName =
          interestLabels.find((lbl) =>
            item.aiTags.some((t) => t.toLowerCase().includes(lbl.toLowerCase().slice(0, 2))),
          ) ??
          interestLabels[0] ??
          'AI 与大模型动态'
      } else if (parsedFreq.groups.length > 0) {
        const m = matchTitleToFrequency(title, parsedFreq)
        if (!m.matched) continue
        const grp = m.groupIndex !== undefined ? parsedFreq.groups[m.groupIndex] : undefined
        groupName = grp ? getGroupDisplayName(grp) : '全部 RSS'
      }
      const entry = {
        title,
        sourceName: item.feedName,
        timeDisplay: formatAgeDisplay(item.ageHours, timezone),
        url: item.url,
        isNew: item.isNew,
      }
      const g = rssGroupMap.get(groupName) ?? { word: groupName, count: 0, titles: [] }
      if (maxNewsPerKeyword === 0 || g.titles.length < maxNewsPerKeyword) {
        g.titles.push(entry)
      }
      g.count = g.titles.length
      rssGroupMap.set(groupName, g)

      if (item.isNew && mode !== 'incremental') {
        const ng = rssNewMap.get(groupName) ?? { word: groupName, count: 0, titles: [] }
        ng.titles.push(entry)
        ng.count = ng.titles.length
        rssNewMap.set(groupName, ng)
      }
    }
    rssItems.push(...rssGroupMap.values())
    rssNewItems.push(...rssNewMap.values())
  }

  // Web Search
  const webSearchEnabled = Boolean(getInObject(cfg, ['web_search', 'enabled'], false))
  const defaultSearchProvider = String(getInObject(cfg, ['web_search', 'provider'], 'deepseek') || 'deepseek')
  const globalSearchMaxItems = Math.max(0, Number(getInObject(cfg, ['web_search', 'max_items_per_topic'], 8)) || 8)
  const minAuthority = Number(getInObject(cfg, ['web_search', 'min_authority'], -1))
  const parsedSearch = parseSearchQueries(files['search_queries.txt'])

  const searchItems: PreviewSearchTopic[] = []
  const searchNewItems: PreviewSearchTopic[] = []
  let searchCandidateCount = 0

  if (webSearchEnabled && regionWebSearch && parsedSearch.topics.length > 0) {
    const sampleSites = [
      { site: 'gov.cn', authority: 4 },
      { site: 'github.com', authority: 3 },
      { site: 'reuters.com', authority: 3 },
      { site: '36kr.com', authority: 2 },
    ]
    for (let ti = 0; ti < parsedSearch.topics.length; ti++) {
      const topic = parsedSearch.topics[ti]
      const topicTitle = topic.name || topic.queries[0] || `搜索主题 ${ti + 1}`
      const topicMax = topic.maxItems ?? 0
      const maxItems = topicMax > 0 ? topicMax : globalSearchMaxItems
      const targetCount = maxItems > 0 ? Math.min(maxItems, 3) : 3
      const provider = topic.provider || defaultSearchProvider
      const excludedSites = new Set(
        [...parsedSearch.globalExcludeSites, ...topic.excludeSites].map((s) => s.toLowerCase()),
      )
      const excludedWords = [...parsedSearch.globalExcludeWords, ...topic.excludeWords].map((w) => w.toLowerCase())

      const items: PreviewSearchTopic['titles'] = []
      const newTopicItems: PreviewSearchTopic['titles'] = []
      for (let k = 0; k < targetCount; k++) {
        searchCandidateCount += 2
        const siteInfo = sampleSites[(ti + k) % sampleSites.length]
        if (excludedSites.has(siteInfo.site)) continue
        if (Number.isFinite(minAuthority) && minAuthority >= 0 && siteInfo.authority < minAuthority) continue
        const qBase = topic.queries[k % Math.max(1, topic.queries.length)] || topicTitle
        const titleZh =
          k === 0
            ? `${topicTitle}：官方最新进展与核心政策要点梳理`
            : k === 1
            ? `${qBase} 深度追踪：行业落地案例与关键数据变化`
            : `${topicTitle} 近期海外动态与权威机构研报汇总`
        const titleEn =
          k === 0
            ? `${topicTitle}: Official updates and key policy highlights`
            : k === 1
            ? `${qBase} deep dive: adoption cases and key metrics`
            : `${topicTitle}: Global updates and analyst research digest`
        const snippetZh = `围绕「${qBase}」检索到的重点摘要：涵盖最新官方发布、技术演进路线及主要市场反馈，点击摘要可展开完整预览内容。`
        const snippetEn = `Curated search summary for "${qBase}": covers official announcements, technical milestones, and market reactions. Click to expand full snippet.`
        const finalTitle = pickTitle({ titleZh, titleEn }, options.lang, translateSearch)
        const finalSnippet =
          translateSearch === 'en'
            ? snippetEn
            : translateSearch === 'zh'
            ? snippetZh
            : options.lang === 'en'
            ? snippetEn
            : snippetZh
        if (excludedWords.some((w) => w && finalTitle.toLowerCase().includes(w))) continue

        const isNew = k === 0
        if (mode === 'incremental' && !isNew) continue
        const entry = {
          title: finalTitle,
          sourceName: siteInfo.site,
          timeDisplay: formatAgeDisplay(1 + k * 4, timezone),
          snippet: finalSnippet,
          authority: siteInfo.authority,
          url: `https://${siteInfo.site}/search-preview/${ti + 1}-${k + 1}`,
          isNew,
        }
        items.push(entry)
        if (isNew && mode !== 'incremental') newTopicItems.push(entry)
      }
      if (items.length > 0) {
        searchItems.push({
          word: topicTitle,
          query: topic.queries.join(' / '),
          provider,
          titles: items,
        })
      }
      if (newTopicItems.length > 0) {
        searchNewItems.push({
          word: topicTitle,
          query: topic.queries.join(' / '),
          provider,
          titles: newTopicItems,
        })
      }
    }
  }

  // Standalone section
  let standaloneData: PreviewStandaloneData | null = null
  if (regionStandalone) {
    const standalonePlatIds = getInObject<unknown>(cfg, ['display', 'standalone', 'platforms'], [])
    const standaloneRssIds = getInObject<unknown>(cfg, ['display', 'standalone', 'rss_feeds'], [])
    const standaloneMax = Math.max(0, Number(getInObject(cfg, ['display', 'standalone', 'max_items'], 20)) || 20)

    const platforms: PreviewStandaloneData['platforms'] = []
    if (Array.isArray(standalonePlatIds)) {
      for (const rawId of standalonePlatIds) {
        const id = String(rawId ?? '').trim()
        if (!id) continue
        const name = platformNameById.get(id) ?? id
        const matched = hotPool
          .filter((item) => item.platformId === id && item.inCurrentBatch)
          .sort((a, b) => (a.ranks[0] ?? 999) - (b.ranks[0] ?? 999))
        const list = (standaloneMax > 0 ? matched.slice(0, standaloneMax) : matched).map((item) => ({
          title: pickTitle(item, options.lang, translateStandalone),
          ranks: item.ranks,
          rankTimeline: item.rankTimeline,
          timeDisplay: item.timeDisplay,
          count: item.count,
          url: item.url,
        }))
        if (list.length > 0) platforms.push({ id, name, items: list })
      }
    }

    const rssFeeds: PreviewStandaloneData['rssFeeds'] = []
    if (Array.isArray(standaloneRssIds)) {
      for (const rawId of standaloneRssIds) {
        const id = String(rawId ?? '').trim()
        if (!id) continue
        const feed = enabledFeeds.find((f) => f.id === id)
        const name = feed?.name ?? id
        const matched = rssPool.filter((item) => item.feedId === id)
        const list = (standaloneMax > 0 ? matched.slice(0, standaloneMax) : matched).map((item) => ({
          title: pickTitle(item, options.lang, translateStandalone),
          timeDisplay: formatAgeDisplay(item.ageHours, timezone),
          author: item.author,
          url: item.url,
        }))
        if (list.length > 0) rssFeeds.push({ id, name, items: list })
      }
    }

    if (platforms.length > 0 || rssFeeds.length > 0) {
      standaloneData = { platforms, rssFeeds }
    }
  }

  // AI Analysis
  const aiAnalysisEnabled = Boolean(getInObject(cfg, ['ai_analysis', 'enabled'], false))
  const aiApiKey = String(getInObject(cfg, ['ai', 'api_key'], '') || '').trim()
  const aiIncludeRss = Boolean(getInObject(cfg, ['ai_analysis', 'include_rss'], false))
  const aiIncludeWebSearch = getInObject<boolean>(cfg, ['ai_analysis', 'include_web_search'], true) !== false
  const aiIncludeStandalone = getInObject<boolean>(cfg, ['ai_analysis', 'include_standalone'], true) !== false
  const aiLanguage = String(getInObject(cfg, ['ai_analysis', 'language'], 'Chinese') || 'Chinese')
  const isAiEn = aiLanguage.toLowerCase().includes('en')

  const hotlistCount = hotStats.reduce((s, g) => s + g.titles.length, 0)
  const rssCount = rssItems.reduce((s, g) => s + g.titles.length, 0)
  const searchCount = searchItems.reduce((s, g) => s + g.titles.length, 0)
  const standaloneCount = standaloneData
    ? standaloneData.platforms.reduce((s, p) => s + p.items.length, 0) +
      standaloneData.rssFeeds.reduce((s, r) => s + r.items.length, 0)
    : 0

  let aiAnalysis: PreviewAiAnalysis | null = null
  if (aiAnalysisEnabled && regionAiAnalysis) {
    const topGroupNames = hotStats.slice(0, 3).map((g) => g.word).join('、') || '综合热点'
    const standaloneSummaries: Record<string, string> = {}
    if (standaloneData) {
      for (const p of standaloneData.platforms.slice(0, 2)) {
        standaloneSummaries[p.name] = isAiEn
          ? `Top discussions focus on ${p.items[0]?.title ?? 'key developments'} (${p.items.length} tracked items).`
          : `核心议题聚焦「${p.items[0]?.title ?? '当日热议'}」等 ${p.items.length} 条在榜热点。`
      }
    }
    aiAnalysis = {
      status: 'success',
      hotlistAnalyzed: hotlistCount,
      rssAnalyzed: aiIncludeRss ? rssCount : 0,
      searchAnalyzed: aiIncludeWebSearch ? searchCount : 0,
      standaloneAnalyzed: aiIncludeStandalone ? standaloneCount : 0,
      includeRss: aiIncludeRss,
      includeWebSearch: aiIncludeWebSearch && webSearchEnabled,
      includeStandalone: aiIncludeStandalone && standaloneCount > 0,
      coreTrends: isAiEn
        ? `1. Primary momentum concentrates around ${topGroupNames} across ${enabledPlatforms.length} active platforms.\n2. Multiple top-3 entries show sustained upward rank trajectories during the latest crawl window.`
        : `1. 本轮核心关注度集中在「${topGroupNames}」，覆盖 ${enabledPlatforms.length} 个已启用热榜平台。\n2. 多条头部条目在最新时间窗口内维持高位或连续上升，跨平台共振明显。`,
      sentimentControversy: isAiEn
        ? '1. Developer communities emphasize cost efficiency and local deployment ergonomics.\n2. Market commentary balances short-term CapEx optimism against monetization pacing.'
        : '1. 技术社区围绕推理降本与本地部署体验反馈积极，关注开源生态适配速度。\n2. 财经讨论对算力投入与商业化兑现节奏存在观点分化，理性评估为主。',
      signals: isAiEn
        ? '1. Local-first MCP tooling and small-model quantization workflows are emerging as fast-rising weak signals.'
        : '1. 本地化 MCP 工作流与端侧量化部署讨论度快速攀升，值得持续追踪。',
      rssInsights:
        aiIncludeRss && rssCount > 0
          ? isAiEn
            ? `Synthesized ${rssCount} curated RSS entries highlighting practical engineering benchmarks and architecture retrospectives.`
            : `结合 ${rssCount} 条精选 RSS 更新，技术博客与海外社区持续深化对 AI 工程化与轻量化存储架构的讨论。`
          : undefined,
      searchInsights:
        aiIncludeWebSearch && searchCount > 0
          ? isAiEn
            ? `Cross-checked ${searchCount} web search findings across ${searchItems.length} scheduled topic(s), anchored by authoritative primary sources.`
            : `围绕 ${searchItems.length} 个定时联网搜索主题汇总 ${searchCount} 条高权重信源，与热榜舆情形成交叉印证。`
          : undefined,
      outlookStrategy: isAiEn
        ? '1. Continue monitoring top keyword groups in current/incremental mode to catch sudden rank jumps.\n2. Pair high-authority web search topics with timeline quiet windows to reduce alert fatigue.'
        : '1. 建议结合当前榜单或增量模式持续跟踪核心词组，重点留意排名跃升条目。\n2. 可将高权威度联网搜索主题与时间线分时段推送联动，减少高频打扰。',
      standaloneSummaries: aiIncludeStandalone ? standaloneSummaries : undefined,
    }
  }

  const nowFormatted = formatNowInTimezone(timezone)
  const html = renderTrendRadarPreviewHtml({
    mode,
    displayMode,
    regionOrder,
    generatedTimeShort: nowFormatted.short,
    generatedTimeFull: nowFormatted.full,
    timezoneLabel: timezone,
    stats: hotStats,
    hotlistTotal: Math.max(modeHotPool.length, hotlistCount),
    platformTotal: enabledPlatforms.length,
    failedIds: [],
    newTitles,
    totalNewCount,
    showNewSection,
    rssEnabled,
    rssItems,
    rssNewItems: showNewSection ? rssNewItems : [],
    rssTotalCount: rssPool.length,
    rssSourceTotal: enabledFeeds.length,
    webSearchEnabled,
    searchItems,
    searchNewItems: showNewSection ? searchNewItems : [],
    searchCandidateCount,
    searchTopicTotal: parsedSearch.topics.length,
    standaloneData,
    aiAnalysis,
    initialWideMode: options.wideMode,
    initialDarkMode: options.darkMode,
  })

  const activeRegions = regionOrder.filter((id) => {
    if (id === 'hotlist') return hotlistCount > 0
    if (id === 'rss') return rssCount > 0
    if (id === 'web_search') return searchCount > 0
    if (id === 'new_items') return showNewSection && (totalNewCount > 0 || rssNewItems.length > 0 || searchNewItems.length > 0)
    if (id === 'standalone') return standaloneCount > 0
    if (id === 'ai_analysis') return Boolean(aiAnalysis && aiAnalysis.status !== 'disabled')
    return false
  })

  return {
    html,
    summary: {
      mode,
      displayMode,
      filterMethod,
      timezone,
      htmlFormatEnabled,
      activeRegions,
      hotlistCount,
      rssCount,
      searchCount,
      newCount: totalNewCount,
      standaloneCount,
      aiEnabled: aiAnalysisEnabled && regionAiAnalysis,
      aiHasKey: aiApiKey.length > 0,
      translationEnabled,
      scheduleEnabled,
      schedulePreset,
      configErrorMessage: parsed.error ? parsed.error.message : null,
    },
  }
}

export const buildTrendRadarPreview = buildLivePreviewReport
