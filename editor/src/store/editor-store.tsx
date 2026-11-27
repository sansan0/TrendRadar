import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  getDefaultFile,
  getDefaultFiles,
  getMatchingDefaultFile,
  getMatchingDefaultFiles,
  inferFileTemplateLang,
} from '@/lib/defaults'
import { compareTemplate, differsFromTemplate } from '@/lib/config-changes'
import {
  ALL_CONFIG_FILES,
  ALL_REGIONS,
  type ConfigFileKey,
  type ConfigFilesMap,
  type ConfigVersionSnapshot,
  type DeployMode,
  type HealthIssue,
  type Lang,
  type SectionId,
  type SourcesSubTab,
  type SourceViewMode,
  type TemplateLang,
  type ThemeMode,
  type WorkspaceMode,
  type YamlParseError,
} from '@/lib/types'
import { isLang, LANGUAGE_META, normalizeLang, toTemplateLang } from '@/i18n/languages'
import { tr } from '@/i18n/translate'
import {
  createSnapshot,
  loadStoredSnapshots,
  normalizeImportedSnapshots,
  persistSnapshots,
  summarizeConfigFiles,
} from '@/lib/snapshots'
import { runHealthCheck } from '@/lib/validator'
import { findChangedLineSpan, firstChangedPosition } from '@/lib/source-text'
import {
  featureForSource,
  fileStart,
  isYamlFile,
  sourceForFeature,
  yamlChapters,
  type FeatureLocation,
  type SourceTarget,
  type YamlFile,
} from '@/lib/pro-navigation'
import {
  buildDocumentTitle,
  buildEditorUrl,
  canSyncBrowserUrl,
  getCanonicalUrlForLang,
  parseEditorUrl,
} from '@/lib/url-state'
import {
  buildYamlSourceIndex,
  getInObject,
  parseYamlSafe,
  parseConfigYaml,
  setYamlValues,
  type YamlPatch,
  type YamlPath,
} from '@/lib/yaml-doc'

const STORAGE_FILES_KEY = 'tr_studio_v2_files'
const STORAGE_DRAFT_KEY = 'tr_studio_v3_draft'
const STORAGE_META_KEY = 'tr_studio_v2_meta'
const STORAGE_THEME_KEY = 'tr_editor_theme'
const STORAGE_WORKSPACE_MODE_KEY = 'tr_editor_workspace_mode'
const STORAGE_PRO_VIEW_KEY = 'tr_editor_pro_view_v2'
const STORAGE_PRO_SPLIT_KEY = 'tr_editor_pro_split'
const STORAGE_PRO_AUTO_FOLLOW_KEY = 'tr_editor_pro_auto_follow'
const STORAGE_GUIDED_KEY = 'tr_editor_guided_progress'

export type ProView = 'file' | 'features'
export type PreviewMode = 'closed' | 'modal' | 'docked'
export type ChangesRequest = { file?: ConfigFileKey; restoreFile?: boolean; restoreAll?: boolean }
export type ConfigOriginMeta =
  | { kind: 'bundled' }
  | { kind: 'local'; updatedAt: number }
  | { kind: 'remote'; provider: 'github' | 'jsdelivr'; host: string; updatedAt: number }

export interface EditStamp {
  stepId: number
  at: number
}
export type EditLogMap = Record<string, EditStamp>

interface FileHistoryEntry {
  stepId: number
  at: number
  content: string
  fileLog: EditLogMap
}
type FileHistoriesMap = Record<ConfigFileKey, { past: FileHistoryEntry[]; future: FileHistoryEntry[] }>

type Navigation = {
  target: SourceTarget
  origin: 'source' | 'form' | 'jump' | 'scroll'
  seq: number
}

export interface SourceFlash {
  file: ConfigFileKey
  startLine: number
  endLine: number
  seq: number
}

export interface VisualFocusTarget {
  section: SectionId
  anchor?: string
  channel?: string
  filterMode?: 'keyword' | 'ai'
  timelineTab?: 'default' | 'periods' | 'week'
  seq: number
}

export interface ToastItem {
  id: number
  message: string
  tone: 'default' | 'success' | 'warning' | 'danger'
}

export interface EditorContextValue {
  files: ConfigFilesMap
  baselineFiles: ConfigFilesMap
  templateLang: TemplateLang
  dirtyFiles: ConfigFileKey[]
  changedFromDefaults: ConfigFileKey[]
  totalChangesCount: number
  hasCustomBaseline: boolean
  configData: Record<string, unknown>
  configError: YamlParseError | null
  timelineError: YamlParseError | null
  issues: HealthIssue[]

  lang: Lang
  setLang: (lang: Lang) => void
  theme: ThemeMode
  toggleTheme: () => void
  deployMode: DeployMode
  setDeployMode: (mode: DeployMode) => void

  workspaceMode: WorkspaceMode
  setWorkspaceMode: (mode: WorkspaceMode) => void
  proSplitRatio: number
  setProSplitRatio: (ratio: number) => void
  sourcesSubTab: SourcesSubTab
  setSourcesSubTab: (tab: SourcesSubTab) => void

  activeSection: SectionId
  setActiveSection: (section: SectionId) => void
  selectProFile: (file: ConfigFileKey) => void
  selectProSection: (section: SectionId, tab?: SourcesSubTab) => void
  openSourceTarget: (target: SourceTarget) => void
  proView: ProView
  setProView: (view: ProView) => void
  proAutoFollow: boolean
  setProAutoFollow: (enabled: boolean) => void
  proAlignTop: boolean
  activeYamlDoc: ReturnType<typeof parseYamlSafe>['doc']
  chapters: string[]
  proPath: YamlPath
  proPosition: { line: number; column: number }
  revealSeq: number
  trackSourcePosition: (file: ConfigFileKey, line: number, column: number) => void
  syncProScrollLine: (file: ConfigFileKey, line: number) => void
  focusSourceFromForm: (target: SourceTarget) => void
  patchYamlFile: (file: YamlFile, patches: YamlPatch[]) => void

  sourceViewMode: SourceViewMode
  setSourceViewMode: (mode: SourceViewMode) => void
  activeSourceFile: ConfigFileKey
  setActiveSourceFile: (file: ConfigFileKey) => void
  sourceJumpLine: { line: number; column: number; seq: number; alignToTop: boolean } | null
  sourceFlash: SourceFlash | null
  jumpToSource: (file: ConfigFileKey, line?: number) => void
  visualFocusTarget: VisualFocusTarget | null
  focusVisual: (section: SectionId, anchor?: string, extra?: Omit<VisualFocusTarget, 'section' | 'anchor' | 'seq'>) => void

  resumedSession: { active: boolean; savedSection: SectionId; savedTab: SourcesSubTab }
  dismissResumedSession: () => void

  exportOpen: boolean
  setExportOpen: (open: boolean) => void
  importOpen: boolean
  setImportOpen: (open: boolean) => void
  importDefaultTab: 'remote' | 'local'
  openImportDialog: (tab?: 'remote' | 'local') => void
  commandOpen: boolean
  setCommandOpen: (open: boolean) => void
  versionsOpen: boolean
  setVersionsOpen: (open: boolean) => void
  previewMode: PreviewMode
  setPreviewMode: (mode: PreviewMode) => void
  togglePreview: () => void
  changesRequest: ChangesRequest | null
  setChangesRequest: (request: ChangesRequest | null) => void
  getActiveCopyFile: () => ConfigFileKey

  snapshots: ConfigVersionSnapshot[]
  activeSnapshotId: string | null
  saveSnapshot: (name: string, note?: string) => ConfigVersionSnapshot
  overwriteSnapshot: (id: string) => void
  loadSnapshot: (id: string, backupCurrentFirst?: boolean) => void
  renameSnapshot: (id: string, name: string, note?: string) => void
  deleteSnapshot: (id: string) => void
  importSnapshotsJson: (rawJson: string) => number

  setFileContent: (file: ConfigFileKey, content: string, origin?: 'source' | 'form', position?: { line: number; column: number }) => void
  setConfigValue: (path: YamlPath, value: unknown) => void
  patchConfigValues: (patches: YamlPatch[]) => void
  removeConfigKey: (path: YamlPath) => void
  loadFiles: (partial: Partial<ConfigFilesMap>, updateBaseline?: boolean) => void
  resetFile: (file: ConfigFileKey, target?: 'default' | 'baseline') => void
  resetAll: () => void
  applyQuickFix: (fixKey: string) => void

  canUndo: boolean
  undoCount: number
  canRedo: boolean
  undo: () => void
  redo: () => void
  canUndoFile: (file: ConfigFileKey) => boolean
  canRedoFile: (file: ConfigFileKey) => boolean
  getFileUndoCount: (file: ConfigFileKey) => number
  undoFile: (file: ConfigFileKey) => void
  redoFile: (file: ConfigFileKey) => void
  editLog: EditLogMap

  configOrigin: ConfigOriginMeta
  setConfigOrigin: (origin: ConfigOriginMeta) => void
  toasts: ToastItem[]
  notify: (message: string, tone?: ToastItem['tone']) => void
  lastSavedAt: number | null
  persistenceError: boolean
}

const EditorContext = createContext<EditorContextValue | null>(null)

function readStoredMeta(): { lang?: Lang; deployMode?: DeployMode; configOrigin?: ConfigOriginMeta } {
  try {
    const raw = localStorage.getItem(STORAGE_META_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function getInitialConfigOrigin(): ConfigOriginMeta {
  const saved = readStoredMeta().configOrigin
  if (saved && typeof saved === 'object') {
    if (saved.kind === 'local' && typeof saved.updatedAt === 'number') return saved
    if (
      saved.kind === 'remote' &&
      (saved.provider === 'github' || saved.provider === 'jsdelivr') &&
      typeof saved.host === 'string' &&
      typeof saved.updatedAt === 'number'
    ) {
      return saved
    }
  }
  return { kind: 'bundled' }
}

function getInitialLang(): Lang {
  const stored = readStoredMeta().lang
  if (isLang(stored)) return stored
  if (typeof navigator !== 'undefined' && navigator.language) {
    const detected = normalizeLang(navigator.language)
    if (detected) return detected
  }
  return 'zh'
}

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_THEME_KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch {}
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

function getInitialDeployMode(): DeployMode {
  const saved = readStoredMeta().deployMode
  if (saved === 'github_actions' || saved === 'docker' || saved === 'local') return saved
  return 'docker'
}

function getInitialWorkspaceMode(): WorkspaceMode {
  try {
    const saved = localStorage.getItem(STORAGE_WORKSPACE_MODE_KEY)
    if (saved === 'pro' || saved === 'guided') return saved
  } catch {}
  return 'guided'
}

function getInitialProView(): ProView {
  try {
    const saved = localStorage.getItem(STORAGE_PRO_VIEW_KEY)
    if (saved === 'file' || saved === 'features') return saved
  } catch {}
  return 'file'
}

function getInitialProSplitRatio(): number {
  try {
    const raw = localStorage.getItem(STORAGE_PRO_SPLIT_KEY)
    const num = raw ? Number(raw) : NaN
    if (Number.isFinite(num) && num >= 28 && num <= 68) return num
  } catch {}
  return 46
}

function getInitialProAutoFollow(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_PRO_AUTO_FOLLOW_KEY)
    if (raw === 'false') return false
    if (raw === 'true') return true
  } catch {}
  return true
}

function createEmptyFileHistories(): FileHistoriesMap {
  return Object.fromEntries(
    ALL_CONFIG_FILES.map((file) => [file, { past: [], future: [] }]),
  ) as unknown as FileHistoriesMap
}

function belongsToFileLog(key: string, file: ConfigFileKey): boolean {
  return (
    key === `file::${file}` ||
    key.startsWith(`yaml::${file}::`) ||
    key.startsWith(`text::${file}::`) ||
    key.startsWith(`textline::${file}::`)
  )
}

function extractFileLog(log: EditLogMap, file: ConfigFileKey): EditLogMap {
  const out: EditLogMap = {}
  for (const [k, v] of Object.entries(log)) {
    if (belongsToFileLog(k, file)) out[k] = v
  }
  return out
}

function replaceFileLog(log: EditLogMap, file: ConfigFileKey, nextFileLog: EditLogMap): EditLogMap {
  const out: EditLogMap = {}
  for (const [k, v] of Object.entries(log)) {
    if (!belongsToFileLog(k, file)) out[k] = v
  }
  for (const [k, v] of Object.entries(nextFileLog)) {
    out[k] = v
  }
  return out
}

function readGuidedProgress(): { section: SectionId; tab: SourcesSubTab; hadSaved: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_GUIDED_KEY)
    if (!raw) return { section: 'onboarding', tab: 'hotlist', hadSaved: false }
    const saved = JSON.parse(raw)
    return {
      section: ['onboarding', 'sources', 'filter', 'ai', 'report', 'push', 'storage'].includes(saved?.section) ? saved.section : 'onboarding',
      tab: ['hotlist', 'rss', 'search'].includes(saved?.tab) ? saved.tab : 'hotlist',
      hadSaved: true,
    }
  } catch {
    return { section: 'onboarding', tab: 'hotlist', hadSaved: false }
  }
}

function inferTemplateLang(files: ConfigFilesMap, fallback: Lang): TemplateLang {
  return inferFileTemplateLang('config.yaml', files['config.yaml'], fallback)
}

function isUnmodifiedAgainstAnyDefault(file: ConfigFileKey, content: string): boolean {
  return (
    !differsFromTemplate(getDefaultFile(file, 'zh'), content) ||
    !differsFromTemplate(getDefaultFile(file, 'en'), content)
  )
}

function sanitizeEditLog(raw: unknown): EditLogMap {
  if (!raw || typeof raw !== 'object') return {}
  const out: EditLogMap = {}
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (
      val &&
      typeof val === 'object' &&
      typeof (val as EditStamp).stepId === 'number' &&
      typeof (val as EditStamp).at === 'number'
    ) {
      out[key] = { stepId: (val as EditStamp).stepId, at: (val as EditStamp).at }
    }
  }
  return out
}

function updateEditLogForDiff(
  prevLog: EditLogMap,
  baseFiles: ConfigFilesMap,
  nextFiles: ConfigFilesMap,
  changedKeys: ConfigFileKey[],
  stamp: EditStamp,
): EditLogMap {
  const nextLog: EditLogMap = { ...prevLog }
  for (const file of changedKeys) {
    nextLog[`file::${file}`] = stamp
    const diff = compareTemplate(file, baseFiles[file], nextFiles[file], 'zh')
    if (diff.type === 'yaml') {
      for (const item of diff.items) {
        nextLog[`yaml::${file}::${JSON.stringify(item.path)}`] = stamp
      }
    } else if (diff.type === 'text') {
      for (const item of diff.items) {
        const sig = (item.after.length ? item.after : item.before).join('\n')
        nextLog[`text::${file}::${item.kind}::${sig}`] = stamp
        nextLog[`textline::${file}::${item.newStart}`] = stamp
      }
    }
  }
  return nextLog
}

function seedMissingEditLog(
  existingLog: EditLogMap,
  baseFiles: ConfigFilesMap,
  currentFiles: ConfigFilesMap,
  fallbackAt: number,
): EditLogMap {
  const changedKeys = ALL_CONFIG_FILES.filter((f) => differsFromTemplate(baseFiles[f], currentFiles[f]))
  if (changedKeys.length === 0) return existingLog
  const seeded = updateEditLogForDiff({}, baseFiles, currentFiles, changedKeys, { stepId: 1, at: fallbackAt })
  // Existing explicit stamps always take precedence; shift their stepIds above 1 if needed
  const hasExplicit = Object.keys(existingLog).length > 0
  if (!hasExplicit) return seeded
  const merged: EditLogMap = { ...seeded }
  for (const [k, v] of Object.entries(existingLog)) {
    merged[k] = { stepId: v.stepId + 1, at: v.at }
  }
  return merged
}

function restorePersistedDraft(lang: Lang): {
  files: ConfigFilesMap
  baselineFiles: ConfigFilesMap
  templateLang: TemplateLang
  editLog: EditLogMap
  fromStorage: boolean
} {
  const targetTplLang = toTemplateLang(lang)
  const defaults = getDefaultFiles(targetTplLang)
  const merge = (partial: unknown, base = defaults): ConfigFilesMap => {
    const out = { ...base }
    if (partial && typeof partial === 'object') {
      for (const k of ALL_CONFIG_FILES) {
        const value = (partial as Partial<ConfigFilesMap>)[k]
        if (typeof value === 'string') out[k] = value
      }
    }
    return out
  }
  try {
    const raw = localStorage.getItem(STORAGE_DRAFT_KEY)
    if (raw) {
      const draft = JSON.parse(raw)
      if (draft?.files && typeof draft.files === 'object') {
        const storedTplLang: TemplateLang = draft.templateLang === 'en' || draft.templateLang === 'zh'
          ? draft.templateLang
          : targetTplLang
        const tplDefaults = getDefaultFiles(storedTplLang)
        const restoredFiles = merge(draft.files, tplDefaults)
        const restoredBase = merge(draft.baselineFiles, tplDefaults)
        const savedAt = typeof draft.savedAt === 'number' ? draft.savedAt : Date.now()
        let rawLog = sanitizeEditLog(draft.editLog)
        // Auto-heal any unedited default file that got stuck in the opposite template language
        const targetDefs = getDefaultFiles(targetTplLang)
        const otherDefs = getDefaultFiles(targetTplLang === 'en' ? 'zh' : 'en')
        for (const k of ALL_CONFIG_FILES) {
          const baseIsBundled = isUnmodifiedAgainstAnyDefault(k, restoredBase[k])
          if (
            baseIsBundled &&
            !differsFromTemplate(otherDefs[k], restoredFiles[k]) &&
            differsFromTemplate(targetDefs[k], restoredFiles[k])
          ) {
            restoredFiles[k] = targetDefs[k]
            restoredBase[k] = targetDefs[k]
            rawLog = replaceFileLog(rawLog, k, {})
          }
        }
        const matchedDefs = getMatchingDefaultFiles(restoredFiles, targetTplLang)
        const editLog = seedMissingEditLog(rawLog, matchedDefs, restoredFiles, savedAt)
        return {
          files: restoredFiles,
          baselineFiles: restoredBase,
          templateLang: inferTemplateLang(restoredFiles, targetTplLang),
          editLog,
          fromStorage: true,
        }
      }
    }
  } catch {}
  try {
    const legacyRaw = localStorage.getItem(STORAGE_FILES_KEY)
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw)
      if (parsed && typeof parsed === 'object') {
        const restoredFiles = merge(parsed, defaults)
        const tplLang = inferTemplateLang(restoredFiles, targetTplLang)
        const matchedDefs = getMatchingDefaultFiles(restoredFiles, tplLang)
        const editLog = seedMissingEditLog({}, matchedDefs, restoredFiles, Date.now())
        return { files: restoredFiles, baselineFiles: matchedDefs, templateLang: tplLang, editLog, fromStorage: true }
      }
    }
  } catch {}
  return { files: defaults, baselineFiles: defaults, templateLang: targetTplLang, editLog: {}, fromStorage: false }
}

export function EditorProvider({ children }: { children: ReactNode }) {
  const initUrl = useMemo(
    () => (typeof window !== 'undefined' ? parseEditorUrl(window.location) : parseEditorUrl(null)),
    [],
  )
  const initLang = useMemo<Lang>(() => initUrl.lang ?? getInitialLang(), [initUrl.lang])
  const initWorkspaceMode = useMemo<WorkspaceMode>(
    () => initUrl.workspaceMode ?? getInitialWorkspaceMode(),
    [initUrl.workspaceMode],
  )
  const initProView = useMemo<ProView>(
    () => initUrl.proView ?? getInitialProView(),
    [initUrl.proView],
  )
  const guided = useMemo(readGuidedProgress, [])
  const initTab = useMemo<SourcesSubTab>(
    () => initUrl.sourcesSubTab ?? guided.tab,
    [initUrl.sourcesSubTab, guided.tab],
  )
  const initSection = useMemo<SectionId>(() => {
    if (initUrl.section) {
      return initWorkspaceMode === 'pro' && initUrl.section === 'onboarding'
        ? 'sources'
        : initUrl.section
    }
    return initWorkspaceMode === 'pro' ? 'sources' : guided.section
  }, [initUrl.section, initWorkspaceMode, guided.section])
  const initTarget = useMemo<SourceTarget>(() => {
    if (initUrl.file) return fileStart(initUrl.file)
    if (initWorkspaceMode === 'pro' && initProView === 'features' && initUrl.section) {
      return sourceForFeature(initSection, initTab)
    }
    return fileStart('config.yaml')
  }, [initUrl.file, initUrl.section, initWorkspaceMode, initProView, initSection, initTab])

  const [lang, setLangInternal] = useState<Lang>(initLang)
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme())
  const [deployMode, setDeployMode] = useState<DeployMode>(() => getInitialDeployMode())
  const [configOrigin, setConfigOrigin] = useState<ConfigOriginMeta>(() => getInitialConfigOrigin())
  const [workspaceMode, setWorkspaceModeInternal] = useState<WorkspaceMode>(initWorkspaceMode)
  const [proSplitRatio, setProSplitRatioInternal] = useState<number>(() => getInitialProSplitRatio())
  const [proAutoFollow, setProAutoFollowState] = useState<boolean>(() => getInitialProAutoFollow())
  const [sourcesSubTab, setSourcesSubTab] = useState<SourcesSubTab>(initTab)

  const setProAutoFollow = useCallback((enabled: boolean) => {
    setProAutoFollowState(enabled)
    try {
      localStorage.setItem(STORAGE_PRO_AUTO_FOLLOW_KEY, String(enabled))
    } catch {}
  }, [])

  const initialDraft = useMemo(() => restorePersistedDraft(initLang), [initLang])
  const [templateLang, setTemplateLang] = useState<TemplateLang>(initialDraft.templateLang)
  const [baselineFiles, setBaselineFiles] = useState<ConfigFilesMap>(initialDraft.baselineFiles)
  const initialMaxStep = useMemo(() => {
    let max = 0
    for (const entry of Object.values(initialDraft.editLog)) {
      if (entry.stepId > max) max = entry.stepId
    }
    return max
  }, [initialDraft.editLog])
  const stepSeqRef = useRef<number>(initialMaxStep)
  const [history, setHistory] = useState(() => ({
    files: initialDraft.files,
    editLog: initialDraft.editLog,
    fileHistories: createEmptyFileHistories(),
  }))
  const { files, editLog, fileHistories } = history
  const coalesceRef = useRef<{ at: number; key: string | null; stepId: number }>({ at: 0, key: null, stepId: 0 })

  const editFiles = useCallback(
    (edit: (prev: ConfigFilesMap) => ConfigFilesMap, remember = true, coalesceKey: string | null = null) => {
      setHistory((state) => {
        const next = edit(state.files)
        const changedKeys = ALL_CONFIG_FILES.filter((file) => state.files[file] !== next[file])
        if (changedKeys.length === 0) return state
        if (!remember) {
          coalesceRef.current = { at: 0, key: null, stepId: 0 }
          const nextHistories = { ...state.fileHistories }
          for (const f of changedKeys) {
            nextHistories[f] = { past: state.fileHistories[f].past, future: [] }
          }
          return { files: next, editLog: state.editLog, fileHistories: nextHistories }
        }
        const now = Date.now()
        const singleFile = changedKeys.length === 1 ? changedKeys[0] : null
        const canCoalesce =
          coalesceKey !== null &&
          singleFile !== null &&
          coalesceRef.current.key === coalesceKey &&
          now - coalesceRef.current.at < 500 &&
          state.fileHistories[singleFile].past.length > 0 &&
          state.fileHistories[singleFile].future.length === 0

        if (canCoalesce && singleFile) {
          const prevEntry = state.fileHistories[singleFile].past[state.fileHistories[singleFile].past.length - 1]
          const stepId = coalesceRef.current.stepId
          coalesceRef.current = { at: now, key: coalesceKey, stepId }
          const baseFiles = { ...state.files, [singleFile]: prevEntry.content }
          const baseLog = replaceFileLog(state.editLog, singleFile, prevEntry.fileLog)
          const nextLog = updateEditLogForDiff(baseLog, baseFiles, next, [singleFile], { stepId, at: now })
          return { files: next, editLog: nextLog, fileHistories: state.fileHistories }
        }

        const stepId = ++stepSeqRef.current
        coalesceRef.current = { at: now, key: coalesceKey, stepId }
        const nextLog = updateEditLogForDiff(state.editLog, state.files, next, changedKeys, { stepId, at: now })
        const nextHistories = { ...state.fileHistories }
        for (const f of changedKeys) {
          const entry: FileHistoryEntry = {
            stepId,
            at: now,
            content: state.files[f],
            fileLog: extractFileLog(state.editLog, f),
          }
          nextHistories[f] = {
            past: [...state.fileHistories[f].past.slice(-49), entry],
            future: [],
          }
        }
        return { files: next, editLog: nextLog, fileHistories: nextHistories }
      })
    },
    [],
  )

  const [resumedSession, setResumedSession] = useState(() => {
    const matchedDefs = getMatchingDefaultFiles(initialDraft.files, initialDraft.templateLang)
    const hasEdits = initialDraft.fromStorage && ALL_CONFIG_FILES.some((f) => differsFromTemplate(matchedDefs[f], initialDraft.files[f]))
    const hasStep = guided.hadSaved && guided.section !== 'onboarding'
    return {
      active: Boolean(hasEdits || hasStep),
      savedSection: guided.section,
      savedTab: guided.tab,
    }
  })
  const dismissResumedSession = useCallback(() => {
    setResumedSession((prev) => ({ ...prev, active: false }))
  }, [])

  const [activeSection, setSection] = useState<SectionId>(initSection)
  const [sourceViewMode, setSourceViewMode] = useState<SourceViewMode>('closed')
  const [proView, setProViewState] = useState<ProView>(initProView)
  const [navigation, setNavigation] = useState<Navigation>({
    target: initTarget, origin: 'jump', seq: 1,
  })
  const activeSourceFile = navigation.target.file
  const [visualFocusTarget, setVisualFocusTarget] = useState<VisualFocusTarget | null>(null)
  const [sourceFlash, setSourceFlash] = useState<SourceFlash | null>(null)
  const seqRef = useRef(1)

  const configRaw = files['config.yaml']
  const timelineRaw = files['timeline.yaml']
  const configParsed = useMemo(() => parseConfigYaml(configRaw), [configRaw])
  const timelineParsed = useMemo(() => parseConfigYaml(timelineRaw), [timelineRaw])
  const configData = useMemo(() => configParsed.data ?? {}, [configParsed.data])
  const activeYamlDoc = activeSourceFile === 'config.yaml' ? configParsed.doc
    : activeSourceFile === 'timeline.yaml' ? timelineParsed.doc : null
  const sourceRaw = files[activeSourceFile]
  const sourceLines = useMemo(() => sourceRaw.split(/\r\n|\r|\n/), [sourceRaw])
  const chapters = useMemo(() => yamlChapters(activeYamlDoc), [activeYamlDoc])
  const index = useMemo(() => activeYamlDoc && buildYamlSourceIndex(sourceRaw, activeYamlDoc), [activeYamlDoc, sourceRaw])
  const { target } = navigation
  const proPath = useMemo(() => {
    if (!index) return []
    const position = 'path' in target ? index.positionAt(target.path) : target
    const path = index.pathAt(position.line, position.column)
    return path.length === 0 && chapters.length ? [chapters[0]] : path
  }, [target, index, chapters])
  const proPosition = useMemo(() => {
    if ('path' in target) return index?.positionAt(proPath) ?? { line: 1, column: 1 }
    const line = Math.max(1, Math.min(target.line, sourceLines.length))
    return { line, column: Math.max(1, Math.min(target.column ?? 1, sourceLines[line - 1].length + 1)) }
  }, [index, proPath, target, sourceLines])
  const sourceJumpLine = navigation.origin === 'source' || navigation.origin === 'scroll' ? null : {
    ...proPosition, seq: navigation.seq, alignToTop: navigation.origin === 'jump',
  }
  const proAlignTop = navigation.origin === 'jump' || navigation.origin === 'scroll'

  const focusVisual = useCallback(
    (section: SectionId, anchor?: string, extra?: Omit<VisualFocusTarget, 'section' | 'anchor' | 'seq'>) => {
      setSection(section)
      const nextSeq = ++seqRef.current
      setVisualFocusTarget({ section, anchor, ...extra, seq: nextSeq })
    },
    [],
  )

  const openFeature = useCallback((feature: FeatureLocation) => {
    if (feature.tab) setSourcesSubTab(feature.tab)
    focusVisual(feature.section, feature.anchor, {
      channel: feature.channel,
      filterMode: feature.filterMode,
      timelineTab: feature.timelineTab,
    })
  }, [focusVisual])

  const navigate = useCallback((nextTarget: SourceTarget, origin: Navigation['origin']) => {
    setNavigation({ target: nextTarget, origin, seq: ++seqRef.current })
  }, [])

  const focusSourceFromForm = useCallback((nextTarget: SourceTarget) => {
    if (workspaceMode === 'pro' || sourceViewMode !== 'closed') navigate(nextTarget, 'form')
  }, [navigate, sourceViewMode, workspaceMode])

  const trackSourcePosition = useCallback((file: ConfigFileKey, line: number, column: number) => {
    if (workspaceMode !== 'pro' || file !== activeSourceFile || !proAutoFollow) return
    navigate({ file, line, column }, 'source')
  }, [activeSourceFile, navigate, proAutoFollow, workspaceMode])

  const syncProScrollLine = useCallback((file: ConfigFileKey, line: number) => {
    if (workspaceMode !== 'pro' || file !== activeSourceFile || !proAutoFollow) return
    navigate({ file, line, column: 1 }, 'scroll')
  }, [activeSourceFile, navigate, proAutoFollow, workspaceMode])

  // Sync left source cursor / scroll -> right visual feature section in Pro mode
  const lastSyncedSourceSeq = useRef(0)
  useEffect(() => {
    if (workspaceMode !== 'pro' || proView !== 'features' || !proAutoFollow) return
    if (
      (navigation.origin !== 'source' && navigation.origin !== 'scroll') ||
      navigation.seq === lastSyncedSourceSeq.current
    ) {
      return
    }
    lastSyncedSourceSeq.current = navigation.seq
    const feature = featureForSource(activeSourceFile, proPath)
    if (feature) {
      openFeature(feature)
    }
  }, [workspaceMode, proView, proAutoFollow, navigation, activeSourceFile, proPath, openFeature])

  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importDefaultTab, setImportDefaultTab] = useState<'remote' | 'local'>('remote')
  const [commandOpen, setCommandOpen] = useState(false)

  const openImportDialog = useCallback((tab: 'remote' | 'local' = 'remote') => {
    setImportDefaultTab(tab)
    setImportOpen(true)
  }, [])
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [previewMode, setPreviewModeInternal] = useState<PreviewMode>('closed')
  const setPreviewMode = useCallback((mode: PreviewMode) => {
    if (mode === 'docked') {
      setSourceViewMode('closed')
    }
    setPreviewModeInternal(mode)
  }, [])
  const togglePreview = useCallback(() => {
    setPreviewModeInternal((curr) => (curr === 'closed' ? 'modal' : 'closed'))
  }, [])
  const [changesRequest, setChangesRequest] = useState<ChangesRequest | null>(null)
  const [snapshots, setSnapshots] = useState<ConfigVersionSnapshot[]>(() => loadStoredSnapshots())
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [persistenceError, setPersistenceError] = useState(false)

  const notify = useCallback((message: string, tone: ToastItem['tone'] = 'default') => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((list) => [...list.slice(-3), { id, message, tone }])
    setTimeout(() => {
      setToasts((list) => list.filter((x) => x.id !== id))
    }, 3200)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_THEME_KEY, theme)
    } catch {}
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = LANGUAGE_META[lang].htmlLang
    try {
      localStorage.setItem(STORAGE_META_KEY, JSON.stringify({ lang, deployMode, configOrigin }))
    } catch {}
  }, [lang, deployMode, configOrigin])

  useEffect(() => {
    if (workspaceMode === 'guided') {
      try {
        localStorage.setItem(STORAGE_GUIDED_KEY, JSON.stringify({ section: activeSection, tab: sourcesSubTab }))
      } catch {}
    }
  }, [workspaceMode, activeSection, sourcesSubTab])

  const urlHydratedRef = useRef(false)
  const suppressNextUrlPushRef = useRef(false)
  const prevUrlMetaRef = useRef<{ lang: Lang; mode: WorkspaceMode; view: ProView }>({
    lang: initLang,
    mode: initWorkspaceMode,
    view: initProView,
  })

  useEffect(() => {
    const urlState = {
      lang,
      workspaceMode,
      proView,
      activeSection,
      sourcesSubTab,
      activeSourceFile,
    }
    document.title = buildDocumentTitle(urlState)
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (canonical) {
      canonical.href = getCanonicalUrlForLang(lang)
    }

    const prevMeta = prevUrlMetaRef.current
    const majorSwitch =
      prevMeta.lang !== lang ||
      prevMeta.mode !== workspaceMode ||
      prevMeta.view !== proView
    prevUrlMetaRef.current = { lang, mode: workspaceMode, view: proView }

    if (typeof window === 'undefined' || !canSyncBrowserUrl(window.location)) {
      urlHydratedRef.current = true
      suppressNextUrlPushRef.current = false
      return
    }

    const nextUrl = buildEditorUrl(window.location.pathname, urlState)
    const currentUrl = `${window.location.pathname}${window.location.search}`

    if (suppressNextUrlPushRef.current) {
      suppressNextUrlPushRef.current = false
      urlHydratedRef.current = true
      return
    }

    if (!urlHydratedRef.current) {
      urlHydratedRef.current = true
      if (nextUrl !== currentUrl) {
        try {
          window.history.replaceState(null, '', nextUrl)
        } catch {}
      }
      return
    }

    if (nextUrl !== currentUrl) {
      const isAutoFollow =
        !majorSwitch && (navigation.origin === 'scroll' || navigation.origin === 'source')
      try {
        if (isAutoFollow) {
          window.history.replaceState(null, '', nextUrl)
        } else {
          window.history.pushState(null, '', nextUrl)
        }
      } catch {}
    }
  }, [lang, workspaceMode, proView, activeSection, sourcesSubTab, activeSourceFile, navigation.origin])

  const saveDraft = useCallback(() => {
    try {
      const savedAt = Date.now()
      localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify({ files, baselineFiles, templateLang, editLog, savedAt }))
      localStorage.removeItem(STORAGE_FILES_KEY)
      setLastSavedAt(savedAt)
      setPersistenceError(false)
      return true
    } catch {
      setPersistenceError(true)
      return false
    }
  }, [files, baselineFiles, templateLang, editLog])

  useEffect(() => {
    const handle = setTimeout(saveDraft, 650)
    const onHidden = () => { if (document.visibilityState === 'hidden') saveDraft() }
    window.addEventListener('pagehide', saveDraft)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      clearTimeout(handle)
      window.removeEventListener('pagehide', saveDraft)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [saveDraft])

  const setFileContent = useCallback(
    (file: ConfigFileKey, content: string, origin: 'source' | 'form' = 'form', position?: { line: number; column: number }) => {
      if (origin === 'form' && files[file] !== content) {
        const span = findChangedLineSpan(files[file], content)
        const pos = position ?? (span ? { line: span.startLine, column: span.column } : firstChangedPosition(files[file], content))
        if (workspaceMode === 'pro' || sourceViewMode !== 'closed') {
          navigate({ file, ...pos }, 'form')
          if (span) {
            setSourceFlash({ file, startLine: span.startLine, endLine: span.endLine, seq: ++seqRef.current })
          }
        }
      }
      const coalesceKey = origin === 'source' ? `source:${file}` : null
      editFiles((prev) => ({ ...prev, [file]: content }), true, coalesceKey)
    },
    [editFiles, files, navigate, sourceViewMode, workspaceMode],
  )

  const patchYamlFile = useCallback(
    (file: YamlFile, patches: YamlPatch[]) => {
      if (!patches.length) return
      const first = patches[0]
      const currentRaw = files[file]
      const updatedPreview = setYamlValues(currentRaw, patches)
      const span = findChangedLineSpan(currentRaw, updatedPreview)
      const isSingleScalar =
        patches.length === 1 &&
        !first.remove &&
        (first.value === null || typeof first.value !== 'object')

      if (span && !isSingleScalar) {
        focusSourceFromForm({ file, line: span.startLine, column: 1 })
      } else {
        focusSourceFromForm({ file, path: first.remove ? first.path.slice(0, -1) : first.path })
      }

      if (span && (workspaceMode === 'pro' || sourceViewMode !== 'closed')) {
        setSourceFlash({ file, startLine: span.startLine, endLine: span.endLine, seq: ++seqRef.current })
      }

      if (updatedPreview === currentRaw) return

      const coalesceKey =
        patches.length === 1 && !first.remove && typeof first.value === 'string'
          ? `yaml:${file}:${first.path.join('.')}`
          : null
      editFiles(
        (prev) => {
          const updated = prev[file] === currentRaw ? updatedPreview : setYamlValues(prev[file], patches)
          if (updated === prev[file]) return prev
          return { ...prev, [file]: updated }
        },
        true,
        coalesceKey,
      )
    },
    [editFiles, files, focusSourceFromForm, sourceViewMode, workspaceMode],
  )

  const patchConfigValues = useCallback((patches: YamlPatch[]) => patchYamlFile('config.yaml', patches), [patchYamlFile])
  const setConfigValue = useCallback((path: YamlPath, value: unknown) => patchConfigValues([{ path, value }]), [patchConfigValues])
  const removeConfigKey = useCallback((path: YamlPath) => patchConfigValues([{ path, remove: true }]), [patchConfigValues])

  const loadFiles = useCallback(
    (partial: Partial<ConfigFilesMap>, updateBaseline = false) => {
      coalesceRef.current = { at: 0, key: null, stepId: 0 }
      editFiles((prev) => {
        const next = { ...prev, ...partial }
        if (partial['config.yaml']) {
          setTemplateLang((curr) => inferTemplateLang(next, curr))
        }
        return next
      })
      if (updateBaseline) {
        setBaselineFiles((prev) => ({ ...prev, ...partial }))
      }
    },
    [editFiles],
  )

  const setLang = useCallback(
    (nextLang: Lang) => {
      if (nextLang === lang) return
      const nextDefaults = getDefaultFiles(nextLang)
      const configUnmodified = isUnmodifiedAgainstAnyDefault('config.yaml', files['config.yaml'])
      editFiles((prev) => {
        const next = { ...prev }
        for (const k of ALL_CONFIG_FILES) {
          if (isUnmodifiedAgainstAnyDefault(k, prev[k])) {
            next[k] = nextDefaults[k]
          }
        }
        return next
      }, false)
      setBaselineFiles((previous) => Object.fromEntries(ALL_CONFIG_FILES.map((file) => [
        file, isUnmodifiedAgainstAnyDefault(file, previous[file]) ? nextDefaults[file] : previous[file],
      ])) as ConfigFilesMap)
      if (configUnmodified) {
        setTemplateLang(toTemplateLang(nextLang))
      }
      setLangInternal(nextLang)
    },
    [editFiles, files, lang],
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !canSyncBrowserUrl(window.location)) return
    const onPopState = () => {
      if (!canSyncBrowserUrl(window.location)) return
      const parsed = parseEditorUrl(window.location)
      suppressNextUrlPushRef.current = true

      const targetLang: Lang = parsed.lang ?? 'zh'
      if (targetLang !== lang) {
        setLang(targetLang)
      }

      const nextMode: WorkspaceMode = parsed.workspaceMode ?? 'guided'
      setWorkspaceModeInternal(nextMode)
      try {
        localStorage.setItem(STORAGE_WORKSPACE_MODE_KEY, nextMode)
      } catch {}

      if (nextMode === 'pro') {
        const nextView: ProView = parsed.proView ?? 'file'
        setProViewState(nextView)
        try {
          localStorage.setItem(STORAGE_PRO_VIEW_KEY, nextView)
        } catch {}
        const nextFile: ConfigFileKey = parsed.file ?? 'config.yaml'
        if (nextView === 'features') {
          const nextSection: SectionId =
            parsed.section && parsed.section !== 'onboarding' ? parsed.section : 'sources'
          const nextTab: SourcesSubTab = parsed.sourcesSubTab ?? 'hotlist'
          setSection(nextSection)
          if (nextSection === 'sources') setSourcesSubTab(nextTab)
          navigate(parsed.file ? fileStart(nextFile) : sourceForFeature(nextSection, nextTab), 'jump')
        } else {
          navigate(fileStart(nextFile), 'jump')
        }
      } else {
        const nextSection: SectionId = parsed.section ?? 'onboarding'
        const nextTab: SourcesSubTab = parsed.sourcesSubTab ?? 'hotlist'
        setSection(nextSection)
        if (nextSection === 'sources') setSourcesSubTab(nextTab)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [lang, navigate, setLang])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const resetFile = useCallback(
    (file: ConfigFileKey, target: 'default' | 'baseline' = 'default') => {
      coalesceRef.current = { at: 0, key: null, stepId: 0 }
      if (target === 'baseline') {
        const base = baselineFiles[file]
        setHistory((state) => ({
          files: { ...state.files, [file]: base },
          editLog: replaceFileLog(state.editLog, file, {}),
          fileHistories: {
            ...state.fileHistories,
            [file]: { past: [], future: [] },
          },
        }))
        notify(
          tr(
            lang,
            '已将 {file} 恢复为刚导入时的内容',
            'Restored {file} to imported content',
            { file },
          ),
          'success',
        )
        return
      }
      const def = getDefaultFile(file, lang)
      setHistory((state) => ({
        files: { ...state.files, [file]: def },
        editLog: replaceFileLog(state.editLog, file, {}),
        fileHistories: {
          ...state.fileHistories,
          [file]: { past: [], future: [] },
        },
      }))
      setBaselineFiles((prev) => (
        isUnmodifiedAgainstAnyDefault(file, prev[file]) ? { ...prev, [file]: def } : prev
      ))
      if (file === 'config.yaml') setTemplateLang(toTemplateLang(lang))
      notify(tr(lang, '已恢复 {file} 默认模板', 'Reset {file} to default', { file }), 'success')
    },
    [baselineFiles, lang, notify],
  )

  const resetAll = useCallback(() => {
    coalesceRef.current = { at: 0, key: null, stepId: 0 }
    stepSeqRef.current = 0
    const defs = getDefaultFiles(lang)
    setHistory({
      files: defs,
      editLog: {},
      fileHistories: createEmptyFileHistories(),
    })
    setBaselineFiles(defs)
    setTemplateLang(toTemplateLang(lang))
    setConfigOrigin({ kind: 'bundled' })
    setResumedSession({ active: false, savedSection: 'onboarding', savedTab: 'hotlist' })
    try {
      localStorage.removeItem(STORAGE_GUIDED_KEY)
    } catch {}
    notify(tr(lang, '已恢复默认配置', 'Restored default settings'), 'success')
  }, [lang, notify])

  const undoFile = useCallback((file: ConfigFileKey) => {
    coalesceRef.current = { at: 0, key: null, stepId: 0 }
    setHistory((state) => {
      const stack = state.fileHistories[file]
      if (!stack.past.length) return state
      const last = stack.past[stack.past.length - 1]
      const futureEntry: FileHistoryEntry = {
        stepId: last.stepId,
        at: last.at,
        content: state.files[file],
        fileLog: extractFileLog(state.editLog, file),
      }
      return {
        files: { ...state.files, [file]: last.content },
        editLog: replaceFileLog(state.editLog, file, last.fileLog),
        fileHistories: {
          ...state.fileHistories,
          [file]: {
            past: stack.past.slice(0, -1),
            future: [...stack.future, futureEntry],
          },
        },
      }
    })
  }, [])

  const redoFile = useCallback((file: ConfigFileKey) => {
    coalesceRef.current = { at: 0, key: null, stepId: 0 }
    setHistory((state) => {
      const stack = state.fileHistories[file]
      if (!stack.future.length) return state
      const next = stack.future[stack.future.length - 1]
      const pastEntry: FileHistoryEntry = {
        stepId: next.stepId,
        at: next.at,
        content: state.files[file],
        fileLog: extractFileLog(state.editLog, file),
      }
      return {
        files: { ...state.files, [file]: next.content },
        editLog: replaceFileLog(state.editLog, file, next.fileLog),
        fileHistories: {
          ...state.fileHistories,
          [file]: {
            past: [...stack.past, pastEntry],
            future: stack.future.slice(0, -1),
          },
        },
      }
    })
  }, [])

  const undo = useCallback(() => {
    coalesceRef.current = { at: 0, key: null, stepId: 0 }
    setHistory((state) => {
      let maxStepId = -1
      for (const f of ALL_CONFIG_FILES) {
        const top = state.fileHistories[f].past.at(-1)
        if (top && top.stepId > maxStepId) maxStepId = top.stepId
      }
      if (maxStepId < 0) return state
      const nextFiles = { ...state.files }
      let nextLog = state.editLog
      const nextHistories = { ...state.fileHistories }
      for (const f of ALL_CONFIG_FILES) {
        const stack = state.fileHistories[f]
        const top = stack.past.at(-1)
        if (top && top.stepId === maxStepId) {
          const futureEntry: FileHistoryEntry = {
            stepId: top.stepId,
            at: top.at,
            content: state.files[f],
            fileLog: extractFileLog(state.editLog, f),
          }
          nextFiles[f] = top.content
          nextLog = replaceFileLog(nextLog, f, top.fileLog)
          nextHistories[f] = {
            past: stack.past.slice(0, -1),
            future: [...stack.future, futureEntry],
          }
        }
      }
      return { files: nextFiles, editLog: nextLog, fileHistories: nextHistories }
    })
  }, [])

  const redo = useCallback(() => {
    coalesceRef.current = { at: 0, key: null, stepId: 0 }
    setHistory((state) => {
      let minStepId = Infinity
      for (const f of ALL_CONFIG_FILES) {
        const top = state.fileHistories[f].future.at(-1)
        if (top && top.stepId < minStepId) minStepId = top.stepId
      }
      if (!Number.isFinite(minStepId)) return state
      const nextFiles = { ...state.files }
      let nextLog = state.editLog
      const nextHistories = { ...state.fileHistories }
      for (const f of ALL_CONFIG_FILES) {
        const stack = state.fileHistories[f]
        const top = stack.future.at(-1)
        if (top && top.stepId === minStepId) {
          const pastEntry: FileHistoryEntry = {
            stepId: top.stepId,
            at: top.at,
            content: state.files[f],
            fileLog: extractFileLog(state.editLog, f),
          }
          nextFiles[f] = top.content
          nextLog = replaceFileLog(nextLog, f, top.fileLog)
          nextHistories[f] = {
            past: [...stack.past, pastEntry],
            future: stack.future.slice(0, -1),
          }
        }
      }
      return { files: nextFiles, editLog: nextLog, fileHistories: nextHistories }
    })
  }, [])

  const setWorkspaceMode = useCallback(
    (nextMode: WorkspaceMode) => {
      setWorkspaceModeInternal(nextMode)
      try {
        localStorage.setItem(STORAGE_WORKSPACE_MODE_KEY, nextMode)
      } catch {}
      if (nextMode === 'pro') {
        setSourceViewMode('closed')
        setSection((curr) => (curr === 'onboarding' ? 'sources' : curr))
        notify(
          tr(
            lang,
            '已切换至专业模式（左代码 · 右视觉），支持双向联动定位',
            'Switched to Pro Mode (Code Left · Visual Right)',
          ),
          'default',
        )
      } else {
        const progress = readGuidedProgress()
        setSection(progress.section)
        setSourcesSubTab(progress.tab)
        setVisualFocusTarget(null)
        notify(
          tr(
            lang,
            '已切换至引导模式（逐步向导），浏览器已自动保存进度',
            'Switched to Guided Mode — progress saved locally',
          ),
          'default',
        )
      }
    },
    [lang, notify],
  )

  const setProSplitRatio = useCallback((ratio: number) => {
    const clamped = Math.max(28, Math.min(68, Math.round(ratio * 10) / 10))
    setProSplitRatioInternal(clamped)
    try {
      localStorage.setItem(STORAGE_PRO_SPLIT_KEY, String(clamped))
    } catch {}
  }, [])

  const openSourceTarget = useCallback((destination: SourceTarget) => {
    navigate(destination, 'jump')
    const path = 'path' in destination
      ? destination.path
      : isYamlFile(destination.file)
        ? buildYamlSourceIndex(files[destination.file], parseYamlSafe(files[destination.file]).doc).pathAt(destination.line, destination.column)
        : []
    const feature = featureForSource(destination.file, path)
    if (workspaceMode === 'pro') {
      if (proView === 'features' && feature) {
        openFeature(feature)
      }
    } else {
      setSourceViewMode((mode) => mode === 'closed' ? 'drawer' : mode)
      if (feature) openFeature(feature)
    }
  }, [files, navigate, openFeature, proView, workspaceMode])

  const selectProFile = useCallback((file: ConfigFileKey) => {
    setProViewState('file')
    try { localStorage.setItem(STORAGE_PRO_VIEW_KEY, 'file') } catch {}
    navigate(fileStart(file), 'jump')
  }, [navigate])
  const setActiveSourceFile = useCallback((file: ConfigFileKey) => navigate(fileStart(file), 'jump'), [navigate])
  const jumpToSource = useCallback((file: ConfigFileKey, line?: number) => {
    const destination = line === undefined ? fileStart(file) : { file, line }
    if (workspaceMode === 'pro') {
      navigate(destination, 'jump')
    } else {
      navigate(destination, 'jump')
      setSourceViewMode((mode) => mode === 'closed' ? 'drawer' : mode)
    }
  }, [navigate, workspaceMode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen((o) => !o)
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (saveDraft()) {
          notify(tr(lang, '已保存至本地浏览器', 'Saved locally'), 'success')
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveDraft, lang, notify])

  const issues = useMemo(() => runHealthCheck(files, deployMode, { config: configParsed, timeline: timelineParsed }), [files, deployMode, configParsed, timelineParsed])

  const selectProSection = useCallback((section: SectionId, tab = sourcesSubTab) => {
    setProViewState('features')
    try { localStorage.setItem(STORAGE_PRO_VIEW_KEY, 'features') } catch {}
    if (section === 'sources') setSourcesSubTab(tab)
    focusVisual(section)
    navigate(sourceForFeature(section, tab), 'jump')
  }, [focusVisual, navigate, sourcesSubTab])

  const setActiveSection = useCallback((section: SectionId) => {
    if (workspaceMode === 'pro') selectProSection(section)
    else setSection(section)
  }, [workspaceMode, selectProSection])

  const setProView = useCallback((next: ProView) => {
    setProViewState(next)
    try { localStorage.setItem(STORAGE_PRO_VIEW_KEY, next) } catch {}
    if (next === 'file') {
      navigate(isYamlFile(activeSourceFile) ? { file: activeSourceFile, path: proPath } : target, 'jump')
      return
    }
    const feature = featureForSource(activeSourceFile, proPath)
    if (feature) {
      openFeature(feature)
    } else {
      focusVisual(activeSection === 'onboarding' ? 'sources' : activeSection)
    }
  }, [activeSourceFile, activeSection, focusVisual, navigate, openFeature, proPath, target])

  const dirtyFiles = useMemo(
    () => ALL_CONFIG_FILES.filter((k) => differsFromTemplate(baselineFiles[k], files[k])),
    [files, baselineFiles],
  )
  const changedFromDefaults = useMemo(() => {
    return ALL_CONFIG_FILES.filter((file) => {
      const def = getMatchingDefaultFile(file, files[file], templateLang)
      return differsFromTemplate(def, files[file])
    })
  }, [files, templateLang])
  const totalChangesCount = useMemo(() => {
    if (changedFromDefaults.length === 0) return 0
    let count = 0
    for (const file of changedFromDefaults) {
      const def = getMatchingDefaultFile(file, files[file], templateLang)
      const diff = compareTemplate(file, def, files[file], 'zh')
      count += diff.type === 'invalid' ? 1 : Math.max(1, diff.items.length)
    }
    return count
  }, [changedFromDefaults, files, templateLang])
  const hasCustomBaseline = useMemo(() => {
    return ALL_CONFIG_FILES.some((file) => !isUnmodifiedAgainstAnyDefault(file, baselineFiles[file]))
  }, [baselineFiles])

  const applyQuickFix = useCallback(
    (fixKey: string) => {
      if (fixKey === 'enable_region_ai_analysis') {
        patchConfigValues([{ path: ['display', 'regions', 'ai_analysis'], value: true }])
        notify(tr(lang, '已开启 AI 分析展示区', 'Enabled AI analysis display region'), 'success')
      } else if (fixKey === 'enable_html_format') {
        patchConfigValues([{ path: ['storage', 'formats', 'html'], value: true }])
        notify(tr(lang, '已开启 HTML 报告生成', 'Enabled HTML report output'), 'success')
      } else if (fixKey === 'enable_sqlite_format') {
        patchConfigValues([{ path: ['storage', 'formats', 'sqlite'], value: true }])
        notify(tr(lang, '已恢复开启 SQLite 主数据库', 'Re-enabled primary SQLite storage'), 'success')
      } else if (fixKey === 'disable_proxies') {
        patchConfigValues([
          { path: ['advanced', 'crawler', 'use_proxy'], value: false },
          { path: ['advanced', 'rss', 'use_proxy'], value: false },
          { path: ['advanced', 'web_search', 'use_proxy'], value: false },
        ])
        notify(tr(lang, '已关闭全部数据源代理开关', 'Disabled all source proxy toggles'), 'success')
      } else if (fixKey === 'normalize_weights') {
        const adv = configData.advanced as Record<string, unknown> | undefined
        const w = adv?.weight as Record<string, number> | undefined
        const r = Number(w?.rank ?? 0.6)
        const f = Number(w?.frequency ?? 0.3)
        const h = Number(w?.hotness ?? 0.1)
        const sum = r + f + h
        if (sum > 0) {
          const nr = Math.round((r / sum) * 100) / 100
          const nf = Math.round((f / sum) * 100) / 100
          const nh = Math.max(0, Math.round((1 - nr - nf) * 100) / 100)
          patchConfigValues([
            { path: ['advanced', 'weight', 'rank'], value: nr },
            { path: ['advanced', 'weight', 'frequency'], value: nf },
            { path: ['advanced', 'weight', 'hotness'], value: nh },
          ])
        } else {
          patchConfigValues([
            { path: ['advanced', 'weight', 'rank'], value: 0.6 },
            { path: ['advanced', 'weight', 'frequency'], value: 0.3 },
            { path: ['advanced', 'weight', 'hotness'], value: 0.1 },
          ])
        }
        notify(tr(lang, '已自动归一化权重总和为 1.0', 'Normalized weights to 1.0'), 'success')
      } else if (fixKey === 'fix_region_order') {
        const display = configData.display as Record<string, unknown> | undefined
        const curr = Array.isArray(display?.region_order) ? (display.region_order as string[]) : []
        const merged = [...curr]
        for (const r of ALL_REGIONS) {
          if (!merged.includes(r)) merged.push(r)
        }
        patchConfigValues([{ path: ['display', 'region_order'], value: merged }])
        notify(tr(lang, '已补全推送区域排序列表', 'Synced display.region_order'), 'success')
      }
    },
    [configData, lang, notify, patchConfigValues],
  )

  const saveSnapshot = useCallback(
    (name: string, note = '') => {
      const snap = createSnapshot(name, note, files, deployMode)
      setSnapshots((prev) => {
        const next = [snap, ...prev]
        persistSnapshots(next)
        return next
      })
      setActiveSnapshotId(snap.id)
      notify(
        tr(lang, '已保存「{name}」', 'Saved "{name}"', { name: snap.name }),
        'success',
      )
      return snap
    },
    [deployMode, files, lang, notify],
  )

  const overwriteSnapshot = useCallback(
    (id: string) => {
      let updatedName = ''
      setSnapshots((prev) => {
        const next = prev.map((item) => {
          if (item.id !== id) return item
          updatedName = item.name
          return {
            ...item,
            updatedAt: Date.now(),
            deployMode,
            files: { ...files },
            summary: summarizeConfigFiles(files),
          }
        })
        persistSnapshots(next)
        return next
      })
      setActiveSnapshotId(id)
      if (updatedName) {
        notify(
          tr(lang, '已更新「{name}」', 'Updated "{name}"', { name: updatedName }),
          'success',
        )
      }
    },
    [deployMode, files, lang, notify],
  )

  const loadSnapshot = useCallback(
    (id: string, backupCurrentFirst = false) => {
      const targetSnap = snapshots.find((s) => s.id === id)
      if (!targetSnap) return
      if (backupCurrentFirst) {
        const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const backup = createSnapshot(
          tr(lang, '切换前自动备份 {stamp}', 'Auto-backup {stamp}', { stamp }),
          '',
          files,
          deployMode,
        )
        setSnapshots((prev) => {
          const next = [backup, ...prev]
          persistSnapshots(next)
          return next
        })
      }
      coalesceRef.current = { at: 0, key: null, stepId: 0 }
      const snapFiles = { ...targetSnap.files }
      editFiles(() => snapFiles)
      setBaselineFiles(snapFiles)
      setTemplateLang((curr) => inferTemplateLang(snapFiles, curr))
      setDeployMode(targetSnap.deployMode)
      setActiveSnapshotId(targetSnap.id)
      notify(
        tr(lang, '已切换到「{name}」', 'Switched to "{name}"', { name: targetSnap.name }),
        'success',
      )
    },
    [deployMode, editFiles, files, lang, notify, snapshots],
  )

  const renameSnapshot = useCallback(
    (id: string, name: string, note?: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      setSnapshots((prev) => {
        const next = prev.map((item) =>
          item.id === id
            ? { ...item, name: trimmed, note: note !== undefined ? note.trim() : item.note, updatedAt: Date.now() }
            : item,
        )
        persistSnapshots(next)
        return next
      })
    },
    [],
  )

  const deleteSnapshot = useCallback(
    (id: string) => {
      setSnapshots((prev) => {
        const next = prev.filter((item) => item.id !== id)
        persistSnapshots(next)
        return next
      })
      setActiveSnapshotId((curr) => (curr === id ? null : curr))
      notify(tr(lang, '已删除该保存记录', 'Deleted saved setup'), 'default')
    },
    [lang, notify],
  )

  const importSnapshotsJson = useCallback(
    (rawJson: string) => {
      const imported = normalizeImportedSnapshots(rawJson, getDefaultFiles(lang))
      if (imported.length === 0) return 0
      setSnapshots((prev) => {
        const existingIds = new Set(prev.map((p) => p.id))
        const deduped = imported.filter((i) => !existingIds.has(i.id))
        const next = [...deduped, ...prev]
        persistSnapshots(next)
        return next
      })
      notify(
        tr(lang, '已导入 {count} 个配置版本', 'Imported {count} version(s)', { count: imported.length }),
        'success',
      )
      return imported.length
    },
    [lang, notify],
  )

  const getActiveCopyFile = useCallback((): ConfigFileKey => {
    if (workspaceMode === 'pro') return activeSourceFile
    if (activeSection === 'sources' && sourcesSubTab === 'search') return 'search_queries.txt'
    if (activeSection === 'filter') {
      const m = getInObject<string>(configData, ['filter', 'method'], 'keyword')
      return m === 'ai' ? 'ai_interests.txt' : 'frequency_words.txt'
    }
    return 'config.yaml'
  }, [activeSection, activeSourceFile, configData, sourcesSubTab, workspaceMode])

  const undoCount = useMemo(
    () => ALL_CONFIG_FILES.reduce((sum, f) => sum + fileHistories[f].past.length, 0),
    [fileHistories],
  )
  const canUndo = undoCount > 0
  const canRedo = useMemo(
    () => ALL_CONFIG_FILES.some((f) => fileHistories[f].future.length > 0),
    [fileHistories],
  )
  const canUndoFile = useCallback(
    (file: ConfigFileKey) => fileHistories[file].past.length > 0,
    [fileHistories],
  )
  const canRedoFile = useCallback(
    (file: ConfigFileKey) => fileHistories[file].future.length > 0,
    [fileHistories],
  )
  const getFileUndoCount = useCallback(
    (file: ConfigFileKey) => fileHistories[file].past.length,
    [fileHistories],
  )

  return (
    <EditorContext.Provider
      value={{
        files,
        baselineFiles,
        templateLang,
        dirtyFiles,
        changedFromDefaults,
        totalChangesCount,
        hasCustomBaseline,
        configData,
        configError: configParsed.error,
        timelineError: timelineParsed.error,
        issues,
        lang,
        setLang,
        theme,
        toggleTheme,
        deployMode,
        setDeployMode,
        workspaceMode,
        setWorkspaceMode,
        proSplitRatio,
        setProSplitRatio,
        sourcesSubTab,
        setSourcesSubTab,
        activeSection,
        setActiveSection,
        selectProFile,
        selectProSection,
        openSourceTarget,
        proView,
        setProView,
        proAutoFollow,
        setProAutoFollow,
        proAlignTop,
        activeYamlDoc,
        chapters,
        proPath,
        proPosition,
        revealSeq: navigation.origin === 'form' ? 0 : navigation.seq,
        trackSourcePosition,
        syncProScrollLine,
        focusSourceFromForm,
        patchYamlFile,
        sourceViewMode,
        setSourceViewMode,
        activeSourceFile,
        setActiveSourceFile,
        sourceJumpLine,
        sourceFlash,
        jumpToSource,
        visualFocusTarget,
        focusVisual,
        resumedSession,
        dismissResumedSession,
        exportOpen,
        setExportOpen,
        importOpen,
        setImportOpen,
        importDefaultTab,
        openImportDialog,
        commandOpen,
        setCommandOpen,
        versionsOpen,
        setVersionsOpen,
        previewMode,
        setPreviewMode,
        togglePreview,
        changesRequest,
        setChangesRequest,
        getActiveCopyFile,
        snapshots,
        activeSnapshotId,
        saveSnapshot,
        overwriteSnapshot,
        loadSnapshot,
        renameSnapshot,
        deleteSnapshot,
        importSnapshotsJson,
        setFileContent,
        setConfigValue,
        patchConfigValues,
        removeConfigKey,
        loadFiles,
        resetFile,
        resetAll,
        applyQuickFix,
        canUndo,
        undoCount,
        canRedo,
        undo,
        redo,
        canUndoFile,
        canRedoFile,
        getFileUndoCount,
        undoFile,
        redoFile,
        editLog,
        configOrigin,
        setConfigOrigin,
        toasts,
        notify,
        lastSavedAt,
        persistenceError,
      }}
    >
      {children}
    </EditorContext.Provider>
  )
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor must be used inside EditorProvider')
  return ctx
}
