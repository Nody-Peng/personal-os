'use server'

import { revalidatePath } from 'next/cache'
import { fail, cleanText, type ActionResult } from '@/lib/actionUtils'
import {
  FINISHED_AT,
  MAX_SHELVES_PER_BOOK,
  cleanBookmarks,
  cleanCfi,
  cleanHighlights,
  cleanIds,
  type Bookmark,
  type Highlight,
  type Shelf,
} from '@/lib/books'
import { requireActionSession, type Session } from '@/lib/session'

const MAX_BATCH = 500

function cleanId(id: unknown): number {
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) throw new Error('找不到這本書')
  return n
}

function cleanShelfName(name: unknown): string {
  const clean = cleanText(name, 40).trim()
  if (!clean) throw new Error('分類名稱不能空白')
  return clean
}

const shelvesOfBook = async ({ payload, user }: Session, id: number) => {
  const book = await payload.findByID({ collection: 'books', id, user, overrideAccess: false, depth: 0, select: { shelves: true } })
  return (book.shelves ?? []).map((s) => (typeof s === 'number' ? s : s.id))
}

/** Where the reader is (called a moment after each page turn, and on leaving). */
export async function saveReadingPosition(id: number, cfi: string, progress: number): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    const bookId = cleanId(id)
    const p = Number(progress)
    const clean = Number.isFinite(p) ? Math.min(1, Math.max(0, Math.round(p * 10_000) / 10_000)) : 0
    // Reaching the end marks the book read (keeping the first date it was).
    let finishedAt: string | undefined
    if (clean >= FINISHED_AT) {
      const book = await payload.findByID({ collection: 'books', id: bookId, user, overrideAccess: false, depth: 0, select: { finishedAt: true } })
      finishedAt = book.finishedAt ?? new Date().toISOString()
    }
    await payload.update({
      collection: 'books',
      id: bookId,
      data: { cfi: cleanCfi(cfi), progress: clean, lastReadAt: new Date().toISOString(), ...(finishedAt ? { finishedAt } : {}) },
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

export async function saveHighlights(id: number, highlights: Highlight[]): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    await payload.update({
      collection: 'books',
      id: cleanId(id),
      data: { highlights: cleanHighlights(highlights) },
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

/** Deletes books and their files; covers are left to the daily cleanup. */
export async function deleteBooks(ids: number[]): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    const clean = cleanIds(ids, MAX_BATCH)
    if (!clean.length) return { ok: true }
    await payload.delete({ collection: 'books', where: { id: { in: clean } }, user, overrideAccess: false, depth: 0 })
    revalidatePath('/books')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

/** 標記為讀完 (a full bar) or 重設進度 (back to the first page, unread). */
export async function setBooksFinished(ids: number[], finished: boolean): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    const clean = cleanIds(ids, MAX_BATCH)
    if (!clean.length) return { ok: true }
    const now = new Date().toISOString()
    await payload.update({
      collection: 'books',
      where: { id: { in: clean } },
      data: finished
        ? { finishedAt: now, progress: 1, lastReadAt: now }
        : { finishedAt: null, progress: 0, cfi: null, lastReadAt: null },
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

// ---- shelves (categories) ----

export async function createShelf(name: string): Promise<ActionResult<Shelf>> {
  try {
    const { payload, user } = await requireActionSession()
    const { totalDocs } = await payload.count({ collection: 'book-shelves', user, overrideAccess: false })
    if (totalDocs >= 100) throw new Error('分類最多 100 個')
    const shelf = await payload.create({
      collection: 'book-shelves',
      data: { name: cleanShelfName(name), position: totalDocs },
      user,
      overrideAccess: false,
      depth: 0,
    })
    revalidatePath('/books')
    return { ok: true, data: { id: shelf.id, name: shelf.name } }
  } catch (error) {
    return fail(error)
  }
}

export async function renameShelf(id: number, name: string): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    await payload.update({ collection: 'book-shelves', id: cleanId(id), data: { name: cleanShelfName(name) }, user, overrideAccess: false, depth: 0 })
    revalidatePath('/books')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

/** Removes the category only; its books stay in the library. */
export async function deleteShelf(id: number): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    const shelfId = cleanId(id)
    const { docs } = await payload.find({
      collection: 'books',
      where: { shelves: { in: [shelfId] } },
      user,
      overrideAccess: false,
      pagination: false,
      depth: 0,
      select: { shelves: true },
    })
    for (const book of docs) {
      const rest = (book.shelves ?? []).map((s) => (typeof s === 'number' ? s : s.id)).filter((s) => s !== shelfId)
      await payload.update({ collection: 'books', id: book.id, data: { shelves: rest }, user, overrideAccess: false, depth: 0 })
    }
    await payload.delete({ collection: 'book-shelves', id: shelfId, user, overrideAccess: false, depth: 0 })
    revalidatePath('/books')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

export async function reorderShelves(ids: number[]): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    const clean = cleanIds(ids, 100)
    for (const [position, id] of clean.entries()) {
      await payload.update({ collection: 'book-shelves', id, data: { position }, user, overrideAccess: false, depth: 0 })
    }
    revalidatePath('/books')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

/** The categories of one book, replaced as a whole. */
export async function setBookShelves(id: number, shelfIds: number[]): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    await payload.update({
      collection: 'books',
      id: cleanId(id),
      data: { shelves: cleanIds(shelfIds, MAX_SHELVES_PER_BOOK) },
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

/** Puts several books on a shelf (add) or takes them off it (remove). */
export async function moveBooksShelf(ids: number[], shelfId: number, mode: 'add' | 'remove'): Promise<ActionResult> {
  try {
    const session = await requireActionSession()
    const { payload, user } = session
    const shelf = cleanId(shelfId)
    for (const id of cleanIds(ids, MAX_BATCH)) {
      const current = await shelvesOfBook(session, id)
      const next = mode === 'add' ? [...new Set([...current, shelf])] : current.filter((s) => s !== shelf)
      if (next.length === current.length && next.every((s, i) => s === current[i])) continue
      if (next.length > MAX_SHELVES_PER_BOOK) throw new Error(`一本書最多 ${MAX_SHELVES_PER_BOOK} 個分類`)
      await payload.update({ collection: 'books', id, data: { shelves: next }, user, overrideAccess: false, depth: 0 })
    }
    revalidatePath('/books')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}
