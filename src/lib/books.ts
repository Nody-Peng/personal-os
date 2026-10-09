// E-books (`books` collection): types shared by the library, the reader and
// the server actions in app/(frontend)/book-actions.ts.

export type Bookmark = { cfi: string; label: string; createdAt: string }

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
  createdAt: string
}

export const MAX_BOOKMARKS = 200
const MAX_CFI = 2000
const MAX_LABEL = 200

/** EPUB CFIs look like `epubcfi(/6/14!/4/2/1:0)`; anything else is rejected. */
export function cleanCfi(value: unknown): string {
  const cfi = String(value ?? '')
  if (cfi.length > MAX_CFI || !/^epubcfi\([^()]*\)$/.test(cfi)) throw new Error('閱讀位置格式錯誤')
  return cfi
}

export function cleanBookmarks(value: unknown): Bookmark[] {
  if (!Array.isArray(value)) throw new Error('書籤格式錯誤')
  return value.slice(0, MAX_BOOKMARKS).map((b) => {
    const item = (b ?? {}) as Record<string, unknown>
    const createdAt = String(item.createdAt ?? '')
    return {
      cfi: cleanCfi(item.cfi),
      label: String(item.label ?? '').slice(0, MAX_LABEL),
      createdAt: Number.isNaN(Date.parse(createdAt)) ? new Date().toISOString() : createdAt,
    }
  })
}

export function bookmarksOf(value: unknown): Bookmark[] {
  try {
    return cleanBookmarks(value ?? [])
  } catch {
    return []
  }
}

/** `/api/media/file/...` only: covers are uploaded media, never outside links. */
export function cleanCoverUrl(value: unknown): string | null {
  const url = String(value ?? '')
  return /^\/api\/media\/file\/[^\s"'<>]+$/.test(url) && url.length <= 500 ? url : null
}

export const percentOf = (progress: number) => `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`
