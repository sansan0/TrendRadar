import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  buildYamlSourceIndex,
  deleteYamlKey,
  findYamlPathLine,
  parseYamlSafe,
  setYamlValue,
  setYamlValues,
  type YamlPath,
} from '../yaml-doc.ts'
import { getYamlFieldTree } from '../yaml-fields.ts'

test('each field and collection in the bundled YAML navigates back to its own path', () => {
  for (const name of ['config.yaml', 'timeline.yaml', 'config.en.yaml', 'timeline.en.yaml']) {
    const raw = readFileSync(new URL(`../../../../config/${name}`, import.meta.url), 'utf8')
    const parsed = parseYamlSafe(raw)
    assert.equal(parsed.error, null)
    const index = buildYamlSourceIndex(raw, parsed.doc)

    function check(value: unknown, path: YamlPath) {
      if (path.length) {
        const { line, column } = index.positionAt(path)
        assert.deepEqual(index.pathAt(line, column), path, `${name} ${JSON.stringify(path)}`)
      }
      if (Array.isArray(value)) {
        value.forEach((child, i) => check(child, [...path, i]))
      } else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) check(child, [...path, key])
      }
    }
    check(parsed.data, [])
  }
})

test('source positions respect comments, repeated keys, quoted keys, and inline collections', () => {
  const lines = [
    '# Header',
    'first:',
    '  enabled: false    # inline comment',
    '                    # continuation',
    '',
    '# Next section',
    'second:',
    '  flags: { enabled: true, "a.b[]": [on, off] }',
    '  rows:',
    '    - id: first',
    '    - id: second',
    '      label: |',
    '        # text in a block scalar',
    '        third: still text',
    'third:',
    '  enabled: true',
  ]
  const raw = lines.join('\r\n')
  const index = buildYamlSourceIndex(raw, parseYamlSafe(raw).doc)
  assert.deepEqual(index.pathAt(1), ['first'])
  assert.deepEqual(index.pathAt(3), ['first', 'enabled'])
  assert.deepEqual(index.pathAt(4), ['first', 'enabled'])
  assert.deepEqual(index.pathAt(6), ['second'])
  assert.deepEqual(index.pathAt(8), ['second', 'flags'])
  assert.deepEqual(index.pathAt(8, lines[7].indexOf('true') + 1), ['second', 'flags', 'enabled'])
  assert.deepEqual(index.pathAt(8, lines[7].indexOf('off') + 1), ['second', 'flags', 'a.b[]', 1])
  assert.deepEqual(index.pathAt(11), ['second', 'rows', 1])
  assert.deepEqual(index.pathAt(11, 8), ['second', 'rows', 1, 'id'])
  assert.deepEqual(index.pathAt(13), ['second', 'rows', 1, 'label'])
  assert.deepEqual(index.pathAt(14), ['second', 'rows', 1, 'label'])
  assert.equal(findYamlPathLine(raw, ['second', 'enabled']), 7)
  assert.equal(index.lineAt(['second', 'flags', 'missing']), 8)
  assert.equal(index.lineAt(['no such key']), 1)
  assert.deepEqual(buildYamlSourceIndex('[', null).pathAt(1), [])
})

test('existing scalar edits preserve surrounding source and do not confuse integer keys with list indices', () => {
  const raw = [
    'week_map:',
    "  1: 'monday'   # Monday",
    'notes: [alpha, beta]   # inline list',
    'items:',
    '  - before   # list entry',
    '',
  ].join('\r\n')
  const changed = setYamlValues(raw, [
    { path: ['week_map', '1'], value: 'weekend' },
    { path: ['notes', 1], value: 'a, b' },
    { path: ['items', 0], value: true },
  ])
  const parsed = parseYamlSafe(changed)
  assert.equal(parsed.error, null)
  assert.deepEqual(parsed.data, { week_map: { 1: 'weekend' }, notes: ['alpha', 'a, b'], items: [true] })
  assert.ok(changed.includes("  1: 'weekend'   # Monday\r\n"))
  assert.ok(changed.includes('   # inline list\r\n'))
  assert.ok(changed.includes('  - true   # list entry\r\n'))
  assert.equal(setYamlValue(changed, ['items', 0], true), changed)
  assert.equal(deleteYamlKey(raw, ['week_map', 'missing']), raw)
  const removed = parseYamlSafe(deleteYamlKey(changed, ['week_map', '1']))
  assert.deepEqual(removed.data?.week_map, {})
})

test('text entered in an inline YAML collection round-trips without becoming YAML syntax', () => {
  const raw = 'settings: {text: old, list: [old, untouched]} # keep this comment\n'
  for (const text of [',', 'a, b', '[x]', 'x]', '{x: y}', '# comment', ':', ': value', 'a: b', 'true', 'first\nsecond']) {
    const changed = setYamlValues(raw, [
      { path: ['settings', 'text'], value: text },
      { path: ['settings', 'list', 0], value: text },
    ])
    const parsed = parseYamlSafe(changed)
    assert.equal(parsed.error, null, text)
    assert.deepEqual(parsed.data?.settings, { text, list: [text, 'untouched'] })
    assert.ok(changed.endsWith(']} # keep this comment\n'))
  }
})

test('edits through aliases retain anchor definitions and sibling fields', () => {
  const raw = 'base: &base\n  name: old\n  other: keep\ncopy: *base\n'
  const changed = setYamlValue(raw, ['copy', 'name'], 'updated')
  assert.equal(changed, raw.replace('name: old', 'name: updated'))
  const replacement = setYamlValue(changed, ['copy'], { name: 'new name' })
  assert.ok(replacement.includes('base: &base'))
  assert.ok(replacement.includes('copy: *base'))
  assert.deepEqual(parseYamlSafe(replacement).data, { base: { name: 'new name' }, copy: { name: 'new name' } })
  assert.equal(deleteYamlKey(raw, ['base']), raw)
  assert.deepEqual(parseYamlSafe(deleteYamlKey(raw, ['copy'])).data, { base: { name: 'old', other: 'keep' } })
})

test('null mapping keys have the same path in forms, source navigation and updates', () => {
  const raw = 'settings:\n  null: before\n  other: untouched\n'
  const index = buildYamlSourceIndex(raw, parseYamlSafe(raw).doc)
  assert.deepEqual(index.pathAt(2), ['settings', ''])
  assert.equal(index.lineAt(['settings', '']), 2)
  assert.deepEqual(getYamlFieldTree(parseYamlSafe(raw).doc!).children[0].children[0].path, ['settings', ''])
  const changed = setYamlValue(raw, ['settings', ''], 'after')
  assert.deepEqual(parseYamlSafe(changed).data, { settings: { '': 'after', other: 'untouched' } })
})
