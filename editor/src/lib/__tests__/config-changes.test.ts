import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parseDocument } from 'yaml'
import { compareTemplate, differsFromTemplate, restoreFieldChange, restoreTextChange } from '../config-changes.ts'
import { parseYamlSafe } from '../yaml-doc.ts'
import { explainFieldChange } from '../yaml-change-impact.ts'
import { formatFieldPath, getYamlFieldTree, type YamlField } from '../yaml-fields.ts'

test('text comparison and single-change restoration support CR-only imports', () => {
  const initial = 'first\r\rsecond\r'
  const current = 'changed\r\rsecond\r'
  assert.equal(differsFromTemplate(initial, initial.replace(/\r/g, '\n')), false)
  const diff = compareTemplate('ai_interests.txt', initial, current)
  assert.equal(diff.type, 'text')
  if (diff.type !== 'text') return
  assert.equal(diff.items.length, 1)
  assert.equal(restoreTextChange(current, diff.items[0]), initial)
})

test('YAML changes identify edited, added and removed fields, including masked subtrees', () => {
  const base = 'app: {timezone: UTC}\nai: {api_key: ""}\nextra: {removed: false}\n'
  const raw = 'app: {timezone: "Asia/Shanghai"}\nai: {api_key: demo-private}\nextra: {custom: {password: hidden-value, keep: 23}}\n'
  const diff = compareTemplate('config.yaml', base, raw)
  assert.equal(diff.type, 'yaml')
  assert.deepEqual(diff.items.map((item) => [item.path, item.kind]), [
    [['app', 'timezone'], 'changed'], [['ai', 'api_key'], 'changed'],
    [['extra', 'removed'], 'removed'], [['extra', 'custom'], 'added'],
  ])
  assert.equal(diff.items[1].after, '"••••••"')
  assert.ok(!JSON.stringify(diff).includes('demo-private'))
  assert.ok(!JSON.stringify(diff).includes('hidden-value'))
  const fixed = restoreFieldChange(base, raw, diff.items[1])
  assert.deepEqual(parseYamlSafe(fixed).data, { app: { timezone: 'Asia/Shanghai' }, ai: { api_key: '' }, extra: { custom: { password: 'hidden-value', keep: 23 } } })
})

test('list insertions keep stable IDs aligned and restore separately from edits to adjacent rows', () => {
  const base = 'sources:\n  - {id: a, name: A}\n  - {id: b, name: B}\n  - {id: c, name: C}\n'
  const current = 'sources:\n  - {id: a, name: A}\n  - {id: new, name: New}\n  - {id: b, name: Edited} # retain\n  - {id: c, name: C}\n'
  const diff = compareTemplate('config.yaml', base, current)
  assert.equal(diff.type, 'yaml')
  assert.deepEqual(diff.items.map(({ kind, path }) => [kind, path]), [
    ['added', ['sources', 1]],
    ['changed', ['sources', 2, 'name']],
  ])
  const keepInsertion = restoreFieldChange(base, current, diff.items[1])
  const keepRename = restoreFieldChange(base, current, diff.items[0])
  assert.equal(parseYamlSafe<{ sources: { name: string }[] }>(keepInsertion).data?.sources[2].name, 'B')
  assert.equal(parseYamlSafe<{ sources: { name: string }[] }>(keepRename).data?.sources[1].name, 'Edited')
  assert.ok(keepRename.includes('# retain'))
  assert.ok(keepInsertion.includes('id: new'))
})

test('removed array records restore to the right position and use numeric YAML mapping keys', () => {
  const base = 'days: {1: [a, b, c, d]}\n'
  const current = 'days: {1: [a, d]}\n'
  const diff = compareTemplate('timeline.yaml', base, current)
  assert.equal(diff.type, 'yaml')
  assert.equal(diff.items.length, 1)
  assert.equal(diff.items[0].kind, 'removed')
  assert.deepEqual(parseYamlSafe(restoreFieldChange(base, current, diff.items[0])).data, parseYamlSafe(base).data)
})

test('text changes show actual line ranges, and each hunk can be restored independently', () => {
  const base = 'one\r\ntwo\r\nkeep\r\nfour\r\n'
  const current = 'one\r\nnew\r\nkeep\r\nextra\r\nfour\r\n'
  const diff = compareTemplate('ai_analysis_prompt.txt', base, current)
  assert.equal(diff.type, 'text')
  assert.deepEqual(diff.items.map(({ newStart, before, after }) => [newStart, before, after]), [
    [1, ['two'], ['new']], [3, [], ['extra']],
  ])
  assert.equal(restoreTextChange(current, diff.items[0]), current.replace('new', 'two'))
  assert.equal(restoreTextChange(current, diff.items[1]), current.replace('extra\r\n', ''))
  assert.equal(differsFromTemplate(base, base.replaceAll('\r','')), false)
})

test('syntax errors are reported without source snippets, comments alone give zero field changes', () => {
  const initial = 'ai: {api_key: ""}\n'
  const malformed = 'ai: {api_key: secret-in-parser-message\n'
  const invalid = compareTemplate('config.yaml', initial, malformed)
  assert.equal(invalid.type, 'invalid')
  assert.ok(!JSON.stringify(invalid).includes('secret-in-parser-message'))
  const comments = compareTemplate('config.yaml', initial, '# custom note\n' + initial)
  assert.deepEqual(comments, { type: 'yaml', items: [] })
})

test('aliases of credentials stay masked even when displayed under a non-secret field name', () => {
  const raw = 'ai: {api_key: &key demo-sensitive}\nsection: &section {value: *key}\ncopy: *section\n'
  const result = compareTemplate('config.yaml', '{}', raw)
  assert.equal(result.type, 'yaml')
  assert.equal(result.items.length, 3)
  assert.ok(!JSON.stringify(result).includes('demo-sensitive'))
})

test('restoring text retains other hunks, mixed line endings and the original EOF', () => {
  const base = 'keep\nbase\r\nkeep\r\n'
  const current = 'keep\nedit\r\nkeep\r\nother'
  const diff = compareTemplate('search_queries.txt', base, current)
  assert.equal(diff.type, 'text')
  assert.equal(restoreTextChange(current, diff.items[0]), 'keep\nbase\r\nkeep\r\nother')
  assert.equal(restoreTextChange(current, diff.items[1]), 'keep\nedit\r\nkeep\r\n')
})

test('the change review explains the three switches in both directions and reflects the AI master switch', () => {
  const config = (value: boolean) => `schedule: {enabled: ${value}}\nweb_search: {enabled: ${value}}\nai_analysis: {enabled: false, include_rss: ${value}}\n`
  const on = compareTemplate('config.yaml', config(false), config(true))
  const off = compareTemplate('config.yaml', config(true), config(false))
  assert.equal(on.type, 'yaml')
  assert.equal(off.type, 'yaml')
  assert.match(on.items[0].effect, /每次运行.*timeline.yaml.*时段/)
  assert.match(on.items[1].effect, /搜索任务文件.*按主题/)
  assert.match(on.items[2].effect, /RSS 文章.*模型分析.*总开关已关闭/)
  assert.match(off.items[0].effect, /跳过时间线/)
  assert.match(off.items[1].effect, /暂停查询/)
  assert.match(off.items[2].effect, /跳过 RSS 文章/)
  const en = compareTemplate('config.yaml', config(false), config(true), 'en')
  assert.equal(en.type, 'yaml')
  assert.match(en.items[2].effect, /RSS articles.*currently switched off/)
})

test('effect text uses trusted template guidance, understands numeric limits, and identifies unknown settings', () => {
  const base = 'web_search: {max_items_per_topic: 8}\ncustom:\n  count: 5 # Upper item limit\n'
  const edited = 'web_search: {max_items_per_topic: 3}\ncustom:\n  count: 7 # private draft comment\n  extra: 9 # invented meaning\n'
  const result = compareTemplate('config.yaml', base, edited)
  assert.equal(result.type, 'yaml')
  assert.match(result.items[0].effect, /最多展示 3 条/)
  assert.equal(result.items[1].effect, 'Upper item limit')
  assert.match(result.items[2].effect, /模板没有提供/)
  assert.doesNotMatch(JSON.stringify(result.items), /private draft comment|invented meaning/)
  const empty = compareTemplate('config.yaml', 'schedule: {enabled: true, preset: x}', 'schedule: {preset: x}')
  assert.equal(empty.type, 'yaml')
  assert.match(empty.items[0].effect, /不再指定/)
})

test('all scalar settings in the bundled main and timeline templates have documented effects', () => {
  for (const lang of ['zh', 'en'] as const) {
    for (const file of ['config.yaml', 'timeline.yaml'] as const) {
      const name = lang === 'en' ? file.replace('.yaml', '.en.yaml') : file
      const doc = parseDocument(readFileSync(new URL(`../../../../config/${name}`, import.meta.url), 'utf8'))
      const tree = getYamlFieldTree(doc)
      const data = doc.toJS()
      const check = (node: YamlField) => {
        node.children.forEach(check)
        if (node.kind !== 'scalar') return
        const next = typeof node.value === 'boolean' ? !node.value : typeof node.value === 'number' ? node.value + 1 : 'custom'
        const impact = explainFieldChange(file, { kind: 'changed', originalPath: node.path, path: node.path, after: JSON.stringify(next) }, tree, data, lang)
        assert.ok(impact.length > 0)
        assert.doesNotMatch(impact, /随附模板没有提供|The bundled template does not document|undefined/, `${name}: ${formatFieldPath(node.path)}`)
      }
      check(tree)
    }
  }
})

test('pure array reordering reports a single reorder change and restores without duplicating items', () => {
  const base = 'platforms:\n  sources:\n    - {id: zhihu, name: 知乎}\n    - {id: weibo, name: 微博}\n    - {id: baidu, name: 百度}\n'
  const reordered = 'platforms:\n  sources:\n    - {id: baidu, name: 百度}\n    - {id: zhihu, name: 知乎}\n    - {id: weibo, name: 微博}\n'
  const diff = compareTemplate('config.yaml', base, reordered)
  assert.equal(diff.type, 'yaml')
  assert.equal(diff.items.length, 1)
  assert.equal(diff.items[0].kind, 'changed')
  assert.equal(diff.items[0].isReorder, true)
  assert.deepEqual(diff.items[0].path, ['platforms', 'sources'])
  const restored = restoreFieldChange(base, reordered, diff.items[0])
  assert.deepEqual(parseYamlSafe(restored).data, parseYamlSafe(base).data)
})

test('cross-ID item replacement and implicit platform enabled=true diff and restore accurately', () => {
  const base = 'platforms:\n  sources:\n    - {id: zhihu, name: 知乎}\n    - {id: weibo, name: 微博}\n'
  const replaced = 'platforms:\n  sources:\n    - {id: zhihu, name: 知乎, enabled: false}\n    - {id: hackernews, name: HN}\n'
  const diff = compareTemplate('config.yaml', base, replaced)
  assert.equal(diff.type, 'yaml')
  const enabledDiff = diff.items.find((it) => it.path.at(-1) === 'enabled')!
  assert.equal(enabledDiff.kind, 'changed')
  assert.equal(enabledDiff.beforeDisplay, '开启 (true)')
  assert.equal(enabledDiff.afterDisplay, '关闭 (false)')

  const removedWeibo = diff.items.find((it) => it.kind === 'removed')!
  const addedHn = diff.items.find((it) => it.kind === 'added')!
  assert.ok(removedWeibo)
  assert.ok(addedHn)
  const withWeiboBack = restoreFieldChange(base, replaced, removedWeibo)
  const parsedIds = (parseYamlSafe<{ platforms: { sources: Array<{ id: string }> } }>(withWeiboBack).data?.platforms.sources ?? []).map((s) => s.id)
  assert.ok(parsedIds.includes('weibo'))
  assert.ok(parsedIds.includes('hackernews'))
})
