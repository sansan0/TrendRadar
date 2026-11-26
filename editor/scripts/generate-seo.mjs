import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = process.env.EDITOR_DIST_DIR
  ? path.resolve(process.env.EDITOR_DIST_DIR)
  : path.resolve(__dirname, '../dist')
const SITE_URL = 'https://sansan0.github.io/TrendRadar/'
const EN_SITE_URL = `${SITE_URL}en/`
const today = new Date().toISOString().slice(0, 10)

fs.mkdirSync(distDir, { recursive: true })

// 0. Generate independent English static entry (dist/en/index.html) sharing ../assets/* chunks
const zhHtmlPath = path.join(distDir, 'index.html')
if (!fs.existsSync(zhHtmlPath)) {
  throw new Error(`Missing built ${zhHtmlPath} — run vite build before generate-seo.mjs`)
}
const zhHtml = fs.readFileSync(zhHtmlPath, 'utf8')

const viteAssetTags = [
  ...(zhHtml.match(/<script\b[^>]*\bsrc=['"]\.\/assets\/[^'"]+['"][^>]*><\/script>/gi) || []),
  ...(zhHtml.match(/<link\b[^>]*\bhref=['"]\.\/assets\/[^'"]+['"][^>]*>/gi) || []),
].map((tag) => tag.replace(/(src|href)=(['"])\.\/assets\//gi, '$1=$2../assets/'))

if (viteAssetTags.length === 0) {
  throw new Error(`No Vite ./assets/ script or link tags found in ${zhHtmlPath}`)
}

const enHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Primary SEO & GEO Meta -->
    <title>TrendRadar Visual Config Studio | Online config.yaml, Keyword Rules &amp; Schedule Editor</title>
    <meta
      name="description"
      content="Official browser-based visual configuration studio for TrendRadar. Edit and validate config.yaml, frequency_words.txt keyword DSL rules, search_queries.txt web search topics, timeline.yaml 7x24h push schedules, and AI prompts locally with zero data uploads."
    />
    <meta
      name="keywords"
      content="TrendRadar, TrendRadar Config Editor, TrendRadar Visual Config Studio, config.yaml generator, frequency_words.txt, search_queries.txt, timeline.yaml, news aggregator config, RSS feed editor, AI news filter, MCP Server"
    />
    <meta name="author" content="sansan0 / TrendRadar" />
    <meta name="application-name" content="TrendRadar Visual Config Studio" />
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
    <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
    <meta name="theme-color" content="#307da7" />
    <meta name="color-scheme" content="light dark" />

    <!-- Canonical & Multilingual Alternates -->
    <link rel="canonical" href="${EN_SITE_URL}" />
    <link rel="alternate" hreflang="zh-CN" href="${SITE_URL}" />
    <link rel="alternate" hreflang="en" href="${EN_SITE_URL}" />
    <link rel="alternate" hreflang="x-default" href="${SITE_URL}" />

    <!-- App Icons (Shared with root build for GitHub Pages subpath compatibility) -->
    <link rel="icon" type="image/png" sizes="32x32" href="../favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="64x64" href="../favicon-64x64.png" />
    <link rel="shortcut icon" href="../favicon.ico" />
    <link rel="apple-touch-icon" sizes="180x180" href="../apple-touch-icon.png" />

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="TrendRadar" />
    <meta property="og:title" content="TrendRadar Visual Config Studio | Online Configuration Editor" />
    <meta
      property="og:description"
      content="Edit and validate all 7 TrendRadar configuration files in your browser — hotlists, RSS feeds, scheduled web search, keyword DSL rules, AI filtering, 7x24h push timelines, and multi-channel notifications with zero server uploads."
    />
    <meta property="og:url" content="${EN_SITE_URL}" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:locale:alternate" content="zh_CN" />
    <meta property="og:image" content="https://trendradar.sandev.cc/images/og-image.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="TrendRadar Visual Config Studio" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="TrendRadar Visual Config Studio | Online Configuration Editor" />
    <meta
      name="twitter:description"
      content="Online visual configuration studio for TrendRadar — edit config.yaml, keyword rules, web search topics, and 7x24h push timelines locally in your browser."
    />
    <meta name="twitter:image" content="https://trendradar.sandev.cc/images/og-image.png" />

    <!-- Structured Data (Schema.org WebApplication + FAQPage for Google Rich Results & AI / GEO) -->
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebApplication",
            "@id": "${EN_SITE_URL}#webapp",
            "name": "TrendRadar Visual Config Studio",
            "alternateName": "TrendRadar Config Editor",
            "url": "${EN_SITE_URL}",
            "applicationCategory": "DeveloperApplication",
            "operatingSystem": "Any (Web Browser)",
            "browserRequirements": "Requires modern JavaScript-enabled browser",
            "inLanguage": "en",
            "isAccessibleForFree": true,
            "license": "https://opensource.org/licenses/GPL-3.0",
            "description": "Official client-side visual configuration studio for TrendRadar supporting step-by-step Guided Mode and side-by-side Pro Mode for config.yaml, frequency_words.txt, search_queries.txt, timeline.yaml, and AI prompt templates.",
            "author": {
              "@type": "Person",
              "@id": "https://sandev.cc/#person",
              "name": "sansan",
              "url": "https://sandev.cc/"
            },
            "isPartOf": {
              "@type": "SoftwareApplication",
              "@id": "https://trendradar.sandev.cc/#software",
              "name": "TrendRadar",
              "url": "https://trendradar.sandev.cc/en/",
              "sameAs": [
                "https://github.com/sansan0/TrendRadar",
                "https://hub.docker.com/r/wantcat/trendradar"
              ]
            },
            "featureList": [
              "Guided Mode step-by-step setup and Pro Mode side-by-side YAML/DSL live sync",
              "Visual editing and validation for config.yaml, frequency_words.txt, search_queries.txt, timeline.yaml, and AI prompts",
              "Interactive 7x24h push schedule timeline editor with cross-midnight overlap detection",
              "Live keyword rule and regex headline matching sandbox",
              "100% client-side execution with automatic secret sanitization for GitHub Actions and Docker exports"
            ],
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            }
          },
          {
            "@type": "FAQPage",
            "@id": "${EN_SITE_URL}#faq",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "Which TrendRadar configuration files does Visual Config Studio support?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "It supports live editing and validation for all 7 TrendRadar configuration files: config.yaml (core settings), frequency_words.txt (keyword matching and global filter rules), search_queries.txt (scheduled web search topics), timeline.yaml (7x24h push schedules), plus ai_interests.txt, ai_analysis_prompt.txt, and ai_translation_prompt.txt."
                }
              },
              {
                "@type": "Question",
                "name": "Are my API keys or notification webhook secrets uploaded to a server?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "No. The studio runs 100% locally in your browser as a static client-side app. Drafts and version snapshots stay in your browser localStorage, and GitHub Actions exports automatically sanitize secrets to prevent leaks."
                }
              },
              {
                "@type": "Question",
                "name": "What is the difference between Guided Mode and Pro Mode?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Guided Mode walks new users step by step through Sources, Filtering, AI, Report Layout, Notifications & Schedule, and Storage with trial file copy helpers. Pro Mode pairs a CodeMirror source pane on the left with synced field forms or visual panels on the right, plus granular change tracking and per-item restore."
                }
              }
            ]
          }
        ]
      }
    </script>

    <style>
      @keyframes trSeoFallbackReveal {
        to {
          opacity: 1;
        }
      }
      .tr-seo-shell {
        max-width: 52rem;
        margin: 8vh auto;
        padding: 1.5rem;
        font-family: system-ui, -apple-system, sans-serif;
        line-height: 1.7;
        color: #4b5563;
        opacity: 0;
        animation: trSeoFallbackReveal 0.2s ease 0.45s forwards;
      }
      .dark .tr-seo-shell {
        color: #9ca3af;
      }
      .tr-seo-shell h1 {
        font-size: 1.5rem;
        margin: 0 0 0.75rem;
        color: #1d2433;
      }
      .dark .tr-seo-shell h1 {
        color: #e6edf3;
      }
      .tr-seo-shell a {
        color: #307da7;
      }
    </style>

    <script>
      ;(function () {
        try {
          var saved = localStorage.getItem('tr_editor_theme')
          var isDark =
            saved === 'dark' ||
            (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
          if (isDark) {
            document.documentElement.classList.add('dark')
            document.documentElement.setAttribute('data-theme', 'dark')
          } else {
            document.documentElement.setAttribute('data-theme', 'light')
          }
        } catch (e) {}
      })()
    </script>
    ${viteAssetTags.join('\n    ')}
  </head>
  <body>
    <div id="root">
      <main class="tr-seo-shell">
        <h1>TrendRadar Visual Config Studio</h1>
        <p>
          Official client-side visual configuration studio for <strong>TrendRadar</strong> — configure hotlist platforms, RSS feeds, scheduled web search, keyword DSL rules, AI semantic filtering, multi-channel notifications, and 7x24h push timelines directly in your browser with zero server uploads.
        </p>
        <h2>Supported Configuration Files</h2>
        <ul>
          <li><code>config/config.yaml</code> — Hotlist platforms, RSS/Atom feeds, web search, shared LiteLLM AI engine, report layout, Feishu/DingTalk/WeCom/Telegram/Email/Slack/Bark/ntfy notifications, and SQLite/S3 storage</li>
          <li><code>config/frequency_words.txt</code> — Zero-cost keyword priority groups, <code>+</code> required terms, <code>!</code> exclusions, regex rules, and a live headline matching sandbox</li>
          <li><code>config/search_queries.txt</code> — Scheduled web search topics, site exclusions, and result filters</li>
          <li><code>config/timeline.yaml</code> — Interactive 7x24h weekly push and silent AI schedule presets</li>
          <li><code>config/ai_interests.txt</code> &amp; Prompt Templates — AI semantic filter profile, trend analysis, and multi-language translation prompts</li>
        </ul>
        <p>
          <a href="../" hreflang="zh-CN" lang="zh-CN">中文版</a> ·
          <a href="https://trendradar.sandev.cc/en/">Official Website</a> ·
          <a href="https://trendradar.sandev.cc/en/docs/quick-start/">Quick Start Docs</a> ·
          <a href="https://github.com/sansan0/TrendRadar">GitHub (sansan0/TrendRadar)</a> ·
          <a href="https://sandev.cc/">Author Blog (sandev.cc)</a>
        </p>
      </main>
    </div>
  </body>
</html>
`

const enDir = path.join(distDir, 'en')
fs.mkdirSync(enDir, { recursive: true })
fs.writeFileSync(path.join(enDir, 'index.html'), enHtml, 'utf8')

// 1. Disable Jekyll processing on GitHub Pages so dot/asset files serve cleanly
fs.writeFileSync(path.join(distDir, '.nojekyll'), '')

// 2. robots.txt — explicitly allow Google, Bing, and major AI search crawlers (GEO)
const robotsTxt = [
  'User-agent: *',
  'Allow: /',
  '',
  'User-agent: Googlebot',
  'Allow: /',
  '',
  'User-agent: Bingbot',
  'Allow: /',
  '',
  'User-agent: GPTBot',
  'Allow: /',
  '',
  'User-agent: OAI-SearchBot',
  'Allow: /',
  '',
  'User-agent: ChatGPT-User',
  'Allow: /',
  '',
  'User-agent: ClaudeBot',
  'Allow: /',
  '',
  'User-agent: PerplexityBot',
  'Allow: /',
  '',
  `Sitemap: ${SITE_URL}sitemap.xml`,
  '',
].join('\n')
fs.writeFileSync(path.join(distDir, 'robots.txt'), robotsTxt, 'utf8')

// 3. sitemap.xml — independent zh-CN and en canonical URLs with reciprocal hreflang annotations
const hreflangBlock = `    <xhtml:link rel="alternate" hreflang="zh-CN" href="${SITE_URL}" />
    <xhtml:link rel="alternate" hreflang="en" href="${EN_SITE_URL}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}" />`

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${SITE_URL}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
${hreflangBlock}
  </url>
  <url>
    <loc>${EN_SITE_URL}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
${hreflangBlock}
  </url>
</urlset>
`
fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf8')

// 4. llms.txt — structured Markdown index for Generative Engine Optimization (GEO / LLMs)
const llmsTxt = `# TrendRadar Visual Config Studio (TrendRadar 可视化配置编辑器)

> Official browser-based visual configuration studio for TrendRadar — an open-source AI-powered news aggregation, filtering, web search, and multi-channel push notification tool.

TrendRadar 可视化配置编辑器是 TrendRadar 开源项目的官方纯前端在线配置工作台，100% 在本地浏览器运行，零服务器上传，支持独立中/英文入口、新手分步引导模式（Guided Mode）与双栏源码联动专业模式（Pro Mode）。

- Live Web App (中文): ${SITE_URL}
- Live Web App (English): ${EN_SITE_URL}
- Official Website & Docs (中文): https://trendradar.sandev.cc/zh/
- Official Website & Docs (English): https://trendradar.sandev.cc/en/
- GitHub Repository: https://github.com/sansan0/TrendRadar
- Docker Hub: https://hub.docker.com/r/wantcat/trendradar
- Author Blog: https://sandev.cc/
- License: GPL-3.0

## Deep-Link Entry Points (支持参数直达对应面板与文件)

Both \`${SITE_URL}\` (Chinese) and \`${EN_SITE_URL}\` (English) support clean query-parameter deep links:

- \`?section=sources\` (\`&tab=hotlist|rss|search\`): Hotlists, RSS feeds, and scheduled web search
- \`?section=filter\`: Keyword DSL rules (\`frequency_words.txt\`) and AI interest filter (\`ai_interests.txt\`)
- \`?section=ai\`: Shared AI provider, deep analysis, and translation prompts
- \`?section=report\`: Push modes, display regions, and ranking weights
- \`?section=push\`: 9+ notification channels and 7x24h \`timeline.yaml\` schedule editor
- \`?section=storage\`: Local SQLite/HTML, S3/R2 remote storage, and system runtime options
- \`?mode=pro\` (\`&file=config.yaml|timeline.yaml|frequency_words.txt|search_queries.txt|ai_interests.txt|ai_analysis_prompt.txt|ai_translation_prompt.txt\`): Side-by-side CodeMirror + synced fields Pro Mode

## Supported Configuration Files (支持双向编辑与校验的 7 份配置文件)

- \`config/config.yaml\`: Master configuration covering hotlist platforms, RSS/Atom feeds, scheduled web search (\`web_search\`), shared LiteLLM AI engine (\`ai\`), report push modes (\`daily\` / \`current\` / \`incremental\`), 10+ notification channels (WeCom, Feishu, DingTalk, Telegram, Email, Bark, ntfy, Slack, Webhook), and SQLite / S3-compatible cloud storage.
- \`config/frequency_words.txt\`: Zero-cost keyword matching DSL supporting priority groups, \`=>\` display aliases, \`+\` required terms, \`!\` exclusions, \`/regex/\` patterns, \`@N\` per-group limits, \`[GLOBAL_FILTER]\` blocklists, and a live headline test sandbox.
- \`config/search_queries.txt\`: Scheduled web search topics, per-topic exclusions, site filters (\`-site:\`), and result limits.
- \`config/timeline.yaml\`: Interactive 7x24h weekly schedule presets (\`always_on\`, \`morning_evening\`, \`office_hours\`, \`night_owl\`, \`custom\`) with cross-midnight window support and overlap validation.
- \`config/ai_interests.txt\`: Plain-language interest profile for AI semantic filtering and relevance scoring (\`filter.method: "ai"\`).
- \`config/ai_analysis_prompt.txt\`: Customizable system/user prompt template for AI trend summaries.
- \`config/ai_translation_prompt.txt\`: Customizable prompt template for multi-language headline translation.

## Key Capabilities

- **Dual Workspace Modes**: Switch anytime between step-by-step Guided Mode for quick onboarding and side-by-side Pro Mode (CodeMirror YAML/DSL source synced live with focused field forms and visual controls).
- **Change Review & Granular Restore**: Inspect numbered edit history (\`#N..#1\`), compare against bundled or imported templates, and restore individual fields or whole files in one click.
- **Deployment Guardrails**: Built-in health checks for Docker, GitHub Actions, and local \`uv\` Python deployments, including automatic secret sanitization before copying or exporting for public repositories.
`
fs.writeFileSync(path.join(distDir, 'llms.txt'), llmsTxt, 'utf8')

console.log('Generated bilingual entry (en/index.html) & SEO/GEO files in dist/: .nojekyll, robots.txt, sitemap.xml, llms.txt')
