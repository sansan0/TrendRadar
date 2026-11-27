import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getTextSections, replaceTextareaText, replaceTextSection, textOffset, textPosition, textareaText } from '../text-sections.ts'
import { ALL_CONFIG_FILES } from '../types.ts'
import { parseFrequencyWords } from '../frequency-parser.ts'
import { compareTemplate } from '../config-changes.ts'

test('keyword sections and change explanations follow the runtime treatment of whitespace-only lines', () => {
  const raw = 'apple\n \n+pear\n'
  assert.equal(parseFrequencyWords(raw).groups.length, 1)
  assert.equal(getTextSections('frequency_words.txt', raw).length, 1)
  const split = 'apple\n\n+pear\n'
  assert.equal(parseFrequencyWords(split).groups.length, 2)
  assert.equal(getTextSections('frequency_words.txt', split).length, 2)
  const diff = compareTemplate('frequency_words.txt', raw, split)
  assert.equal(diff.type, 'text')
  if (diff.type === 'text') assert.match(diff.items[0].effect, /两个独立匹配/)
  assert.equal(getTextSections('frequency_words.txt', 'apple\n\n \n+pear').length, 2)
})

test('every source line in each shipped text file belongs to an editable section, including comments and blank lines', () => {
  for (const file of ALL_CONFIG_FILES.filter((name) => name.endsWith('.txt'))) {
    const source = readFileSync(new URL('../../../../config/' + file, import.meta.url), 'utf8')
    const lines = textareaText(source).split('\n')
    let first = 1
    for (const section of getTextSections(file, source)) {
      assert.equal(section.firstLine, first)
      const displayed = lines.slice(first - 1, section.lastLine).join('\n')
      assert.equal(textareaText(source.slice(section.from, section.to)), displayed)
      assert.equal(replaceTextSection(source, section, displayed).value, source)
      first = section.lastLine + 1
    }
    assert.equal(first - 1, lines.length)
  }
})

test('DSL navigation follows blank-line groups and recognizes named and unnamed rules', () => {
  const words = '\ufeff# 说明\r\n\r\n[global_filter]\r\n标题党\n\n[WORD_GROUPS]\n\n# 注释\n[芯片]\n+材料\n!广告\n@5\n\n/模型/i => AI\n'
  assert.deepEqual(getTextSections('frequency_words.txt', words).map(({ kind, title }) => [kind, title]), [
    ['comments', '说明'], ['filter', '标题党'], ['words', 'WORD_GROUPS'], ['words', '芯片'], ['words', 'AI'],
  ])
  const search = '[SEARCH_TOPICS]\r\n\r\n# 同一主题\r\n[交通]\r\n交通 site:gov.cn\r\n@provider:test\r\n \r\n未命名任务'
  const topics = getTextSections('search_queries.txt', search)
  assert.deepEqual(topics.map((s) => s.title), ['SEARCH_TOPICS', '交通', '未命名任务'])
  assert.equal(topics[1].firstLine, 3)
  assert.equal(topics[2].firstLine, 8)
})

test('prompts keep unmatched markup inside its role and interests expose individual list entries', () => {
  for (const file of ['ai_analysis_prompt.txt', 'ai_translation_prompt.txt'] as const) {
    const prompt = '# 说明\r\n\n[system]\n指示\n\n[other]\n## 正文\n[user]\r\n{变量}\n'
    const groups = getTextSections(file, prompt)
    assert.deepEqual(groups.map((s) => s.kind), ['comments', 'system', 'user'])
    const changed = replaceTextSection(prompt, groups[2], '[user]\n新内容\n')
    assert.equal(changed.value, '# 说明\r\n\n[system]\n指示\n\n[other]\n## 正文\n[user]\r\n新内容\n')
  }
  const interests = '我的偏好\n\n1. 开源：模型\n   续行\n2. 软件：开发\n\n自定义内容\n- 下一项'
  assert.deepEqual(getTextSections('ai_interests.txt', interests).map((s) => s.firstLine), [1, 3, 5, 7, 8])
})

test('local edits keep BOM, trailing whitespace, unknown syntax and mixed line endings outside the changed span', () => {
  const raw = '\ufeff 头  \r\nfoo\nquery\r尾  \r\n'
  assert.equal(replaceTextareaText(raw, textareaText(raw).replace('foo', '更新')), '\ufeff 头  \r\n更新\nquery\r尾  \r\n')
  assert.equal(replaceTextareaText('首行', '首行\n次行', '\r\n'), '首行\r\n次行')
  assert.equal(replaceTextareaText('a\r\nb\nc', 'a\nb\nc\nd'), 'a\r\nb\nc\nd')
  assert.equal(replaceTextareaText('a\r\nb', 'a\n\nb'), 'a\r\n\r\nb')
})

test('typing and pasting new groups can continue within the original textarea range until blur', () => {
  const original = '# 设置\r\n\r\n[旧主题]\r\n词\r\n\r\n# 保留写法\n[下一组]\n!排除\n@未知  \n'
  const active = getTextSections('search_queries.txt', original)[1]
  const prefix = original.slice(0, active.from)
  const suffix = original.slice(active.to)
  let result = { value: original, section: active }
  for (const input of ['[新主题]', '[新主题]\n', '[新主题]\n\n', '[新主题]\n\n[再一组]\n粘贴', '[新主题]\n\n[再一组]\n粘贴完成']) {
    result = replaceTextSection(result.value, result.section, input)
    assert.equal(result.value.slice(0, result.section.from), prefix)
    assert.equal(result.value.slice(result.section.to), suffix)
    assert.equal(textareaText(result.value.slice(result.section.from, result.section.to)), input)
    assert.equal(result.section.lastLine, result.section.firstLine + input.split('\n').length - 1)
  }
  assert.equal(getTextSections('search_queries.txt', result.value).find((s) => s.title === '再一组')?.firstLine, 5)
})

test('empty files and UTF-16 textarea caret positions map to 1-based source lines and columns', () => {
  const [empty] = getTextSections('ai_interests.txt', '')
  assert.deepEqual([empty.firstLine, empty.lastLine, empty.from, empty.to], [1, 1, 0, 0])
  assert.equal(replaceTextSection('', empty, '初始\n正文').value, '初始\n正文')
  const body = '\n内容\nA\u{20000}B\n'
  for (let i = 0; i <= body.length; i++) {
    const { line, column } = textPosition(body, i, 27)
    assert.equal(textOffset(body, line, column, 27), i)
  }
  assert.equal(textOffset(body, 999, 999, 27), body.length)
})
