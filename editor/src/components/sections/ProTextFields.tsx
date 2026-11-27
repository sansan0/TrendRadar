import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PanelsTopLeft } from 'lucide-react'
import { Button, SelectField } from '@/components/ui/primitives'
import { useT } from '@/i18n'
import { getTextSections, replaceTextSection, textOffset, textPosition, textareaText, type TextSection } from '@/lib/text-sections'
import type { ConfigFileKey } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useEditor } from '@/store/editor-store'

interface ProTextFieldsProps {
  file: ConfigFileKey
  value: string
  line: number
  column: number
  revealSeq: number
  onNavigate: (line: number, column?: number) => void
  onChange: (value: string, line: number, column: number) => void
}

const labels: Record<TextSection['kind'], [string, string]> = {
  comments: ['注释', 'Comments'],
  filter: ['全局过滤', 'Global filters'],
  words: ['关键词组', 'Keyword group'],
  search: ['搜索主题', 'Search topic'],
  system: ['系统提示词', 'System prompt'],
  user: ['用户提示词', 'User prompt'],
  interests: ['兴趣描述', 'Interests'],
  text: ['文件内容', 'File content'],
}

const textStyle = 'min-w-0 overflow-x-hidden overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere] px-3 py-2.5 font-mono text-sm leading-6 [tab-size:4]'

function caretOf(input: HTMLTextAreaElement) {
  return input.selectionDirection === 'backward' ? input.selectionStart : input.selectionEnd
}

export function ProTextFields({ file, value, line, column, revealSeq, onNavigate, onChange }: ProTextFieldsProps) {
  const { setProView } = useEditor()
  const t = useT()
  const id = useId()
  const textarea = useRef<HTMLTextAreaElement>(null)
  const mirror = useRef<HTMLDivElement>(null)
  const marker = useRef<HTMLSpanElement>(null)
  const shown = useRef<{ file: ConfigFileKey; firstLine: number } | null>(null)
  const sections = useMemo(() => getTextSections(file, value), [file, value])
  const current = sections.find((entry) => line <= entry.lastLine) ?? sections[sections.length - 1]
  // A blank line or a new marker may split a group while the user is still typing into it.
  // Keep that textarea's input range until blur or an explicit source-side jump.
  const [edit, setEdit] = useState<{ file: ConfigFileKey; value: string; section: TextSection } | null>(null)
  const section = revealSeq === 0 && edit?.file === file && edit.value === value ? edit.section : current
  const body = textareaText(value.slice(section.from, section.to))
  const offset = textOffset(body, line, column, section.firstLine)
  const lineStart = offset === 0 ? 0 : body.lastIndexOf('\n', offset - 1) + 1
  const newline = body.indexOf('\n', offset)
  const lineEnd = newline === -1 ? body.length : newline
  const markedChar = offset < lineEnd ? String.fromCodePoint(body.codePointAt(offset)!) : '\u200b'
  const label = (entry: TextSection) => {
    const name = t(...labels[entry.kind])
    return entry.title ? name + ' · ' + entry.title : name
  }

  useLayoutEffect(() => {
    const input = textarea.current
    const overlay = mirror.current
    const caret = marker.current
    if (!input || !overlay || !caret) return
    const sameSection = shown.current?.file === file && shown.current.firstLine === section.firstLine
    shown.current = { file, firstLine: section.firstLine }
    if (revealSeq === 0 && sameSection) return

    input.setSelectionRange(offset, offset)
    const reveal = () => {
      if (!input.clientHeight) return
      const bounds = input.getBoundingClientRect()
      const rect = caret.getBoundingClientRect()
      const top = rect.top - bounds.top + overlay.scrollTop
      if (top < input.scrollTop || top + rect.height > input.scrollTop + input.clientHeight) {
        input.scrollTop = Math.max(0, top - input.clientHeight / 2)
      }
      overlay.scrollTop = input.scrollTop
      const pane = input.closest('main')
      if (pane) {
        const row = caret.getBoundingClientRect()
        const area = pane.getBoundingClientRect()
        if (row.top < area.top || row.bottom > area.bottom) pane.scrollTop += row.top - area.top - 16
      }
    }
    reveal()
    const observer = new ResizeObserver(reveal)
    observer.observe(input)
    return () => observer.disconnect()
  }, [file, section.firstLine, offset, revealSeq])

  function navigate(input: HTMLTextAreaElement, repeat = false) {
    if (document.activeElement !== input || input.value !== body) return
    const pos = textPosition(body, caretOf(input), section.firstLine)
    if (repeat || pos.line !== line || pos.column !== column) onNavigate(pos.line, pos.column)
  }

  return (
    <div className="min-w-0 space-y-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-soft)]/50 px-3 py-2 text-xs">
        <span className="text-[var(--text-secondary)]">
          {t('当前聚焦编辑这一段内容；切换到「可视化」可用图形界面添加规则与实时测试。', 'Editing this section directly; switch to Visual for the interactive rule builder and live preview.')}
        </span>
        <Button size="xs" variant="primary" onClick={() => setProView('features')}>
          <PanelsTopLeft size={13} />
          <span>{t('切换到可视化', 'Open Visual')}</span>
        </Button>
      </div>
      <div className="min-w-0 space-y-1.5">
        <span className="block text-sm font-medium">{t('段落定位', 'Section')}</span>
        <SelectField
          size="sm"
          value={String(current.firstLine)}
          ariaLabel={t('选择文本段落', 'Select text section')}
          title={label(current)}
          onValueChange={(val) => {
            setEdit(null)
            onNavigate(Number(val), 1)
          }}
          options={sections.map((entry) => ({
            value: String(entry.firstLine),
            label: label(entry),
            hint:
              entry.lastLine > entry.firstLine
                ? t('第 {v0}–{v1} 行', 'Lines {v0}–{v1}', { v0: entry.firstLine, v1: entry.lastLine })
                : t('第 {v0} 行', 'Line {v0}', { v0: entry.firstLine }),
          }))}
        />
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <label htmlFor={id} className="text-sm font-medium">{t(...labels[section.kind])}</label>
        <span className="text-xs tabular-nums text-[var(--text-muted)]">{t('第 ' + line + ' 行，第 ' + column + ' 列', 'Line ' + line + ', column ' + column)}</span>
      </div>
      <div className="relative rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] focus-within:border-[var(--brand-primary)]">
        {/* The mirror keeps the selected source line visible without taking focus from CodeMirror. */}
        <div aria-hidden="true" ref={mirror} className={cn('pointer-events-none absolute inset-0 overflow-hidden rounded-lg text-transparent', textStyle)}>
          {body.slice(0, lineStart)}
          <mark className="rounded-sm bg-[var(--brand-soft)] text-transparent">
            {body.slice(lineStart, offset)}
            <span ref={marker}>{markedChar}</span>
            {body.slice(Math.min(offset + markedChar.length, lineEnd), lineEnd)}
          </mark>
          {body.slice(lineEnd)}
        </div>
        <textarea
          ref={textarea}
          id={id}
          value={body}
          rows={Math.min(18, Math.max(5, section.lastLine - section.firstLine + 1))}
          spellCheck={false}
          className={cn('relative block w-full resize-y rounded-lg bg-transparent text-[var(--text-primary)] outline-none', textStyle)}
          onScroll={(event) => {
            if (mirror.current) mirror.current.scrollTop = event.currentTarget.scrollTop
          }}
          onSelect={(event) => navigate(event.currentTarget)}
          onClick={(event) => navigate(event.currentTarget, true)}
          onBlur={() => setEdit(null)}
          onChange={(event) => {
            const input = event.currentTarget
            const next = replaceTextSection(value, section, input.value)
            const pos = textPosition(input.value, caretOf(input), section.firstLine)
            setEdit({ file, ...next })
            onChange(next.value, pos.line, pos.column)
          }}
        />
      </div>
    </div>
  )
}
