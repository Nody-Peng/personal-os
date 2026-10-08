'use server'

import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { revalidatePath } from 'next/cache'
import { clampInt, cleanBlocks, cleanText, fail, type ActionResult } from '@/lib/actionUtils'
import { blocksToText, countWords, isBlankDocument } from '@/lib/blocks'
import { isDay } from '@/lib/day'
import {
  MAX_ICON_LENGTH,
  MAX_NOTEBOOK_TITLE,
  MAX_PAGE_TITLE,
  TRASH_DAYS,
  UNTITLED,
  applyItemMove,
  applyMove,
  childrenOf,
  columnOf,
  parentCandidates,
  toBoardItem,
  type BoardItem,
  subtreeIds,
  toPageNode,
  type NotebookItem,
  type PageNode,
} from '@/lib/notes'
import { toNotebookItem } from '@/lib/notebookQueries'
import { cleanNoteIcon } from '@/lib/noteIcons'
import {
  COVER_COLORS,
  COVER_PATTERNS,
  ITEM_STATUSES,
  PAGE_FONTS,
  TEMPLATE_KINDS,
  type CoverColor,
  type CoverPattern,
  type ItemStatus,
  type PageFont,
  type TemplateKind,
} from '@/lib/options'
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

/** One emoji (or a couple of characters), or a coloured `ph:` icon. */
const cleanIcon = (value: unknown) => cleanNoteIcon(value).slice(0, MAX_ICON_LENGTH)

/** Every page of a notebook as tree nodes, optionally including the trash. */
async function treeOf({ payload, user }: Session, notebookId: number, withTrash = false) {
  const { docs } = await payload.find({
    collection: 'note-pages',
    where: { notebook: { equals: notebookId } },
    select: { title: true, icon: true, parent: true, position: true, kind: true, favorite: true, deletedAt: true },
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

/** Sub-page and board blocks inside copied content point at the copies. */
function remapContent(value: unknown, copies: Map<number, number>): unknown {
  if (Array.isArray(value)) return value.map((v) => remapContent(v, copies))
  if (!value || typeof value !== 'object') return value
  const block = value as { type?: unknown; props?: Record<string, unknown>; children?: unknown }
  let props = block.props
  if (props && block.type === 'pageLink' && props.mode === 'child' && copies.has(Number(props.pageId))) {
    props = { ...props, pageId: copies.get(Number(props.pageId)) }
  }
  if (props && block.type === 'board' && copies.has(Number(props.boardId))) {
    props = { ...props, boardId: copies.get(Number(props.boardId)) }
  }
  return { ...block, props, children: remapContent(block.children, copies) }
}

/**
 * Notion's Duplicate: a page and everything under it (sub-pages, boards and
 * their cards), placed right after the original. Returns the copy first,
 * then the new tree nodes (cards excluded, as in the sidebar).
 */
export async function duplicatePage(id: number): Promise<ActionResult<{ id: number; nodes: PageNode[] }>> {
  try {
    const session = await requireActionSession()
    const { payload, user } = session
    const pageId = asId(id)
    const original = await payload.findByID({ collection: 'note-pages', id: pageId, depth: 0, user, overrideAccess: false })
    const notebook = idOf(original.notebook)!
    const tree = (await treeOf(session, notebook)).map(toPageNode)
    const ids = subtreeIds(tree, pageId)
    const { docs } = await payload.find({
      collection: 'note-pages',
      where: { id: { in: ids } },
      depth: 0,
      pagination: false,
      user,
      overrideAccess: false,
    })
    // Parents before children.
    const depthOf = (pid: number): number => (pid === pageId ? 0 : 1 + depthOf(idOf(docs.find((d) => d.id === pid)?.parent) ?? pageId))
    docs.sort((a, b) => depthOf(a.id) - depthOf(b.id))

    const transactionID = await payload.db.beginTransaction()
    const req = transactionID ? { transactionID } : undefined
    const copies = new Map<number, number>()
    try {
      // Make room right after the original.
      const parent = idOf(original.parent)
      for (const sibling of tree.filter((p) => p.parent === parent && p.position > (original.position ?? 0))) {
        await payload.update({ collection: 'note-pages', id: sibling.id, data: { position: sibling.position + 1 }, user, overrideAccess: false, req })
      }
      for (const doc of docs) {
        const isRoot = doc.id === pageId
        const created = await payload.create({
          collection: 'note-pages',
          data: {
            notebook,
            parent: isRoot ? parent : copies.get(idOf(doc.parent)!),
            title: isRoot ? `${doc.title || UNTITLED}（副本）`.slice(0, MAX_PAGE_TITLE) : doc.title,
            icon: doc.icon,
            kind: doc.kind,
            status: doc.status,
            startDate: doc.startDate,
            endDate: doc.endDate,
            parentItem: copies.get(idOf(doc.parentItem) ?? -1) ?? idOf(doc.parentItem),
            cover: doc.cover,
            coverPosition: doc.coverPosition,
            font: doc.font,
            smallText: doc.smallText,
            fullWidth: doc.fullWidth,
            position: isRoot ? (original.position ?? 0) + 1 : doc.position,
            editedAt: new Date().toISOString(),
          },
          user,
          overrideAccess: false,
          req,
        })
        copies.set(doc.id, created.id)
      }
      for (const doc of docs) {
        if (!Array.isArray(doc.content)) continue
        await payload.update({
          collection: 'note-pages',
          id: copies.get(doc.id)!,
          data: { content: remapContent(doc.content, copies) as unknown[] },
          user,
          overrideAccess: false,
          req,
        })
      }
      if (transactionID) await payload.db.commitTransaction(transactionID)
    } catch (error) {
      if (transactionID) await payload.db.rollbackTransaction(transactionID)
      throw error
    }

    const fresh = (await treeOf(session, notebook)).map(toPageNode)
    const created = new Set(copies.values())
    refreshShelf()
    return { ok: true, data: { id: copies.get(pageId)!, nodes: fresh.filter((p) => created.has(p.id) && p.kind !== 'item') } }
  } catch (error) {
    return fail(error)
  }
}

export type PagePatch = Partial<{
  title: string
  icon: string
  content: unknown[] | null
  cover: string
  coverPosition: number
  font: PageFont
  smallText: boolean
  fullWidth: boolean
  locked: boolean
  favorite: boolean
  /** null = not a template. */
  templateFor: TemplateKind | null
}>

const PAGE_FONT_VALUES = new Set<string>(PAGE_FONTS.map((f) => f.value))
const TEMPLATE_KIND_VALUES = new Set<string>(TEMPLATE_KINDS.map((k) => k.value))

// Version history (PageSnapshots): saving a page keeps the content it replaces
// when the page's newest snapshot is older than this, and this many per page.
const SNAPSHOT_EVERY = 10 * 60_000
const SNAPSHOTS_KEPT = 50

/** Keeps the page's current title and content as a snapshot (`force`: whatever the newest one's age). */
async function keepSnapshot({ payload, user }: Session, pageId: number, force = false) {
  const newest = await payload.find({
    collection: 'page-snapshots',
    where: { page: { equals: pageId } },
    sort: '-createdAt',
    limit: SNAPSHOTS_KEPT + 20,
    depth: 0,
    select: { createdAt: true },
    user,
    overrideAccess: false,
  })
  if (!force && newest.docs[0] && Date.now() - Date.parse(newest.docs[0].createdAt) < SNAPSHOT_EVERY) return
  const page = await payload.findByID({ collection: 'note-pages', id: pageId, depth: 0, select: { title: true, content: true }, user, overrideAccess: false })
  if (isBlankDocument(page.content)) return
  await payload.create({ collection: 'page-snapshots', data: { page: pageId, title: page.title ?? '', content: page.content }, user, overrideAccess: false })
  const surplus = newest.docs.slice(SNAPSHOTS_KEPT - 1).map((s) => s.id)
  if (surplus.length) {
    await payload.delete({ collection: 'page-snapshots', where: { id: { in: surplus } }, user, overrideAccess: false })
  }
}

/** Covers are our own uploads only (served, with the login check, by Payload). */
function cleanCover(value: unknown): string {
  const url = String(value ?? '').trim()
  if (!url) return ''
  if (url.length > 300 || !url.startsWith('/api/media/file/') || url.includes('..')) throw new Error('封面圖片網址錯誤')
  return url
}

export async function updatePage(id: number, patch: PagePatch): Promise<ActionResult> {
  try {
    const session = await requireActionSession()
    const { payload, user } = session
    const data: Omit<PagePatch, 'font'> & { font?: PageFont; editedAt?: string } = {}
    if ('title' in patch) data.title = cleanPageTitle(patch.title)
    if ('icon' in patch) data.icon = cleanIcon(patch.icon)
    if ('content' in patch) data.content = cleanBlocks(patch.content)
    if ('cover' in patch) data.cover = cleanCover(patch.cover)
    if ('coverPosition' in patch) data.coverPosition = clampInt(patch.coverPosition, 0, 100)
    if ('font' in patch) {
      if (!PAGE_FONT_VALUES.has(String(patch.font))) throw new Error('字型錯誤')
      data.font = patch.font
    }
    for (const key of ['smallText', 'fullWidth', 'locked', 'favorite'] as const) {
      if (key in patch) data[key] = patch[key] === true
    }
    if ('templateFor' in patch) {
      if (patch.templateFor != null && !TEMPLATE_KIND_VALUES.has(String(patch.templateFor))) throw new Error('範本類型錯誤')
      data.templateFor = patch.templateFor ?? null
    }
    if (!Object.keys(data).length) return { ok: true }
    if ('title' in data || 'content' in data) data.editedAt = new Date().toISOString()
    if ('content' in data) await keepSnapshot(session, asId(id))
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
    // Cards move between board columns (moveItem); a page can't live inside a
    // card, where the sidebar would never show it.
    if (page.kind === 'item') throw new Error('看板卡片請在看板裡移動')
    const before = (await treeOf(session, idOf(page.notebook)!)).map(toPageNode)
    const target = optionalId(parentId)
    if (target != null && before.find((p) => p.id === target)?.kind === 'item') throw new Error('不能把頁面放進看板卡片裡')
    const after = applyMove(before, pageId, target, Number(index))
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

    // If its parent is still in the trash, bring it back at the top level. A
    // card whose board is gone comes back as an ordinary page, or nothing
    // would ever show it.
    const parent = all.find((p) => p.id === idOf(page.parent))
    const parentGone = !parent || Boolean(parent.deletedAt)
    const live = all.filter((p) => !p.deletedAt).map(toPageNode)
    const newParent = parentGone ? null : parent.id
    const siblings = childrenOf(live, newParent).filter((p) => p.kind !== 'item')
    const orphanCard = page.kind === 'item' && parentGone

    await payload.update({
      collection: 'note-pages',
      where: { id: { in: ids } },
      data: { deletedAt: null },
      trash: true,
      user,
      overrideAccess: false,
    })
    const position = siblings.length ? siblings[siblings.length - 1].position + 1 : 0
    if (page.kind !== 'item' || orphanCard) {
      await payload.update({
        collection: 'note-pages',
        id: pageId,
        data: { parent: newParent, position, ...(orphanCard ? { kind: 'page' as const, parentItem: null } : {}) },
        user,
        overrideAccess: false,
      })
    }

    // Cards are reached through their board, never the sidebar tree.
    const restored = await treeOf(session, idOf(page.notebook)!)
    refreshShelf()
    return { ok: true, data: restored.filter((p) => batch.has(p.id) && p.kind !== 'item').map(toPageNode) }
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

// -------------------------------------------------------------- page links
// (Searching notebooks and the journal lives in search-actions.ts.)

const MAX_QUERY = 100

export type PageLinkInfo = { id: number; title: string; icon: string; kind: string; notebookId: number; notebookTitle: string }

/** Titles for "link to page" blocks, across notebooks. Missing ids are trashed or gone. */
export async function getPageLinks(ids: number[]): Promise<ActionResult<PageLinkInfo[]>> {
  try {
    const { payload, user } = await requireActionSession()
    const wanted = [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 200)
    if (!wanted.length) return { ok: true, data: [] }
    const [pages, notebooks] = await Promise.all([
      payload.find({
        collection: 'note-pages',
        where: { id: { in: wanted } },
        select: { title: true, icon: true, kind: true, notebook: true },
        depth: 0,
        pagination: false,
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
        title: p.title ?? '',
        icon: p.icon ?? '',
        kind: p.kind ?? 'page',
        notebookId: idOf(p.notebook)!,
        notebookTitle: titles.get(idOf(p.notebook)!) ?? '',
      })),
    }
  } catch (error) {
    return fail(error)
  }
}

/** Pages whose title matches, across notebooks (recently edited first; all recent ones for an empty query). */
export async function findPages(query: string): Promise<ActionResult<PageLinkInfo[]>> {
  try {
    const { payload, user } = await requireActionSession()
    const q = cleanText(query, MAX_QUERY).trim()
    const [pages, notebooks] = await Promise.all([
      payload.find({
        collection: 'note-pages',
        where: q ? { title: { contains: q } } : undefined,
        select: { title: true, icon: true, kind: true, notebook: true },
        sort: ['-updatedAt', '-id'],
        limit: 12,
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
        title: p.title ?? '',
        icon: p.icon ?? '',
        kind: p.kind ?? 'page',
        notebookId: idOf(p.notebook)!,
        notebookTitle: titles.get(idOf(p.notebook)!) ?? '',
      })),
    }
  } catch (error) {
    return fail(error)
  }
}

// ------------------------------------------------------------------- boards

const ITEM_SELECT = {
  title: true,
  icon: true,
  status: true,
  position: true,
  startDate: true,
  endDate: true,
  parentItem: true,
} as const

function cleanStatus(value: unknown): ItemStatus {
  const found = ITEM_STATUSES.find((s) => s.value === value)
  if (!found) throw new Error('狀態錯誤')
  return found.value
}

const optionalDay = (value: unknown): string | null => {
  if (value == null || value === '') return null
  if (!isDay(value)) throw new Error('日期格式錯誤')
  return value
}

async function boardItems({ payload, user }: Session, boardId: number): Promise<BoardItem[]> {
  const { docs } = await payload.find({
    collection: 'note-pages',
    where: { and: [{ parent: { equals: boardId } }, { kind: { equals: 'item' } }] },
    select: ITEM_SELECT,
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })
  return docs.map(toBoardItem)
}

async function boardOf({ payload, user }: Session, boardId: number) {
  const board = await payload.findByID({ collection: 'note-pages', id: boardId, depth: 0, user, overrideAccess: false })
  if (board.kind !== 'board') throw new Error('這不是看板')
  return board
}

/** A board inside `hostPageId` (a todo database, like Notion's). */
export async function createBoard(hostPageId: number): Promise<ActionResult<PageNode>> {
  try {
    const session = await requireActionSession()
    const { payload, user } = session
    const host = await payload.findByID({ collection: 'note-pages', id: asId(hostPageId), depth: 0, user, overrideAccess: false })
    const notebook = idOf(host.notebook)!
    const siblings = childrenOf((await treeOf(session, notebook)).map(toPageNode), host.id)
    const doc = await payload.create({
      collection: 'note-pages',
      data: {
        notebook,
        parent: host.id,
        kind: 'board',
        title: 'TODO List',
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

export type BoardData = { id: number; title: string; icon: string; notebookId: number; items: BoardItem[] }

export async function getBoard(boardId: number): Promise<ActionResult<BoardData>> {
  try {
    const session = await requireActionSession()
    const board = await boardOf(session, asId(boardId))
    return {
      ok: true,
      data: {
        id: board.id,
        title: board.title ?? '',
        icon: board.icon ?? '',
        notebookId: idOf(board.notebook)!,
        items: await boardItems(session, board.id),
      },
    }
  } catch (error) {
    return fail(error)
  }
}

/** A new card at the bottom of a column. */
export async function createItem(boardId: number, status: ItemStatus, title = ''): Promise<ActionResult<BoardItem>> {
  try {
    const session = await requireActionSession()
    const { payload, user } = session
    const board = await boardOf(session, asId(boardId))
    const column = cleanStatus(status)
    const items = columnOf(await boardItems(session, board.id), column)
    const doc = await payload.create({
      collection: 'note-pages',
      data: {
        notebook: idOf(board.notebook)!,
        parent: board.id,
        kind: 'item',
        status: column,
        title: cleanPageTitle(title),
        position: items.length ? items[items.length - 1].position + 1 : 0,
      },
      user,
      overrideAccess: false,
    })
    refreshShelf()
    return { ok: true, data: toBoardItem(doc) }
  } catch (error) {
    return fail(error)
  }
}

export type ItemPatch = Partial<{ status: ItemStatus; startDate: string | null; endDate: string | null; parentItem: number | null }>

/** Item properties (title, icon and content go through updatePage). */
export async function updateItem(id: number, patch: ItemPatch): Promise<ActionResult> {
  try {
    const session = await requireActionSession()
    const { payload, user } = session
    const item = await payload.findByID({ collection: 'note-pages', id: asId(id), depth: 0, user, overrideAccess: false })
    if (item.kind !== 'item') throw new Error('這不是看板項目')
    const data: ItemPatch = {}
    if ('status' in patch) data.status = cleanStatus(patch.status)
    if ('startDate' in patch) data.startDate = optionalDay(patch.startDate)
    if ('endDate' in patch) data.endDate = optionalDay(patch.endDate)
    if ('parentItem' in patch) {
      const target = optionalId(patch.parentItem)
      if (target != null) {
        const items = await boardItems(session, idOf(item.parent)!)
        if (!parentCandidates(items, item.id).some((i) => i.id === target)) throw new Error('上級項目必須是同一個看板裡的其他項目')
      }
      data.parentItem = target
    }
    // A date range needs both ends: fill the missing one with the other.
    const start = 'startDate' in data ? data.startDate : (item.startDate ?? null)
    const end = 'endDate' in data ? data.endDate : (item.endDate ?? null)
    if (start && !end) data.endDate = start
    if (end && !start) data.startDate = end
    if (start && end && start > end) throw new Error('開始日期不能晚於結束日期')
    await payload.update({ collection: 'note-pages', id: item.id, data, user, overrideAccess: false })
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

/** Drags a card into `status` at `index` within that column. */
export async function moveItem(id: number, status: ItemStatus, index: number): Promise<ActionResult> {
  try {
    const session = await requireActionSession()
    const { payload, user } = session
    const item = await payload.findByID({ collection: 'note-pages', id: asId(id), depth: 0, user, overrideAccess: false })
    if (item.kind !== 'item') throw new Error('這不是看板項目')
    const before = await boardItems(session, idOf(item.parent)!)
    const after = applyItemMove(before, item.id, cleanStatus(status), Number(index))
    const changed = after.filter((p, i) => p.status !== before[i].status || p.position !== before[i].position)
    for (const p of changed) {
      await payload.update({
        collection: 'note-pages',
        id: p.id,
        data: { status: p.status, position: p.position },
        user,
        overrideAccess: false,
      })
    }
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

export type PageDetail = {
  id: number
  notebookId: number
  kind: string
  title: string
  icon: string
  content: unknown[] | null
  boardId: number | null
}

/** Everything the side peek needs to edit a page. */
export async function getPageDetail(id: number): Promise<ActionResult<PageDetail>> {
  try {
    const { payload, user } = await requireActionSession()
    const page = await payload.findByID({ collection: 'note-pages', id: asId(id), depth: 0, user, overrideAccess: false })
    return {
      ok: true,
      data: {
        id: page.id,
        notebookId: idOf(page.notebook)!,
        kind: page.kind ?? 'page',
        title: page.title ?? '',
        icon: page.icon ?? '',
        content: Array.isArray(page.content) ? page.content : null,
        boardId: page.kind === 'item' ? idOf(page.parent) : null,
      },
    }
  } catch (error) {
    return fail(error)
  }
}

// ------------------------------------------------------------------ uploads

/** s3 = Supabase Storage (direct browser upload); local = ./media in development; off = not set up yet. */
export async function getUploadMode(): Promise<ActionResult<'s3' | 'local' | 'off'>> {
  try {
    await requireActionSession()
    return { ok: true, data: process.env.S3_BUCKET ? 's3' : process.env.VERCEL ? 'off' : 'local' }
  } catch (error) {
    return fail(error)
  }
}

export type TemplateInfo = { id: number; title: string; icon: string }

/** Pages marked as templates (a page's ••• → 用作範本) for this kind of note. */
export async function listTemplates(kind: TemplateKind): Promise<ActionResult<TemplateInfo[]>> {
  try {
    const { payload, user } = await requireActionSession()
    if (!TEMPLATE_KIND_VALUES.has(String(kind))) throw new Error('範本類型錯誤')
    const { docs } = await payload.find({
      collection: 'note-pages',
      where: { templateFor: { equals: kind } },
      select: { title: true, icon: true },
      sort: 'title',
      limit: 30,
      depth: 0,
      user,
      overrideAccess: false,
    })
    return { ok: true, data: docs.map((p) => ({ id: p.id, title: p.title ?? '', icon: p.icon ?? '' })) }
  } catch (error) {
    return fail(error)
  }
}

/** A template's content, to copy into an empty note. */
export async function getTemplateContent(id: number): Promise<ActionResult<unknown[]>> {
  try {
    const { payload, user } = await requireActionSession()
    const page = await payload.findByID({
      collection: 'note-pages',
      id: asId(id),
      depth: 0,
      select: { content: true, templateFor: true },
      user,
      overrideAccess: false,
    })
    if (!page.templateFor) throw new Error('這一頁已經不是範本了')
    return { ok: true, data: Array.isArray(page.content) ? page.content : [] }
  } catch (error) {
    return fail(error)
  }
}

export type BacklinkInfo = { id: number; notebookId: number; title: string; icon: string }

/** Pages that link to this one (a 連結到頁面 block anywhere in them, inside toggles and columns too). */
export async function getBacklinks(pageId: number): Promise<ActionResult<BacklinkInfo[]>> {
  try {
    const { payload } = await requireActionSession()
    const id = asId(pageId)
    // A JSON path query: Payload's own `where` can't look inside nested blocks.
    const { rows } = await (payload.db as unknown as PostgresAdapter).drizzle.execute(sql`
      SELECT "id", "notebook_id", "title", "icon" FROM "note_pages"
      WHERE "deleted_at" IS NULL AND "id" <> ${id}
        AND jsonb_path_exists(
          "content",
          '$.** ? (@.type == "pageLink" && @.props.mode == "link" && @.props.pageId == $id)',
          jsonb_build_object('id', ${id}::int)
        )
      ORDER BY "edited_at" DESC NULLS LAST
      LIMIT 50`)
    return {
      ok: true,
      data: rows.map((r) => ({ id: Number(r.id), notebookId: Number(r.notebook_id), title: String(r.title ?? ''), icon: String(r.icon ?? '') })),
    }
  } catch (error) {
    return fail(error)
  }
}

export type SnapshotItem = { id: number; createdAt: string; title: string; words: number; preview: string }

/** A page's earlier versions, newest first (••• → 版本紀錄). */
export async function listSnapshots(pageId: number): Promise<ActionResult<SnapshotItem[]>> {
  try {
    const { payload, user } = await requireActionSession()
    const { docs } = await payload.find({
      collection: 'page-snapshots',
      where: { page: { equals: asId(pageId) } },
      sort: '-createdAt',
      limit: SNAPSHOTS_KEPT,
      depth: 0,
      select: { title: true, content: true, createdAt: true },
      user,
      overrideAccess: false,
    })
    return {
      ok: true,
      data: docs.map((s) => {
        const text = blocksToText(s.content)
        return { id: s.id, createdAt: s.createdAt, title: s.title ?? '', words: countWords(text).words, preview: text.slice(0, 240) }
      }),
    }
  } catch (error) {
    return fail(error)
  }
}

export async function getSnapshot(id: number): Promise<ActionResult<{ title: string; content: unknown[] }>> {
  try {
    const { payload, user } = await requireActionSession()
    const s = await payload.findByID({ collection: 'page-snapshots', id: asId(id), depth: 0, select: { title: true, content: true }, user, overrideAccess: false })
    return { ok: true, data: { title: s.title ?? '', content: Array.isArray(s.content) ? s.content : [] } }
  } catch (error) {
    return fail(error)
  }
}

/** Keeps the page as it is now before a restore replaces it, so the restore can be undone too. */
export async function snapshotPage(pageId: number): Promise<ActionResult> {
  try {
    await keepSnapshot(await requireActionSession(), asId(pageId), true)
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}
