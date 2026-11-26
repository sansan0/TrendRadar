import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parseDocument } from 'yaml'
import { getYamlFieldTree, type YamlField } from '../yaml-fields.ts'
import type { YamlPath } from '../yaml-doc.ts'

function checkField(field: YamlField, source: unknown, path: YamlPath) {
  assert.deepEqual(field.path, path)
  if (Array.isArray(source)) {
    assert.equal(field.kind, 'list')
    assert.equal(field.children.length, source.length)
    source.forEach((value, index) => checkField(field.children[index], value, [...path, index]))
  } else if (source !== null && typeof source === 'object') {
    const entries = Object.entries(source)
    assert.equal(field.kind, 'map')
    assert.equal(field.children.length, entries.length)
    for (const [key, value] of entries) {
      const child = field.children.find((candidate) => candidate.name === key)
      assert.ok(child, `Missing field ${[...path, key].join('.')}`)
      checkField(child, value, [...path, key])
    }
  } else {
    assert.equal(field.kind, 'scalar')
    assert.equal(field.value, source)
  }
}

test('the right pane represents every bundled YAML field with its source path and type', () => {
  for (const file of ['config.yaml', 'timeline.yaml', 'config.en.yaml', 'timeline.en.yaml']) {
    const text = readFileSync(new URL(`../../../../config/${file}`, import.meta.url), 'utf8')
    const doc = parseDocument(text)
    const tree = getYamlFieldTree(doc)
    const source = doc.toJS()
    assert.deepEqual(tree.children.map((child) => child.name), Object.keys(source))
    checkField(tree, source, [])
  }
})

test('fields follow user-defined keys, mixed scalar types, comments and alias references', () => {
  const doc = parseDocument('extension:\n  list: &settings [{value: false}, 0, "001", null, []]\n  a.b: *settings\n  "1": 0.5 # custom threshold\n')
  const root = getYamlFieldTree(doc).children[0]
  const [list, alias, number] = root.children
  assert.deepEqual(list.path, ['extension', 'list'])
  checkField(list, [{ value: false }, 0, '001', null, []], list.path)
  assert.equal(list.anchor, 'settings')
  assert.deepEqual(alias.path, ['extension', 'a.b'])
  assert.equal(alias.kind, 'alias')
  assert.equal(alias.value, 'settings')
  assert.deepEqual(number.path, ['extension', '1'])
  assert.equal(number.comment, 'custom threshold')
})
