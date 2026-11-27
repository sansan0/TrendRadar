import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { Compartment, EditorState, RangeSetBuilder, StateEffect, StateField, Transaction, type Extension } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  GutterMarker,
  gutterLineClass,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { yaml } from '@codemirror/lang-yaml'
import { HighlightStyle, syntaxHighlighting, bracketMatching } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { tags } from '@lezer/highlight'
import type { ThemeMode } from '@/lib/types'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { changedTextRange } from '@/lib/source-text'
import { replaceTextareaText } from '@/lib/text-sections'

const lightHighlight = HighlightStyle.define([
  { tag: tags.comment, color: '#64748b', fontStyle: 'italic' },
  { tag: tags.propertyName, color: '#0369a1', fontWeight: '600' },
  { tag: tags.string, color: '#0f766e' },
  { tag: tags.number, color: '#b45309' },
  { tag: tags.bool, color: '#7c3aed', fontWeight: '600' },
  { tag: tags.null, color: '#6b7280' },
  { tag: tags.keyword, color: '#7c3aed' },
])

const studioBaseTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'var(--font-mono)',
    fontSize: '12.5px',
    lineHeight: '1.65',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: '1px solid var(--border-default)',
    color: 'var(--text-muted)',
    userSelect: 'none',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--brand-soft)',
    color: 'var(--brand-primary)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--brand-soft)',
  },
})

export type JumpLineInput = number | { line: number; column?: number; seq: number; alignToTop?: boolean } | null | undefined
export type FlashLinesInput = { startLine: number; endLine: number; seq: number } | null | undefined

const setFlashEffect = StateEffect.define<{ startLine: number; endLine: number } | null>()
const flashLineDecoration = Decoration.line({
  attributes: { class: 'cm-value-flash-line', 'data-changed-line': 'true' },
})
class FlashGutterMarker extends GutterMarker {
  elementClass = 'cm-value-flash-gutter'
}
const flashGutterMarker = new FlashGutterMarker()

const flashLinesField = StateField.define<{
  range: { startLine: number; endLine: number } | null
  decorations: DecorationSet
  gutter: ReturnType<RangeSetBuilder<GutterMarker>['finish']>
}>({
  create() {
    return {
      range: null,
      decorations: Decoration.none,
      gutter: new RangeSetBuilder<GutterMarker>().finish(),
    }
  },
  update(state, tr) {
    let nextRange = state.range
    let changed = false
    for (const effect of tr.effects) {
      if (effect.is(setFlashEffect)) {
        nextRange = effect.value
        changed = true
      }
    }
    if (!changed && (!tr.docChanged || !nextRange)) return state
    if (!nextRange) {
      return {
        range: null,
        decorations: Decoration.none,
        gutter: new RangeSetBuilder<GutterMarker>().finish(),
      }
    }
    const lineBuilder = new RangeSetBuilder<Decoration>()
    const gutterBuilder = new RangeSetBuilder<GutterMarker>()
    const maxLines = tr.state.doc.lines
    const fromL = Math.max(1, Math.min(nextRange.startLine, maxLines))
    const toL = Math.max(fromL, Math.min(nextRange.endLine, maxLines))
    for (let ln = fromL; ln <= toL; ln++) {
      const line = tr.state.doc.line(ln)
      lineBuilder.add(line.from, line.from, flashLineDecoration)
      gutterBuilder.add(line.from, line.from, flashGutterMarker)
    }
    return {
      range: nextRange,
      decorations: lineBuilder.finish(),
      gutter: gutterBuilder.finish(),
    }
  },
  provide(field) {
    return [
      EditorView.decorations.from(field, (v) => v.decorations),
      gutterLineClass.from(field, (v) => v.gutter),
    ]
  },
})

export function CodeEditor({
  value,
  onChange,
  onSourcePosition,
  onScrollLine,
  editorHistory,
  language = 'yaml',
  theme = 'light',
  readOnly = false,
  jumpToLine,
  flashLines,
  className,
}: {
  value: string
  onChange?: (val: string) => void
  onSourcePosition?: (line: number, column: number) => void
  onScrollLine?: (line: number) => void
  editorHistory?: { undo: () => void; redo: () => void }
  language?: 'yaml' | 'text'
  theme?: ThemeMode
  readOnly?: boolean
  jumpToLine?: JumpLineInput
  flashLines?: FlashLinesInput
  className?: string
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const settings = useRef({ language: new Compartment(), theme: new Compartment(), readOnly: new Compartment() })
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onPositionRef = useRef(onSourcePosition)
  onPositionRef.current = onSourcePosition
  const onScrollLineRef = useRef(onScrollLine)
  onScrollLineRef.current = onScrollLine
  const rawRef = useRef(value)
  const historyRef = useRef(editorHistory)
  historyRef.current = editorHistory
  const internalUpdateRef = useRef(false)
  const programmaticScrollUntilRef = useRef(0)
  const lastTopJumpSeq = useRef<number | null>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const t = useT()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let lastPosition = ''
    const reportPosition = (view: EditorView, offset: number, force = false) => {
      if (!onPositionRef.current) return
      const line = view.state.doc.lineAt(offset)
      const column = offset - line.from + 1
      const key = `${line.number}/${column}`
      if (!force && lastPosition === key) return
      lastPosition = key
      onPositionRef.current(line.number, column)
    }

    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      flashLinesField,
      bracketMatching(),
      historyRef.current ? keymap.of([
        { key: 'Mod-z', run: () => { historyRef.current?.undo(); return true } },
        { key: 'Mod-Shift-z', run: () => { historyRef.current?.redo(); return true } },
        { key: 'Ctrl-y', run: () => { historyRef.current?.redo(); return true } },
        ...defaultKeymap,
      ]) : [history(), keymap.of([...defaultKeymap, ...historyKeymap])],
      EditorView.lineWrapping,
      studioBaseTheme,
      settings.current.readOnly.of(EditorState.readOnly.of(readOnly)),
      EditorView.updateListener.of((update) => {
        if (internalUpdateRef.current) {
          lastPosition = ''
          return
        }
        if (update.docChanged) {
          rawRef.current = replaceTextareaText(rawRef.current, update.state.doc.toString())
          onChangeRef.current?.(rawRef.current)
        }
        if ((update.selectionSet || update.docChanged) && update.view.hasFocus) {
          reportPosition(update.view, update.state.selection.main.head, update.docChanged)
        }
      }),
    ]

    extensions.push(settings.current.language.of(language === 'yaml' ? yaml() : []))
    extensions.push(settings.current.theme.of(theme === 'dark' ? oneDark : syntaxHighlighting(lightHighlight)))

    const view = new EditorView({
      state: EditorState.create({
        doc: value.replace(/\r\n?/g, '\n'),
        extensions,
      }),
      parent: host,
    })

    viewRef.current = view
    lastTopJumpSeq.current = null
    const scroller = view.scrollDOM
    let scrollRaf = 0
    let lastScrolledLine = 0
    const onPointerUp = () => {
      if (view.hasFocus) reportPosition(view, view.state.selection.main.head)
    }
    const handleScroll = () => {
      setShowBackToTop(scroller.scrollTop > 220)
      if (!onScrollLineRef.current) return
      if (Date.now() < programmaticScrollUntilRef.current) return
      if (scrollRaf) return
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0
        if (!onScrollLineRef.current || Date.now() < programmaticScrollUntilRef.current) return
        const probeOffset = scroller.scrollTop + Math.min(72, scroller.clientHeight * 0.2)
        const block = view.lineBlockAtHeight(probeOffset)
        const lineNum = view.state.doc.lineAt(block.from).number
        if (lineNum !== lastScrolledLine) {
          lastScrolledLine = lineNum
          onScrollLineRef.current(lineNum)
        }
      })
    }
    view.contentDOM.addEventListener('pointerup', onPointerUp)
    scroller.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      if (scrollRaf) cancelAnimationFrame(scrollRaf)
      view.contentDOM.removeEventListener('pointerup', onPointerUp)
      scroller.removeEventListener('scroll', handleScroll)
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    viewRef.current?.dispatch({ effects: [
      settings.current.language.reconfigure(language === 'yaml' ? yaml() : []),
      settings.current.theme.reconfigure(theme === 'dark' ? oneDark : syntaxHighlighting(lightHighlight)),
      settings.current.readOnly.reconfigure(EditorState.readOnly.of(readOnly)),
    ] })
  }, [language, theme, readOnly])

  // Sync external value changes without losing cursor position unnecessarily
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    rawRef.current = value
    const current = view.state.doc.toString()
    const next = value.replace(/\r\n?/g, '\n')
    if (current === next) return
    internalUpdateRef.current = true
    view.dispatch({
      changes: changedTextRange(current, next),
      annotations: Transaction.addToHistory.of(false),
    })
    internalUpdateRef.current = false
    // Undo/redo remaps the caret. Keep the form at that new position when the
    // source owns navigation; a form-originated update must retain its target.
    if (!jumpToLine) {
      const head = view.state.selection.main.head
      const line = view.state.doc.lineAt(head)
      onPositionRef.current?.(line.number, head - line.from + 1)
    }
  }, [value])

  // Jump to line when requested (supports repeated clicks via seq)
  const targetLine = typeof jumpToLine === 'number' ? jumpToLine : jumpToLine?.line ?? null
  const targetSeq = typeof jumpToLine === 'object' && jumpToLine ? jumpToLine.seq : 0
  const targetColumn = typeof jumpToLine === 'object' && jumpToLine ? jumpToLine.column ?? 1 : 1
  const alignToTop = typeof jumpToLine === 'object' && jumpToLine?.alignToTop === true

  useEffect(() => {
    const view = viewRef.current
    if (!view || !targetLine || targetLine < 1) return
    if (alignToTop && lastTopJumpSeq.current === targetSeq) return
    const totalLines = view.state.doc.lines
    const clamped = Math.min(targetLine, totalLines)
    const lineInfo = view.state.doc.line(clamped)
    const offset = Math.min(lineInfo.to, lineInfo.from + Math.max(0, targetColumn - 1))
    programmaticScrollUntilRef.current = Date.now() + 260
    internalUpdateRef.current = true
    view.dispatch({
      selection: { anchor: offset },
      effects: EditorView.scrollIntoView(offset, alignToTop ? { y: 'start', yMargin: 12 } : { y: 'nearest', yMargin: 24 }),
    })
    internalUpdateRef.current = false
    if (alignToTop) lastTopJumpSeq.current = targetSeq
  }, [targetLine, targetColumn, targetSeq, alignToTop])

  const flashSeq = flashLines?.seq ?? 0
  const flashStart = flashLines?.startLine ?? 0
  const flashEnd = flashLines?.endLine ?? 0

  useEffect(() => {
    const view = viewRef.current
    if (!view || !flashSeq || flashStart < 1) return
    const totalLines = view.state.doc.lines
    const clampedStart = Math.min(flashStart, totalLines)
    const clampedEnd = Math.max(clampedStart, Math.min(flashEnd, totalLines))
    const lineInfo = view.state.doc.line(clampedStart)
    programmaticScrollUntilRef.current = Date.now() + 360
    internalUpdateRef.current = true
    view.dispatch({
      ...(view.hasFocus ? {} : { selection: { anchor: lineInfo.from } }),
      effects: [
        setFlashEffect.of({ startLine: clampedStart, endLine: clampedEnd }),
        EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
      ],
    })
    internalUpdateRef.current = false

    const timer = window.setTimeout(() => {
      if (!viewRef.current) return
      internalUpdateRef.current = true
      viewRef.current.dispatch({ effects: setFlashEffect.of(null) })
      internalUpdateRef.current = false
    }, 2400)
    return () => window.clearTimeout(timer)
  }, [flashSeq, flashStart, flashEnd])

  const scrollToTop = () => {
    const view = viewRef.current
    if (!view) return
    programmaticScrollUntilRef.current = Date.now() + 260
    view.dispatch({ selection: { anchor: 0 }, effects: EditorView.scrollIntoView(0, { y: 'start' }) })
    onPositionRef.current?.(1, 1)
  }

  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)]',
        className,
      )}
    >
      <div ref={hostRef} className="h-full w-full" />
      {showBackToTop && (
        <button
          type="button"
          onClick={scrollToTop}
          title={t('回到文件开头（第 1 行）', 'Back to top (Line 1)')}
          className="tr-focus-ring absolute bottom-3 right-3 z-20 inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)]/95 px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] shadow-[var(--shadow-md)] backdrop-blur-md transition-all hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] cursor-pointer"
        >
          <ArrowUp className="h-3.5 w-3.5" />
          <span>{t('回到顶部', 'Top')}</span>
        </button>
      )}
    </div>
  )
}
