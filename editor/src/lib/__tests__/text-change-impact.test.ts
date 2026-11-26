import assert from 'node:assert/strict'
import test from 'node:test'
import { compareTemplate } from '../config-changes.ts'
import type { ConfigFileKey, Lang } from '../types.ts'

function impact(file: ConfigFileKey, initial: string, edited: string, lang: Lang = 'zh'): string {
  const diff = compareTemplate(file, initial, edited, lang)
  assert.equal(diff.type, 'text')
  assert.ok(diff.items.length)
  for (const item of diff.items) {
    assert.ok(item.effect.length > 0)
    assert.doesNotMatch(item.effect, /PRIVATE_/)
  }
  return diff.items.map((item) => item.effect).join(' ')
}

const keywords = 'frequency_words.txt'
const search = 'search_queries.txt'
const translation = 'ai_translation_prompt.txt'
const analysis = 'ai_analysis_prompt.txt'

test('keyword changes describe global filtering, required terms, exclusion scope and report controls', () => {
  const base = '[GLOBAL_FILTER]\nPRIVATE_FILTER\n\n[WORD_GROUPS]\n\n[一个词组]\nPRIVATE_TERM => 旧\n+PRIVATE_MUST\n!PRIVATE_BLOCK\n@3'
  assert.match(impact(keywords, base, base.replace('PRIVATE_FILTER', 'PRIVATE_NEW')), /全局排除.*标题/)
  assert.match(impact(keywords, base, base.replace('PRIVATE_FILTER', '+PRIVATE_FILTER')), /全局过滤区.*跳过/)
  assert.match(impact(keywords, base, base.replace('PRIVATE_MUST', 'PRIVATE_NEXT')), /同时满足.*必含词/)
  assert.match(impact(keywords, base, base.replace('PRIVATE_BLOCK', 'PRIVATE_NEXT')), /匹配前过滤.*标题/)
  assert.match(impact(keywords, base, base.replace('@3', '@7')), /报告中最多展示/)
  assert.match(impact(keywords, base, base.replace('\n@3', '')), /报告的每组条数上限/)
  const rename = impact(keywords, base, base.replace('=> 旧', '=> PRIVATE_NEW'))
  assert.match(rename, /没有单独命名.*显示名称/)
  assert.doesNotMatch(rename, /普通词条件|必含词/)
  assert.match(impact(keywords, base, base.replace('!PRIVATE_BLOCK', '!PRIVATE_BLOCK => PRIVATE_ALIAS')), /原有的匹配条件/)
})

test('search changes distinguish all topics from one topic and attached limits from global defaults', () => {
  const base = '[GLOBAL_FILTER]\nPRIVATE_WORD\n-site:PRIVATE_GLOBAL\n\n[SEARCH_TOPICS]\n\n[主题]\nPRIVATE_QUERY\n!PRIVATE_LOCAL\n-site:PRIVATE_SITE\n@3\n~7d\n@provider:PRIVATE_ENGINE'
  const replace = (value: string) => impact(search, base, base.replace(value, value + '_NEW'))
  assert.match(replace('PRIVATE_WORD'), /所有搜索主题.*标题或摘要/)
  assert.match(replace('PRIVATE_GLOBAL'), /全局屏蔽域名/)
  assert.match(impact(search, base, base.replace('[主题]', '[PRIVATE_TOPIC]')), /主题名称.*展示标题/)
  assert.match(replace('PRIVATE_QUERY'), /查询词.*检索/)
  assert.match(replace('PRIVATE_LOCAL'), /本主题排除词/)
  assert.match(replace('PRIVATE_SITE'), /本主题屏蔽的域名/)
  assert.match(impact(search, base, base.replace('@3', '@7')), /限制最终展示的结果条数/)
  assert.match(impact(search, base, base.replace('@3', '@0')), /只接受正整数/)
  assert.match(impact(search, base, base.replace('~7d', '~0d')), /取消.*发布时间限制/)
  assert.match(impact(search, base, base.replace('~7d\n', '')), /使用全局搜索时效/)
  assert.match(replace('PRIVATE_ENGINE'), /指定执行查询的搜索引擎/)
  assert.match(impact(search, base, base.replace('\n@provider:PRIVATE_ENGINE', '')), /使用全局搜索引擎/)
  assert.match(impact(search, base, base.replace('PRIVATE_QUERY\n', '')), /没有查询词的主题会被跳过/)
})

test('plain notes and cosmetic whitespace differ from blank lines that actually change matching or searches', () => {
  for (const file of [keywords, search] as const) {
    const base = '# 注释\nPRIVATE_A\nPRIVATE_B'
    assert.match(impact(file, base, base.replace('注释', 'PRIVATE_NOTE')), /注释或排版/)
    assert.match(impact(file, base, base.replace('PRIVATE_A', '  PRIVATE_A  ')), /注释或排版/)
    assert.match(impact(file, base, base + '\n\n'), /注释或排版/)
    const split = base.replace('PRIVATE_B', '\nPRIVATE_B')
    assert.match(impact(file, base, split), file === search ? /两个独立的搜索任务/ : /两个独立匹配的词组/)
    assert.match(impact(file, split, base), file === search ? /同一个搜索主题/ : /同一个匹配词组/)
    const marker = file === search ? '[SEARCH_TOPICS]' : '[WORD_GROUPS]'
    const global = '[GLOBAL_FILTER]\nPRIVATE_FILTER\n' + marker + '\nPRIVATE_RULE'
    assert.match(impact(file, global, global.replace(marker, '\n' + marker)), /区域标记/)
  }
})

test('interest rules drive tag updates while note-only changes preserve the tag fingerprint', () => {
  const base = '# 说明\n1. PRIVATE_BEFORE\n2. 另一条兴趣'
  assert.match(impact('ai_interests.txt', base, base.replace('PRIVATE_BEFORE', 'PRIVATE_AFTER')), /兴趣描述提取或更新标签.*判断新闻标题/)
  const notes = impact('ai_interests.txt', base, base.replace('说明', 'PRIVATE_NOTE'))
  assert.match(notes, /标签变更检测会忽略注释/)
  assert.match(notes, /模型仍可读取完整的兴趣说明/)
})

test('analysis and translation prompts distinguish file notes, Markdown instructions, request data and role markers', () => {
  const base = '# 文件说明\n[system]\n# PRIVATE_SYSTEM\n系统第二段\n[user]\nPRIVATE_REQUEST'
  for (const file of [analysis, translation] as const) {
    assert.match(impact(file, base, base.replace('文件说明', 'PRIVATE_META')), /正文之前/)
    assert.match(impact(file, base, base.replace('PRIVATE_SYSTEM', 'PRIVATE_NEXT')), file === analysis ? /系统指令.*报告写法/ : /系统指令.*译文/)
    assert.match(impact(file, base, base.replace('系统第二段', '\n系统第二段')), /段落间距/)
    assert.match(impact(file, base, base.replace('PRIVATE_REQUEST', 'PRIVATE_NEW')), file === analysis ? /本次报告的数据/ : /每批翻译请求/)
    assert.match(impact(file, base, base.replace('[system]\n', '')), /缺少其中一个标记.*用户提示词/)
    assert.match(impact(file, '[system]\n# PRIVATE_RAW', '[system]\n# PRIVATE_OTHER'), /用户提示词/)
    assert.match(impact(file, base, base.replace('PRIVATE_SYSTEM', 'PRIVATE_NEXT'), 'en'), file === analysis ? /system instructions shape the analysis/ : /system instructions shape the wording/)
  }
})

test('English explanations cover every text file without including user-supplied content', () => {
  assert.match(impact(keywords, 'PRIVATE_OLD', 'PRIVATE_NEW', 'en'), /When this keyword file is used, a headline/)
  assert.match(impact(search, 'PRIVATE_OLD', 'PRIVATE_NEW', 'en'), /When this search file is used, queries/)
  assert.match(impact('ai_interests.txt', 'PRIVATE_OLD', 'PRIVATE_NEW', 'en'), /When AI filtering uses this file/)
  assert.match(impact(analysis, 'PRIVATE_OLD', 'PRIVATE_NEW', 'en'), /When AI analysis uses this template/)
  assert.match(impact(translation, 'PRIVATE_OLD', 'PRIVATE_NEW', 'en'), /When AI translation uses this template/)
})
