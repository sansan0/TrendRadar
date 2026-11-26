import assert from 'node:assert/strict'
import test from 'node:test'
import { trialFileNotices, trialFileOptions } from '../guided-trial.ts'

test('a later trial retains files modified in earlier steps and companion settings', () => {
  assert.deepEqual(trialFileOptions('onboarding', ['config.yaml', 'frequency_words.txt'], ['frequency_words.txt']), ['frequency_words.txt', 'config.yaml'])
  assert.ok(trialFileOptions('ai', ['timeline.yaml']).includes('timeline.yaml'))
})

test('trial guidance explains inactive and custom rule files without redirecting writes', () => {
  const config = { filter: { method: 'ai' }, ai_filter: { interests_file: 'finance.txt' }, web_search: { enabled: false, queries_file: 'custom.txt' } }
  assert.match(trialFileNotices(config, '', 'ai_interests.txt', 'zh').join(), /config\/custom\/ai\/finance.txt/)
  assert.match(trialFileNotices(config, '', 'frequency_words.txt', 'zh').join(), /默认使用 AI/)
  assert.equal(trialFileNotices(config, '', 'search_queries.txt', 'zh').length, 2)
  assert.equal(trialFileNotices({ web_search: { enabled: true, queries_file: './config/search_queries.txt' } }, '', 'search_queries.txt', 'zh').length, 0)
})

test('only the selected schedule and its reachable periods affect trial guidance', () => {
  const config = { filter: { method: 'keyword' }, schedule: { enabled: true, preset: 'custom' } }
  const timeline = 'custom:\n  default: {}\n  periods: { evening: {start: "18:00", end: "20:00", frequency_file: custom.txt} }\n  day_plans: { work: {periods: [evening]} }\n  week_map: {1: work}\n'
  assert.match(trialFileNotices(config, timeline, 'frequency_words.txt', 'zh').join(), /时段/)
  assert.equal(trialFileNotices(config, timeline.replace('[evening]', '[]'), 'frequency_words.txt', 'zh').length, 0)
  assert.match(trialFileNotices(config, timeline, 'config.yaml', 'zh').join(), /timeline.yaml/)
})
