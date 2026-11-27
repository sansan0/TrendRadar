import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseYamlSafe, setYamlValue, setYamlValues } from '../yaml-doc.ts'
import {
  parseFrequencyWords,
  serializeFrequencyWords,
  testTitlesAgainstFrequency,
} from '../frequency-parser.ts'
import { parseSearchQueries, serializeSearchQueries } from '../search-parser.ts'
import {
  buildDaySegments,
  parseTimelinePresets,
  validateTimelinePreset,
} from '../timeline-engine.ts'
import { extractSecrets, generateDotEnv, generateDotEnvSnippet, isSensitiveField, sanitizeConfigYaml } from '../exporter.ts'
import { createSnapshot, normalizeImportedSnapshots } from '../snapshots.ts'
import { runHealthCheck } from '../validator.ts'
import type { ConfigFilesMap } from '../types.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../../..')

function loadRepoConfigFiles(): ConfigFilesMap {
  const read = (rel: string) => fs.readFileSync(path.join(repoRoot, 'config', rel), 'utf8')
  return {
    'config.yaml': read('config.yaml'),
    'timeline.yaml': read('timeline.yaml'),
    'frequency_words.txt': read('frequency_words.txt'),
    'search_queries.txt': read('search_queries.txt'),
    'ai_interests.txt': read('ai_interests.txt'),
    'ai_analysis_prompt.txt': read('ai_analysis_prompt.txt'),
    'ai_translation_prompt.txt': read('ai_translation_prompt.txt'),
  }
}

test('YAML AST updates preserve comments and platform expected_domain fields', () => {
  const files = loadRepoConfigFiles()
  const updated = setYamlValue(files['config.yaml'], ['schedule', 'enabled'], true)

  // Comments must remain intact
  assert.ok(updated.includes('TrendRadar 配置文件'))
  assert.ok(updated.includes('可视化配置编辑器地址'))
  // expected_domain must never be stripped
  assert.ok(updated.includes('expected_domain: "zhihu.com"'))
  assert.ok(updated.includes('expected_domain: "baidu.com"'))

  const parsed = parseYamlSafe<Record<string, any>>(updated)
  assert.equal(parsed.error, null)
  assert.equal(parsed.data?.schedule?.enabled, true)
  assert.equal(parsed.data?.platforms?.sources?.[0]?.expected_domain, 'toutiao.com')
})

test('Frequency words parser preserves mixed groups and mirrors Python matching semantics', () => {
  const files = loadRepoConfigFiles()
  const doc = parseFrequencyWords(files['frequency_words.txt'])
  assert.ok(doc.globalFilters.length >= 1)
  assert.ok(doc.groups.length > 10)

  // Round-trip serialization preserves groups without splitting mixed alias+normal groups
  const serialized = serializeFrequencyWords(doc)
  const reparsed = parseFrequencyWords(serialized)
  assert.equal(reparsed.groups.length, doc.groups.length)

  // Test sandbox matching: global filter rejects first, then first-match-wins
  const { results } = testTitlesAgainstFrequency(doc, [
    '震惊！某地发生大事',
    '华为发布新一代鸿蒙系统',
    'DeepSeek 开源新模型引发关注',
    '今天天气不错出去散步',
  ])
  assert.equal(results[0].status, 'filtered_global')
  assert.equal(results[1].status, 'matched')
  assert.equal(results[1].matchedGroupName, '华为')
  assert.equal(results[2].status, 'matched')
  assert.equal(results[2].matchedGroupName, 'DeepSeek')
  assert.equal(results[3].status, 'unmatched')
})

test('Search queries parser round-trips global filters and topic modifiers', () => {
  const files = loadRepoConfigFiles()
  const doc = parseSearchQueries(files['search_queries.txt'])
  assert.ok(doc.globalExcludeWords.includes('震惊'))
  assert.ok(doc.globalExcludeSites.includes('baijiahao.baidu.com'))
  assert.equal(doc.topics.length, 3)
  assert.equal(doc.topics[0].maxItems, 8)
  assert.equal(doc.topics[0].freshnessDays, 7)

  const out = serializeSearchQueries(doc)
  const doc2 = parseSearchQueries(out)
  assert.equal(doc2.topics.length, 3)
  assert.deepEqual(doc2.globalExcludeSites, doc.globalExcludeSites)
})

test('Timeline engine handles cross-midnight periods and detects overlaps', () => {
  const files = loadRepoConfigFiles()
  const { presets, error } = parseTimelinePresets(files['timeline.yaml'])
  assert.equal(error, null)
  assert.ok(presets.length >= 5)

  const nightOwl = presets.find((p) => p.key === 'night_owl')!
  const segs = buildDaySegments(nightOwl.config, 1)
  // late_night 22:00-01:00 splits into two cross-midnight segments + afternoon_peek = 3
  assert.equal(segs.length, 3)
  assert.ok(segs.some((s) => s.crossMidnight && s.endMin === 1440))
  assert.ok(segs.some((s) => s.crossMidnight && s.startMin === 0))

  // Default presets must have zero structural errors
  for (const p of presets) {
    const errs = validateTimelinePreset(p.key, p.config).filter((i) => i.type !== 'short_window')
    assert.equal(errs.length, 0, `Preset ${p.key} unexpected errors: ${JSON.stringify(errs)}`)
  }
})

test('Validator detects high-risk cross-field traps and exporter sanitizes secrets cleanly', () => {
  const files = loadRepoConfigFiles()
  const mutated = setYamlValues(files['config.yaml'], [
    { path: ['ai_analysis', 'enabled'], value: true },
    { path: ['display', 'regions', 'ai_analysis'], value: false },
    { path: ['notification', 'channels', 'email', 'from'], value: 'bot@example.com' },
    { path: ['storage', 'formats', 'html'], value: false },
    { path: ['ai', 'api_key'], value: 'sk-test-secret-123456' },
    { path: ['advanced', 'rss', 'use_proxy'], value: true },
  ])

  const issues = runHealthCheck({ ...files, 'config.yaml': mutated }, 'github_actions')
  const ids = new Set(issues.map((i) => i.id))
  assert.ok(ids.has('ai-analysis-hidden-token-waste'))
  assert.ok(ids.has('email-requires-html'))
  assert.ok(ids.has('gha-proxy-trap'))
  assert.ok(ids.has('gha-secrets-in-yaml'))

  const secrets = extractSecrets(mutated)
  assert.ok(secrets.some((s) => s.envKey === 'AI_API_KEY'))
  const envText = generateDotEnv(mutated, true, {
    webserverPort: '9090',
    cronSchedule: '*/15 * * * *',
    runMode: 'cron',
    immediateRun: false,
    mcpPort: '3334',
  })
  assert.ok(envText.includes('AI_API_KEY=sk-test-secret-123456'))
  assert.ok(envText.includes('WEBSERVER_PORT=9090'))
  assert.ok(envText.includes('CRON_SCHEDULE=*/15 * * * *'))
  assert.ok(envText.includes('RUN_MODE=cron'))
  assert.ok(envText.includes('IMMEDIATE_RUN=false'))
  assert.ok(envText.includes('MCP_PORT=3334'))
  // Non-secret switches remain empty so config.yaml changes take effect immediately
  assert.ok(envText.includes('AI_ANALYSIS_ENABLED=\n'))
  assert.ok(envText.includes('AI_MODEL=\n'))

  const snippet = generateDotEnvSnippet(mutated)
  assert.ok(snippet.includes('AI_API_KEY=sk-test-secret-123456'))
  assert.equal(snippet.includes('WEBSERVER_PORT='), false, 'Incremental snippet must not overwrite Docker runtime settings')

  const cleanYaml = sanitizeConfigYaml(mutated)
  assert.ok(!cleanYaml.includes('sk-test-secret-123456'))
  assert.ok(cleanYaml.includes('expected_domain: "zhihu.com"'))
})

test('Config snapshots capture all 7 files, compute accurate summary, and import cleanly', () => {
  const files = loadRepoConfigFiles()
  const snap = createSnapshot('Workday Minimal', 'No AI test', files, 'docker')
  assert.equal(snap.name, 'Workday Minimal')
  assert.equal(snap.summary.enabledSources, 2)
  assert.equal(snap.summary.filterMethod, 'keyword')
  assert.equal(snap.files['timeline.yaml'], files['timeline.yaml'])

  const json = JSON.stringify({ snapshots: [snap] })
  const restored = normalizeImportedSnapshots(json, files)
  assert.equal(restored.length, 1)
  assert.equal(restored[0].name, 'Workday Minimal')
  assert.equal(restored[0].files['search_queries.txt'], files['search_queries.txt'])
})

test('live validation keeps the editor available while a list or a period is only partly typed', () => {
  const files = loadRepoConfigFiles()
  files['config.yaml'] = 'display:\n  regions: { hotlist: true }\n  region_order:\nschedule:\n  enabled: true\n  preset: custom'
  files['timeline.yaml'] = 'custom:\n  periods:\n    draft:\n  day_plans:\n    monday:\n      periods: {}\n  week_map: { 1: monday }'
  const issues = runHealthCheck(files, 'local')
  assert.ok(issues.some((issue) => issue.id === 'region-missing-from-order'))
  assert.ok(issues.some((issue) => issue.id === 'timeline-structure'))
})

test('frequency and search parsers preserve full official tutorial header comments across edits', () => {
  const files = loadRepoConfigFiles()
  const freq = parseFrequencyWords(files['frequency_words.txt'])
  assert.ok(freq.headerComments.includes('# ───'))
  const freqOut = serializeFrequencyWords(freq)
  assert.ok(freqOut.includes('# ───'))
  assert.ok(freqOut.length > 2000)

  const search = parseSearchQueries(files['search_queries.txt'])
  assert.ok(search.headerComments.includes('# ───'))
  const searchOut = serializeSearchQueries(search)
  assert.ok(searchOut.includes('# ───'))
})

test('exporter keeps non-sensitive addresses readable in UI while sanitizing secrets and custom search providers', () => {
  const files = loadRepoConfigFiles()
  const mutated = setYamlValues(files['config.yaml'], [
    { path: ['notification', 'channels', 'email', 'from'], value: 'bot@example.com' },
    { path: ['notification', 'channels', 'email', 'password'], value: 'smtp-secret-pass' },
    { path: ['storage', 'remote', 'endpoint_url'], value: 'https://demo.r2.cloudflarestorage.com' },
    { path: ['storage', 'remote', 'secret_access_key'], value: 'r2-secret-key' },
    { path: ['web_search', 'provider'], value: 'custom_search' },
    { path: ['web_search', 'providers', 'custom_search', 'api_key'], value: 'ws-custom-secret' },
    { path: ['storage', 'formats', 'sqlite'], value: false },
  ])

  assert.equal(isSensitiveField('config.yaml', ['notification', 'channels', 'email', 'from']), false)
  assert.equal(isSensitiveField('config.yaml', ['storage', 'remote', 'endpoint_url']), false)
  assert.equal(isSensitiveField('config.yaml', ['notification', 'channels', 'email', 'password']), true)
  assert.equal(isSensitiveField('config.yaml', ['web_search', 'providers', 'custom_search', 'api_key']), true)

  const sanitized = sanitizeConfigYaml(mutated)
  assert.ok(!sanitized.includes('smtp-secret-pass'))
  assert.ok(!sanitized.includes('r2-secret-key'))
  assert.ok(!sanitized.includes('ws-custom-secret'))
  const extracted = extractSecrets(mutated)
  assert.ok(extracted.some((s) => s.envKey === 'WEB_SEARCH_API_KEY' && s.value === 'ws-custom-secret'))

  const issues = runHealthCheck({ ...files, 'config.yaml': mutated }, 'github_actions')
  const ids = new Set(issues.map((i) => i.id))
  assert.ok(ids.has('sqlite-required'))
  assert.ok(ids.has('email-incomplete'))
  assert.ok(ids.has('gha-secrets-in-yaml'))
})
