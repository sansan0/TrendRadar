import { useEffect, useRef, type PointerEvent } from 'react'
import { Check, ChevronDown, Globe } from 'lucide-react'
import { Popover, PopoverPanel, PopoverTrigger } from '@/components/ui/primitives'
import { LANGUAGE_GRID_ROWS, LANGUAGE_META, useT } from '@/i18n'
import type { Lang } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useEditor } from '@/store/editor-store'

const CLOSE_DELAY_MS = 150

export function LanguageMenuPopover({
  open,
  onOpenChange,
  onBeforeOpen,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBeforeOpen?: () => void
}) {
  const { lang, setLang } = useEditor()
  const t = useT()
  const closeTimerRef = useRef<number | null>(null)
  const lastPointerTypeRef = useRef<string>('mouse')

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const openMenu = () => {
    clearCloseTimer()
    onBeforeOpen?.()
    onOpenChange(true)
  }

  const scheduleCloseMenu = () => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      onOpenChange(false)
      closeTimerRef.current = null
    }, CLOSE_DELAY_MS)
  }

  useEffect(() => () => {
    clearCloseTimer()
  }, [])

  const onMouseEnter = (e: PointerEvent) => {
    lastPointerTypeRef.current = e.pointerType
    if (e.pointerType === 'mouse') openMenu()
  }

  const onMouseLeave = (e: PointerEvent) => {
    lastPointerTypeRef.current = e.pointerType
    if (e.pointerType === 'mouse') scheduleCloseMenu()
  }

  const handleSelect = (code: Lang) => {
    setLang(code)
    // On desktop mouse hover, keep the panel open briefly while pointer remains inside
    // so the user immediately sees every language's bottom explanation switch to their chosen language.
    // On touch/keyboard, close right away.
    if (lastPointerTypeRef.current !== 'mouse') {
      clearCloseTimer()
      onOpenChange(false)
    }
  }

  const currentMeta = LANGUAGE_META[lang]

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        clearCloseTimer()
        if (nextOpen) onBeforeOpen?.()
        onOpenChange(nextOpen)
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          data-lang-switcher-trigger="true"
          onPointerEnter={onMouseEnter}
          onPointerLeave={onMouseLeave}
          className={cn(
            'tr-focus-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium whitespace-nowrap text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] cursor-pointer',
            open && 'bg-[var(--bg-muted)] text-[var(--text-primary)]',
          )}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={t('切换界面语言', 'Switch interface language')}
          title={`${currentMeta.pickerTitle}: ${currentMeta.nativeName}`}
        >
          <Globe className="h-4 w-4 shrink-0" />
          <span className="min-w-[18px] text-center">{currentMeta.badge}</span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-180',
              open && 'rotate-180 opacity-100',
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverPanel
        align="end"
        onPointerEnter={onMouseEnter}
        onPointerLeave={onMouseLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        data-lang-switcher-panel="true"
        className="relative w-[min(428px,calc(100vw-24px))] overflow-visible p-0 before:absolute before:-top-3 before:left-0 before:right-0 before:h-3 before:content-['']"
      >
        <div className="overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 bg-[var(--bg-subtle)]/55 px-3.5 py-2">
            <span className="text-xs font-semibold tracking-wide text-[var(--text-secondary)]">
              {currentMeta.pickerTitle}
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">
              {currentMeta.nativeName}
            </span>
          </div>

          <div
            role="menu"
            aria-label={currentMeta.pickerTitle}
            className="grid grid-cols-1 gap-1.5 p-2.5 sm:grid-cols-2"
          >
            {LANGUAGE_GRID_ROWS.flat().map((code) => {
              const item = LANGUAGE_META[code]
              const active = code === lang
              const localizedSubLabel = item.namesByLang[lang]
              return (
                <button
                  key={code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  data-lang-option={code}
                  onPointerDown={(e) => {
                    lastPointerTypeRef.current = e.pointerType
                  }}
                  onClick={() => handleSelect(code)}
                  className={cn(
                    'tr-focus-ring group flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all cursor-pointer',
                    active
                      ? 'border-[var(--brand-border)] bg-[var(--brand-soft)] shadow-[var(--shadow-xs)]'
                      : 'border-transparent bg-transparent hover:border-[var(--border-default)]/70 hover:bg-[var(--bg-muted)]/75',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-[11px] font-semibold tracking-tight transition-colors',
                      active
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-[var(--shadow-xs)]'
                        : 'border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] group-hover:border-[var(--brand-border)] group-hover:text-[var(--brand-primary)]',
                    )}
                    aria-hidden="true"
                  >
                    {active ? <Check className="h-4 w-4 stroke-[2.5]" /> : item.badge}
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span
                      className={cn(
                        'truncate text-[13.5px] font-semibold leading-snug',
                        active ? 'text-[var(--brand-primary)]' : 'text-[var(--text-primary)]',
                      )}
                    >
                      {item.nativeName}
                    </span>
                    <span
                      data-lang-exonym={code}
                      className="truncate text-[11.5px] leading-snug text-[var(--text-muted)]"
                    >
                      {localizedSubLabel}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </PopoverPanel>
    </Popover>
  )
}
