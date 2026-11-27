import type { Lang, TemplateLang } from '../lib/types.ts'

export interface LanguageMeta {
  code: Lang
  badge: string
  nativeName: string
  htmlLang: string
  intlLocale: string
  pickerTitle: string
  /** Localized name of THIS language in every supported UI language. */
  namesByLang: Record<Lang, string>
}

/**
 * Balanced 2-column ordering (4 rows x 2 columns):
 * - Left column: European / alphabetic scripts, led by English (EN)
 * - Right column: East Asian CJK scripts, led by Simplified Chinese (简)
 * Both highest-traffic languages sit on Row 1; positions stay fixed across switches.
 */
export const LANGUAGE_GRID_ROWS: readonly (readonly [Lang, Lang])[] = [
  ['en', 'zh'],
  ['de', 'zh-TW'],
  ['tr', 'ko'],
  ['ru', 'ja'],
] as const

export const SUPPORTED_LANGS: readonly Lang[] = [
  'en',
  'zh',
  'de',
  'zh-TW',
  'tr',
  'ko',
  'ru',
  'ja',
] as const

export const LANGUAGE_META: Record<Lang, LanguageMeta> = {
  en: {
    code: 'en',
    badge: 'EN',
    nativeName: 'English',
    htmlLang: 'en',
    intlLocale: 'en-US',
    pickerTitle: 'Language',
    namesByLang: {
      zh: '英语',
      'zh-TW': '英語',
      en: 'English',
      de: 'Englisch',
      ja: '英語',
      ko: '영어',
      ru: 'Английский',
      tr: 'İngilizce',
    },
  },
  zh: {
    code: 'zh',
    badge: '简',
    nativeName: '简体中文',
    htmlLang: 'zh-CN',
    intlLocale: 'zh-CN',
    pickerTitle: '语言',
    namesByLang: {
      zh: '简体中文',
      'zh-TW': '簡體中文',
      en: 'Simplified Chinese',
      de: 'Chinesisch (vereinfacht)',
      ja: '簡体字中国語',
      ko: '중국어 (간체)',
      ru: 'Китайский (упр.)',
      tr: 'Basitleştirilmiş Çince',
    },
  },
  de: {
    code: 'de',
    badge: 'DE',
    nativeName: 'Deutsch',
    htmlLang: 'de',
    intlLocale: 'de-DE',
    pickerTitle: 'Sprache',
    namesByLang: {
      zh: '德语',
      'zh-TW': '德語',
      en: 'German',
      de: 'Deutsch',
      ja: 'ドイツ語',
      ko: '독일어',
      ru: 'Немецкий',
      tr: 'Almanca',
    },
  },
  'zh-TW': {
    code: 'zh-TW',
    badge: '繁',
    nativeName: '繁體中文',
    htmlLang: 'zh-TW',
    intlLocale: 'zh-TW',
    pickerTitle: '語言',
    namesByLang: {
      zh: '繁体中文',
      'zh-TW': '繁體中文',
      en: 'Traditional Chinese',
      de: 'Chinesisch (traditionell)',
      ja: '繁体字中国語',
      ko: '중국어 (번체)',
      ru: 'Китайский (трад.)',
      tr: 'Geleneksel Çince',
    },
  },
  tr: {
    code: 'tr',
    badge: 'TR',
    nativeName: 'Türkçe',
    htmlLang: 'tr',
    intlLocale: 'tr-TR',
    pickerTitle: 'Dil',
    namesByLang: {
      zh: '土耳其语',
      'zh-TW': '土耳其語',
      en: 'Turkish',
      de: 'Türkisch',
      ja: 'トルコ語',
      ko: '튀르키예어',
      ru: 'Турецкий',
      tr: 'Türkçe',
    },
  },
  ja: {
    code: 'ja',
    badge: 'JA',
    nativeName: '日本語',
    htmlLang: 'ja',
    intlLocale: 'ja-JP',
    pickerTitle: '言語',
    namesByLang: {
      zh: '日语',
      'zh-TW': '日語',
      en: 'Japanese',
      de: 'Japanisch',
      ja: '日本語',
      ko: '일본어',
      ru: 'Японский',
      tr: 'Japonca',
    },
  },
  ru: {
    code: 'ru',
    badge: 'RU',
    nativeName: 'Русский',
    htmlLang: 'ru',
    intlLocale: 'ru-RU',
    pickerTitle: 'Язык',
    namesByLang: {
      zh: '俄语',
      'zh-TW': '俄語',
      en: 'Russian',
      de: 'Russisch',
      ja: 'ロシア語',
      ko: '러시아어',
      ru: 'Русский',
      tr: 'Rusça',
    },
  },
  ko: {
    code: 'ko',
    badge: 'KO',
    nativeName: '한국어',
    htmlLang: 'ko',
    intlLocale: 'ko-KR',
    pickerTitle: '언어',
    namesByLang: {
      zh: '韩语',
      'zh-TW': '韓語',
      en: 'Korean',
      de: 'Koreanisch',
      ja: '韓国語',
      ko: '한국어',
      ru: 'Корейский',
      tr: 'Korece',
    },
  },
}

const LANG_SET = new Set<string>(SUPPORTED_LANGS)

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && LANG_SET.has(value)
}

export function normalizeLang(raw: string | null | undefined): Lang | null {
  if (!raw) return null
  const lower = raw.trim().toLowerCase().replace(/_/g, '-')
  if (lower === 'zh-tw' || lower === 'zh-hk' || lower === 'zh-mo' || lower.startsWith('zh-hant')) {
    return 'zh-TW'
  }
  if (lower === 'zh' || lower === 'zh-cn' || lower === 'zh-sg' || lower.startsWith('zh-hans')) {
    return 'zh'
  }
  if (lower === 'en' || lower.startsWith('en-')) return 'en'
  if (lower === 'de' || lower.startsWith('de-')) return 'de'
  if (lower === 'ja' || lower.startsWith('ja-')) return 'ja'
  if (lower === 'ko' || lower.startsWith('ko-')) return 'ko'
  if (lower === 'ru' || lower.startsWith('ru-')) return 'ru'
  if (lower === 'tr' || lower.startsWith('tr-')) return 'tr'
  return null
}

/** Map any UI language to the matching bundled YAML template / external bilingual site language. */
export function toTemplateLang(lang: Lang): TemplateLang {
  return lang === 'zh' || lang === 'zh-TW' ? 'zh' : 'en'
}
