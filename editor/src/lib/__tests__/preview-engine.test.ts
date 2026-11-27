import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { buildTrendRadarPreview, calculateNewsWeight } from '../preview-engine.ts'
import { TRENDRADAR_REPORT_CSS, TRENDRADAR_REPORT_JS } from '../preview-report-assets.ts'
import type { ConfigFilesMap } from '../types.ts'
import { setYamlValues } from '../yaml-doc.ts'

function getDefaultFiles(_lang?: 'zh' | 'en'): ConfigFilesMap {
  const read = (name: string) =>
    readFileSync(new URL(`../../../../config/${name}`, import.meta.url), 'utf8')
  return {
    'config.yaml': read('config.yaml'),
    'frequency_words.txt': read('frequency_words.txt'),
    'search_queries.txt': read('search_queries.txt'),
    'timeline.yaml': read('timeline.yaml'),
    'ai_interests.txt': read('ai_interests.txt'),
    'ai_analysis_prompt.txt': read('ai_analysis_prompt.txt'),
    'ai_translation_prompt.txt': read('ai_translation_prompt.txt'),
  }
}

describe('preview-engine: weight formula mirrors trendradar/core/analyzer.py', () => {
  it('computes exact weighted rank, frequency, and hotness score', () => {
    const score = calculateNewsWeight(
      [1, 2, 1],
      6,
      5,
      { rank: 0.6, frequency: 0.3, hotness: 0.1 },
    )
    // rank_weight = ((10 + 9 + 10) / 3) * 10 = 96.666666...
    // freq_weight = 6 * 10 = 60
    // hot_weight = (3 / 3) * 100 = 100
    // total = 96.666666... * 0.6 + 60 * 0.3 + 100 * 0.1 = 58 + 18 + 10 = 86
    assert.ok(Math.abs(score - 86) < 1e-6, `Expected 86, got ${score}`)
  })

  it('caps ranks beyond 10 to weight 1 and handles zero high-rank hits', () => {
    const score = calculateNewsWeight(
      [15, 20],
      2,
      5,
      { rank: 0.6, frequency: 0.3, hotness: 0.1 },
    )
    // rank_weight = ((1 + 1) / 2) * 10 = 10
    // freq_weight = 20
    // hot_weight = 0
    // total = 6 + 6 + 0 = 12
    assert.ok(Math.abs(score - 12) < 1e-6, `Expected 12, got ${score}`)
  })
})

describe('preview-engine: live config reactivity & Desktop HTML rendering', () => {
  it('renders desktop wide-mode HTML by default and toggles dark/narrow classes cleanly', () => {
    const files = getDefaultFiles('zh')
    const wideLight = buildTrendRadarPreview(files, { lang: 'zh', wideMode: true, darkMode: false })
    assert.ok(wideLight.html.includes('<body class="wide-mode" data-preview-wide="1" data-preview-dark="0">'))
    assert.ok(wideLight.html.includes('TrendRadar'))
    assert.ok(wideLight.summary.hotlistCount >= 10, `Expected rich default hotlist, got ${wideLight.summary.hotlistCount}`)
    assert.ok(wideLight.summary.rssCount >= 3, `Expected rich default RSS with max_age_days=1, got ${wideLight.summary.rssCount}`)
    assert.equal(wideLight.html.includes('申奥 最新动态与行业深度解读'), false, 'Default stock template should not flood with synthetic filler tabs')

    const narrowDark = buildTrendRadarPreview(files, { lang: 'zh', wideMode: false, darkMode: true })
    assert.ok(narrowDark.html.includes('<body class="dark-mode" data-preview-wide="0" data-preview-dark="1">'))
    assert.equal(narrowDark.html.includes('class="wide-mode"'), false)
  })

  it('preserves 1:1 verbatim trendradar/report/html.py CSS, DOM structure, and valid offline JS', () => {
    // Extracted JS must parse cleanly with zero syntax errors
    assert.doesNotThrow(() => new Function(TRENDRADAR_REPORT_JS))
    // Verbatim CSS must preserve the full ~3,200-line stylesheet from trendradar/report/html.py
    assert.ok(TRENDRADAR_REPORT_CSS.split('\n').length > 2500)
    for (const selector of [
      '.header-watermark',
      '.save-dropdown-menu',
      '.metric-tooltip',
      '.section-nav-indicator',
      '.rank-popover',
      '.fab-dock',
      '.ai-block-icon-wrap',
      'body.wide-mode',
      'body.dark-mode',
    ]) {
      assert.ok(TRENDRADAR_REPORT_CSS.includes(selector), `Missing authentic CSS selector: ${selector}`)
    }

    const files = getDefaultFiles('zh')
    const res = buildTrendRadarPreview(files, { lang: 'zh', wideMode: true, darkMode: false })
    for (const marker of [
      'class="reading-progress"',
      'class="header-watermark"',
      'class="save-dropdown-menu"',
      'class="search-box"',
      'class="section-nav-track"',
      'class="tab-bar-wrapper"',
      'class="feed-group"',
      'class="card-copy-btn"',
      'class="ai-blocks-grid"',
      'id="rank-timeline-popover"',
      'class="fab-progress-svg"',
    ]) {
      assert.ok(res.html.includes(marker), `Missing authentic DOM marker: ${marker}`)
    }
    assert.equal(res.html.includes('<script src="http'), false, 'Preview HTML must not load external CDN scripts')
  })

  it('reacts live to report.mode, report.display_mode, and display.region_order', () => {
    const base = getDefaultFiles('zh')
    const updatedCfg = setYamlValues(base['config.yaml'], [
      { path: ['report', 'mode'], value: 'daily' },
      { path: ['report', 'display_mode'], value: 'platform' },
      { path: ['display', 'regions', 'rss'], value: true },
      { path: ['display', 'region_order'], value: ['rss', 'hotlist', 'ai_analysis', 'new_items', 'web_search', 'standalone'] },
    ])
    const res = buildTrendRadarPreview(
      { ...base, 'config.yaml': updatedCfg },
      { lang: 'zh', wideMode: true, darkMode: false },
    )
    assert.equal(res.summary.mode, 'daily')
    assert.equal(res.summary.displayMode, 'platform')
    assert.ok(res.html.includes('全天汇总'))
    const rssPos = res.html.indexOf('id="region-rss"')
    const hotPos = res.html.indexOf('id="region-hotlist"')
    assert.ok(rssPos > 0 && hotPos > 0 && rssPos < hotPos, 'RSS section should render before Hotlist per region_order')
  })

  it('synthesizes matching items for user-added custom keyword groups and respects [GLOBAL_FILTER]', () => {
    const base = getDefaultFiles('zh')
    const customFreq = [
      '[GLOBAL_FILTER]',
      'DeepSeek',
      '',
      '[WORD_GROUPS]',
      '[量子计算]',
      '量子比特',
    ].join('\n')
    const res = buildTrendRadarPreview(
      { ...base, 'frequency_words.txt': customFreq },
      { lang: 'zh', wideMode: true, darkMode: false },
    )
    assert.ok(res.html.includes('量子计算'))
    assert.equal(res.html.includes('DeepSeek 发布新一代开源大模型'), false)
  })

  it('switches to 4+3 header layout when web_search is enabled and renders custom topics', () => {
    const base = getDefaultFiles('zh')
    const cfg = setYamlValues(base['config.yaml'], [
      { path: ['web_search', 'enabled'], value: true },
      { path: ['display', 'regions', 'web_search'], value: true },
    ])
    const queries = '[半导体出口政策]\nAI 芯片 出口管制\n'
    const res = buildTrendRadarPreview(
      { ...base, 'config.yaml': cfg, 'search_queries.txt': queries },
      { lang: 'zh', wideMode: true, darkMode: false },
    )
    assert.ok(res.summary.searchCount > 0)
    assert.ok(res.html.includes('header-sources-bar'))
    assert.ok(res.html.includes('半导体出口政策'))
  })

  it('supports AI smart filter mode, AI analysis blocks, standalone showcase, and translation', () => {
    const base = getDefaultFiles('zh')
    const cfg = setYamlValues(base['config.yaml'], [
      { path: ['filter', 'method'], value: 'ai' },
      { path: ['ai_analysis', 'enabled'], value: true },
      { path: ['ai_analysis', 'include_rss'], value: true },
      { path: ['display', 'regions', 'ai_analysis'], value: true },
      { path: ['display', 'regions', 'standalone'], value: true },
      { path: ['display', 'standalone', 'platforms'], value: ['zhihu'] },
      { path: ['ai_translation', 'enabled'], value: true },
      { path: ['ai_translation', 'language'], value: 'English' },
      { path: ['ai_translation', 'scope', 'hotlist'], value: true },
    ])
    const res = buildTrendRadarPreview(
      { ...base, 'config.yaml': cfg },
      { lang: 'zh', wideMode: true, darkMode: false },
    )
    assert.equal(res.summary.filterMethod, 'ai')
    assert.equal(res.summary.aiEnabled, true)
    assert.equal(res.summary.translationEnabled, true)
    assert.ok(res.summary.standaloneCount > 0)
    assert.ok(res.html.includes('id="region-ai_analysis"'))
    assert.ok(res.html.includes('id="region-standalone"'))
    assert.ok(res.html.includes('DeepSeek unveils next-gen open-source LLM'))
  })

  it('safely escapes HTML/XSS payloads in custom keyword groups and search queries', () => {
    const base = getDefaultFiles('zh')
    const cfg = setYamlValues(base['config.yaml'], [
      { path: ['web_search', 'enabled'], value: true },
      { path: ['display', 'regions', 'web_search'], value: true },
    ])
    const xssFreq = '[WORD_GROUPS]\n[<img src=x onerror=alert(1)>]\n<script>alert("xss")</script>\n'
    const xssSearch = '[<script>evil()</script>]\n<b>query</b>\n'
    const res = buildTrendRadarPreview(
      {
        ...base,
        'config.yaml': cfg,
        'frequency_words.txt': xssFreq,
        'search_queries.txt': xssSearch,
      },
      { lang: 'zh', wideMode: true, darkMode: false },
    )
    assert.equal(res.html.includes('<script>alert("xss")</script>'), false)
    assert.equal(res.html.includes('<script>evil()</script>'), false)
    assert.equal(res.html.includes('<img src=x onerror=alert(1)>'), false)
    assert.ok(res.html.includes('&lt;script&gt;'))
  })
})
