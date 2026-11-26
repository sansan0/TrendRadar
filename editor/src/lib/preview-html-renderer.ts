import { TRENDRADAR_REPORT_CSS, TRENDRADAR_REPORT_JS } from './preview-report-assets.ts'

export type PreviewRegionId =
  | 'hotlist'
  | 'rss'
  | 'web_search'
  | 'new_items'
  | 'standalone'
  | 'ai_analysis'

export interface RankTimelinePoint {
  time: string
  rank: number | null
}

export interface PreviewHotlistTitle {
  title: string
  sourceName: string
  matchedKeyword?: string
  ranks: number[]
  rankThreshold: number
  rankTimeline?: RankTimelinePoint[]
  timeDisplay?: string
  count: number
  url?: string
  isNew?: boolean
}

export interface PreviewHotlistGroup {
  word: string
  count: number
  titles: PreviewHotlistTitle[]
}

export interface PreviewNewSourceGroup {
  sourceName: string
  titles: Array<{
    title: string
    ranks: number[]
    rankThreshold: number
    url?: string
  }>
}

export interface PreviewRssGroup {
  word: string
  count: number
  titles: Array<{
    title: string
    sourceName?: string
    timeDisplay?: string
    url?: string
    isNew?: boolean
  }>
}

export interface PreviewSearchTopic {
  word: string
  query?: string
  provider?: string
  titles: Array<{
    title: string
    sourceName?: string
    timeDisplay?: string
    snippet?: string
    authority?: number
    url?: string
    isNew?: boolean
  }>
}

export interface PreviewStandaloneData {
  platforms: Array<{
    id: string
    name: string
    items: Array<{
      title: string
      ranks: number[]
      rankTimeline?: RankTimelinePoint[]
      timeDisplay?: string
      count?: number
      url?: string
    }>
  }>
  rssFeeds: Array<{
    id: string
    name: string
    items: Array<{
      title: string
      timeDisplay?: string
      author?: string
      url?: string
    }>
  }>
}

export interface PreviewAiAnalysis {
  status: 'success' | 'disabled' | 'unconfigured' | 'skipped'
  error?: string
  skipReason?: string
  hotlistAnalyzed: number
  rssAnalyzed: number
  searchAnalyzed: number
  standaloneAnalyzed: number
  includeRss: boolean
  includeWebSearch: boolean
  includeStandalone: boolean
  coreTrends?: string
  sentimentControversy?: string
  signals?: string
  rssInsights?: string
  searchInsights?: string
  outlookStrategy?: string
  standaloneSummaries?: Record<string, string>
}

export interface PreviewReportRenderInput {
  mode: 'daily' | 'current' | 'incremental'
  displayMode: 'keyword' | 'platform'
  regionOrder: PreviewRegionId[]
  generatedTimeShort: string
  generatedTimeFull: string
  timezoneLabel: string
  stats: PreviewHotlistGroup[]
  hotlistTotal: number
  platformTotal: number
  failedIds: string[]
  newTitles: PreviewNewSourceGroup[]
  totalNewCount: number
  showNewSection: boolean
  rssEnabled: boolean
  rssItems: PreviewRssGroup[]
  rssNewItems: PreviewRssGroup[]
  rssTotalCount: number
  rssSourceTotal: number
  webSearchEnabled: boolean
  searchItems: PreviewSearchTopic[]
  searchNewItems: PreviewSearchTopic[]
  searchCandidateCount: number
  searchTopicTotal: number
  standaloneData: PreviewStandaloneData | null
  aiAnalysis: PreviewAiAnalysis | null
  initialWideMode: boolean
  initialDarkMode: boolean
}

// Exact 14px crisp linear SVG icons matching trendradar/report/html.py (_UI_ICONS)
const UI_ICONS = {
  all: '<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>',
  hotlist: '<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 12 6 7.5 9.5 10 14 4"/><polyline points="10.5 4 14 4 14 7.5"/></svg>',
  rss: '<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13h.01"/><path d="M3 8.5a4.5 4.5 0 0 1 4.5 4.5"/><path d="M3 4a9 9 0 0 1 9 9"/></svg>',
  web_search: '<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>',
  new_items: '<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.5"/><path d="M8 5.2v5.6M5.2 8h5.6"/></svg>',
  standalone: '<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M5 6h6M5 9h6"/></svg>',
  ai_analysis: '<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5l1.45 4.55L14 7.5l-4.55 1.45L8 13.5l-1.45-4.55L2 7.5l4.55-1.45z"/></svg>',
  trend_up: '<svg class="trend-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="2.5 11.5 6.5 7.5 9.5 10 13.5 4.5"/><polyline points="10 4.5 13.5 4.5 13.5 8"/></svg>',
  trend_down: '<svg class="trend-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="2.5 4.5 6.5 8.5 9.5 6 13.5 11.5"/><polyline points="10 11.5 13.5 11.5 13.5 8"/></svg>',
  sparkline: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5 11 5.5 6.5 9 9.5 14.5 4"/></svg>',
  warning: '<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M7.13 2.5a1 1 0 0 1 1.74 0l5.3 9.2A1 1 0 0 1 13.3 13.2H2.7a1 1 0 0 1-.87-1.5z"/><path d="M8 6.2v3M8 11.2h.01"/></svg>',
  chevron: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 6 8 10 12 6"/></svg>',
  copy: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 0 1 2 9.5v-7A1.5 1.5 0 0 1 3.5 1h7A1.5 1.5 0 0 1 12 2.5V5"/></svg>',
  ext_link: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5h6v6M12.5 3.5L6 10"/></svg>',
  shield: '<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.8l5 2v4.3c0 3.2-2.1 5.3-5 6.1-2.9-.8-5-2.9-5-6.1V3.8z"/><path d="M5.8 8.2L7.3 9.7 10.4 6.5"/></svg>',
  query_mini: '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>',
  info: '<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><circle cx="8" cy="8" r="6"/><path d="M8 7.2v3.6M8 5.2h.01"/></svg>',
  expand: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6V3.5a1 1 0 0 1 1-1H6M10 2.5h2.5a1 1 0 0 1 1 1V6M13.5 10v2.5a1 1 0 0 1-1 1H10M6 13.5H3.5a1 1 0 0 1-1-1V10"/></svg>',
  compress: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5V5a1 1 0 0 1-1 1H2.5M13.5 6H11a1 1 0 0 1-1-1V2.5M10 13.5V11a1 1 0 0 1 1-1h2.5M2.5 10H5a1 1 0 0 1 1 1v2.5"/></svg>',
  moon: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13.2 10.1A5.6 5.6 0 0 1 5.9 2.8a5.6 5.6 0 1 0 7.3 7.3z"/></svg>',
  sun: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1"/></svg>',
} as const

// Exact AI block icons matching trendradar/ai/formatter.py (_AI_BLOCK_ICONS)
const AI_BLOCK_ICONS: Record<string, string> = {
  core: '<svg class="ai-block-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 11.5 6 7.5 9 10 14 4.5"/><polyline points="10.5 4.5 14 4.5 14 8"/></svg>',
  sentiment: '<svg class="ai-block-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4A1.5 1.5 0 0 1 4 2.5h8A1.5 1.5 0 0 1 13.5 4v5.5A1.5 1.5 0 0 1 12 11H6.5L3.5 13.5V11H4A1.5 1.5 0 0 1 2.5 9.5z"/></svg>',
  signals: '<svg class="ai-block-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1.8L3.5 9h4.3L7 14.2 12.5 7H8.2z"/></svg>',
  rss: '<svg class="ai-block-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13h.01"/><path d="M3 8.5a4.5 4.5 0 0 1 4.5 4.5"/><path d="M3 4a9 9 0 0 1 9 9"/></svg>',
  search: '<svg class="ai-block-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>',
  strategy: '<svg class="ai-block-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.5"/><polygon points="10.2 5.8 8.9 8.9 5.8 10.2 7.1 7.1"/></svg>',
  standalone: '<svg class="ai-block-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M5 6h6M5 9h6"/></svg>',
}

const PROVIDER_DISPLAY: Record<string, string> = {
  deepseek: 'DeepSeek',
  tavily: 'Tavily',
  bocha: '博查',
  serper: 'Serper',
  exa: 'Exa',
  perplexity: 'Perplexity',
  brave: 'Brave',
  bing: 'Bing',
  google: 'Google',
  baidu: '百度',
  duckduckgo: 'DuckDuckGo',
  zhipu: '智谱',
  metaso: '秘塔',
  aliyun: '阿里云',
  searxng: 'SearXNG',
  jina: 'Jina',
}

function escapeHtml(raw: string): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatProviderLabel(provider?: string): string {
  if (!provider) return ''
  const cleaned = provider.trim()
  return PROVIDER_DISPLAY[cleaned.toLowerCase()] ?? cleaned
}

function calculateRankTrend(
  rankTimeline?: RankTimelinePoint[],
  ranks?: number[],
): 'up' | 'down' | '' {
  const valid: number[] = []
  if (rankTimeline && rankTimeline.length > 0) {
    for (const pt of rankTimeline) {
      if (typeof pt.rank === 'number' && pt.rank > 0) valid.push(pt.rank)
    }
  } else if (ranks && ranks.length > 0) {
    for (const r of ranks) {
      if (typeof r === 'number' && r > 0) valid.push(r)
    }
  }
  if (valid.length < 2) return ''
  const first = valid[0]
  const last = valid[valid.length - 1]
  if (last < first) return 'up'
  if (last > first) return 'down'
  return ''
}

function normalizeTimelinePoints(
  rankTimeline?: RankTimelinePoint[],
  ranks?: number[],
  fallbackTime = '',
): Array<[string, number | null]> {
  const points: Array<[string, number | null]> = []
  if (rankTimeline && rankTimeline.length > 0) {
    for (const pt of rankTimeline) {
      let t = String(pt.time || '').trim()
      if (t.length === 5 && t[2] === '-') t = t.replace('-', ':')
      const r = typeof pt.rank === 'number' && pt.rank > 0 ? Math.round(pt.rank) : null
      points.push([t || '--:--', r])
    }
  } else if (ranks && ranks.length > 0) {
    const cleanTime = fallbackTime.replace(/\[|\]/g, '').replace(' ~ ', '~').trim()
    if (cleanTime.includes('~') && ranks.length >= 2) {
      const [t0, t1] = cleanTime.split('~', 2).map((s) => s.trim())
      points.push([t0 || '--:--', ranks[0]])
      for (const mid of ranks.slice(1, -1)) points.push(['·', mid])
      points.push([t1 || '--:--', ranks[ranks.length - 1]])
    } else {
      points.push([cleanTime || '--:--', ranks[ranks.length - 1]])
    }
  }
  return points
}

function buildRankTriggerHtml(
  ranks: number[],
  rankThreshold: number,
  rankTimeline?: RankTimelinePoint[],
  sourceName = '',
  fallbackTime = '',
): string {
  const effRanks = ranks.filter((r) => Number.isFinite(r) && r > 0).map((r) => Math.round(r))
  if (effRanks.length === 0) return ''

  const minRank = Math.min(...effRanks)
  const maxRank = Math.max(...effRanks)
  const rankClass = minRank <= 3 ? 'top' : minRank <= rankThreshold ? 'high' : ''
  const rankText = minRank === maxRank ? String(minRank) : `${minRank}-${maxRank}`

  const trend = calculateRankTrend(rankTimeline, effRanks)
  let trendHtml = ''
  if (trend === 'up') {
    trendHtml = `<span class="trend-badge trend-up" title="排名上升">${UI_ICONS.trend_up}<span class="trend-email-glyph">↑</span></span>`
  } else if (trend === 'down') {
    trendHtml = `<span class="trend-badge trend-down" title="排名下降">${UI_ICONS.trend_down}<span class="trend-email-glyph">↓</span></span>`
  }

  const points = normalizeTimelinePoints(rankTimeline, effRanks, fallbackTime)
  if (points.length === 0) {
    return `<span class="rank-num ${rankClass}">${rankText}</span>${trendHtml}`
  }

  const payload = escapeHtml(JSON.stringify(points))
  const srcAttr = sourceName ? ` data-rank-source="${escapeHtml(sourceName)}"` : ''
  const sparkHint =
    points.length >= 2 && !trendHtml
      ? `<span class="rank-spark-hint" aria-hidden="true">${UI_ICONS.sparkline}</span>`
      : ''

  return (
    `<span class="rank-trigger" tabindex="0" role="button" aria-label="查看排名变化轨迹" ` +
    `data-rank-timeline="${payload}"${srcAttr}>` +
    `<span class="rank-num ${rankClass}">${rankText}</span>` +
    `${trendHtml}${sparkHint}` +
    `</span>`
  )
}

function buildMetricTooltip(
  title: string,
  rows: Array<{ label: string; value: string; dotColor?: string }>,
  opts: { badge?: string; foot?: string; actionHint?: string; align?: 'left' | 'center' | 'right' } = {},
): string {
  const alignCls =
    opts.align === 'left'
      ? ' tip-align-left'
      : opts.align === 'right'
        ? ' tip-align-right'
        : ''
  const badgeHtml = opts.badge ? `<span class="tip-badge">${escapeHtml(opts.badge)}</span>` : ''
  const linesHtml = rows
    .map((r) => {
      const dot = r.dotColor ? `<span class="tip-dot" style="background:${r.dotColor};"></span>` : ''
      return `<div class="tip-line"><span class="tip-line-label">${dot}${escapeHtml(r.label)}</span><span class="tip-line-val">${escapeHtml(r.value)}</span></div>`
    })
    .join('')

  let footHtml = ''
  if (opts.foot || opts.actionHint) {
    const parts: string[] = []
    if (opts.foot) parts.push(escapeHtml(opts.foot))
    if (opts.actionHint) parts.push(`<span class="tip-foot-action">${escapeHtml(opts.actionHint)}</span>`)
    footHtml = `<div class="tip-foot">${parts.join(' · ')}</div>`
  }

  return (
    `<div class="metric-tooltip${alignCls}" role="tooltip">` +
    `<div class="tip-header"><span>${escapeHtml(title)}</span>${badgeHtml}</div>` +
    `<div class="tip-list">${linesHtml}</div>` +
    `${footHtml}</div>`
  )
}

function renderHotlistHtml(stats: PreviewHotlistGroup[], displayMode: 'keyword' | 'platform'): string {
  if (stats.length === 0) return ''
  const totalGroups = stats.length
  const totalNewsCount = stats.reduce((sum, s) => sum + s.count, 0)

  let tabBarHtml = '<div class="tab-bar-wrapper"><div class="tab-bar">'
  tabBarHtml += `<button class="tab-btn" data-tab-index="all">全部<span class="tab-count">${totalNewsCount}</span></button>`
  stats.forEach((stat, idx) => {
    tabBarHtml += `<button class="tab-btn" data-tab-index="${idx}">${escapeHtml(stat.word)}<span class="tab-count">${stat.count}</span></button>`
  })
  tabBarHtml += '</div></div>'

  let groupsHtml = ''
  stats.forEach((stat, idx) => {
    const countClass = stat.count >= 10 ? 'hot' : stat.count >= 5 ? 'warm' : ''
    groupsHtml += `
                <div class="word-group" data-tab-index="${idx}">
                    <div class="word-header">
                        <div class="word-info">
                            <div class="word-name">${escapeHtml(stat.word)}</div>
                            <div class="word-count ${countClass}">${stat.count} 条</div>
                        </div>
                        <div class="word-index"><span class="collapse-icon">${UI_ICONS.chevron}</span>${idx + 1}/${totalGroups}</div>
                    </div>`

    stat.titles.forEach((item, j) => {
      const newClass = item.isNew ? 'new' : ''
      groupsHtml += `
                    <div class="news-item ${newClass}">
                        <div class="news-number">${j + 1}</div>
                        <div class="news-content">
                            <div class="news-header">`

      if (displayMode === 'keyword') {
        groupsHtml += `<span class="source-name">${escapeHtml(item.sourceName)}</span>`
      } else if (item.matchedKeyword) {
        groupsHtml += `<span class="keyword-tag">[${escapeHtml(item.matchedKeyword)}]</span>`
      }

      if (item.ranks.length > 0) {
        groupsHtml += buildRankTriggerHtml(
          item.ranks,
          item.rankThreshold,
          item.rankTimeline,
          item.sourceName,
          item.timeDisplay ?? '',
        )
      }

      if (item.timeDisplay) {
        const simplified = item.timeDisplay.replace(' ~ ', '~').replace(/\[|\]/g, '')
        groupsHtml += `<span class="time-info">${escapeHtml(simplified)}</span>`
      }

      if (item.count > 1) {
        groupsHtml += `<span class="count-info">${item.count}次</span>`
      }

      groupsHtml += `
                            </div>
                            <div class="news-title">`
      const escapedTitle = escapeHtml(item.title)
      if (item.url) {
        groupsHtml += `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="news-link">${escapedTitle}</a>`
      } else {
        groupsHtml += escapedTitle
      }
      groupsHtml += `
                            </div>
                        </div>
                    </div>`
    })

    groupsHtml += `
                </div>`
  })

  return `
                <div class="hotlist-section">${tabBarHtml}${groupsHtml}
                </div>`
}

function renderNewTitlesHtml(
  newTitles: PreviewNewSourceGroup[],
  totalNewCount: number,
  showNewSection: boolean,
): string {
  if (!showNewSection || newTitles.length === 0) return ''

  let out = `
                <div class="new-section">
                    <div class="new-section-header">
                        <div class="section-heading-left">
                            <span class="section-icon-badge badge-new-sec">${UI_ICONS.new_items}</span>
                            <div class="new-section-title">本次新增热点</div>
                        </div>
                        <div class="section-count-pill">共 ${totalNewCount} 条</div>
                    </div>
                    <div class="new-sources-grid">`

  for (const source of newTitles) {
    out += `
                    <div class="new-source-group">
                        <div class="new-source-title"><span class="new-source-title-left"><span class="group-dot dot-new"></span><span>${escapeHtml(source.sourceName)}</span></span><span class="new-source-count">${source.titles.length} 条</span></div>`

    source.titles.forEach((item, idx) => {
      let rankClass = ''
      let rankText = '?'
      if (item.ranks.length > 0) {
        const minR = Math.min(...item.ranks)
        const maxR = Math.max(...item.ranks)
        rankClass = minR <= 3 ? 'top' : minR <= item.rankThreshold ? 'high' : ''
        rankText = minR === maxR ? String(minR) : `${minR}-${maxR}`
      }
      const escapedTitle = escapeHtml(item.title)
      const titleHtml = item.url
        ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="news-link">${escapedTitle}</a>`
        : escapedTitle

      out += `
                        <div class="new-item">
                            <div class="new-item-number">${idx + 1}</div>
                            <div class="new-item-rank ${rankClass}">${rankText}</div>
                            <div class="new-item-content">
                                <div class="new-item-title">${titleHtml}</div>
                            </div>
                        </div>`
    })

    out += `
                    </div>`
  }

  out += `
                    </div>
                </div>`
  return out
}

function renderRssStatsHtml(stats: PreviewRssGroup[], title: string): string {
  const validGroups = stats.filter((g) => g.titles.length > 0)
  const totalCount = validGroups.reduce((sum, g) => sum + g.titles.length, 0)
  if (totalCount === 0) return ''

  let out = `
                <div class="rss-section">
                    <div class="rss-section-header">
                        <div class="section-heading-left">
                            <span class="section-icon-badge badge-rss">${UI_ICONS.rss}</span>
                            <div class="rss-section-title">${escapeHtml(title)}</div>
                        </div>
                        <div class="rss-section-count">${totalCount} 条</div>
                    </div>
                    <div class="rss-feeds-grid">`

  for (const group of validGroups) {
    out += `
                    <div class="feed-group">
                        <div class="feed-header">
                            <div class="feed-name-wrap"><span class="group-dot dot-rss"></span><div class="feed-name">${escapeHtml(group.word)}</div></div>
                            <div class="feed-count">${group.titles.length} 条</div>
                        </div>`

    for (const item of group.titles) {
      out += `
                        <div class="rss-item">
                            <div class="rss-meta">
                                <div class="rss-meta-left">`
      if (item.sourceName) out += `<span class="rss-author">${escapeHtml(item.sourceName)}</span>`
      if (item.timeDisplay) out += `<span class="rss-time">${escapeHtml(item.timeDisplay)}</span>`
      if (item.isNew) out += '<span class="badge-new">NEW</span>'
      out += '</div>'

      if (item.url) {
        out += `<div class="card-meta-actions"><button type="button" class="card-copy-btn" title="复制标题和链接" aria-label="复制标题和链接">${UI_ICONS.copy}</button><span class="card-ext-icon" aria-hidden="true">${UI_ICONS.ext_link}</span></div>`
      }

      const escapedTitle = escapeHtml(item.title)
      const titleHtml = item.url
        ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="rss-link">${escapedTitle}</a>`
        : escapedTitle

      out += `
                            </div>
                            <div class="rss-title">${titleHtml}</div>
                        </div>`
    }

    out += `
                    </div>`
  }

  out += `
                    </div>
                </div>`
  return out
}

function renderSearchStatsHtml(stats: PreviewSearchTopic[], title: string, enableTabs: boolean): string {
  const validTopics = stats.filter((t) => t.titles.length > 0)
  const totalCount = validTopics.reduce((sum, t) => sum + t.titles.length, 0)
  if (totalCount === 0) return ''

  let out = `
                <div class="search-section">
                    <div class="search-section-header">
                        <div class="section-heading-left">
                            <span class="section-icon-badge badge-search">${UI_ICONS.web_search}</span>
                            <div class="search-section-title">${escapeHtml(title)}</div>
                        </div>
                        <div class="search-section-count">${totalCount} 条</div>
                    </div>`

  if (enableTabs && validTopics.length >= 2) {
    out += `
                    <div class="search-tab-bar-wrapper">
                        <div class="tab-bar search-tab-bar">
                            <button class="tab-btn active" data-search-tab="all">全部<span class="tab-count">${totalCount}</span></button>`
    validTopics.forEach((topic, tIdx) => {
      const tName = topic.word || topic.query || `主题 ${tIdx + 1}`
      out += `
                            <button class="tab-btn" data-search-tab="${tIdx}">${escapeHtml(tName)}<span class="tab-count">${topic.titles.length}</span></button>`
    })
    out += `
                        </div>
                    </div>`
  }

  const gridClass = validTopics.length === 1 ? 'search-topics-grid single-topic' : 'search-topics-grid'
  out += `
                    <div class="${gridClass}">`

  validTopics.forEach((topic, tIdx) => {
    const topicName = topic.word || topic.query || `主题 ${tIdx + 1}`
    const queryText = (topic.query ?? '').trim()
    const providerLabel = formatProviderLabel(topic.provider)
    const tabAttr = enableTabs ? ` data-search-tab="${tIdx}"` : ''

    out += `
                    <div class="search-topic-group"${tabAttr}>
                        <div class="search-topic-header">
                            <div class="search-topic-header-top">
                                <div class="search-topic-info">
                                    <span class="group-dot dot-search"></span>
                                    <div class="search-topic-name">${escapeHtml(topicName)}</div>`
    if (providerLabel) {
      out += `<span class="search-provider-badge">${escapeHtml(providerLabel)}</span>`
    }
    out += `
                                </div>
                                <div class="search-topic-count"><span class="collapse-icon">${UI_ICONS.chevron}</span>${topic.titles.length} 条</div>
                            </div>`

    if (queryText) {
      const escapedQ = escapeHtml(queryText)
      out += `
                            <div class="search-query-hint" data-copy-query="${escapedQ}" title="点击复制搜索词">${UI_ICONS.query_mini}<span>搜索词：${escapedQ}</span></div>`
    }
    out += `
                        </div>`

    topic.titles.forEach((item, j) => {
      const authority = item.authority ?? 0
      out += `
                        <div class="search-item">
                            <div class="news-number">${j + 1}</div>
                            <div class="search-item-body">`
      if (item.sourceName || authority >= 3 || item.timeDisplay || item.isNew || item.url) {
        out += `
                                <div class="search-meta">
                                    <div class="search-meta-left">`
        if (item.sourceName) out += `<span class="search-site">${escapeHtml(item.sourceName)}</span>`
        if (authority >= 3) out += `<span class="badge-authority">${UI_ICONS.shield}权威</span>`
        if (item.timeDisplay) out += `<span class="search-time">${escapeHtml(item.timeDisplay)}</span>`
        if (item.isNew) out += '<span class="badge-new">NEW</span>'
        out += '</div>'
        if (item.url) {
          out += `<span class="card-ext-icon" aria-hidden="true">${UI_ICONS.ext_link}</span>`
        }
        out += `
                                </div>`
      }
      const escapedTitle = escapeHtml(item.title)
      const titleHtml = item.url
        ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="search-link">${escapedTitle}</a>`
        : escapedTitle
      out += `
                                <div class="search-title">${titleHtml}</div>`
      if (item.snippet?.trim()) {
        out += `
                                <div class="search-snippet">${escapeHtml(item.snippet.trim())}</div>`
      }
      out += `
                            </div>
                        </div>`
    })

    out += `
                    </div>`
  })

  out += `
                    </div>
                </div>`
  return out
}

function renderStandaloneHtml(data: PreviewStandaloneData | null): string {
  if (!data) return ''
  const platforms = data.platforms.filter((p) => p.items.length > 0)
  const rssFeeds = data.rssFeeds.filter((f) => f.items.length > 0)
  const totalCount =
    platforms.reduce((s, p) => s + p.items.length, 0) +
    rssFeeds.reduce((s, f) => s + f.items.length, 0)
  if (totalCount === 0) return ''

  const allGroups = [
    ...platforms.map((p) => ({ name: p.name, count: p.items.length })),
    ...rssFeeds.map((f) => ({ name: f.name, count: f.items.length })),
  ]

  let out = `
                <div class="standalone-section">
                    <div class="standalone-section-header">
                        <div class="section-heading-left">
                            <span class="section-icon-badge badge-standalone">${UI_ICONS.standalone}</span>
                            <div class="standalone-section-title">独立展示区</div>
                        </div>
                        <div class="standalone-section-count">${totalCount} 条</div>
                    </div>`

  if (allGroups.length >= 2) {
    out += `
                    <div class="tab-bar standalone-tab-bar">`
    allGroups.forEach((g, idx) => {
      out += `
                        <button class="tab-btn${idx === 0 ? ' active' : ''}" data-standalone-tab="${idx}">${escapeHtml(g.name)}<span class="tab-count">${g.count}</span></button>`
    })
    out += `
                        <button class="tab-btn" data-standalone-tab="all">全部<span class="tab-count">${totalCount}</span></button>
                    </div>`
  }

  out += `
                    <div class="standalone-groups-grid">`

  let groupIdx = 0
  for (const platform of platforms) {
    out += `
                    <div class="standalone-group" data-standalone-tab="${groupIdx}">
                        <div class="standalone-header">
                            <div class="standalone-name-wrap"><span class="group-dot dot-standalone"></span><div class="standalone-name">${escapeHtml(platform.name)}</div><span class="standalone-type-pill">热榜</span></div>
                            <div class="standalone-count">${platform.items.length} 条</div>
                        </div>`

    platform.items.forEach((item, j) => {
      const escapedTitle = escapeHtml(item.title)
      const titleHtml = item.url
        ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="news-link">${escapedTitle}</a>`
        : escapedTitle
      out += `
                        <div class="news-item">
                            <div class="news-number">${j + 1}</div>
                            <div class="news-content">
                                <div class="news-header">${buildRankTriggerHtml(item.ranks, 10, item.rankTimeline, platform.name, item.timeDisplay ?? '')}${item.timeDisplay ? `<span class="time-info">${escapeHtml(item.timeDisplay)}</span>` : ''}${(item.count ?? 1) > 1 ? `<span class="count-info">${item.count}次</span>` : ''}</div>
                                <div class="news-title">${titleHtml}</div>
                            </div>
                        </div>`
    })

    out += `
                    </div>`
    groupIdx += 1
  }

  for (const feed of rssFeeds) {
    out += `
                    <div class="standalone-group" data-standalone-tab="${groupIdx}">
                        <div class="standalone-header">
                            <div class="standalone-name-wrap"><span class="group-dot dot-rss"></span><div class="standalone-name">${escapeHtml(feed.name)}</div><span class="standalone-type-pill">RSS</span></div>
                            <div class="standalone-count">${feed.items.length} 条</div>
                        </div>`

    feed.items.forEach((item, j) => {
      const escapedTitle = escapeHtml(item.title)
      const titleHtml = item.url
        ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="news-link">${escapedTitle}</a>`
        : escapedTitle
      out += `
                        <div class="news-item">
                            <div class="news-number">${j + 1}</div>
                            <div class="news-content">
                                <div class="news-header">${item.timeDisplay ? `<span class="time-info">${escapeHtml(item.timeDisplay)}</span>` : ''}${item.author ? `<span class="source-name">${escapeHtml(item.author)}</span>` : ''}</div>
                                <div class="news-title">${titleHtml}</div>
                            </div>
                        </div>`
    })

    out += `
                    </div>`
    groupIdx += 1
  }

  out += `
                    </div>
                </div>`
  return out
}

function renderAiAnalysisHtml(ai: PreviewAiAnalysis | null): string {
  if (!ai || ai.status === 'disabled') return ''

  if (ai.status === 'skipped') {
    return `
                <div class="ai-section">
                    <div class="ai-info">${UI_ICONS.info}${escapeHtml(ai.skipReason || '当前调度时段已跳过 AI 分析')}</div>
                </div>`
  }

  if (ai.status === 'unconfigured') {
    return `
                <div class="ai-section">
                    <div class="ai-warning">AI 分析失败: ${escapeHtml(ai.error || '尚未配置 AI API Key')}</div>
                </div>`
  }

  const standaloneText =
    ai.standaloneSummaries && Object.keys(ai.standaloneSummaries).length > 0
      ? Object.entries(ai.standaloneSummaries)
          .filter(([, v]) => Boolean(v))
          .map(([k, v]) => `[${k}]:\n${v}`)
          .join('\n\n')
      : ''

  const blocks: Array<{ title: string; content: string; accent: string }> = [
    { title: '核心热点态势', content: ai.coreTrends ?? '', accent: 'core' },
    { title: '舆论风向争议', content: ai.sentimentControversy ?? '', accent: 'sentiment' },
    { title: '异动与弱信号', content: ai.signals ?? '', accent: 'signals' },
    { title: 'RSS 深度洞察', content: ai.includeRss ? (ai.rssInsights ?? '') : '', accent: 'rss' },
    { title: '联网搜索专题研判', content: ai.includeWebSearch ? (ai.searchInsights ?? '') : '', accent: 'search' },
    { title: '研判策略建议', content: ai.outlookStrategy ?? '', accent: 'strategy' },
    { title: '独立源点速览', content: ai.includeStandalone ? standaloneText : '', accent: 'standalone' },
  ].filter((b) => b.content.trim().length > 0)

  if (blocks.length === 0) return ''

  const blocksHtml = blocks
    .map((b) => {
      const iconSvg = AI_BLOCK_ICONS[b.accent] ?? AI_BLOCK_ICONS.core
      const contentHtml = escapeHtml(b.content.trim()).replace(/\n/g, '<br>')
      return `
                    <div class="ai-block" data-ai-accent="${b.accent}">
                        <div class="ai-block-head">
                            <div class="ai-block-title"><span class="ai-block-icon-wrap accent-${b.accent}">${iconSvg}</span><span>${escapeHtml(b.title)}</span></div>
                            <button type="button" class="ai-block-copy-btn" title="复制本节内容" aria-label="复制本节内容">${UI_ICONS.copy}</button>
                        </div>
                        <div class="ai-block-content">${contentHtml}</div>
                    </div>`
    })
    .join('')

  return `
                <div class="ai-section">
                    <div class="ai-section-header">
                        <div class="ai-section-header-left">
                            <span class="section-icon-badge badge-ai"><svg class="ai-title-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5l1.45 4.55L14 7.5l-4.55 1.45L8 13.5l-1.45-4.55L2 7.5l4.55-1.45z"/></svg></span>
                            <div class="ai-section-title">AI 热点分析</div>
                            <span class="ai-section-badge">AI</span>
                        </div>
                        <button type="button" class="ai-copy-all-btn" title="复制全部 AI 研判内容">${UI_ICONS.copy}<span>复制全文</span></button>
                    </div>
                    <div class="ai-blocks-grid">${blocksHtml}
                    </div>
                </div>`
}

function addSectionDivider(content: string): string {
  if (!content) return content
  const pos = content.indexOf('class="')
  if (pos === -1) return content
  const insertAt = pos + 'class="'.length
  return `${content.slice(0, insertAt)}section-divider ${content.slice(insertAt)}`
}

function addRegionAttr(content: string, region: PreviewRegionId, addId: boolean): string {
  if (!content) return content
  const pos = content.indexOf('<div ')
  if (pos === -1) return content
  const insertAt = pos + '<div '.length
  const idAttr = addId ? `id="region-${region}" ` : ''
  return `${content.slice(0, insertAt)}${idAttr}data-region="${region}" ${content.slice(insertAt)}`
}

export function renderTrendRadarPreviewHtml(input: PreviewReportRenderInput): string {
  const modeMeta: Record<PreviewReportRenderInput['mode'], { label: string; desc: string }> = {
    current: { label: '当前榜单', desc: '仅统计本轮仍在榜的匹配热点与最新抓取数据' },
    incremental: { label: '增量分析', desc: '仅呈现本轮新发现的去重条目，零重复干扰' },
    daily: { label: '全天汇总', desc: '汇总今日全部批次的匹配热点与新增条目' },
  }
  const { label: modeDisplay, desc: modeDesc } = modeMeta[input.mode]

  const hotNewsCount = input.stats.reduce((sum, g) => sum + g.titles.length, 0)
  const rssMatchedCount = input.rssItems.reduce((sum, g) => sum + g.titles.length, 0)
  const rssNewCount = input.rssNewItems.reduce((sum, g) => sum + g.titles.length, 0)
  const searchMatchedCount = input.searchItems.reduce((sum, g) => sum + g.titles.length, 0)
  const searchNewCount = input.searchNewItems.reduce((sum, g) => sum + g.titles.length, 0)
  const standaloneCount = input.standaloneData
    ? input.standaloneData.platforms.reduce((s, p) => s + p.items.length, 0) +
      input.standaloneData.rssFeeds.reduce((s, r) => s + r.items.length, 0)
    : 0

  const hasWebSearch = input.webSearchEnabled && (input.searchTopicTotal > 0 || searchMatchedCount > 0)
  const failedCount = input.failedIds.length
  const platformSuccess = Math.max(0, input.platformTotal - failedCount)

  // AI header metric & tooltip
  let aiValue = '未启用'
  const aiTipRows: Array<{ label: string; value: string; dotColor?: string }> = []
  let aiTipBadge = ''
  let aiTipFoot = ''
  const aiSuccess = Boolean(input.aiAnalysis && input.aiAnalysis.status === 'success')
  if (input.aiAnalysis && input.aiAnalysis.status === 'success') {
    const parts = [String(input.aiAnalysis.hotlistAnalyzed)]
    aiTipRows.push({ label: '热榜新闻', value: `${input.aiAnalysis.hotlistAnalyzed} 条`, dotColor: '#818cf8' })
    if (input.aiAnalysis.includeRss) {
      parts.push(String(input.aiAnalysis.rssAnalyzed))
      aiTipRows.push({ label: 'RSS 订阅', value: `${input.aiAnalysis.rssAnalyzed} 条`, dotColor: '#34d399' })
    }
    if ((input.aiAnalysis.includeWebSearch && hasWebSearch) || input.aiAnalysis.searchAnalyzed > 0) {
      parts.push(String(input.aiAnalysis.searchAnalyzed))
      aiTipRows.push({ label: '联网搜索', value: `${input.aiAnalysis.searchAnalyzed} 条`, dotColor: '#fbbf24' })
    }
    if (input.aiAnalysis.includeStandalone) {
      parts.push(String(input.aiAnalysis.standaloneAnalyzed))
      aiTipRows.push({ label: '独立展示', value: `${input.aiAnalysis.standaloneAnalyzed} 条`, dotColor: '#38bdf8' })
    }
    const totalAnalyzed = parts.reduce((s, n) => s + Number(n), 0)
    aiValue = totalAnalyzed > 0 ? parts.join(' + ') : '0'
    aiTipBadge = `共 ${totalAnalyzed} 条`
    aiTipFoot = '数字依次对应各来源送入 AI 的样本数'
  } else if (input.aiAnalysis?.status === 'skipped') {
    aiValue = '已跳过'
    aiTipRows.push({ label: '状态', value: '当前调度时段跳过分析', dotColor: '#94a3b8' })
  } else if (input.aiAnalysis?.status === 'unconfigured') {
    aiValue = '待配置'
    aiTipRows.push({ label: '状态', value: '未配置模型密钥或调用失败', dotColor: '#f87171' })
  } else {
    aiTipRows.push({ label: '状态', value: '可在 config.yaml 开启 ai_analysis', dotColor: '#94a3b8' })
  }

  const modeTip = buildMetricTooltip('报告模式说明', [{ label: '当前模式', value: modeDisplay, dotColor: '#818cf8' }], {
    foot: modeDesc,
    align: 'left',
  })
  const timeTip = buildMetricTooltip(
    '报告生成时间',
    [
      { label: '完整时间', value: input.generatedTimeFull, dotColor: '#94a3b8' },
      { label: '配置时区', value: input.timezoneLabel, dotColor: '#818cf8' },
    ],
    { foot: '数据统计截止至此时刻' },
  )

  const hotHitRate = input.hotlistTotal > 0 ? `${((hotNewsCount / input.hotlistTotal) * 100).toFixed(1)}%` : '--'
  const hotlistTipRows = [
    { label: '关键词命中', value: `${hotNewsCount} 条`, dotColor: '#818cf8' },
    { label: '抓取总标题', value: `${input.hotlistTotal} 条`, dotColor: '#94a3b8' },
    { label: '筛选命中率', value: hotHitRate, dotColor: '#a5b4fc' },
    {
      label: '平台成功数',
      value: input.platformTotal > 0 ? `${platformSuccess} / ${input.platformTotal}` : '--',
      dotColor: failedCount === 0 ? '#34d399' : '#fbbf24',
    },
  ]

  const rssHitRate = input.rssTotalCount > 0 ? `${((rssMatchedCount / input.rssTotalCount) * 100).toFixed(1)}%` : '--'
  const rssTipRows =
    input.rssEnabled && input.rssSourceTotal > 0
      ? [
          { label: '筛选命中', value: `${rssMatchedCount} 条`, dotColor: '#34d399' },
          { label: '新鲜度保留', value: `${input.rssTotalCount} 条`, dotColor: '#94a3b8' },
          { label: '筛选命中率', value: rssHitRate, dotColor: '#6ee7b7' },
          { label: '订阅源状态', value: `${input.rssSourceTotal} / ${input.rssSourceTotal}`, dotColor: '#34d399' },
        ]
      : [{ label: '当前状态', value: '未启用 RSS 订阅源', dotColor: '#94a3b8' }]

  const searchTipRows = [
    { label: '精选入榜', value: `${searchMatchedCount} 条`, dotColor: '#fbbf24' },
    ...(input.searchCandidateCount > searchMatchedCount
      ? [{ label: '质量漏斗前候选', value: `${input.searchCandidateCount} 条`, dotColor: '#94a3b8' }]
      : []),
    { label: '本轮新增发现', value: `${searchNewCount} 条`, dotColor: '#fb7185' },
    { label: '搜索主题状态', value: `${input.searchTopicTotal} / ${input.searchTopicTotal}`, dotColor: '#34d399' },
  ]

  let headerBodyHtml = ''
  if (hasWebSearch) {
    const totalNew = input.totalNewCount + rssNewCount + searchNewCount
    const newValue = totalNew > 0 ? `${input.totalNewCount} + ${rssNewCount} + ${searchNewCount}` : '0'
    const newTip = buildMetricTooltip(
      '新增条目构成',
      [
        { label: '热榜新增', value: `${input.totalNewCount} 条`, dotColor: '#818cf8' },
        { label: 'RSS 新增', value: `${rssNewCount} 条`, dotColor: '#34d399' },
        { label: '联网搜索新增', value: `${searchNewCount} 条`, dotColor: '#fbbf24' },
      ],
      { badge: `共 ${totalNew} 条`, foot: '按 热榜 + RSS + 联网搜索 顺序统计' },
    )
    const aiTip = buildMetricTooltip('AI 分析样本构成', aiTipRows, {
      badge: aiTipBadge,
      foot: aiTipFoot,
      actionHint: aiSuccess ? '点击查看 AI 研判' : '',
      align: 'right',
    })
    const aiClickAttr = aiSuccess ? ' data-jump-region="ai_analysis" style="cursor:pointer;"' : ''
    const hotJump = hotNewsCount > 0 ? ' data-jump-region="hotlist"' : ''
    const rssJump = rssMatchedCount > 0 ? ' data-jump-region="rss"' : ''
    const searchJump = searchMatchedCount > 0 ? ' data-jump-region="web_search"' : ''
    const hotTip = buildMetricTooltip('热榜数据源统计', hotlistTipRows, {
      actionHint: hotNewsCount > 0 ? '点击聚焦热榜区域' : '',
      align: 'left',
    })
    const rssTip = buildMetricTooltip('RSS 订阅源统计', rssTipRows, {
      actionHint: rssMatchedCount > 0 ? '点击聚焦 RSS 区域' : '',
    })
    const searchTip = buildMetricTooltip('联网搜索统计', searchTipRows, {
      actionHint: searchMatchedCount > 0 ? '点击聚焦联网搜索区域' : '',
      align: 'right',
    })

    headerBodyHtml = `
                <div class="header-info">
                    <div class="info-item metric-interactive" tabindex="0">
                        <span class="info-label">报告类型</span>
                        <span class="info-value">${modeDisplay}</span>
                        ${modeTip}
                    </div>
                    <div class="info-item metric-interactive" tabindex="0">
                        <span class="info-label">生成时间</span>
                        <span class="info-value">${escapeHtml(input.generatedTimeShort)}</span>
                        ${timeTip}
                    </div>
                    <div class="info-item metric-interactive" tabindex="0">
                        <span class="info-label">新增条目</span>
                        <span class="info-value"><span class="metric-value-hint">${newValue}</span></span>
                        ${newTip}
                    </div>
                    <div class="info-item metric-interactive" tabindex="0"${aiClickAttr}>
                        <span class="info-label">AI 分析</span>
                        <span class="info-value"><span class="metric-value-hint">${aiValue}</span></span>
                        ${aiTip}
                    </div>
                </div>
                <div class="header-sources-bar">
                    <div class="header-source-card">
                        <div class="source-card-inner metric-clickable" tabindex="0"${hotJump}>
                            <span class="source-card-label"><span class="source-card-dot dot-hotlist"></span>${UI_ICONS.hotlist}热榜命中</span>
                            <span class="source-card-value"><span class="metric-value-hint">${hotNewsCount} / ${input.hotlistTotal}</span></span>
                            <span class="source-card-sub">${input.platformTotal > 0 ? `平台 ${platformSuccess}/${input.platformTotal}` : '平台 --'}</span>
                            ${hotTip}
                        </div>
                    </div>
                    <div class="header-source-card">
                        <div class="source-card-inner metric-clickable" tabindex="0"${rssJump}>
                            <span class="source-card-label"><span class="source-card-dot dot-rss"></span>${UI_ICONS.rss}RSS 命中</span>
                            <span class="source-card-value"><span class="metric-value-hint">${input.rssEnabled && input.rssSourceTotal > 0 ? `${rssMatchedCount} / ${input.rssTotalCount}` : '未启用'}</span></span>
                            <span class="source-card-sub">${input.rssEnabled && input.rssSourceTotal > 0 ? `源 ${input.rssSourceTotal}/${input.rssSourceTotal}` : '--'}</span>
                            ${rssTip}
                        </div>
                    </div>
                    <div class="header-source-card">
                        <div class="source-card-inner metric-clickable" tabindex="0"${searchJump}>
                            <span class="source-card-label"><span class="source-card-dot dot-search"></span>${UI_ICONS.web_search}联网搜索</span>
                            <span class="source-card-value"><span class="metric-value-hint">${searchMatchedCount} 条</span></span>
                            <span class="source-card-sub">主题 ${input.searchTopicTotal}/${input.searchTopicTotal}</span>
                            ${searchTip}
                        </div>
                    </div>
                </div>`
  } else {
    const totalNew = input.totalNewCount + rssNewCount
    const newValue = totalNew > 0 ? `${input.totalNewCount} + ${rssNewCount}` : '0'
    const newTip8 = buildMetricTooltip(
      '新增热点构成',
      [
        { label: '热榜新增', value: `${input.totalNewCount} 条`, dotColor: '#818cf8' },
        { label: 'RSS 新增', value: `${rssNewCount} 条`, dotColor: '#34d399' },
      ],
      { badge: `共 ${totalNew} 条`, foot: '按 热榜 + RSS 顺序统计' },
    )
    const aiTip8 = buildMetricTooltip('AI 分析样本构成', aiTipRows, {
      badge: aiTipBadge,
      foot: aiTipFoot,
      actionHint: aiSuccess ? '点击查看 AI 研判' : '',
      align: 'right',
    })
    const hotTip8 = buildMetricTooltip('热榜数据源统计', hotlistTipRows, {
      actionHint: hotNewsCount > 0 ? '点击聚焦热榜区域' : '',
    })
    const rssTip8 = buildMetricTooltip('RSS 订阅源统计', rssTipRows, {
      actionHint: rssMatchedCount > 0 ? '点击聚焦 RSS 区域' : '',
      align: 'right',
    })

    headerBodyHtml = `
                <div class="header-info">
                    <div class="info-item metric-interactive" tabindex="0">
                        <span class="info-label">报告类型</span>
                        <span class="info-value"><span class="metric-value-hint">${modeDisplay}</span></span>
                        ${modeTip}
                    </div>
                    <div class="info-item metric-interactive" tabindex="0">
                        <span class="info-label">生成时间</span>
                        <span class="info-value"><span class="metric-value-hint">${escapeHtml(input.generatedTimeShort)}</span></span>
                        ${timeTip}
                    </div>
                    <div class="info-item metric-interactive" tabindex="0"${hotNewsCount > 0 ? ' data-jump-region="hotlist" style="cursor:pointer;"' : ''}>
                        <span class="info-label">热榜命中</span>
                        <span class="info-value"><span class="metric-value-hint">${hotNewsCount} / ${input.hotlistTotal}</span></span>
                        ${hotTip8}
                    </div>
                    <div class="info-item metric-interactive" tabindex="0"${rssMatchedCount > 0 ? ' data-jump-region="rss" style="cursor:pointer;"' : ''}>
                        <span class="info-label">RSS 命中</span>
                        <span class="info-value"><span class="metric-value-hint">${input.rssEnabled && input.rssSourceTotal > 0 ? `${rssMatchedCount} / ${input.rssTotalCount}` : '未启用'}</span></span>
                        ${rssTip8}
                    </div>
                    <div class="info-item">
                        <span class="info-label">热榜平台</span>
                        <span class="info-value">${input.platformTotal > 0 ? `${platformSuccess}/${input.platformTotal}` : '--'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">RSS 源</span>
                        <span class="info-value">${input.rssEnabled && input.rssSourceTotal > 0 ? `${input.rssSourceTotal}/${input.rssSourceTotal}` : '--'}</span>
                    </div>
                    <div class="info-item metric-interactive" tabindex="0">
                        <span class="info-label">新增热点</span>
                        <span class="info-value"><span class="metric-value-hint">${newValue}</span></span>
                        ${newTip8}
                    </div>
                    <div class="info-item metric-interactive" tabindex="0"${aiSuccess ? ' data-jump-region="ai_analysis" style="cursor:pointer;"' : ''}>
                        <span class="info-label">AI 分析</span>
                        <span class="info-value"><span class="metric-value-hint">${aiValue}</span></span>
                        ${aiTip8}
                    </div>
                </div>`
  }

  // Render all 6 region contents with exact html.py DOM structure
  const statsHtml = renderHotlistHtml(input.stats, input.displayMode)
  const newTitlesHtml = renderNewTitlesHtml(input.newTitles, input.totalNewCount, input.showNewSection)
  const rssStatsHtml = renderRssStatsHtml(input.rssItems, 'RSS 订阅更新')
  const rssNewHtml = input.showNewSection ? renderRssStatsHtml(input.rssNewItems, 'RSS 新增更新') : ''
  const searchStatsHtml = renderSearchStatsHtml(input.searchItems, '联网搜索', true)
  const searchNewHtml = input.showNewSection ? renderSearchStatsHtml(input.searchNewItems, '联网搜索新增', false) : ''
  const standaloneHtml = renderStandaloneHtml(input.standaloneData)
  const aiHtml = renderAiAnalysisHtml(input.aiAnalysis)

  const newRenderCount =
    (newTitlesHtml ? input.newTitles.reduce((s, g) => s + g.titles.length, 0) : 0) +
    (rssNewHtml ? rssNewCount : 0) +
    (searchNewHtml ? searchNewCount : 0)

  const regionNavMeta: Record<PreviewRegionId, { label: string; count?: number }> = {
    hotlist: { label: '热榜', count: hotNewsCount },
    rss: { label: 'RSS', count: rssMatchedCount },
    web_search: { label: '联网搜索', count: searchMatchedCount },
    new_items: { label: '新增', count: newRenderCount },
    standalone: { label: '独立展示', count: standaloneCount },
    ai_analysis: { label: 'AI 分析' },
  }

  const renderedNavRegions: Array<{ id: PreviewRegionId; label: string; count?: number }> = []
  const seenNav = new Set<PreviewRegionId>()
  for (const reg of input.regionOrder) {
    if (seenNav.has(reg)) continue
    const hasContent =
      reg === 'hotlist'
        ? Boolean(statsHtml)
        : reg === 'rss'
          ? Boolean(rssStatsHtml)
          : reg === 'web_search'
            ? Boolean(searchStatsHtml)
            : reg === 'new_items'
              ? Boolean(newTitlesHtml || rssNewHtml || searchNewHtml)
              : reg === 'standalone'
                ? Boolean(standaloneHtml)
                : Boolean(aiHtml)
    if (hasContent) {
      seenNav.add(reg)
      renderedNavRegions.push({ id: reg, ...regionNavMeta[reg] })
    }
  }

  let sectionNavHtml = ''
  if (renderedNavRegions.length >= 2) {
    sectionNavHtml = `
                <div class="section-nav-bar" role="tablist" aria-label="区域快捷切换">
                    <div class="section-nav-track">
                        <div class="section-nav-indicator" aria-hidden="true"></div>
                        <button class="section-nav-btn active" data-region-target="all">${UI_ICONS.all}<span>全部视图</span></button>`
    for (const r of renderedNavRegions) {
      const pill = typeof r.count === 'number' ? `<span class="nav-pill-count">${r.count}</span>` : ''
      sectionNavHtml += `
                        <button class="section-nav-btn" data-region-target="${r.id}">${UI_ICONS[r.id]}<span>${escapeHtml(r.label)}</span>${pill}</button>`
    }
    sectionNavHtml += `
                    </div>
                </div>`
  }

  let errorHtml = ''
  if (input.failedIds.length > 0) {
    errorHtml = `
                <div class="error-section">
                    <div class="error-title">${UI_ICONS.warning}请求失败的平台</div>
                    <ul class="error-list">${input.failedIds.map((id) => `<li class="error-item">${escapeHtml(id)}</li>`).join('')}</ul>
                </div>`
  }

  // Assemble regions in exact region_order with section-divider, id="region-*", data-region="*"
  let regionsBodyHtml = ''
  let hasPreviousContent = false
  const assignedRegionIds = new Set<PreviewRegionId>()
  for (const region of input.regionOrder) {
    if (region === 'new_items') {
      for (const sub of [newTitlesHtml, rssNewHtml, searchNewHtml]) {
        if (!sub) continue
        const needId = !assignedRegionIds.has(region)
        let block = addRegionAttr(sub, 'new_items', needId)
        if (needId) assignedRegionIds.add(region)
        if (hasPreviousContent) block = addSectionDivider(block)
        regionsBodyHtml += block
        hasPreviousContent = true
      }
    } else {
      const raw =
        region === 'hotlist'
          ? statsHtml
          : region === 'rss'
            ? rssStatsHtml
            : region === 'web_search'
              ? searchStatsHtml
              : region === 'standalone'
                ? standaloneHtml
                : aiHtml
      if (!raw) continue
      const needId = !assignedRegionIds.has(region)
      let block = addRegionAttr(raw, region, needId)
      if (needId) assignedRegionIds.add(region)
      if (hasPreviousContent) block = addSectionDivider(block)
      regionsBodyHtml += block
      hasPreviousContent = true
    }
  }

  const emptyStateHtml = !hasPreviousContent
    ? `
                <div style="text-align:center;padding:48px 24px;color:#64748b;">
                    <div style="font-size:16px;font-weight:600;margin-bottom:8px;">当前配置下暂无可展示的报告内容</div>
                    <div style="font-size:13.5px;">请检查数据源开关（热榜 / RSS / 联网搜索）、display.regions 开关，或放宽关键词与过滤条件。</div>
                </div>`
    : ''

  const searchPlaceholder = hasWebSearch ? '搜索新闻标题或摘要...' : '搜索新闻标题...'
  const bodyClasses = [
    input.initialWideMode ? 'wide-mode' : '',
    input.initialDarkMode ? 'dark-mode' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>热点新闻分析 · TrendRadar 实时预览</title>
    <style>
${TRENDRADAR_REPORT_CSS}
    </style>
</head>
<body class="${bodyClasses}" data-preview-wide="${input.initialWideMode ? '1' : '0'}" data-preview-dark="${input.initialDarkMode ? '1' : '0'}">
    <div class="reading-progress"></div>
    <div class="container">
        <div class="header">
            <div class="header-watermark">TrendRadar</div>
            <div class="save-buttons">
                <button class="toggle-wide-btn" onclick="toggleWideMode()" title="切换宽屏/窄屏" aria-label="切换宽屏/窄屏">${input.initialWideMode ? UI_ICONS.compress : UI_ICONS.expand}</button>
                <button class="toggle-dark-btn" onclick="toggleDarkMode()" title="切换暗色/亮色" aria-label="切换暗色/亮色">${input.initialDarkMode ? UI_ICONS.sun : UI_ICONS.moon}</button>
                <div class="save-btn-group">
                    <button class="save-btn" onclick="saveAsMarkdown()">导出</button>
                    <button class="save-dropdown-trigger">▾</button>
                    <div class="save-dropdown-menu">
                        <button class="save-dropdown-item" onclick="saveAsImage(event)"><svg class="dropdown-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="8" cy="7.5" r="2.5"/><path d="M12 4h.01"/></svg>整页截图</button>
                        <button class="save-dropdown-item" onclick="saveAsMultipleImages(event)"><svg class="dropdown-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="10" height="10" rx="1.5"/><path d="M5 4V2.5A1.5 1.5 0 016.5 1h7A1.5 1.5 0 0115 2.5v7a1.5 1.5 0 01-1.5 1.5H12"/></svg>分段截图</button>
                        <button class="save-dropdown-item" onclick="saveAsMarkdown()"><svg class="dropdown-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.5 2h11A1.5 1.5 0 0115 3.5v9a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9A1.5 1.5 0 012.5 2z"/><path d="M4 11V5l2.5 3L9 5v6"/><path d="M11.5 8v3m0 0l-1.5-2m1.5 2l1.5-2"/></svg>Markdown</button>
                    </div>
                </div>
            </div>
            <div class="header-title">热点新闻分析</div>${headerBodyHtml}
        </div>

        <div class="content">
            <div class="search-bar">
                <div class="search-box">
                    <svg class="search-box-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>
                    <input type="text" class="search-input" placeholder="${searchPlaceholder}" oninput="handleSearch(this.value)">
                    <span class="search-kbd" aria-hidden="true">/</span>
                    <button type="button" class="search-clear-btn" onclick="clearSearchInput()" title="清空搜索" aria-label="清空搜索">
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
                    </button>
                </div>
            </div>${sectionNavHtml}${errorHtml}${regionsBodyHtml}${emptyStateHtml}
        </div>

        <div class="footer">
            <div class="footer-content">
                由 <span class="project-name">TrendRadar</span> 生成 ·
                <a href="https://github.com/sansan0/TrendRadar" target="_blank" rel="noopener noreferrer" class="footer-link">
                    GitHub 开源项目
                </a>
            </div>
        </div>
    </div>

    <div id="rank-timeline-popover" class="rank-popover" role="dialog" aria-label="排名变化轨迹" aria-hidden="true"></div>

    <div class="fab-bar">
        <div class="fab-dock">
            <div class="fab-top-wrap">
                <button type="button" class="fab-btn fab-top-btn" onclick="window.scrollTo({top:0,behavior:'smooth'})" title="返回顶部" aria-label="返回顶部">
                    <svg class="fab-progress-svg" viewBox="0 0 36 36" aria-hidden="true">
                        <circle class="fab-progress-track" cx="18" cy="18" r="16"/>
                        <circle class="fab-progress-arc" cx="18" cy="18" r="16"/>
                    </svg>
                    <svg class="fab-top-arrow" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12.5V3.5M4 7.5L8 3.5l4 4"/></svg>
                </button>
                <div class="fab-divider" aria-hidden="true"></div>
            </div>
            <div class="fab-help-wrap">
                <button type="button" class="fab-btn fab-help" title="快捷操作与提示 (?)" aria-label="快捷操作与提示" aria-expanded="false">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="3.5" width="13" height="9" rx="2"/><path d="M4.5 6.5h.01M7 6.5h.01M9.5 6.5h.01M11.5 6.5h.01M4.5 9h7"/></svg>
                </button>
                <div class="fab-panel" role="dialog" aria-label="快捷操作与提示">
                    <div class="fab-panel-head">
                        <span class="fab-panel-title">快捷操作与提示</span>
                        <button type="button" class="fab-panel-close" aria-label="关闭">
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
                        </button>
                    </div>
                    <div class="fab-panel-group">
                        <button type="button" class="fab-shortcut-row" data-fab-action="wide"><span>切换宽屏 / 窄屏</span><span class="fab-kbd-group"><kbd class="fab-kbd">W</kbd></span></button>
                        <button type="button" class="fab-shortcut-row" data-fab-action="dark"><span>切换暗色 / 亮色</span><span class="fab-kbd-group"><kbd class="fab-kbd">D</kbd></span></button>
                        <button type="button" class="fab-shortcut-row" data-fab-action="search"><span>聚焦搜索框</span><span class="fab-kbd-group"><kbd class="fab-kbd">/</kbd></span></button>
                        <div class="fab-shortcut-row static-row"><span>切换热榜分组</span><span class="fab-kbd-group"><kbd class="fab-kbd">←</kbd><kbd class="fab-kbd">→</kbd></span></div>
                    </div>
                    <div class="fab-panel-subhead">页面交互提示</div>
                    <div class="fab-panel-group">
                        <div class="fab-shortcut-row static-row"><span>排名变化轨迹</span><span class="fab-hint-pill">悬停 / 点击排名</span></div>
                        <div class="fab-shortcut-row static-row"><span>复制标题链接</span><span class="fab-hint-pill">点击序号</span></div>
                        <div class="fab-shortcut-row static-row"><span>快速定位分区</span><span class="fab-hint-pill">点击顶部指标</span></div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
${TRENDRADAR_REPORT_JS}
    </script>
</body>
</html>`
}
