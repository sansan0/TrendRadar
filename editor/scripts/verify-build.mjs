import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const editorRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(editorRoot, '..')
const distDir = process.env.EDITOR_DIST_DIR
  ? path.resolve(process.env.EDITOR_DIST_DIR)
  : path.join(editorRoot, 'dist')
const distHtmlPath = path.join(distDir, 'index.html')
const enHtmlPath = path.join(distDir, 'en', 'index.html')
const assetsDir = path.join(distDir, 'assets')
const legacyDocsHtml = path.join(repoRoot, 'docs', 'index.html')

if (!fs.existsSync(distHtmlPath)) {
  console.error(`FAIL: Missing built ${distHtmlPath} — run "npm run build" first.`)
  process.exit(1)
}

const html = fs.readFileSync(distHtmlPath, 'utf8')
const htmlSizeKb = Buffer.byteLength(html, 'utf8') / 1024
const extScripts = html.match(/<script[^>]+src=['"]https?:\/\//gi) || []
const extLinks = html.match(/<link[^>]+rel=['"]stylesheet['"][^>]+href=['"]https?:\/\//gi) || []

const enHtmlExists = fs.existsSync(enHtmlPath)
const enHtml = enHtmlExists ? fs.readFileSync(enHtmlPath, 'utf8') : ''
const enHtmlSizeKb = enHtmlExists ? Buffer.byteLength(enHtml, 'utf8') / 1024 : 0
const enExtScripts = enHtml.match(/<script[^>]+src=['"]https?:\/\//gi) || []
const enExtLinks = enHtml.match(/<link[^>]+rel=['"]stylesheet['"][^>]+href=['"]https?:\/\//gi) || []
const enAssetRefs = [...enHtml.matchAll(/(?:src|href)=['"]\.\.\/assets\/([^'"]+)['"]/gi)].map((m) => m[1])
const enAssetsValid =
  enAssetRefs.length > 0 &&
  !/(?:src|href)=['"]\.\/(?:assets\/|favicon|apple-touch-icon)/i.test(enHtml) &&
  enAssetRefs.every((name) => fs.existsSync(path.join(assetsDir, name)))

const sitemapXml = fs.existsSync(path.join(distDir, 'sitemap.xml'))
  ? fs.readFileSync(path.join(distDir, 'sitemap.xml'), 'utf8')
  : ''
const llmsTxt = fs.existsSync(path.join(distDir, 'llms.txt'))
  ? fs.readFileSync(path.join(distDir, 'llms.txt'), 'utf8')
  : ''

const assetFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : []
const cssBundle = assetFiles
  .filter((f) => f.endsWith('.css'))
  .map((f) => fs.readFileSync(path.join(assetsDir, f), 'utf8'))
  .join('\n')
const jsBundle = assetFiles
  .filter((f) => f.endsWith('.js'))
  .map((f) => fs.readFileSync(path.join(assetsDir, f), 'utf8'))
  .join('\n')

console.log(`Built dist/index.html: ${htmlSizeKb.toFixed(1)} KB (${assetFiles.length} chunked assets)`)
console.log(`Built dist/en/index.html: ${enHtmlSizeKb.toFixed(1)} KB (${enAssetRefs.length} shared ../assets refs)`)
console.log(`External CDN <script>: ${extScripts.length + enExtScripts.length}`)
console.log(`External CDN <link stylesheet>: ${extLinks.length + enExtLinks.length}`)

function hasSharedProGrid(cssText) {
  const postcss = createRequire(import.meta.resolve('vite/package.json'))('postcss')
  const pairs = [['source-toolbar', 'form-toolbar'], ['source-files', 'form-navigation'], ['source-body', 'form-body']]
  const regions = ['divider', ...pairs.flat()]
  const selectors = new Set(['workspace', 'source-pane', 'form-pane', ...regions].map((name) => `.pro-${name}`))
  const rules = []
  postcss.parse(cssText).walkRules((rule) => {
    const targets = rule.selectors.filter((selector) => selectors.has(selector))
    if (!targets.length) return
    let parent = rule.parent
    while (parent && !(parent.type === 'atrule' && parent.name === 'media')) parent = parent.parent
    const media = parent?.params.replace(/\s+/g, '') ?? ''
    const declarations = Object.fromEntries(
      rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop, node.value]),
    )
    rules.push({ targets, media, declarations })
  })

  const grids = rules.filter((rule) => rule.targets.includes('.pro-workspace') && rule.declarations.display === 'grid')
  return grids.some(({ media }) => {
    const style = (name) =>
      Object.assign(
        {},
        ...rules
          .filter((rule) => (!rule.media || rule.media === media) && rule.targets.includes(`.pro-${name}`))
          .map((rule) => rule.declarations),
      )
    if (style('source-pane').display !== 'contents' || style('form-pane').display !== 'contents') return false

    const grid = style('workspace')
    const template = grid['grid-template'] ?? ''
    const areaStrings = /(["'])([^"']+)\1/g
    const areaRows = Array.from((grid['grid-template-areas'] ?? template).matchAll(areaStrings), ([, , row]) =>
      row.trim().split(/\s+/),
    )
    const rowSizes = grid['grid-template-rows'] ?? template.split('/')[0].replace(areaStrings, ' ')
    const tracks = postcss.list.space(rowSizes.toLowerCase().replace(/repeat\(\s*2\s*,\s*(auto|max-content)\s*\)/g, '$1 $1'))
    const isIntrinsic = (track) => track === 'auto' || track === 'max-content'
    if (
      tracks.length !== 3 ||
      !tracks.slice(0, 2).every(isIntrinsic) ||
      !/^minmax\(0(?:px|rem)?,1fr\)$/.test(tracks[2].replace(/\s+/g, ''))
    ) {
      return false
    }

    const area = (name) => style(name)['grid-area']?.split('/')[0].trim()
    const assigned = regions.map(area)
    return (
      assigned.every(Boolean) &&
      new Set(assigned).size === regions.length &&
      areaRows.length === pairs.length &&
      pairs.every(([left, right], i) => {
        const row = areaRows[i]
        return row.length === 3 && row[0] === area(left) && row[1] === area('divider') && row[2] === area(right)
      })
    )
  })
}

const checks = [
  ['lightweight index.html (< 50 KB for fast SEO & GEO crawling)', htmlSizeKb > 2 && htmlSizeKb < 50],
  ['lightweight en/index.html (< 50 KB with English lang & canonical)',
    enHtmlExists &&
    enHtmlSizeKb > 2 &&
    enHtmlSizeKb < 50 &&
    enHtml.includes('<html lang="en">') &&
    enHtml.includes('rel="canonical" href="https://sansan0.github.io/TrendRadar/en/"')],
  ['en/index.html resolves all shared ../assets/* and ../favicon* paths cleanly for GitHub Pages', enAssetsValid],
  ['reciprocal hreflang links between zh-CN (/) and en (/en/) on both pages',
    html.includes('hreflang="zh-CN" href="https://sansan0.github.io/TrendRadar/"') &&
    html.includes('hreflang="en" href="https://sansan0.github.io/TrendRadar/en/"') &&
    html.includes('href="./en/"') &&
    enHtml.includes('hreflang="zh-CN" href="https://sansan0.github.io/TrendRadar/"') &&
    enHtml.includes('hreflang="en" href="https://sansan0.github.io/TrendRadar/en/"') &&
    enHtml.includes('href="../"')],
  ['no legacy 1.8MB docs/index.html in repo', !fs.existsSync(legacyDocsHtml)],
  ['zero external scripts', extScripts.length === 0 && enExtScripts.length === 0],
  ['zero external stylesheets', extLinks.length === 0 && enExtLinks.length === 0],
  ['SEO canonical & JSON-LD structured data present on both zh and en entries',
    html.includes('rel="canonical"') &&
    html.includes('application/ld+json') &&
    enHtml.includes('application/ld+json') &&
    enHtml.includes('"inLanguage": "en"')],
  ['pre-rendered semantic #root shell present on both zh and en entries',
    html.includes('tr-seo-shell') && html.includes('<h1>') && enHtml.includes('tr-seo-shell') && enHtml.includes('<h1>')],
  ['SEO & GEO static files generated (.nojekyll, robots.txt, sitemap.xml, llms.txt) with bilingual URLs',
    ['.nojekyll', 'robots.txt', 'sitemap.xml', 'llms.txt'].every((f) => fs.existsSync(path.join(distDir, f))) &&
    sitemapXml.includes('<loc>https://sansan0.github.io/TrendRadar/</loc>') &&
    sitemapXml.includes('<loc>https://sansan0.github.io/TrendRadar/en/</loc>') &&
    llmsTxt.includes('https://sansan0.github.io/TrendRadar/en/')],
  ['unified favicon assets present',
    ['favicon-32x32.png', 'favicon-64x64.png', 'apple-touch-icon.png'].every((f) => fs.existsSync(path.join(distDir, f)))],
  ['contains trendradar.sandev.cc', jsBundle.includes('https://trendradar.sandev.cc')],
  ['contains sandev.cc', jsBundle.includes('https://sandev.cc')],
  ['contains ocr.sandev.cc', jsBundle.includes('https://ocr.sandev.cc')],
  ['contains bundled config.yaml', jsBundle.includes('TrendRadar 配置文件')],
  ['contains bundled timeline.yaml', jsBundle.includes('morning_evening')],
  ['professional panes share compact header rows and one flexible body row', hasSharedProGrid(cssBundle)],
]

let failed = false
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`)
  if (!ok) failed = true
}

function walk(dir) {
  const out = []
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === '__tests__') continue
      out.push(...walk(p))
    } else if (/\.(ts|tsx)$/.test(ent.name)) {
      out.push(p)
    }
  }
  return out
}

const emojiRx = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu
const emojiHits = []
const gradientHits = []
for (const file of walk(path.join(editorRoot, 'src'))) {
  const txt = fs.readFileSync(file, 'utf8')
  const matches = txt.match(emojiRx)
  if (matches) {
    emojiHits.push({ file: path.relative(editorRoot, file), chars: [...new Set(matches)] })
  }
  if (/bg-gradient-to-/.test(txt)) {
    gradientHits.push(path.relative(editorRoot, file))
  }
}

if (emojiHits.length > 0) {
  console.log('FAIL: Emoji detected in editor/src:', JSON.stringify(emojiHits))
  failed = true
} else {
  console.log('PASS: Zero emojis across all editor/src TypeScript/TSX source files')
}

if (gradientHits.length > 0) {
  console.log('FAIL: bg-gradient-to-* detected in editor/src:', JSON.stringify(gradientHits))
  failed = true
} else {
  console.log('PASS: Zero bg-gradient-to-* utility gradients across editor/src')
}

if (failed) process.exit(1)
