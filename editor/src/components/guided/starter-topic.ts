import { parseFrequencyWords } from '../../lib/frequency-parser.ts'

type TopicFile = 'frequency_words.txt' | 'ai_interests.txt'
type TopicResult = { status: 'added'; content: string } | { status: 'duplicate' | 'invalid' }

export function appendStarterTopic(raw: string, file: TopicFile, topic: string): TopicResult {
  const text = topic.trim()
  if (!text || text.startsWith('#') || /[\r\n]/.test(text)) return { status: 'invalid' }
  const eol = raw.match(/\r\n|\n|\r/)?.[0] ?? '\n'
  const normalized = raw.replace(/\r\n?/g, '\n')
  let addition = text
  if (file === 'frequency_words.txt') {
    const item = parseFrequencyWords(text).groups[0]?.items[0]
    if (item?.kind !== 'normal' || item.isRegex || item.pattern !== text) return { status: 'invalid' }
    const duplicate = parseFrequencyWords(normalized).groups.some((group) =>
      group.items.length === 1 && group.items[0].kind === 'normal' && !group.items[0].isRegex &&
      group.items[0].pattern.toLowerCase() === text.toLowerCase())
    if (duplicate) return { status: 'duplicate' }
    const markers = normalized.split('\n\n').map((block) =>
      block.split('\n').map((line) => line.trim()).find((line) => line && !line.startsWith('#'))?.toUpperCase()
    ).filter((first) => first === '[GLOBAL_FILTER]' || first === '[WORD_GROUPS]')
    if (markers.at(-1) === '[GLOBAL_FILTER]') addition = '[WORD_GROUPS]' + eol + eol + text
  } else if (normalized.split('\n').some((line) => line.trim() === text)) {
    return { status: 'duplicate' }
  }
  // The runtime separates keyword groups at two consecutive newlines.
  let separator = ''
  if (raw && !normalized.endsWith('\n\n')) separator = normalized.endsWith('\n') ? eol : eol + eol
  return { status: 'added', content: raw + separator + addition + eol }
}
