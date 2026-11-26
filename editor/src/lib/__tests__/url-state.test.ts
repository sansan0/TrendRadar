import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDocumentTitle,
  buildEditorUrl,
  buildPathForLang,
  canSyncBrowserUrl,
  getCanonicalUrlForLang,
  parseEditorUrl,
  splitLocalizedPathname,
} from '../url-state.ts'

test('splitLocalizedPathname and buildPathForLang preserve root and GitHub Pages subpaths', () => {
  assert.deepEqual(splitLocalizedPathname('/'), { basePath: '/', isEnglish: false })
  assert.deepEqual(splitLocalizedPathname('/en/'), { basePath: '/', isEnglish: true })
  assert.deepEqual(splitLocalizedPathname('/en'), { basePath: '/', isEnglish: true })
  assert.deepEqual(splitLocalizedPathname('/en/index.html'), { basePath: '/', isEnglish: true })

  // GitHub Pages project site: https://sansan0.github.io/TrendRadar/
  assert.deepEqual(splitLocalizedPathname('/TrendRadar/'), { basePath: '/TrendRadar/', isEnglish: false })
  assert.deepEqual(splitLocalizedPathname('/TrendRadar'), { basePath: '/TrendRadar/', isEnglish: false })
  assert.deepEqual(splitLocalizedPathname('/TrendRadar/en/'), { basePath: '/TrendRadar/', isEnglish: true })
  assert.deepEqual(splitLocalizedPathname('/TrendRadar/en'), { basePath: '/TrendRadar/', isEnglish: true })
  assert.deepEqual(splitLocalizedPathname('/TrendRadar/en/index.html'), { basePath: '/TrendRadar/', isEnglish: true })

  assert.equal(buildPathForLang('/TrendRadar/', 'en'), '/TrendRadar/en/')
  assert.equal(buildPathForLang('/TrendRadar/en/', 'zh'), '/TrendRadar/')
  assert.equal(buildPathForLang('/', 'en'), '/en/')
  assert.equal(buildPathForLang('/en/', 'zh'), '/')
})

test('parseEditorUrl handles bilingual paths, deep-link queries, smart inference, and invalid values', () => {
  const zhRoot = parseEditorUrl({ protocol: 'https:', pathname: '/TrendRadar/', search: '' })
  assert.equal(zhRoot.lang, 'zh')
  assert.equal(zhRoot.pathLang, 'zh')
  assert.equal(zhRoot.hasExplicitRoute, false)
  assert.equal(zhRoot.workspaceMode, null)

  const enPush = parseEditorUrl({ protocol: 'https:', pathname: '/TrendRadar/en/', search: '?section=push' })
  assert.equal(enPush.lang, 'en')
  assert.equal(enPush.workspaceMode, 'guided')
  assert.equal(enPush.section, 'push')
  assert.equal(enPush.hasExplicitRoute, true)

  const searchTab = parseEditorUrl({ protocol: 'https:', pathname: '/', search: '?tab=search' })
  assert.equal(searchTab.workspaceMode, 'guided')
  assert.equal(searchTab.section, 'sources')
  assert.equal(searchTab.sourcesSubTab, 'search')

  const proFile = parseEditorUrl({ protocol: 'https:', pathname: '/TrendRadar/en/', search: '?file=timeline.yaml' })
  assert.equal(proFile.workspaceMode, 'pro')
  assert.equal(proFile.proView, 'file')
  assert.equal(proFile.file, 'timeline.yaml')

  const proSection = parseEditorUrl({ protocol: 'https:', pathname: '/', search: '?mode=pro&section=filter' })
  assert.equal(proSection.workspaceMode, 'pro')
  assert.equal(proSection.proView, 'features')
  assert.equal(proSection.section, 'filter')

  const invalid = parseEditorUrl({ protocol: 'https:', pathname: '/', search: '?mode=nope&section=bad&file=evil.txt&tab=x' })
  assert.equal(invalid.workspaceMode, null)
  assert.equal(invalid.section, null)
  assert.equal(invalid.file, null)
  assert.equal(invalid.sourcesSubTab, null)
  assert.equal(invalid.hasExplicitRoute, false)
})

test('file:// standalone single-file HTML disables browser URL rewriting safely', () => {
  const fileLoc = { protocol: 'file:', pathname: '/D:/code/editor/dist-single/index.html', search: '' }
  assert.equal(canSyncBrowserUrl(fileLoc), false)
  const parsed = parseEditorUrl(fileLoc)
  assert.equal(parsed.lang, null)
  assert.equal(parsed.pathLang, null)
})

test('buildEditorUrl omits default values and preserves GitHub Pages basePath', () => {
  assert.equal(
    buildEditorUrl('/TrendRadar/', {
      lang: 'zh',
      workspaceMode: 'guided',
      proView: 'file',
      activeSection: 'onboarding',
      sourcesSubTab: 'hotlist',
      activeSourceFile: 'config.yaml',
    }),
    '/TrendRadar/',
  )

  assert.equal(
    buildEditorUrl('/TrendRadar/', {
      lang: 'en',
      workspaceMode: 'guided',
      proView: 'file',
      activeSection: 'sources',
      sourcesSubTab: 'search',
      activeSourceFile: 'config.yaml',
    }),
    '/TrendRadar/en/?section=sources&tab=search',
  )

  assert.equal(
    buildEditorUrl('/TrendRadar/en/', {
      lang: 'zh',
      workspaceMode: 'pro',
      proView: 'file',
      activeSection: 'sources',
      sourcesSubTab: 'hotlist',
      activeSourceFile: 'timeline.yaml',
    }),
    '/TrendRadar/?mode=pro&file=timeline.yaml',
  )

  assert.equal(
    buildEditorUrl('/TrendRadar/', {
      lang: 'en',
      workspaceMode: 'pro',
      proView: 'features',
      activeSection: 'push',
      sourcesSubTab: 'hotlist',
      activeSourceFile: 'timeline.yaml',
    }),
    '/TrendRadar/en/?mode=pro&view=features&section=push&file=timeline.yaml',
  )
})

test('canonical URL and document titles match active language and section', () => {
  assert.equal(getCanonicalUrlForLang('zh'), 'https://sansan0.github.io/TrendRadar/')
  assert.equal(getCanonicalUrlForLang('en'), 'https://sansan0.github.io/TrendRadar/en/')

  const titleEn = buildDocumentTitle({
    lang: 'en',
    workspaceMode: 'guided',
    proView: 'file',
    activeSection: 'push',
    sourcesSubTab: 'hotlist',
    activeSourceFile: 'config.yaml',
  })
  assert.ok(titleEn.includes('Notifications & Schedule'))
  assert.ok(titleEn.includes('TrendRadar Visual Config Studio'))
})

test('parseEditorUrl and buildEditorUrl support all 8 languages cleanly via ?lang= for extra locales', () => {
  for (const extra of ['zh-TW', 'de', 'ja', 'ko', 'ru', 'tr'] as const) {
    const built = buildEditorUrl('/TrendRadar/en/', {
      lang: extra,
      workspaceMode: 'guided',
      proView: 'file',
      activeSection: 'push',
      sourcesSubTab: 'hotlist',
      activeSourceFile: 'config.yaml',
    })
    assert.equal(built, `/TrendRadar/?lang=${extra}&section=push`)

    const parsed = parseEditorUrl({
      protocol: 'https:',
      pathname: '/TrendRadar/',
      search: `?lang=${extra}&section=push`,
    })
    assert.equal(parsed.lang, extra)
    assert.equal(parsed.section, 'push')
    assert.equal(getCanonicalUrlForLang(extra), `https://sansan0.github.io/TrendRadar/?lang=${extra}`)
  }
})
