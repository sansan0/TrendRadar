import assert from 'node:assert/strict'
import test from 'node:test'
import { appendStarterTopic } from '../../components/guided/starter-topic.ts'
import { parseFrequencyWords } from '../frequency-parser.ts'

test('guided keyword entry appends an independent group and preserves existing file contents', () => {
  for (const eol of ['\n', '\r\n']) {
    for (const ending of ['', eol, eol + eol]) {
      const raw = ['# user notes', '[WORD_GROUPS]', '', 'old'].join(eol) + ending
      const result = appendStarterTopic(raw, 'frequency_words.txt', '  近海风电  ')
      assert.equal(result.status, 'added')
      if (result.status !== 'added') continue
      assert.ok(result.content.startsWith(raw))
      assert.deepEqual(parseFrequencyWords(result.content).groups.map((group) => group.items.map((item) => item.pattern)), [['old'], ['近海风电']])
    }
  }
  const raw = '[GLOBAL_FILTER]\n排除\n'
  const result = appendStarterTopic(raw, 'frequency_words.txt', '风电')
  assert.equal(result.status, 'added')
  if (result.status !== 'added') return
  const parsed = parseFrequencyWords(result.content)
  assert.deepEqual(parsed.globalFilters.map((item) => item.pattern), ['排除'])
  assert.equal(parsed.groups[0].items[0].pattern, '风电')
  assert.equal(appendStarterTopic('Wind\n', 'frequency_words.txt', 'wind').status, 'duplicate')
  assert.equal(appendStarterTopic('Wind\n', 'frequency_words.txt', '[GLOBAL_FILTER]').status, 'invalid')
})

test('guided AI interests accept natural language without applying keyword syntax', () => {
  const raw = '# Existing comments\r\nAI 兴趣描述\r\n'
  const result = appendStarterTopic(raw, 'ai_interests.txt', '关注 AI => 开源硬件')
  assert.deepEqual(result, { status: 'added', content: raw + '\r\n关注 AI => 开源硬件\r\n' })
  assert.equal(appendStarterTopic(raw, 'ai_interests.txt', 'AI 兴趣描述').status, 'duplicate')
  assert.equal(appendStarterTopic(raw, 'ai_interests.txt', '# 备注').status, 'invalid')
})
