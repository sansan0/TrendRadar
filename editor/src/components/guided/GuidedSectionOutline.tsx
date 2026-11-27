import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { STAGE_FOR_SECTION, stageStyleVars } from '@/lib/workflow-stages'
import { useEditor } from '@/store/editor-store'

interface OutlineMeta {
  titleZh: string
  titleEn: string
  descZh: string
  descEn: string
}

interface OutlineItem {
  id: string
  title: string
  desc: string
}

const OUTLINE_META: Record<string, OutlineMeta> = {
  // Quick Start (onboarding)
  'guided-anchor-starter': {
    titleZh: '运行流程与快速体验',
    titleEn: 'Workflow & Quick Trial',
    descZh: '按 3 阶段直观浏览并快速试用核心开关，改一项就能直接复制试跑。',
    descEn: '3-stage workflow overview and quick setup to test any switch immediately.',
  },
  'guided-anchor-deploy': {
    titleZh: '运行环境选择',
    titleEn: 'Deployment Environment',
    descZh: '按实际部署方式选择 Docker / NAS、GitHub Actions 或本机 Python (uv)。',
    descEn: 'Choose Docker / NAS, GitHub Actions, or local Python (uv) deployment.',
  },
  'guided-anchor-presets': {
    titleZh: '场景方案一键套用',
    titleEn: 'Scenario Presets',
    descZh: '内置 4 套常用情报方案，懒得逐项挑时可一键写入推荐开关组合。',
    descEn: '4 ready-made scenario presets to configure common workflows in one click.',
  },
  'guided-anchor-export-guide': {
    titleZh: '导出与长期运行指南',
    titleEn: 'Export & Deployment Guide',
    descZh: '查看打包 config.zip、安全注入密钥与覆盖启动的完整步骤。',
    descEn: 'Step-by-step guide to pack config.zip, inject secrets, and start running.',
  },

  // 01 Data Sources
  'pro-anchor-hotlist': {
    titleZh: '热榜平台抓取',
    titleEn: 'Hotlist Platforms',
    descZh: '勾选要追踪的热榜站点，支持拖拽排序与增删自定义平台。',
    descEn: 'Enable, disable, and drag-reorder trending hotlist platforms.',
  },
  'pro-anchor-crawler-network': {
    titleZh: '抓取间隔与网络代理',
    titleEn: 'Crawler Timing & Proxy',
    descZh: '调整请求间隔、超时重试与本地 HTTP 代理地址。',
    descEn: 'Tune request interval, timeout, retries, and optional local proxy.',
  },
  'pro-anchor-rss': {
    titleZh: 'RSS 订阅源管理',
    titleEn: 'RSS Feeds',
    descZh: '管理 RSS / Atom 订阅列表、文章新鲜度窗口与单源条数上限。',
    descEn: 'Manage RSS / Atom feeds, freshness filter, and per-feed item limits.',
  },
  'pro-anchor-rss-network': {
    titleZh: 'RSS 网络与并发调优',
    titleEn: 'RSS Network Tuning',
    descZh: '配置 RSS 专属代理、请求超时与并发抓取策略。',
    descEn: 'Configure dedicated RSS proxy, timeouts, and fetch concurrency.',
  },
  'pro-anchor-search': {
    titleZh: '定时联网搜索总开关',
    titleEn: 'Scheduled Web Search',
    descZh: '开启或关闭全网专题主动检索，抓取结果会在报告中独立展示。',
    descEn: 'Master toggle for scheduled web search across custom topics.',
  },
  'pro-anchor-search-engine': {
    titleZh: '搜索模式与引擎凭证',
    titleEn: 'Search Mode & Engine',
    descZh: '在直搜模式与 Smart AI 智能提炼间切换，并配置搜索引擎 API Key。',
    descEn: 'Switch between direct search or Smart AI refine and set provider keys.',
  },
  'pro-anchor-search-queries': {
    titleZh: '搜索主题管理',
    titleEn: 'Search Topics',
    descZh: '可视化管理 search_queries.txt 中的专题关键词与全局过滤规则。',
    descEn: 'Manage search topics and global filters in search_queries.txt.',
  },
  'pro-anchor-search-quality': {
    titleZh: '结果质量过滤',
    titleEn: 'Result Quality Filter',
    descZh: '设置单题条数上限、最低相关度分值与允许/屏蔽域名规则。',
    descEn: 'Set max items per topic, minimum relevance score, and domain rules.',
  },
  'pro-anchor-search-network': {
    titleZh: '去重、权威度与网络',
    titleEn: 'Dedup & Network Tuning',
    descZh: '调节跨轮去重窗口、来源权威度加权与联网搜索网络参数。',
    descEn: 'Adjust dedup window, source authority weighting, and network options.',
  },

  // 02 Content Filter
  'guided-anchor-filter-mode': {
    titleZh: '当前筛选方式',
    titleEn: 'Filter Mode Switch',
    descZh: '在零成本「关键词规则」与自然语言「AI 智能筛选」之间二选一。',
    descEn: 'Pick between zero-cost Keyword Rules or plain-language AI Smart Filter.',
  },
  'pro-anchor-frequency': {
    titleZh: '全局屏蔽词',
    titleEn: 'Global Blocklist',
    descZh: '配置 [GLOBAL_FILTER]，命中任意屏蔽词或正则的标题会直接过滤。',
    descEn: 'Configure [GLOBAL_FILTER] to exclude unwanted headlines globally.',
  },
  'guided-anchor-keyword-groups': {
    titleZh: '关键词词组管理',
    titleEn: 'Keyword Groups',
    descZh: '按优先级编排关注词组、+必含词、!排除词、正则与别名归类。',
    descEn: 'Organize prioritized keyword groups, +must, !exclude, and regex rules.',
  },
  'guided-anchor-filter-sandbox': {
    titleZh: '标题命中测试沙盒',
    titleEn: 'Headline Test Sandbox',
    descZh: '粘贴几条新闻标题，实时验证屏蔽规则、排除词与最终命中词组。',
    descEn: 'Paste sample headlines to live-test blocklists and group matching.',
  },
  'pro-anchor-ai-interests': {
    titleZh: '关注兴趣描述',
    titleEn: 'AI Interest Profile',
    descZh: '用自然语言编辑 ai_interests.txt，告诉大模型你关注和排除的方向。',
    descEn: 'Edit ai_interests.txt in plain language to guide AI semantic filtering.',
  },
  'pro-anchor-ai-filter-advanced': {
    titleZh: 'AI 筛选进阶调优',
    titleEn: 'AI Filter Tuning',
    descZh: '调整每批处理条数、最低相关度门槛与自定义兴趣/提示词文件路径。',
    descEn: 'Tune batch size, minimum score threshold, and custom prompt paths.',
  },

  // 03 AI Engine & Prompts
  'pro-anchor-ai-model': {
    titleZh: '共享 AI 模型引擎',
    titleEn: 'Shared AI Model Engine',
    descZh: '一次配置共享大模型与 API Key，即可联动分析、翻译、筛选与搜索。',
    descEn: 'Configure one shared LLM and API key across all AI capabilities.',
  },
  'pro-anchor-ai-relay': {
    titleZh: '自定义中转 / 代理地址',
    titleEn: 'Custom API Base URL',
    descZh: '接入自建转发站、OpenAI 兼容接口或本机 Ollama 服务地址。',
    descEn: 'Point to a custom OpenAI-compatible relay or local Ollama endpoint.',
  },
  'pro-anchor-ai-advanced': {
    titleZh: '生成参数与容错回退',
    titleEn: 'Generation & Fallbacks',
    descZh: '调整温度、超时时间、备用回退模型列表与扩展参数。',
    descEn: 'Adjust temperature, timeouts, fallback models, and extra parameters.',
  },
  'pro-anchor-ai-analysis': {
    titleZh: 'AI 深度分析',
    titleEn: 'AI Deep Analysis',
    descZh: '让大模型自动提炼热点脉络、关键信号与趋势研判并写入报告。',
    descEn: 'Automatically synthesize trends, key signals, and briefings.',
  },
  'pro-anchor-ai-analysis-scope': {
    titleZh: '更多分析范围与模式',
    titleEn: 'Analysis Scope & Mode',
    descZh: '设置独立分析模式、送审条数上限与是否附带完整排名轨迹。',
    descEn: 'Override analysis mode, item limits, and rank timeline context.',
  },
  'pro-anchor-ai-analysis-prompt': {
    titleZh: '分析提示词模板',
    titleEn: 'Analysis Prompt File',
    descZh: '查看或自定义 ai_analysis_prompt.txt 深度分析系统提示词。',
    descEn: 'Inspect or customize ai_analysis_prompt.txt instructions.',
  },
  'pro-anchor-ai-translation': {
    titleZh: 'AI 多语言翻译',
    titleEn: 'AI Multi-Language Translation',
    descZh: '自动将海外热榜、外文 RSS 或联网搜索结果翻译为目标语言。',
    descEn: 'Translate foreign hotlists, RSS feeds, and web search results.',
  },
  'pro-anchor-ai-translation-prompt': {
    titleZh: '翻译批次与提示词',
    titleEn: 'Translation Batch & Prompt',
    descZh: '调整单批翻译条数并查看 ai_translation_prompt.txt 模板。',
    descEn: 'Tune translation batch size and inspect ai_translation_prompt.txt.',
  },

  // 04 Report & Layout
  'pro-anchor-report': {
    titleZh: '报告模式与展示方式',
    titleEn: 'Report & Display Mode',
    descZh: '选择当日汇总 / 当前榜单 / 增量监控，以及按词组或按平台分组。',
    descEn: 'Pick daily, current, or incremental mode and grouping style.',
  },
  'pro-anchor-display': {
    titleZh: '板块开关与区域排序',
    titleEn: 'Regions & Display Order',
    descZh: '启停并拖拽排序热榜、RSS、联网搜索、AI 分析等报告展示板块。',
    descEn: 'Toggle and drag-reorder hotlist, RSS, search, and AI report blocks.',
  },
  'pro-anchor-standalone': {
    titleZh: '独立展示区配置',
    titleEn: 'Standalone Showcase',
    descZh: '为指定热榜站点或 RSS 订阅开设不受关键词过滤影响的独立专区。',
    descEn: 'Create an unfiltered showcase section for selected platforms or feeds.',
  },
  'pro-anchor-weight': {
    titleZh: '热榜排序权重调节',
    titleEn: 'Ranking Weight Tuning',
    descZh: '平衡排名权重、出现频次与高排名热度的占比，精细控制榜单排序。',
    descEn: 'Balance rank, frequency, and hotness weights for headline scoring.',
  },

  // 05 Push & Schedule
  'pro-anchor-notification': {
    titleZh: '通知推送与 9 大渠道',
    titleEn: 'Push & 9 Channels',
    descZh: '配置飞书、企业微信、钉钉、Telegram、邮件、Bark、ntfy 等渠道。',
    descEn: 'Configure Feishu, WeCom, DingTalk, Telegram, Email, Bark, ntfy, etc.',
  },
  'pro-anchor-timeline': {
    titleZh: '定时调度与预设模板',
    titleEn: 'Schedule & Presets',
    descZh: '开启 7×24h 时间线调度并在全天监控、早晚汇总等预设间快速切换。',
    descEn: 'Enable 7×24h timeline scheduling and switch between built-in presets.',
  },
  'pro-anchor-timeline-orchestrator': {
    titleZh: '时间线可视化编排',
    titleEn: 'Timeline Orchestrator',
    descZh: '精细编辑每个时间窗口的起止时段、报告模式、分析与推送动作。',
    descEn: 'Fine-tune time windows, day plans, and per-period actions.',
  },

  // 06 Storage & System
  'pro-anchor-app': {
    titleZh: '基础运行环境',
    titleEn: 'Runtime Environment',
    descZh: '设置运行时区、版本更新检查等全局基础参数。',
    descEn: 'Configure runtime timezone, update checks, and core app behavior.',
  },
  'pro-anchor-storage': {
    titleZh: '数据存储策略',
    titleEn: 'Data Storage Strategy',
    descZh: '管理本地 SQLite 存储、历史保留天数与 HTML / TXT / SQLite 输出格式。',
    descEn: 'Configure local SQLite retention and HTML / TXT / SQLite outputs.',
  },
  'pro-anchor-storage-remote': {
    titleZh: '云端对象存储 (S3 / R2)',
    titleEn: 'Cloud Storage (S3 / R2)',
    descZh: '配置兼容 S3 的云端桶凭证以实现跨设备同步与 MCP 数据拉取。',
    descEn: 'Configure S3 / R2 credentials for remote sync and MCP data pull.',
  },
  'pro-anchor-advanced': {
    titleZh: '开发者调试与内部运维',
    titleEn: 'Developer & Ops Tuning',
    descZh: '调整消息分片、推送限流、去重与底层调试运维参数。',
    descEn: 'Tune message batching, rate limits, and advanced ops settings.',
  },
}

const ANCHOR_SELECTOR = '[id^="pro-anchor-"], [id^="guided-anchor-"]'

// Uniform tick geometry & silky macOS-Dock / ChatGPT-Desktop wave parameters
const TICK_ROW_HEIGHT = 14 // px per tick row (zero dead gap between rows)
const BASE_WIDTH = 12 // uniform resting width for every tick (px)
const MAX_WIDTH = 28 // peak width directly under cursor (px)
const WAVE_RADIUS = 2.45 // smooth neighbor falloff radius in tick-row units

function computeWaveInfluence(distanceRows: number): number {
  if (distanceRows >= WAVE_RADIUS) return 0
  // Smooth raised-cosine bell curve: 1 at cursor, gently swells neighbors, strictly < 1 for d > 0
  return 0.5 * (1 + Math.cos((Math.PI * distanceRows) / WAVE_RADIUS))
}

export function GuidedSectionOutline({ containerId }: { containerId: string }) {
  const { activeSection, lang, focusVisual } = useEditor()
  const t = useT()

  const [items, setItems] = useState<OutlineItem[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [cursorRow, setCursorRow] = useState<number | null>(null)
  const [hasRoom, setHasRoom] = useState(true)

  const railRef = useRef<HTMLDivElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const stage = STAGE_FOR_SECTION[activeSection]

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const scheduleClose = () => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setHoveredIdx(null)
      setCursorRow(null)
      closeTimerRef.current = null
    }, 130)
  }

  useEffect(() => () => clearCloseTimer(), [])

  const scanAnchors = useCallback(() => {
    const container = document.getElementById(containerId)
    if (!container) {
      setItems([])
      return
    }
    const nodes = [...container.querySelectorAll<HTMLElement>(ANCHOR_SELECTOR)].filter(
      (el) => !el.closest('[hidden]') && Boolean(OUTLINE_META[el.id]),
    )
    const next: OutlineItem[] = nodes.map((el) => {
      const meta = OUTLINE_META[el.id]
      return {
        id: el.id,
        title: t(meta.titleZh, meta.titleEn),
        desc: t(meta.descZh, meta.descEn),
      }
    })
    setItems((prev) => {
      if (
        prev.length === next.length &&
        prev.every((p, idx) => p.id === next[idx].id && p.title === next[idx].title)
      ) {
        return prev
      }
      return next
    })
    setActiveId((cur) => (next.some((it) => it.id === cur) ? cur : next[0]?.id ?? ''))
  }, [containerId, lang])

  // Discover rendered anchors on section switch & dynamic DOM mutations (tabs, toggles)
  useEffect(() => {
    const container = document.getElementById(containerId)
    if (!container) return

    let rafId = requestAnimationFrame(scanAnchors)
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(scanAnchors)
    })
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'data-state'] })

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [containerId, activeSection, scanAnchors])

  // Hide gracefully when scroll pane narrows so the rail never overlaps cards
  useEffect(() => {
    const container = document.getElementById(containerId)
    if (!container) return

    const updateRoom = () => {
      const w = container.clientWidth
      setHasRoom(w === 0 || w >= 980)
    }
    updateRoom()

    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(updateRoom)
    ro.observe(container)
    return () => ro.disconnect()
  }, [containerId])

  // Scroll-spy: highlight whichever section block is currently in view
  useEffect(() => {
    const container = document.getElementById(containerId)
    if (!container || items.length === 0) return

    const updateActive = () => {
      const containerRect = container.getBoundingClientRect()
      const atBottom =
        container.scrollHeight > container.clientHeight + 8 &&
        container.scrollTop + container.clientHeight >= container.scrollHeight - 24

      if (atBottom) {
        setActiveId(items[items.length - 1].id)
        return
      }

      let current = items[0].id
      for (const item of items) {
        const el = container.querySelector<HTMLElement>(`#${CSS.escape(item.id)}`)
        if (!el) continue
        const top = el.getBoundingClientRect().top - containerRect.top
        if (top <= 140) {
          current = item.id
        } else {
          break
        }
      }
      setActiveId(current)
    }

    updateActive()
    container.addEventListener('scroll', updateActive, { passive: true })
    return () => container.removeEventListener('scroll', updateActive)
  }, [containerId, items])

  if (!hasRoom || items.length < 2) return null

  const handleJump = (id: string) => {
    setActiveId(id)
    focusVisual(activeSection, id)
  }

  const handleRailMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    clearCloseTimer()
    const railEl = railRef.current
    if (!railEl) return
    const rect = railEl.getBoundingClientRect()
    if (rect.height <= 0) return
    const relY = e.clientY - rect.top
    const rowPos = relY / TICK_ROW_HEIGHT - 0.5
    const clampedRow = Math.max(0, Math.min(items.length - 1, rowPos))
    setCursorRow(clampedRow)
    setHoveredIdx(Math.round(clampedRow))
  }

  const hoveredItem = hoveredIdx !== null ? items[hoveredIdx] ?? null : null
  const previewCenterY = hoveredIdx !== null ? hoveredIdx * TICK_ROW_HEIGHT + TICK_ROW_HEIGHT / 2 : 0

  return (
    <nav
      aria-label={t('本页配置快速目录', 'On-page section outline')}
      data-guided-outline="true"
      data-stage={stage}
      style={stageStyleVars(stage)}
      onMouseLeave={scheduleClose}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setHoveredIdx(null)
          setCursorRow(null)
        }
      }}
      className="hidden xl:flex absolute left-3 top-1/2 z-[960] -translate-y-1/2 items-center"
    >
      {/* Uniform-width Tick Rail with Silky Dock-Wave Magnification on Hover */}
      <div
        ref={railRef}
        data-outline-rail="true"
        onMouseMove={handleRailMouseMove}
        onMouseEnter={clearCloseTimer}
        className="relative flex flex-col items-start py-0"
      >
        {items.map((item, idx) => {
          const isCurrent = item.id === activeId
          const isHovered = hoveredIdx === idx
          const dist =
            cursorRow !== null
              ? Math.abs(idx - cursorRow)
              : hoveredIdx !== null
                ? Math.abs(idx - hoveredIdx)
                : Number.POSITIVE_INFINITY
          const wave = computeWaveInfluence(dist)
          const widthPx = Number((BASE_WIDTH + (MAX_WIDTH - BASE_WIDTH) * wave).toFixed(1))
          const heightPx = wave > 0.72 ? 3 : wave > 0.28 ? 2.5 : 2

          return (
            <button
              key={item.id}
              type="button"
              data-outline-tick={item.id}
              data-active={isCurrent ? 'true' : 'false'}
              data-wave={wave.toFixed(2)}
              aria-label={item.title}
              onMouseEnter={() => {
                clearCloseTimer()
                setHoveredIdx(idx)
                setCursorRow((cur) => (cur === null ? idx : cur))
              }}
              onFocus={() => {
                clearCloseTimer()
                setHoveredIdx(idx)
                setCursorRow(idx)
              }}
              onClick={() => handleJump(item.id)}
              style={{ height: `${TICK_ROW_HEIGHT}px` }}
              className="tr-focus-ring flex w-9 items-center cursor-pointer rounded-sm"
            >
              <span
                style={{
                  width: `${widthPx}px`,
                  height: `${heightPx}px`,
                  transition:
                    'width 180ms cubic-bezier(0.22, 1, 0.36, 1), height 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms ease, opacity 180ms ease',
                }}
                className={cn(
                  'block rounded-full will-change-[width]',
                  isHovered
                    ? 'bg-[var(--text-primary)] opacity-100'
                    : isCurrent
                      ? 'bg-[var(--stage-solid)] opacity-100'
                      : wave > 0.25
                        ? 'bg-[var(--text-secondary)] opacity-75'
                        : 'bg-[var(--border-strong)] opacity-65',
                )}
              />
            </button>
          )
        })}

        {/* Single Floating Preview Card (ChatGPT Desktop style: shows ONLY the hovered tick, glides smoothly) */}
        {hoveredItem && hoveredIdx !== null && (
          <button
            type="button"
            data-outline-popover="true"
            data-outline-item={hoveredItem.id}
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
            onClick={() => handleJump(hoveredItem.id)}
            style={{
              top: `${previewCenterY}px`,
              transform: 'translateY(-50%)',
              transition: 'top 200ms cubic-bezier(0.22, 1, 0.36, 1), border-color 160ms ease, box-shadow 160ms ease',
            }}
            className="tr-focus-ring group absolute left-full ml-1 w-[264px] cursor-pointer rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]/96 px-3.5 py-2.5 text-left shadow-[var(--shadow-popover)] backdrop-blur-md hover:border-[var(--stage-border)] before:absolute before:-left-3 before:inset-y-0 before:w-3 before:content-['']"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13.5px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--stage-text)] transition-colors">
                {hoveredItem.title}
              </span>
              {hoveredItem.id === activeId ? (
                <span className="shrink-0 rounded-full bg-[var(--stage-soft)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[var(--stage-text)]">
                  {t('当前', 'Here')}
                </span>
              ) : (
                <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--text-muted)]">
                  {hoveredIdx + 1}/{items.length}
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
              {hoveredItem.desc}
            </p>
          </button>
        )}
      </div>
    </nav>
  )
}
