import type { ReviewComment } from './providers/types'

const MAX_COMMENT_BODY_CHARS = 2000
const MAX_SUMMARY_CHARS = 4000
const MAX_REVIEW_COMMENTS = 20

export function sanitizeMarkdown(text: string, maxLength = MAX_SUMMARY_CHARS): string {
  return normalizeMarkdownLinks({ text }).replaceAll('@', '@​').slice(0, maxLength)
}

export function capComments(comments: ReviewComment[], max = MAX_REVIEW_COMMENTS): ReviewComment[] {
  return comments.slice(0, max)
}

export function filterCommentsToChangedFiles(
  comments: ReviewComment[],
  changedPaths: Set<string>,
): ReviewComment[] {
  return comments.filter((c) => changedPaths.has(c.path))
}

export { MAX_COMMENT_BODY_CHARS, MAX_REVIEW_COMMENTS, MAX_SUMMARY_CHARS }

function normalizeMarkdownLinks({ text }: { text: string }): string {
  const closingParentheses = getClosingParentheses({ text })
  const parts: string[] = []
  let sourceCursor = 0
  let searchCursor = 0

  // Each label is examined once. Parenthesis pairs are indexed in advance so
  // malformed or nested links cannot make us repeatedly scan the remaining text.
  while (searchCursor < text.length) {
    const displayStart = text.indexOf('[', searchCursor)
    if (displayStart === -1) {
      break
    }
    const displayEnd = text.indexOf(']', displayStart + 1)
    if (displayEnd === -1) {
      break
    }
    const urlStart = displayEnd + 1
    const urlEnd = text[urlStart] === '(' ? closingParentheses.get(urlStart) : undefined
    if (urlEnd === undefined) {
      searchCursor = displayEnd + 1
      continue
    }

    parts.push(
      text.slice(sourceCursor, displayStart),
      normalizeLink({
        displayText: text.slice(displayStart + 1, displayEnd),
        url: text.slice(urlStart + 1, urlEnd),
      }),
    )
    sourceCursor = urlEnd + 1
    searchCursor = sourceCursor
  }
  parts.push(text.slice(sourceCursor))
  return parts.join('')
}

function getClosingParentheses({ text }: { text: string }): Map<number, number> {
  const openings: number[] = []
  const closings = new Map<number, number>()
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '(') {
      openings.push(index)
    } else if (text[index] === ')') {
      const opening = openings.pop()
      if (opening !== undefined) {
        closings.set(opening, index)
      }
    }
  }
  return closings
}

function normalizeLink({ displayText, url }: { displayText: string; url: string }): string {
  if (/^https?:\/\//i.test(url)) {
    return `[${url}](${url})`
  }
  if (url.startsWith('#') || url.startsWith('/') || url.startsWith('.')) {
    return `[${displayText}](${url})`
  }
  return displayText
}
