export function changedTextRange(before: string, after: string) {
  let from = 0
  while (from < before.length && from < after.length && before[from] === after[from]) from++
  let to = before.length
  let end = after.length
  while (to > from && end > from && before[to - 1] === after[end - 1]) {
    to--
    end--
  }
  return { from, to, insert: after.slice(from, end) }
}

export function firstChangedPosition(before: string, after: string) {
  const { from } = changedTextRange(before, after)
  const lines = after.slice(0, from).split(/\r\n|\r|\n/)
  return { line: lines.length, column: lines[lines.length - 1].length + 1 }
}

export function findChangedLineSpan(
  before: string,
  after: string,
): { startLine: number; endLine: number; column: number } | null {
  const beforeNorm = before.replace(/\r\n?/g, '\n')
  const afterNorm = after.replace(/\r\n?/g, '\n')
  if (beforeNorm === afterNorm) return null
  const { from, insert } = changedTextRange(beforeNorm, afterNorm)
  const prefixLines = afterNorm.slice(0, from).split('\n')
  const startLine = prefixLines.length
  const column = prefixLines[prefixLines.length - 1].length + 1
  const rawEnd = from + insert.length
  const trimmedEnd = rawEnd > from && afterNorm[rawEnd - 1] === '\n' ? rawEnd - 1 : rawEnd
  const endLineRaw = afterNorm.slice(0, Math.max(from, trimmedEnd)).split('\n').length
  const endLine = Math.max(startLine, Math.min(startLine + 7, endLineRaw))
  return { startLine, endLine, column }
}
