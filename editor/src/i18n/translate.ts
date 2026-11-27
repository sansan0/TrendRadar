import type { Lang } from '../lib/types.ts'
import { ZH_TW_DICT } from './locales/zh-tw.ts'
import { DE_DICT } from './locales/de.ts'
import { JA_DICT } from './locales/ja.ts'
import { KO_DICT } from './locales/ko.ts'
import { RU_DICT } from './locales/ru.ts'
import { TR_DICT } from './locales/tr.ts'

export type ExtraLang = Exclude<Lang, 'zh' | 'en'>
export type TemplateVars = Record<string, unknown>

export const LOCALE_DICTS: Record<ExtraLang, Record<string, string>> = {
  'zh-TW': ZH_TW_DICT,
  de: DE_DICT,
  ja: JA_DICT,
  ko: KO_DICT,
  ru: RU_DICT,
  tr: TR_DICT,
}

function interpolate(template: string, vars?: TemplateVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`,
  )
}

export function tr(lang: Lang, zh: string, en: string, vars?: TemplateVars): string {
  let text: string
  if (lang === 'zh') {
    text = zh
  } else if (lang === 'en') {
    text = en
  } else {
    const dict = LOCALE_DICTS[lang]
    text = dict[en] ?? (lang === 'zh-TW' ? zh : en)
  }
  return interpolate(text, vars)
}
