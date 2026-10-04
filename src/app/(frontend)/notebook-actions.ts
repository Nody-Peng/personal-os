'use server'

import { revalidatePath } from 'next/cache'
import type { Where } from 'payload'
import { cleanBlocks, cleanText, fail, type ActionResult } from '@/lib/actionUtils'
import {
  MAX_ICON_LENGTH,
  MAX_NOTEBOOK_TITLE,
  MAX_PAGE_TITLE,
  TRASH_DAYS,
  applyMove,
  childrenOf,
  snippetAround,
  subtreeIds,
  toPageNode,
  type NotebookItem,
  type PageNode,
} from '@/lib/notes'
import { toNotebookItem } from '@/lib/notebookQueries'
import { COVER_COLORS, COVER_PATTERNS, type CoverColor, type CoverPattern } from '@/lib/options'
import { requireActionSession, type Session } from '@/lib/session'

// The shelf shows page counts; the notebook view keeps its own tree state.
const refreshShelf = () => revalidatePath('/journal')

const idOf = (value: unknown): number | null =>
  value == null ? null : typeof value === 'number' ? value : (value as { id: number }).id

const asId = (value: unknown): number => {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw new Error('找不到這個項目')
  return n
}

const optionalId = (value: unknown): number | null => (value == null ? null : asId(value))

function cleanColor(value: unknown): CoverColor {
  const found = COVER_COLORS.find((c) => c.value === value)
  if (!found) throw new Error('封面顏色錯誤')
  return found.value
}

function cleanPattern(value: unknown): CoverPattern {
  const found = COVER_PATTERNS.find((p) => p.value === value)
  if (!found) throw new Error('花紋錯誤')
  return found.value
}

function cleanNotebookTitle(value: unknown): string {
  const title = cleanText(value, MAX_NOTEBOOK_TITLE).trim()
  if (!title) throw new Error('請輸入筆記本名稱')
  return title
}

/** Single-line titles; emptiness is fine (shown as 未命名). */
const cleanPageTitle = (value: unknown) => cleanText(value, MAX_PAGE_TITLE).replace(/\s+/g, ' ').trim()

/** One emoji or a couple of characters. */
const cleanIcon = (value: unknown) => Array.from(String(value ?? '').trim()).slice(0, 8).join('').slice(0, MAX_ICON_LENGTH)

/** Every page of a notebook as tree nodes, optionally including the trash. */
async function treeOf({ payload, user }: Session, notebookId: number, withTrash = false) {
  const { docs } = await payload.find({
    collection: 'note-pages',
    where: { notebook: { equals: notebookId } },
    select: { title: true, icon: true, parent: true, position: true, deletedAt: true },
    depth: 0,
    pagination: false,
    trash: withTrash,
    user,
    overrideAccess: false,
  })
  return docs
}

// ----------------------------------------------------------------- notebooks

export async function createNotebook(input: {
  title: string
  coverColor: string
  pattern: string
}): Promise<ActionResult<{ notebook: NotebookItem; pageId: number }>> {
  try {
    const session = await requireActionSession()
    const { payload, user } = session
    const { totalDocs } = await payload.count({ collection: 'notebooks', user, overrideAccess: false })
    const notebook = await payload.create({
      collection: 'notebooks',
      data: {
        title: cleanNotebookTitle(input.title),
        coverColor: cleanColor(input.coverColor),
        pattern: cleanPattern(input.pattern),
        position: totalDocs,
        archived: false,
      },
      user,
      overrideAccess: false,
    })
    // A new notebook opens on a blank first page, like a new Notion workspace.
    const page = await payload.create({
      collection: 'note-pages',
      data: { notebook: notebook.id, title: '', position: 0 },
      user,
      overrideAccess: false,
    })
    refreshShelf()
    return { ok: true, data: { notebook: toNotebookItem(notebook, 1), pageId: page.id } }
  } catch (error) {
    return fail(error)
  }
}

export type NotebookPatch = Partial<{ title: string; coverColor: string; pattern: string; archived: boolean }>

export async function updateNotebook(id: number, patch: NotebookPatch): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    const data: { title?: string; coverColor?: CoverColor; pattern?: CoverPattern; archived?: boolean } = {}
    if ('title' in patch) data.title = cleanNotebookTitle(patch.title)
    if ('coverColor' in patch) data.coverColor = cleanColor(patch.coverColor)
    if ('pattern' in patch) data.pattern = cleanPattern(patch.pattern)
    if ('archived' in patch) data.archived = patch.archived === true
    await payload.update({ collection: 'notebooks', id: asId(id), data, user, overrideAccess: false })
    refreshShelf()
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

// --------------------------------------------------------------------- pages

/** A new empty page at the end of `parentId`'s children (or of the top level). */
export async function createPage(notebookId: number, parentId: number | null): Promise<ActionResult<PageNode>> {
  try {
    const session = await requireActionSession()
    const { payload, user } = session
    const notebook = asId(notebookId)
    const parent = optionalId(parentId)
    const pages = (await treeOf(session, notebook)).map(toPageNode)
    if (parent != null && !pages.some((p) => p.id === parent)) throw new Error('找不到上層頁面')
    const siblings = childrenOf(pages, parent)
    const doc = await payload.create({
      collection: 'note-pages',
      data: {
        notebook,
        parent,
        title: '',
        position: siblings.length ? siblings[siblings.length - 1].position + 1 : 0,
      },
      user,
      overrideAccess: false,
    })
    refreshShelf()
    return { ok: true, data: toPageNode(doc) }
  } catch (error) {
    return fail(error)
  }
}

export type PagePatch = Partial<{ title: string; icon: string; content: unknown[] | null }>

export async function updatePage(id: number, patch: PagePatch): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    const data: { title?: string; icon?: string; content?: unknown[] | null; editedAt?: string } = {}
    if ('title' in patch) data.title = cleanPageTitle(patch.title)
    if ('icon' in patch) data.icon = cleanIcon(patch.icon)
    if ('content' in patch) data.content = cleanBlocks(patch.content)
    if (!Object.keys(data).length) return { ok: true }
    if ('title' in data || 'content' in data) data.editedAt = new Date().toISOString()
    await payload.update({ collection: 'note-pages', id: asId(id), data, user, overrideAccess: false })
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

/** Moves a page under `parentId` (null = top level) at `index` among its new siblings. */
export async function movePage(id: number, parentId: number | null, index: number): Promise<ActionResult> {
  try {
    const session = await requireActionSession()
    const { payload, user } = session
    const pageId = asId(id)
    const page = await payload.findByID({ collection: 'note-pages', id: pageId, depth: 0, user, overrideAccess: false })
    const before = (await treeOf(session, idOf(page.notebook)!)).map(toPageNode)
    const after = applyMove(before, pageId, optionalId(parentId), Number(index))
    const changed = after.filter((p, i) => p.parent !== before[i].parent || p.position !== before[i].position)
    // The moved page first, so its new parent is checked before siblings shift.
    changed.sort((a, b) => Number(b.id === pageId) - Number(a.id === pageId))
    for (const p of changed) {
      await payload.update({
        collection: 'note-pages',
        id: p.id,
        data: { parent: p.parent, position: p.position },
        user,
        overrideAccess: false,
      })
    }
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

/** Moves a page and everything under it to the trash; returns the ids trashed. */
export async function trashPage(id: number): Promise<ActionResult<number[]>> {
  try {
    const session = await requireActionSession()
    const { payload, user } = session
    const pageId = asId(id)
    const page = await payload.findByID({ collection: 'note-pages', id: pageId, depth: 0, user, overrideAccess: false })
    const ids = subtreeIds((await treeOf(session, idOf(page.notebook)!)).map(toPageNode), pageId)
    // One shared timestamp marks what was trashed together, so it restores together.
    await payload.update({
      collection: 'note-pages',
      where: { id: { in: ids } },
      data: { deletedAt: new Date().toISOString() },
      user,
      overrideAccess: false,
    })
    refreshShelf()
    return { ok: true, data: ids }
  } catch (error) {
    return fail(error)
  }
}

export type TrashItem = { id: number; title: string; icon: string; deletedAt: string; childCount: number }

/** Pages trashed on their own (not along with a trashed parent), newest first. */
export async function listTrash(notebookId: number): Promise<ActionResult<TrashItem[]>> {
  try {
    const session = await requireActionSession()
    const { payload, user } = session
    const notebook = asId(notebookId)
    const cutoff = new Date(Date.now() - TRASH_DAYS * 86_400_000).toISOString()
    await payload.delete({
      collection: 'note-pages',
      where: { and: [{ notebook: { equals: notebook } }, { deletedAt: { less_than: cutoff } }] },
      trash: true,
      user,
      overrideAccess: false,
    })

    const all = await treeOf(session, notebook, true)
    const byId = new Map(all.map((p) => [p.id, p]))
    const trashed = all.filter((p) => p.deletedAt)
    const sameBatch = (a?: string | null, b?: string | null) => Boolean(a && b && Date.parse(a) === Date.parse(b))
    const items = trashed
      .filter((p) => !sameBatch(byId.get(idOf(p.parent) ?? -1)?.deletedAt, p.deletedAt))
      .map((p) => ({
        id: p.id,
        title: p.title ?? '',
        icon: p.icon ?? '',
        deletedAt: p.deletedAt!,
        childCount: subtreeIds(trashed.map(toPageNode), p.id).length - 1,
      }))
      .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
    return { ok: true, data: items }
  } catch (error) {
    return fail(error)
  }
}

/** Restores a trashed page with whatever was trashed along with it. */
export async function restorePage(id: number): Promise<ActionResult<PageNode[]>> {
  try {
    const session = await requireActionSession()
    const { payload, user } = session
    const pageId = asId(id)
    const page = await payload.findByID({ collection: 'note-pages', id: pageId, depth: 0, trash: true, user, overrideAccess: false })
    if (!page.deletedAt) throw new Error('這一頁不在垃圾桶裡')
    const all = await treeOf(session, idOf(page.notebook)!, true)
    const stamp = Date.parse(page.deletedAt)
    const batch = new Set(
      subtreeIds(all.map(toPageNode), pageId).filter((pid) => {
        const deletedAt = all.find((p) => p.id === pid)?.deletedAt
        return deletedAt && Date.parse(deletedAt) === stamp
      }),
    )
    const ids = [...batch]

    // If its parent is still in the trash, bring it back at the top level.
    const parent = all.find((p) => p.id === idOf(page.parent))
    const parentGone = !parent || Boolean(parent.deletedAt)
    const live = all.filter((p) => !p.deletedAt).map(toPageNode)
    const newParent = parentGone ? null : parent.id
    const siblings = childrenOf(live, newParent)

    await payload.update({
      collection: 'note-pages',
      where: { id: { in: ids } },
      data: { deletedAt: null },
      trash: true,
      user,
      overrideAccess: false,
    })
    await payload.update({
      collection: 'note-pages',
      id: pageId,
      data: { parent: newParent, position: siblings.length ? siblings[siblings.length - 1].position + 1 : 0 },
      user,
      overrideAccess: false,
    })

    const restored = await treeOf(session, idOf(page.notebook)!)
    refreshShelf()
    return { ok: true, data: restored.filter((p) => batch.has(p.id)).map(toPageNode) }
  } catch (error) {
    return fail(error)
  }
}

/** Permanently deletes a trashed page and the trashed pages under it. */
export async function deletePageForever(id: number): Promise<ActionResult> {
  try {
    const session = await requireActionSession()
    const { payload, user } = session
    const pageId = asId(id)
    const page = await payload.findByID({ collection: 'note-pages', id: pageId, depth: 0, trash: true, user, overrideAccess: false })
    if (!page.deletedAt) throw new Error('只能永久刪除垃圾桶裡的頁面')
    const trashed = (await treeOf(session, idOf(page.notebook)!, true)).filter((p) => p.deletedAt).map(toPageNode)
    await payload.delete({
      collection: 'note-pages',
      where: { id: { in: subtreeIds(trashed, pageId) } },
      trash: true,
      user,
      overrideAccess: false,
    })
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

// -------------------------------------------------------------------- search

export type SearchHit = {
  id: number
  notebookId: number
  notebookTitle: string
  title: string
  icon: string
  snippet: string
}

const MAX_QUERY = 100

/** Every word must appear in the title or the text, across all notebooks. */
export async function searchNotes(query: string): Promise<ActionResult<SearchHit[]>> {
  try {
    const { payload, user } = await requireActionSession()
    const q = cleanText(query, MAX_QUERY).trim()
    const words = q.split(/\s+/).filter(Boolean).slice(0, 5)
    if (!words.length) return { ok: true, data: [] }

    const where: Where = {
      and: words.map((w): Where => ({ or: [{ title: { contains: w } }, { plainText: { contains: w } }] })),
    }
    const [pages, notebooks] = await Promise.all([
      payload.find({
        collection: 'note-pages',
        where,
        select: { title: true, icon: true, notebook: true, plainText: true },
        sort: ['-updatedAt', '-id'],
        limit: 30,
        depth: 0,
        user,
        overrideAccess: false,
      }),
      payload.find({ collection: 'notebooks', select: { title: true }, pagination: false, user, overrideAccess: false }),
    ])
    const titles = new Map(notebooks.docs.map((n) => [n.id, n.title]))
    return {
      ok: true,
      data: pages.docs.map((p) => ({
        id: p.id,
        notebookId: idOf(p.notebook)!,
        notebookTitle: titles.get(idOf(p.notebook)!) ?? '',
        title: p.title ?? '',
        icon: p.icon ?? '',
        snippet: snippetAround(p.plainText ?? '', q),
      })),
    }
  } catch (error) {
    return fail(error)
  }
}
