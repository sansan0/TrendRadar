import type { ConfigFileKey, ConfigFilesMap, Lang } from './types'
import { ALL_CONFIG_FILES } from './types'
import { parseVersionConfigs } from './defaults'
import { compareVersions, extractFileVersion } from './utils'

export interface RemoteSourceInfo {
  kind: 'github' | 'jsdelivr'
  host: string
}

const REMOTE_ENDPOINTS: Array<{ kind: 'github' | 'jsdelivr'; host: string; base: string }> = [
  {
    kind: 'github',
    host: 'raw.githubusercontent.com',
    base: 'https://raw.githubusercontent.com/sansan0/TrendRadar/master/',
  },
  {
    kind: 'jsdelivr',
    host: 'fastly.jsdelivr.net',
    base: 'https://fastly.jsdelivr.net/gh/sansan0/TrendRadar@master/',
  },
  {
    kind: 'jsdelivr',
    host: 'cdn.jsdelivr.net',
    base: 'https://cdn.jsdelivr.net/gh/sansan0/TrendRadar@master/',
  },
  {
    kind: 'jsdelivr',
    host: 'gcore.jsdelivr.net',
    base: 'https://gcore.jsdelivr.net/gh/sansan0/TrendRadar@master/',
  },
]

const EN_VARIANT_FILES: Record<ConfigFileKey, string> = {
  'config.yaml': 'config/config.en.yaml',
  'timeline.yaml': 'config/timeline.en.yaml',
  'frequency_words.txt': 'config/frequency_words.en.txt',
  'search_queries.txt': 'config/search_queries.en.txt',
  'ai_interests.txt': 'config/ai_interests.en.txt',
  'ai_analysis_prompt.txt': 'config/ai_analysis_prompt.en.txt',
  'ai_translation_prompt.txt': 'config/ai_translation_prompt.en.txt',
}

import { toTemplateLang } from '../i18n/languages.ts'

export function getRemotePathForFile(key: ConfigFileKey, lang: Lang): string {
  if (toTemplateLang(lang) === 'en') {
    return EN_VARIANT_FILES[key]
  }
  return `config/${key}`
}

export async function fetchWithSource(
  relPath: string,
  timeoutMs = 8000,
): Promise<{ text: string; source: RemoteSourceInfo }> {
  const errors: string[] = []
  for (const endpoint of REMOTE_ENDPOINTS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(`${endpoint.base}${relPath}?t=${Date.now()}`, {
        signal: controller.signal,
        cache: 'no-store',
      })
      clearTimeout(timer)
      if (!res.ok) {
        errors.push(`${endpoint.host}: HTTP ${res.status}`)
        continue
      }
      const text = await res.text()
      return { text, source: { kind: endpoint.kind, host: endpoint.host } }
    } catch (err) {
      clearTimeout(timer)
      errors.push(`${endpoint.host}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  throw new Error(`All endpoints failed for ${relPath}: ${errors.join(' | ')}`)
}

export async function fetchWithMirrorFallback(relPath: string, timeoutMs = 8000): Promise<string> {
  const res = await fetchWithSource(relPath, timeoutMs)
  return res.text
}

export interface FileVersionStatus {
  file: ConfigFileKey
  localVersion: string | null
  remoteVersion: string | null
  status: 'up_to_date' | 'outdated' | 'ahead' | 'unknown'
}

export async function checkAllFileVersions(files: ConfigFilesMap): Promise<{
  statuses: FileVersionStatus[]
  remoteVersions: Record<string, string>
  source: RemoteSourceInfo
}> {
  const { text: raw, source } = await fetchWithSource('version_configs')
  const remoteVersions = parseVersionConfigs(raw)
  const statuses: FileVersionStatus[] = ALL_CONFIG_FILES.map((file) => {
    const localVersion = extractFileVersion(files[file])
    const remoteVersion = remoteVersions[file] ?? null
    if (!localVersion || !remoteVersion) {
      return { file, localVersion, remoteVersion, status: 'unknown' }
    }
    const cmp = compareVersions(localVersion, remoteVersion)
    return {
      file,
      localVersion,
      remoteVersion,
      status: cmp < 0 ? 'outdated' : cmp > 0 ? 'ahead' : 'up_to_date',
    }
  })
  return { statuses, remoteVersions, source }
}

export async function fetchRemoteConfigFiles(
  keys: ConfigFileKey[],
  lang: Lang,
): Promise<{ files: Partial<ConfigFilesMap>; source: RemoteSourceInfo }> {
  const out: Partial<ConfigFilesMap> = {}
  const sources: RemoteSourceInfo[] = []
  await Promise.all(
    keys.map(async (key) => {
      const targetPath = getRemotePathForFile(key, lang)
      const fallbackPath = `config/${key}`
      try {
        const res = await fetchWithSource(targetPath)
        out[key] = res.text
        sources.push(res.source)
      } catch (err) {
        if (targetPath !== fallbackPath) {
          const res = await fetchWithSource(fallbackPath)
          out[key] = res.text
          sources.push(res.source)
        } else {
          throw err
        }
      }
    }),
  )
  const mirrorUsed = sources.find((s) => s.kind === 'jsdelivr')
  const source: RemoteSourceInfo = mirrorUsed ?? sources[0] ?? { kind: 'github', host: 'raw.githubusercontent.com' }
  return { files: out, source }
}
