import type { Lang, TimelineBehavior, TimelinePeriod, TimelinePresetConfig } from './types.ts'
import { parseYamlSafe, setYamlValue, setYamlValues } from './yaml-doc.ts'

export interface TimelineParsedPreset {
  key: string
  isCustom: boolean
  config: TimelinePresetConfig
}

export interface TimelineValidationIssue {
  type: 'overlap' | 'dangling_period' | 'dangling_plan' | 'invalid_periods' | 'missing_day' | 'invalid_time' | 'short_window'
  presetKey: string
  detail: string
  detailZh: string
  detailEn: string
  day?: number
  periodKey?: string
}

export interface TimelineVisualSegment {
  periodKey: string
  name: string
  startMin: number
  endMin: number
  crossMidnight: boolean
  behavior: Required<Pick<TimelineBehavior, 'collect' | 'analyze' | 'push'>> & {
    search: boolean
    reportMode: string
    aiMode: string
    oncePush: boolean
    onceAnalyze: boolean
    onceSearch: boolean
  }
}

export function timeToMinutes(hhmm: string): number | null {
  const m = String(hhmm ?? '').trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

export function minutesToTime(totalMin: number): string {
  const norm = ((totalMin % 1440) + 1440) % 1440
  const h = Math.floor(norm / 60)
  const m = norm % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

import { tr } from '../i18n/translate.ts'

/** Validate shapes before typed UI consumers read partially edited source. */
function presetStructureError(raw: unknown, path: string, lang: Lang = 'en'): string | null {
  const msg = (zh: string, en: string, vars?: Record<string, string | number>) => tr(lang, zh, en, vars)
  if (!isRecord(raw)) return msg('{path}：应为键值映射（mapping）', '{path}: expected a mapping', { path })
  const behaviorError = (value: unknown, location: string): string | null => {
    if (!isRecord(value)) return msg('{path}：应为键值映射（mapping）', '{path}: expected a mapping', { path: location })
    for (const key of ['collect', 'analyze', 'push', 'search']) {
      if (value[key] !== undefined && value[key] !== null && typeof value[key] !== 'boolean') {
        return msg('{path}：应为布尔值 true 或 false', '{path}: expected true or false', { path: `${location}.${key}` })
      }
    }
    for (const key of ['name', 'start', 'end', 'report_mode', 'ai_mode', 'filter_method', 'frequency_file', 'interests_file', 'search_file']) {
      if (value[key] != null && typeof value[key] !== 'string') {
        return msg('{path}：应为文本字符串', '{path}: expected text', { path: `${location}.${key}` })
      }
    }
    if (value.once != null) {
      if (!isRecord(value.once)) return msg('{path}：应为键值映射（mapping）', '{path}: expected a mapping', { path: `${location}.once` })
      for (const key of ['analyze', 'push', 'search']) {
        if (value.once[key] != null && typeof value.once[key] !== 'boolean') {
          return msg('{path}：应为布尔值 true 或 false', '{path}: expected true or false', { path: `${location}.once.${key}` })
        }
      }
    }
    return null
  }
  for (const key of ['name', 'description']) {
    if (raw[key] != null && typeof raw[key] !== 'string') {
      return msg('{path}：应为文本字符串', '{path}: expected text', { path: `${path}.${key}` })
    }
  }
  if (raw.default != null) {
    const error = behaviorError(raw.default, `${path}.default`)
    if (error) return error
  }
  for (const key of ['periods', 'day_plans', 'week_map']) {
    if (raw[key] != null && !isRecord(raw[key])) {
      return msg('{path}：应为键值映射（mapping）', '{path}: expected a mapping', { path: `${path}.${key}` })
    }
  }
  for (const [key, period] of Object.entries((raw.periods ?? {}) as Record<string, unknown>)) {
    const error = behaviorError(period, `${path}.periods.${key}`)
    if (error) return error
  }
  for (const [key, plan] of Object.entries((raw.day_plans ?? {}) as Record<string, unknown>)) {
    if (!isRecord(plan) || !Array.isArray(plan.periods) || plan.periods.some((entry) => typeof entry !== 'string')) {
      return msg('{path}：应为时段名称列表', '{path}: expected a list of period names', { path: `${path}.day_plans.${key}.periods` })
    }
  }
  return null
}

function normalizePresetConfig(raw: unknown): TimelinePresetConfig {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const def = (obj.default && typeof obj.default === 'object'
    ? obj.default
    : {}) as TimelineBehavior
  const periods = (obj.periods && typeof obj.periods === 'object'
    ? obj.periods
    : {}) as Record<string, TimelinePeriod>
  const day_plans = (obj.day_plans && typeof obj.day_plans === 'object'
    ? obj.day_plans
    : {}) as Record<string, { periods: string[] }>
  const rawWeekMap = (obj.week_map && typeof obj.week_map === 'object'
    ? obj.week_map
    : {}) as Record<string, string>
  const week_map: Record<string, string> = {}
  for (const [k, v] of Object.entries(rawWeekMap)) {
    week_map[String(k)] = String(v ?? '')
  }
  const overlap = (obj.overlap && typeof obj.overlap === 'object'
    ? obj.overlap
    : undefined) as { policy?: 'error_on_overlap' | 'last_wins' } | undefined

  return {
    name: typeof obj.name === 'string' ? obj.name : undefined,
    description: typeof obj.description === 'string' ? obj.description : undefined,
    default: def,
    periods,
    day_plans,
    week_map,
    overlap,
  }
}

export function parseTimelinePresets(rawYaml: string, lang: Lang = 'en'): {
  presets: TimelineParsedPreset[]
  error: string | null
} {
  const { data, error } = parseYamlSafe<Record<string, unknown>>(rawYaml)
  if (error || !data) {
    return { presets: [], error: error?.message ?? tr(lang, 'timeline.yaml 格式无效', 'Invalid timeline.yaml') }
  }
  const list: TimelineParsedPreset[] = []
  if (!isRecord(data)) {
    return {
      presets: [],
      error: tr(lang, 'timeline.yaml：最外层应为键值映射（mapping）', 'timeline.yaml: expected a mapping'),
    }
  }
  const presetsObj = data.presets
  if (presetsObj != null && !isRecord(presetsObj)) {
    return {
      presets: [],
      error: tr(lang, 'presets：应为键值映射（mapping）', 'presets: expected a mapping'),
    }
  }
  if (isRecord(presetsObj)) {
    for (const [key, val] of Object.entries(presetsObj as Record<string, unknown>)) {
      const structErr = presetStructureError(val, `presets.${key}`, lang)
      if (structErr) return { presets: [], error: structErr }
      list.push({
        key,
        isCustom: false,
        config: normalizePresetConfig(val),
      })
    }
  }
  if (Object.hasOwn(data, 'custom')) {
    const structErr = presetStructureError(data.custom, 'custom', lang)
    if (structErr) return { presets: [], error: structErr }
    list.push({
      key: 'custom',
      isCustom: true,
      config: normalizePresetConfig(data.custom),
    })
  }
  return { presets: list, error: null }
}

export function getPresetBasePath(presetKey: string): string[] {
  return presetKey === 'custom' ? ['custom'] : ['presets', presetKey]
}

export function updatePresetField(
  rawYaml: string,
  presetKey: string,
  subPath: Array<string | number>,
  value: unknown,
): string {
  return setYamlValue(rawYaml, [...getPresetBasePath(presetKey), ...subPath], value)
}

export function duplicatePreset(
  rawYaml: string,
  sourceKey: string,
  newKey: string,
  newName: string,
  newDescription?: string,
): string {
  const { presets } = parseTimelinePresets(rawYaml)
  const src = presets.find((p) => p.key === sourceKey)
  if (!src) return rawYaml
  const clone = structuredClone(src.config)
  clone.name = newName
  if (newDescription !== undefined) {
    if (newDescription.trim()) clone.description = newDescription.trim()
    else delete clone.description
  }
  return setYamlValue(rawYaml, ['presets', newKey], clone)
}

export function deleteCustomPreset(rawYaml: string, presetKey: string): string {
  if (presetKey === 'custom') return rawYaml
  return setYamlValues(rawYaml, [{ path: ['presets', presetKey], remove: true }])
}

export function resolveEffectiveBehavior(
  def: TimelineBehavior,
  period?: TimelineBehavior,
) {
  const collect = period?.collect ?? def.collect ?? true
  const analyze = period?.analyze ?? def.analyze ?? false
  const push = period?.push ?? def.push ?? false
  const rawSearch = period?.search !== undefined ? period.search : def.search
  const search = rawSearch === null || rawSearch === undefined ? collect : Boolean(rawSearch)
  const reportMode = period?.report_mode ?? def.report_mode ?? 'current'
  const aiMode = period?.ai_mode ?? def.ai_mode ?? 'follow_report'
  const onceAnalyze = period?.once?.analyze ?? def.once?.analyze ?? false
  const oncePush = period?.once?.push ?? def.once?.push ?? false
  const onceSearch = period?.once?.search ?? def.once?.search ?? false
  return {
    collect,
    analyze,
    push,
    search,
    reportMode,
    aiMode,
    oncePush,
    onceAnalyze,
    onceSearch,
  }
}

export function buildDaySegments(
  config: TimelinePresetConfig,
  dayNumber: number,
): TimelineVisualSegment[] {
  const planKey = config.week_map[String(dayNumber)]
  const plan = planKey ? config.day_plans[planKey] : undefined
  const periodKeys = Array.isArray(plan?.periods) ? plan.periods : []
  const segments: TimelineVisualSegment[] = []

  for (const pKey of periodKeys) {
    const p = config.periods[pKey]
    if (!p) continue
    const startMin = timeToMinutes(p.start)
    const endMin = timeToMinutes(p.end)
    if (startMin === null || endMin === null || startMin === endMin) continue
    const behavior = resolveEffectiveBehavior(config.default, p)
    const label = p.name || pKey

    if (startMin < endMin) {
      segments.push({
        periodKey: pKey,
        name: label,
        startMin,
        endMin,
        crossMidnight: false,
        behavior,
      })
    } else {
      // Cross-midnight splits visually into [start..1440] and [0..end]
      segments.push({
        periodKey: pKey,
        name: label,
        startMin,
        endMin: 1440,
        crossMidnight: true,
        behavior,
      })
      segments.push({
        periodKey: pKey,
        name: label,
        startMin: 0,
        endMin,
        crossMidnight: true,
        behavior,
      })
    }
  }
  return segments
}

const WEEKDAY_ZH = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']

export function validateTimelinePreset(
  presetKey: string,
  config: TimelinePresetConfig,
): TimelineValidationIssue[] {
  const issues: TimelineValidationIssue[] = []
  const policy = config.overlap?.policy ?? 'error_on_overlap'

  for (let d = 1; d <= 7; d++) {
    const dayZh = WEEKDAY_ZH[d] || `星期 ${d}`
    const planKey = config.week_map[String(d)]
    if (!planKey) {
      const detailEn = `Day ${d} has no day_plan mapping`
      issues.push({
        type: 'missing_day',
        presetKey,
        day: d,
        detail: detailEn,
        detailEn,
        detailZh: `${dayZh}（week_map[${d}]）尚未分配日计划`,
      })
      continue
    }
    const plan = config.day_plans[planKey]
    if (!plan) {
      const detailEn = `week_map[${d}] references missing day_plan "${planKey}"`
      issues.push({
        type: 'dangling_plan',
        presetKey,
        day: d,
        detail: detailEn,
        detailEn,
        detailZh: `${dayZh}（week_map[${d}]）引用的日计划 "${planKey}" 不存在`,
      })
      continue
    }

    if (!Array.isArray(plan.periods)) {
      const detailEn = `day_plans.${planKey}.periods must be a list`
      issues.push({
        type: 'invalid_periods',
        presetKey,
        day: d,
        detail: detailEn,
        detailEn,
        detailZh: `日计划 day_plans.${planKey}.periods 必须是列表`,
      })
      continue
    }
    const intervals: Array<{ key: string; start: number; end: number }> = []
    for (const pKey of plan.periods) {
      const p = config.periods[pKey]
      if (!p) {
        const detailEn = `day_plan "${planKey}" references missing period "${pKey}"`
        issues.push({
          type: 'dangling_period',
          presetKey,
          day: d,
          periodKey: pKey,
          detail: detailEn,
          detailEn,
          detailZh: `日计划 "${planKey}" 引用了不存在的时段 "${pKey}"`,
        })
        continue
      }
      const s = timeToMinutes(p.start)
      const e = timeToMinutes(p.end)
      if (s === null || e === null || s === e) {
        const detailEn = `Period "${pKey}" has invalid start/end (${p.start} - ${p.end})`
        issues.push({
          type: 'invalid_time',
          presetKey,
          periodKey: pKey,
          detail: detailEn,
          detailEn,
          detailZh: `时段 "${pKey}" 的起止时间无效（${p.start} - ${p.end}）`,
        })
        continue
      }
      const dur = s < e ? e - s : 1440 - s + e
      if (dur < 120) {
        const detailEn = `Period "${pKey}" (${p.start}-${p.end}) is shorter than 2h (${dur}m)`
        issues.push({
          type: 'short_window',
          presetKey,
          periodKey: pKey,
          detail: detailEn,
          detailEn,
          detailZh: `时段 "${pKey}"（${p.start}-${p.end}）跨度不足 2 小时（当前 ${dur} 分钟），GitHub Actions 定时触发存在延迟漏跑风险`,
        })
      }
      if (s < e) {
        intervals.push({ key: pKey, start: s, end: e })
      } else {
        intervals.push({ key: pKey, start: s, end: 1440 })
        intervals.push({ key: pKey, start: 0, end: e })
      }
    }

    if (policy === 'error_on_overlap') {
      for (let i = 0; i < intervals.length; i++) {
        for (let j = i + 1; j < intervals.length; j++) {
          const a = intervals[i]
          const b = intervals[j]
          if (a.key === b.key) continue
          if (a.start < b.end && b.start < a.end) {
            const detailEn = `Day ${d}: "${a.key}" overlaps with "${b.key}" under error_on_overlap`
            issues.push({
              type: 'overlap',
              presetKey,
              day: d,
              periodKey: b.key,
              detail: detailEn,
              detailEn,
              detailZh: `${dayZh}：时段 "${a.key}" 与 "${b.key}" 时间重叠（当前策略为重叠报错 error_on_overlap）`,
            })
          }
        }
      }
    }
  }

  // Deduplicate identical period errors across weekdays
  const seen = new Set<string>()
  return issues.filter((it) => {
    const sig = `${it.type}:${it.presetKey}:${it.periodKey ?? ''}:${it.day ?? ''}:${it.detail}`
    if (seen.has(sig)) return false
    seen.add(sig)
    return true
  })
}
