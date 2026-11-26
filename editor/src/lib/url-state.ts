import {
  ALL_CONFIG_FILES,
  type ConfigFileKey,
  type Lang,
  type SectionId,
  type SourcesSubTab,
  type WorkspaceMode,
} from './types.ts'
import { normalizeLang } from '../i18n/languages.ts'
import { tr } from '../i18n/translate.ts'

export type UrlProView = 'file' | 'features'

export interface ParsedEditorUrl {
  /** Language explicitly inferred from URL path (`/en/`) or `?lang=` query, or null on `file:` without query. */
  lang: Lang | null
  /** Explicit language from path (`/en/` vs root) on HTTP(S), used to override stale localStorage. */
  pathLang: Lang | null
  workspaceMode: WorkspaceMode | null
  proView: UrlProView | null
  section: SectionId | null
  sourcesSubTab: SourcesSubTab | null
  file: ConfigFileKey | null
  /** True when the URL contains explicit navigation query parameters. */
  hasExplicitRoute: boolean
}

export interface EditorUrlState {
  lang: Lang
  workspaceMode: WorkspaceMode
  proView: UrlProView
  activeSection: SectionId
  sourcesSubTab: SourcesSubTab
  activeSourceFile: ConfigFileKey
}

export interface LocationLike {
  protocol: string
  pathname: string
  search: string
  hash?: string
}

const VALID_SECTIONS = new Set<SectionId>([
  'onboarding',
  'sources',
  'filter',
  'ai',
  'report',
  'push',
  'storage',
])

const VALID_TABS = new Set<SourcesSubTab>(['hotlist', 'rss', 'search'])
const VALID_FILES = new Set<ConfigFileKey>(ALL_CONFIG_FILES)

const SITE_BASE_URL = 'https://sansan0.github.io/TrendRadar/'

export function canSyncBrowserUrl(loc: LocationLike | null | undefined): boolean {
  if (!loc) return false
  return loc.protocol === 'http:' || loc.protocol === 'https:'
}

/**
 * Normalize an HTTP(S) pathname into `{ basePath, isEnglish }`.
 * Works identically on root (`/` <-> `/en/`) and GitHub Pages subpaths (`/TrendRadar/` <-> `/TrendRadar/en/`).
 */
export function splitLocalizedPathname(pathname: string): { basePath: string; isEnglish: boolean } {
  let clean = pathname || '/'
  if (!clean.startsWith('/')) clean = `/${clean}`
  clean = clean.replace(/\/index\.html$/i, '/')
  const enMatch = clean.match(/^(.*?)\/en\/?$/i)
  if (enMatch) {
    const prefix = enMatch[1] || ''
    const basePath = prefix.endsWith('/') ? prefix : `${prefix}/`
    return { basePath, isEnglish: true }
  }
  const basePath = clean.endsWith('/') ? clean : `${clean}/`
  return { basePath, isEnglish: false }
}

export function buildPathForLang(currentPathname: string, lang: Lang): string {
  const { basePath } = splitLocalizedPathname(currentPathname)
  return lang === 'en' ? `${basePath}en/` : basePath
}

export function getCanonicalUrlForLang(lang: Lang): string {
  if (lang === 'en') return `${SITE_BASE_URL}en/`
  if (lang === 'zh') return SITE_BASE_URL
  return `${SITE_BASE_URL}?lang=${encodeURIComponent(lang)}`
}

export function parseEditorUrl(loc: LocationLike | null | undefined): ParsedEditorUrl {
  const empty: ParsedEditorUrl = {
    lang: null,
    pathLang: null,
    workspaceMode: null,
    proView: null,
    section: null,
    sourcesSubTab: null,
    file: null,
    hasExplicitRoute: false,
  }
  if (!loc) return empty

  const httpLike = canSyncBrowserUrl(loc)
  const pathLang: Lang | null = httpLike
    ? (splitLocalizedPathname(loc.pathname).isEnglish ? 'en' : 'zh')
    : null

  const params = new URLSearchParams(loc.search || '')
  const queryLang: Lang | null = normalizeLang(params.get('lang'))

  const rawMode = params.get('mode')?.toLowerCase()
  let workspaceMode: WorkspaceMode | null =
    rawMode === 'pro' || rawMode === 'guided' ? rawMode : null

  const rawView = params.get('view')?.toLowerCase()
  let proView: UrlProView | null =
    rawView === 'file' || rawView === 'features' ? rawView : null

  const rawSection = params.get('section')?.toLowerCase() as SectionId | undefined
  const section: SectionId | null =
    rawSection && VALID_SECTIONS.has(rawSection) ? rawSection : null

  const rawTab = params.get('tab')?.toLowerCase() as SourcesSubTab | undefined
  const sourcesSubTab: SourcesSubTab | null =
    rawTab && VALID_TABS.has(rawTab) ? rawTab : null

  const rawFile = params.get('file') as ConfigFileKey | null
  const file: ConfigFileKey | null =
    rawFile && VALID_FILES.has(rawFile) ? rawFile : null

  const hasExplicitRoute = Boolean(
    workspaceMode || proView || section || sourcesSubTab || file,
  )

  // Smart inference for concise deep links:
  // - `?section=push` without `mode` targets Guided mode at that section
  // - `?tab=search` without `section` implies `section=sources`
  // - `?file=timeline.yaml` without `mode` targets Pro mode focused on that file
  // - `?mode=pro&section=push` without `view` targets Pro visual features view
  const effectiveSection: SectionId | null = section ?? (sourcesSubTab ? 'sources' : null)

  if (!workspaceMode) {
    if (proView || (file && !effectiveSection)) {
      workspaceMode = 'pro'
    } else if (effectiveSection) {
      workspaceMode = 'guided'
    }
  }

  if (workspaceMode === 'pro' && !proView) {
    if (effectiveSection && effectiveSection !== 'onboarding') {
      proView = 'features'
    } else if (file) {
      proView = 'file'
    }
  }

  return {
    lang: queryLang ?? pathLang,
    pathLang,
    workspaceMode,
    proView,
    section: effectiveSection,
    sourcesSubTab,
    file,
    hasExplicitRoute,
  }
}

export function buildEditorUrl(currentPathname: string, state: EditorUrlState): string {
  const pathname = buildPathForLang(currentPathname, state.lang)
  const params = new URLSearchParams()

  if (state.lang !== 'zh' && state.lang !== 'en') {
    params.set('lang', state.lang)
  }

  if (state.workspaceMode === 'pro') {
    params.set('mode', 'pro')
    if (state.proView === 'features') {
      params.set('view', 'features')
      const section = state.activeSection === 'onboarding' ? 'sources' : state.activeSection
      params.set('section', section)
      if (section === 'sources' && state.sourcesSubTab !== 'hotlist') {
        params.set('tab', state.sourcesSubTab)
      }
      if (state.activeSourceFile !== 'config.yaml') {
        params.set('file', state.activeSourceFile)
      }
    } else if (state.activeSourceFile !== 'config.yaml') {
      params.set('file', state.activeSourceFile)
    }
  } else {
    if (state.activeSection !== 'onboarding') {
      params.set('section', state.activeSection)
      if (state.activeSection === 'sources' && state.sourcesSubTab !== 'hotlist') {
        params.set('tab', state.sourcesSubTab)
      }
    }
  }

  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

const SECTION_TITLES: Record<SectionId, { zh: string; en: string }> = {
  onboarding: { zh: '快速上手', en: 'Quick Start' },
  sources: { zh: '信息来源', en: 'Sources' },
  filter: { zh: '内容筛选', en: 'Filtering' },
  ai: { zh: 'AI 增强', en: 'AI Enhancement' },
  report: { zh: '报告与版面', en: 'Report & Layout' },
  push: { zh: '推送与定时', en: 'Notifications & Schedule' },
  storage: { zh: '存储与系统', en: 'Storage & System' },
}

export function buildDocumentTitle(state: EditorUrlState): string {
  const brand = tr(state.lang, 'TrendRadar 可视化配置编辑器', 'TrendRadar Visual Config Studio')

  if (state.workspaceMode === 'pro') {
    if (state.proView === 'file') {
      return tr(
        state.lang,
        '{file} · 专业模式 · {brand}',
        '{file} · Pro Mode · {brand}',
        { file: state.activeSourceFile, brand },
      )
    }
    const sec = state.activeSection === 'onboarding' ? 'sources' : state.activeSection
    const label = tr(state.lang, SECTION_TITLES[sec].zh, SECTION_TITLES[sec].en)
    return tr(
      state.lang,
      '{label} · 专业模式 · {brand}',
      '{label} · Pro Mode · {brand}',
      { label, brand },
    )
  }

  if (state.activeSection === 'onboarding') {
    return tr(
      state.lang,
      'TrendRadar 可视化配置编辑器 | 在线生成 config.yaml、关键词规则与推送时间线',
      'TrendRadar Visual Config Studio | Online config.yaml, Keyword Rules & Schedule Editor',
    )
  }

  const label = tr(
    state.lang,
    SECTION_TITLES[state.activeSection].zh,
    SECTION_TITLES[state.activeSection].en,
  )
  return `${label} · ${brand}`
}
