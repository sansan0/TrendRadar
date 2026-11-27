import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildAiRegexPrompt,
  createEmptyGroupByType,
  detectWordGroupType,
  formatGroupPreviewLines,
  parsePastedFrequencyLines,
} from '../keyword-helpers.ts'

describe('keyword-helpers: AI regex prompt & smart paste parser', () => {
  it('builds precision Chinese and English AI regex prompts with topic interpolation', () => {
    const zh = buildAiRegexPrompt('胖东来', 'zh')
    assert.ok(zh.includes('【胖东来】'))
    assert.ok(zh.includes('/词A|词B|\\bEnglishWord\\b/ => 胖东来'))
    assert.ok(zh.includes('最短匹配原则'))

    const en = buildAiRegexPrompt('NVIDIA', 'en')
    assert.ok(en.includes('[NVIDIA]'))
    assert.ok(en.includes('/TermA|TermB|\\bEnglishWord\\b/ => NVIDIA'))
  })

  it('parses single and multi-line pasted AI regex output, stripping fences and bullets', () => {
    const pasted = [
      '```text',
      '- /胖东来|于东来/ => 胖东来',
      '2. /\\bDeepSeek\\b|深度求索/i => DeepSeek',
      '+芯片',
      '!手机壳',
      '@5',
      '```',
    ].join('\n')

    const parsed = parsePastedFrequencyLines(pasted)
    assert.equal(parsed.invalidRegexes.length, 0)
    assert.equal(parsed.maxCount, 5)
    assert.equal(parsed.items.length, 4)

    assert.deepEqual(parsed.items[0], {
      kind: 'normal',
      pattern: '胖东来|于东来',
      isRegex: true,
      regexFlags: '',
      alias: '胖东来',
    })
    assert.deepEqual(parsed.items[1], {
      kind: 'normal',
      pattern: '\\bDeepSeek\\b|深度求索',
      isRegex: true,
      regexFlags: 'i',
      alias: 'DeepSeek',
    })
    assert.equal(parsed.items[2].kind, 'required')
    assert.equal(parsed.items[2].pattern, '芯片')
    assert.equal(parsed.items[3].kind, 'exclude')
    assert.equal(parsed.items[3].pattern, '手机壳')
    assert.equal(parsed.items[3].alias, '')
  })

  it('flags invalid regex patterns while preserving valid ones', () => {
    const parsed = parsePastedFrequencyLines('/(unclosed/ => Broken\n/华为|鸿蒙/ => 华为')
    assert.deepEqual(parsed.invalidRegexes, ['(unclosed'])
    assert.equal(parsed.items.length, 2)
  })

  it('detects all 4 structural word group types and generates clean preview syntax', () => {
    const aliasGroup = createEmptyGroupByType('alias')
    assert.equal(aliasGroup.items.length, 1)
    assert.equal(aliasGroup.items[0].isRegex, true)
    aliasGroup.items[0].pattern = '胖东来|于东来'
    aliasGroup.items[0].alias = '胖东来'
    assert.equal(detectWordGroupType(aliasGroup), 'alias')
    assert.deepEqual(formatGroupPreviewLines(aliasGroup), ['/胖东来|于东来/ => 胖东来'])

    const multiAlias = createEmptyGroupByType('multi-alias')
    assert.equal(multiAlias.items.length, 2)
    multiAlias.items[0].pattern = '智元|灵犀'
    multiAlias.items[0].alias = '智元机器人'
    multiAlias.items[1].pattern = '众擎|EngineAI'
    multiAlias.items[1].alias = '众擎机器人'
    assert.equal(detectWordGroupType(multiAlias), 'multi-alias')
    assert.deepEqual(formatGroupPreviewLines(multiAlias), [
      '/智元|灵犀/ => 智元机器人',
      '/众擎|EngineAI/ => 众擎机器人',
    ])

    const namedGroup = createEmptyGroupByType('group')
    namedGroup.groupAlias = '东亚'
    namedGroup.items[0].pattern = '日本'
    assert.equal(detectWordGroupType(namedGroup), 'group')
    assert.deepEqual(formatGroupPreviewLines(namedGroup), ['[东亚]', '日本'])

    const plainGroup = createEmptyGroupByType('plain')
    plainGroup.items[0].pattern = '申奥'
    assert.equal(detectWordGroupType(plainGroup), 'plain')
    assert.deepEqual(formatGroupPreviewLines(plainGroup), ['申奥'])
  })
})
