import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  isLang,
  LANGUAGE_GRID_ROWS,
  LANGUAGE_META,
  normalizeLang,
  SUPPORTED_LANGS,
  toTemplateLang,
} from '../../i18n/languages.ts'
import { LOCALE_DICTS, tr } from '../../i18n/translate.ts'
import { ALL_CONFIG_FILES } from '../types.ts'

test('all 8 supported languages have complete grid layout and 8x8 localized exonym matrix', () => {
  assert.equal(SUPPORTED_LANGS.length, 8)
  const flattened = LANGUAGE_GRID_ROWS.flat()
  assert.equal(flattened.length, 8)
  assert.deepEqual([...new Set(flattened)], [...SUPPORTED_LANGS])

  // Row 1 leads with English (left) and Simplified Chinese (right)
  assert.deepEqual(LANGUAGE_GRID_ROWS[0], ['en', 'zh'])
  // Right column groups CJK scripts cleanly (Korean above Japanese)
  assert.deepEqual(
    LANGUAGE_GRID_ROWS.map((r) => r[1]),
    ['zh', 'zh-TW', 'ko', 'ja'],
  )

  for (const code of SUPPORTED_LANGS) {
    const meta = LANGUAGE_META[code]
    assert.ok(meta.badge.length > 0)
    assert.ok(meta.nativeName.length > 0)
    assert.ok(meta.htmlLang.length > 0)
    assert.ok(meta.intlLocale.length > 0)
    assert.ok(meta.pickerTitle.length > 0)
    for (const activeLang of SUPPORTED_LANGS) {
      assert.ok(
        typeof meta.namesByLang[activeLang] === 'string' && meta.namesByLang[activeLang].length > 0,
        `Missing exonym for ${code} when UI is ${activeLang}`,
      )
    }
  }
})

test('normalizeLang, isLang, and toTemplateLang handle locale tags cleanly', () => {
  assert.equal(isLang('zh-TW'), true)
  assert.equal(isLang('ja'), true)
  assert.equal(isLang('fr'), false)

  assert.equal(normalizeLang('zh-CN'), 'zh')
  assert.equal(normalizeLang('zh-TW'), 'zh-TW')
  assert.equal(normalizeLang('zh-HK'), 'zh-TW')
  assert.equal(normalizeLang('zh-Hant'), 'zh-TW')
  assert.equal(normalizeLang('en-US'), 'en')
  assert.equal(normalizeLang('de-DE'), 'de')
  assert.equal(normalizeLang('ja-JP'), 'ja')
  assert.equal(normalizeLang('ko-KR'), 'ko')
  assert.equal(normalizeLang('ru-RU'), 'ru')
  assert.equal(normalizeLang('tr-TR'), 'tr')
  assert.equal(normalizeLang('unknown'), null)

  assert.equal(toTemplateLang('zh'), 'zh')
  assert.equal(toTemplateLang('zh-TW'), 'zh')
  for (const lang of ['en', 'de', 'ja', 'ko', 'ru', 'tr'] as const) {
    assert.equal(toTemplateLang(lang), 'en')
  }
})

test('all 6 extra locale dictionaries translate core strings, preserve placeholders, and contain zero emojis', () => {
  const emojiRx = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u
  const placeholderRx = /\{[a-zA-Z0-9_]+\}/g
  const expectedKeyCount = Object.keys(LOCALE_DICTS['zh-TW']).length
  assert.ok(expectedKeyCount > 2000, `Expected full dictionary, got ${expectedKeyCount}`)

  for (const [lang, dict] of Object.entries(LOCALE_DICTS)) {
    const keys = Object.keys(dict)
    assert.equal(keys.length, expectedKeyCount, `${lang} dictionary size mismatch`)
    for (const [enKey, translated] of Object.entries(dict)) {
      if (enKey.length > 0) {
        assert.ok(translated.length > 0, `Empty translation in ${lang} for "${enKey}"`)
      }
      assert.equal(emojiRx.test(translated), false, `Emoji found in ${lang} for "${enKey}": ${translated}`)
      if (lang !== 'zh-TW') {
        const expectedPh = [...new Set(enKey.match(placeholderRx) ?? [])].sort()
        const actualPh = [...new Set(translated.match(placeholderRx) ?? [])].sort()
        assert.deepEqual(
          actualPh,
          expectedPh,
          `Placeholder mismatch in ${lang} for "${enKey}": got "${translated}"`,
        )
      }
    }
  }

  // Interpolation works in every language
  assert.equal(tr('zh', '共 {v0} 项', '{v0} items', { v0: 5 }), '共 5 项')
  assert.equal(tr('en', '共 {v0} 项', '{v0} items', { v0: 5 }), '5 items')
  assert.ok(tr('ja', '导航', 'Links').length > 0)
  assert.ok(tr('de', '导航', 'Links').length > 0)
  assert.ok(tr('ko', '导航', 'Links').length > 0)
  assert.ok(tr('ru', '导航', 'Links').length > 0)
  assert.ok(tr('tr', '导航', 'Links').length > 0)
  assert.ok(tr('zh-TW', '导航', 'Links').length > 0)
})

test('all 7 config files have English variants on disk with matching versions and placeholders', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

  for (const key of ALL_CONFIG_FILES) {
    const dot = key.lastIndexOf('.')
    const enKey = `${key.slice(0, dot)}.en${key.slice(dot)}`
    assert.ok(fs.existsSync(path.join(repoRoot, 'config', key)), `Missing default config file config/${key}`)
    assert.ok(fs.existsSync(path.join(repoRoot, 'config', enKey)), `Missing English config file config/${enKey}`)
  }

  // Verify the 3 new AI English templates preserve versions and key prompt placeholders
  const analysisEn = fs.readFileSync(path.join(repoRoot, 'config/ai_analysis_prompt.en.txt'), 'utf8')
  assert.ok(analysisEn.includes('Version: 2.1.0'))
  for (const token of ['[system]', '[user]', '{language}', '{news_content}', '{rss_content}', '{search_content}', '{standalone_content}']) {
    assert.ok(analysisEn.includes(token), `ai_analysis_prompt.en.txt missing ${token}`)
  }

  const interestsEn = fs.readFileSync(path.join(repoRoot, 'config/ai_interests.en.txt'), 'utf8')
  assert.ok(interestsEn.includes('Version: 1.1.0'))

  const translationEn = fs.readFileSync(path.join(repoRoot, 'config/ai_translation_prompt.en.txt'), 'utf8')
  assert.ok(translationEn.includes('Version: 1.2.0'))
  for (const token of ['[system]', '[user]', '{target_language}', '{content}']) {
    assert.ok(translationEn.includes(token), `ai_translation_prompt.en.txt missing ${token}`)
  }
})
