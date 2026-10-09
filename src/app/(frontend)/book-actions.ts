'use server'

import { revalidatePath } from 'next/cache'
import { fail, cleanText, type ActionResult } from '@/lib/actionUtils'
import { cleanBookmarks, cleanCfi, type Bookmark } from '@/lib/books'
import { requireActionSession } from '@/lib/session'

function cleanId(id: unknown): number {
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) throw new Error('找不到這本書')
  return n
}

/** Where the reader is (called a moment after each page turn). */
export async function saveReadingPosition(id: number, cfi: string, progress: number): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    const p = Number(progress)
    await payload.update({
      collection: 'books',
      id: cleanId(id),
      data: {
        cfi: cleanCfi(cfi),
        progress: Number.isFinite(p) ? Math.min(1, Math.max(0, Math.round(p * 10_000) / 10_000)) : 0,
        lastReadAt: new Date().toISOString(),
      },
      user,
      overrideAccess: false,
      depth: 0,
    })
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

export async function saveBookmarks(id: number, bookmarks: Bookmark[]): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    await payload.update({
      collection: 'books',
      id: cleanId(id),
      data: { bookmarks: cleanBookmarks(bookmarks) },
      user,
      overrideAccess: false,
      depth: 0,
    })
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

export async function renameBook(id: number, title: string, author: string): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    const cleanTitle = cleanText(title, 300).trim()
    if (!cleanTitle) throw new Error('書名不能空白')
    await payload.update({
      collection: 'books',
      id: cleanId(id),
      data: { title: cleanTitle, author: cleanText(author, 200).trim() || null },
      user,
      overrideAccess: false,
      depth: 0,
    })
    revalidatePath('/books')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

/** Deletes the book and its file; the cover image is left to the daily cleanup. */
export async function deleteBook(id: number): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    await payload.delete({ collection: 'books', id: cleanId(id), user, overrideAccess: false, depth: 0 })
    revalidatePath('/books')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}
