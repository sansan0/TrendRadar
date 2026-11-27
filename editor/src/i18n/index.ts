import { useCallback } from 'react'
import { useEditor } from '@/store/editor-store'
import type { Lang } from '@/lib/types'
import { tr, type TemplateVars } from './translate'

export {
  isLang,
  LANGUAGE_GRID_ROWS,
  LANGUAGE_META,
  normalizeLang,
  SUPPORTED_LANGS,
  toTemplateLang,
  type LanguageMeta,
} from './languages'
export { LOCALE_DICTS, tr, type ExtraLang, type TemplateVars } from './translate'

export function useT() {
  const { lang } = useEditor()
  return useCallback(
    (zh: string, en: string, vars?: TemplateVars) => tr(lang, zh, en, vars),
    [lang],
  )
}

export function useLang(): Lang {
  return useEditor().lang
}
