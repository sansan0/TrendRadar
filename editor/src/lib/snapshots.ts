import type {
  ConfigFilesMap,
  ConfigVersionSnapshot,
  DeployMode,
  SnapshotSummary,
} from './types.ts'
import { ALL_CONFIG_FILES } from './types.ts'
import { uid } from './utils.ts'
import { getInObject, parseYamlSafe } from './yaml-doc.ts'

export const STORAGE_SNAPSHOTS_KEY = 'tr_studio_v2_snapshots'

const CHANNEL_CHECK_PATHS: string[][] = [
  ['notification', 'channels', 'feishu', 'webhook_url'],
  ['notification', 'channels', 'dingtalk', 'webhook_url'],
  ['notification', 'channels', 'wework', 'webhook_url'],
  ['notification', 'channels', 'telegram', 'bot_token'],
  ['notification', 'channels', 'email', 'from'],
  ['notification', 'channels', 'ntfy', 'topic'],
  ['notification', 'channels', 'bark', 'url'],
  ['notification', 'channels', 'slack', 'webhook_url'],
  ['notification', 'channels', 'generic_webhook', 'webhook_url'],
]

export function summarizeConfigFiles(files: ConfigFilesMap): SnapshotSummary {
  const { data } = parseYamlSafe<Record<string, unknown>>(files['config.yaml'])
  const cfg = data ?? {}
  const enabledSources = [
    Boolean(getInObject<boolean>(cfg, ['platforms', 'enabled'], true)),
    Boolean(getInObject<boolean>(cfg, ['rss', 'enabled'], true)),
    Boolean(getInObject<boolean>(cfg, ['web_search', 'enabled'], false)),
  ].filter(Boolean).length

  const rawMethod = String(getInObject<string>(cfg, ['filter', 'method'], 'keyword') || 'keyword')
  const filterMethod = rawMethod === 'ai' ? 'ai' : 'keyword'
  const aiEnabled =
    Boolean(getInObject<boolean>(cfg, ['ai_analysis', 'enabled'], false)) ||
    Boolean(getInObject<boolean>(cfg, ['ai_translation', 'enabled'], false)) ||
    filterMethod === 'ai'
  const scheduleEnabled = Boolean(getInObject<boolean>(cfg, ['schedule', 'enabled'], false))
  const schedulePreset = String(
    getInObject<string>(cfg, ['schedule', 'preset'], 'morning_evening') || 'morning_evening',
  )
  const configuredChannels = CHANNEL_CHECK_PATHS.filter(
    (p) => String(getInObject(cfg, p, '') ?? '').trim().length > 0,
  ).length

  return {
    enabledSources,
    filterMethod,
    aiEnabled,
    scheduleEnabled,
    schedulePreset,
    configuredChannels,
  }
}

export function createSnapshot(
  name: string,
  note: string,
  files: ConfigFilesMap,
  deployMode: DeployMode,
): ConfigVersionSnapshot {
  const now = Date.now()
  return {
    id: uid('ver'),
    name: name.trim() || `Snapshot ${new Date(now).toLocaleTimeString()}`,
    note: note.trim(),
    createdAt: now,
    updatedAt: now,
    deployMode,
    files: { ...files },
    summary: summarizeConfigFiles(files),
  }
}

export function loadStoredSnapshots(): ConfigVersionSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_SNAPSHOTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is ConfigVersionSnapshot =>
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        item.files &&
        typeof item.files === 'object',
    )
  } catch {
    return []
  }
}

export function persistSnapshots(list: ConfigVersionSnapshot[]): void {
  try {
    localStorage.setItem(STORAGE_SNAPSHOTS_KEY, JSON.stringify(list))
  } catch {
    // Ignore quota errors gracefully
  }
}

export function normalizeImportedSnapshots(
  rawJson: string,
  fallbackFiles: ConfigFilesMap,
): ConfigVersionSnapshot[] {
  const parsed = JSON.parse(rawJson)
  const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.snapshots) ? parsed.snapshots : []
  const result: ConfigVersionSnapshot[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object' || typeof item.name !== 'string' || !item.files) continue
    const files: ConfigFilesMap = { ...fallbackFiles }
    for (const k of ALL_CONFIG_FILES) {
      if (typeof item.files[k] === 'string') {
        files[k] = item.files[k]
      }
    }
    const now = Date.now()
    result.push({
      id: typeof item.id === 'string' ? item.id : uid('ver'),
      name: item.name,
      note: typeof item.note === 'string' ? item.note : '',
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : now,
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : now,
      deployMode:
        item.deployMode === 'github_actions' || item.deployMode === 'local'
          ? item.deployMode
          : 'docker',
      files,
      summary: summarizeConfigFiles(files),
    })
  }
  return result
}
