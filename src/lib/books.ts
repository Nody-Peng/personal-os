// E-books (`books` collection): types shared by the library, the reader and
// the server actions in app/(frontend)/book-actions.ts.

export type Bookmark = { cfi: string; label: string; createdAt: string }

export const HIGHLIGHT_COLORS = [
  { value: 'yellow', label: '黃', hex: '#f2c94c' },
  { value: 'green', label: '綠', hex: '#6fcf97' },
  { value: 'blue', label: '藍', hex: '#56a3f2' },
  { value: 'pink', label: '粉紅', hex: '#f28bb3' },
] as const
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]['value']

export type Highlight = { id: string; cfi: string; text: string; color: HighlightColor; note: string; createdAt: string }

export type Shelf = { id: number; name: string }

/** What the library and the reader need of a book (no file internals). */
export type BookSummary = {
  id: number
  title: string
  author: string | null
  language: string | null
  coverUrl: string | null
  url: string
  filesize: number | null
  cfi: string | null
  progress: number
  lastReadAt: string | null
  finishedAt: string | null
  shelves: number[]
  createdAt: string
}

export type ReadingStatus = 'unread' | 'reading' | 'finished'

export const READING_STATUSES: { value: ReadingStatus; label: string }[] = [
  { value: 'reading', label: '在讀' },
  { value: 'unread', label: '未讀' },
  { value: 'finished', label: '讀完' },
]

/** At the very end counts as read, as does 標記為讀完. */
export const FINISHED_AT = 0.995

export function statusOf(book: Pick<BookSummary, 'finishedAt' | 'progress' | 'lastReadAt'>): ReadingStatus {
  if (book.finishedAt || book.progress >= FINISHED_AT) return 'finished'
  return book.lastReadAt ? 'reading' : 'unread'
}

export const MAX_BOOKMARKS = 200
export const MAX_HIGHLIGHTS = 2000
export const MAX_SHELVES_PER_BOOK = 30
const MAX_CFI = 2000
const MAX_LABEL = 200
const MAX_HIGHLIGHT_TEXT = 1000
const MAX_NOTE = 2000

/** EPUB CFIs look like `epubcfi(/6/14!/4/2/1:0)`; anything else is rejected. */
export function cleanCfi(value: unknown): string {
  const cfi = String(value ?? '')
  if (cfi.length > MAX_CFI || !/^epubcfi\([^()]*\)$/.test(cfi)) throw new Error('閱讀位置格式錯誤')
  return cfi
}

const cleanDate = (value: unknown) => {
  const s = String(value ?? '')
  return Number.isNaN(Date.parse(s)) ? new Date().toISOString() : s
}

export function cleanBookmarks(value: unknown): Bookmark[] {
  if (!Array.isArray(value)) throw new Error('書籤格式錯誤')
  return value.slice(0, MAX_BOOKMARKS).map((b) => {
    const item = (b ?? {}) as Record<string, unknown>
    return { cfi: cleanCfi(item.cfi), label: String(item.label ?? '').slice(0, MAX_LABEL), createdAt: cleanDate(item.createdAt) }
  })
}

export function bookmarksOf(value: unknown): Bookmark[] {
  try {
    return cleanBookmarks(value ?? [])
  } catch {
    return []
  }
}

const COLOR_VALUES = new Set<string>(HIGHLIGHT_COLORS.map((c) => c.value))

export function cleanHighlights(value: unknown): Highlight[] {
  if (!Array.isArray(value)) throw new Error('劃線格式錯誤')
  return value.slice(0, MAX_HIGHLIGHTS).map((h) => {
    const item = (h ?? {}) as Record<string, unknown>
    const id = String(item.id ?? '')
    if (!/^[\w-]{1,40}$/.test(id)) throw new Error('劃線格式錯誤')
    const color = String(item.color)
    return {
      id,
      cfi: cleanCfi(item.cfi),
      text: String(item.text ?? '').slice(0, MAX_HIGHLIGHT_TEXT),
      color: (COLOR_VALUES.has(color) ? color : 'yellow') as HighlightColor,
      note: String(item.note ?? '').slice(0, MAX_NOTE),
      createdAt: cleanDate(item.createdAt),
    }
  })
}

export function highlightsOf(value: unknown): Highlight[] {
  try {
    return cleanHighlights(value ?? [])
  } catch {
    return []
  }
}

/** Positive integer ids, without repeats. */
export function cleanIds(value: unknown, max: number): number[] {
  if (!Array.isArray(value)) throw new Error('資料格式錯誤')
  const ids = [...new Set(value.map(Number))]
  if (ids.length > max || ids.some((n) => !Number.isInteger(n) || n <= 0)) throw new Error('資料格式錯誤')
  return ids
}

/** `/api/media/file/...` only: covers are uploaded media, never outside links. */
export function cleanCoverUrl(value: unknown): string | null {
  const url = String(value ?? '')
  return /^\/api\/media\/file\/[^\s"'<>]+$/.test(url) && url.length <= 500 ? url : null
}

export const percentOf = (progress: number) => `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`
