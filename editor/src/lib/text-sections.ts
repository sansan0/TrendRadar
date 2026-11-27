import { changedTextRange } from './source-text.ts'
import type { ConfigFileKey } from './types.ts'

const lineBreak = /\r\n|\r|\n/

export interface TextSection {
  kind: 'comments' | 'filter' | 'words' | 'search' | 'system' | 'user' | 'interests' | 'text'
  title: string
  firstLine: number
  lastLine: number
  from: number
  to: number
}

export function textareaText(raw: string): string {
  return raw.replace(/\r\n?/g, '\n')
}

function rawOffset(raw: string, offset: number): number {
  let index = 0
  for (let i = 0; i < offset; i++) {
    if (raw[index] === '\r' && raw[index + 1] === '\n') index++
    index++
  }
  return index
}

/** Native textareas expose LF offsets. Keep the original bytes on either side of the actual edit. */
export function replaceTextareaText(raw: string, nextLF: string, preferredEol = '\n'): string {
  const previous = textareaText(raw)
  if (previous === nextLF) return raw
  const range = changedTextRange(previous, nextLF)
  const from = rawOffset(raw, range.from)
  const to = rawOffset(raw, range.to)
  const prefix = raw.slice(0, from)
  const eol = prefix.match(/\r\n|\r|\n/g)?.at(-1) ?? raw.slice(from).match(lineBreak)?.[0] ?? preferredEol
  return prefix + range.insert.replace(/\n/g, eol) + raw.slice(to)
}

export function getTextSections(file: ConfigFileKey, source: string): TextSection[] {
  const lines = source.split(lineBreak)
  const offsets = [0]
  for (const match of source.matchAll(/\r\n|\r|\n/g)) offsets.push(match.index + match[0].length)

  const prompt = file === 'ai_analysis_prompt.txt' || file === 'ai_translation_prompt.txt'
  const interests = file === 'ai_interests.txt'
  const starts = [0]
  let paragraphBreak = false
  for (let i = 1; i < lines.length; i++) {
    if (file === 'frequency_words.txt' ? lines[i - 1] === '' : !lines[i - 1].trim()) paragraphBreak = true
    const text = lines[i].trim()
    if (!text) continue
    const newParagraph = paragraphBreak || (interests && /^(?:\d+[.)、]|[-*])\s/.test(text))
    if (prompt ? /^\[(system|user)\]$/.test(text) : newParagraph) starts.push(i)
    paragraphBreak = false
  }

  let globalFilter = false
  return starts.map((start, index) => {
    const end = (starts[index + 1] ?? lines.length) - 1
    const block = lines.slice(start, end + 1).map((line) => line.trim()).filter(Boolean)
    const rules = block.filter((line) => !line.startsWith('#'))
    let first = rules[0] ?? ''
    const marker = first.toUpperCase()
    let kind: TextSection['kind'] = 'text'
    let title = first

    if (!first) {
      kind = block.length ? 'comments' : 'text'
      title = block.map((line) => line.replace(/^#+\s*/, '')).find((line) => /[\p{L}\p{N}]/u.test(line)) ?? ''
    } else if (prompt) {
      if (first === '[system]') kind = 'system'
      if (first === '[user]') kind = 'user'
      if (kind !== 'text') title = first
    } else if (interests) {
      kind = 'interests'
      title = first.split(/[：:]/, 1)[0] || first
    } else {
      const groupsMarker = file === 'frequency_words.txt' ? '[WORD_GROUPS]' : '[SEARCH_TOPICS]'
      if (marker === '[GLOBAL_FILTER]' || marker === groupsMarker) {
        globalFilter = marker === '[GLOBAL_FILTER]'
        first = rules[1] ?? first
      }
      kind = globalFilter ? 'filter' : file === 'frequency_words.txt' ? 'words' : 'search'
      title = first.match(/^\[(.+)\]$/)?.[1] ?? first.split(/\s*=>\s*/).at(-1) ?? first
    }
    return { kind, title, firstLine: start + 1, lastLine: end + 1, from: offsets[start], to: offsets[end] + lines[end].length }
  })
}

export function replaceTextSection(source: string, section: TextSection, nextLF: string) {
  const before = source.slice(0, section.from)
  const after = source.slice(section.to)
  const eol = after.match(lineBreak)?.[0] ?? before.match(/\r\n|\r|\n/g)?.at(-1)
  const body = replaceTextareaText(source.slice(section.from, section.to), nextLF, eol)
  return {
    value: before + body + after,
    section: {
      ...section,
      lastLine: section.firstLine + nextLF.split('\n').length - 1,
      to: section.from + body.length,
    },
  }
}

export function textPosition(text: string, offset: number, firstLine: number) {
  const lines = text.slice(0, Math.max(0, offset)).split('\n')
  return { line: firstLine + lines.length - 1, column: lines[lines.length - 1].length + 1 }
}

export function textOffset(text: string, line: number, column: number, firstLine: number): number {
  const lines = text.split('\n')
  const index = Math.max(0, Math.min(lines.length - 1, line - firstLine))
  const lineStart = lines.slice(0, index).reduce((offset, part) => offset + part.length + 1, 0)
  return lineStart + Math.max(0, Math.min(lines[index].length, column - 1))
}
