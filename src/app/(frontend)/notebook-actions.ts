'use server'

import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { revalidatePath } from 'next/cache'
import { clampInt, cleanText, fail, type ActionResult } from '@/lib/actionUtils'
import { blocksToText, countWords } from '@/lib/blocks'
import {
  MAX_NOTEBOOK_TITLE,
  MAX_PAGE_TITLE,
  TRASH_DAYS,
  UNTITLED,
  applyItemMove,
  childrenOf,
  toBoardItem,
  type BoardItem,
  subtreeIds,
  toPageNode,
  type NotebookItem,
  type PageNode,
} from '@/lib/notes'
import {
  asId,
  boardItems,
  boardOf,
  cleanIcon,
  cleanPageTitle,
  cleanStatus,
  createBoardItem,
  createPageIn,
  idOf,
  keepSnapshot,
  movePageTo,
  patchBoardItem,
  SNAPSHOTS_KEPT,
  trashPageTree,
  treeOf,
  writePageContent,
  type ItemPatch,
} from '@/lib/notebookOps'
import { toNotebookItem } from '@/lib/notebookQueries'
import {
  COVER_COLORS,
  COVER_PATTERNS,
  PAGE_FONTS,
  TEMPLATE_KINDS,
  type CoverColor,
  type CoverPattern,
  type ItemStatus,
  type PageFont,
  type TemplateKind,
} from '@/lib/options'
import { requireActionSession } from '@/lib/session'

export type { ItemPatch }

// The shelf shows page counts; the notebook view keeps its own tree state.
const refreshShelf = () => revalidatePath('/journal')

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
    await payload.update({ collection: 'notebooks', id: asId(id), data, depth: 0, user, overrideAccess: false })
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
    const doc = await createPageIn(await requireActionSession(), notebookId, parentId)
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
            // Cards inside the copy are linked once every copy exists (below):
            // a sub-card can come before its 上級項目 here.
            parentItem: isRoot ? idOf(doc.parentItem) : null,
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
        const data: { content?: unknown[]; parentItem?: number } = {}
        if (Array.isArray(doc.content)) data.content = remapContent(doc.content, copies) as unknown[]
        const parentItem = doc.id === pageId ? undefined : copies.get(idOf(doc.parentItem) ?? -1)
        if (parentItem != null) data.parentItem = parentItem
        if (!Object.keys(data).length) continue
        await payload.update({
          collection: 'note-pages',
          id: copies.get(doc.id)!,
          data,
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
  /** With `content`: the revision the editor's text is based on (see writePageContent). */
  baseRev: number
}>

const PAGE_FONT_VALUES = new Set<string>(PAGE_FONTS.map((f) => f.value))
const TEMPLATE_KIND_VALUES = new Set<string>(TEMPLATE_KINDS.map((k) => k.value))

export type PageSave = {
  /** Server clock: lets noteCache tell a page render made before this save from a newer one. */
  savedAt?: number
  /** The content revision now on the server. */
  rev?: number
  /** The content changed elsewhere since `baseRev`: nothing was saved; this is what is there. */
  conflict?: { rev: number; content: unknown[] | null }
}

/** Covers are our own uploads only (served, with the login check, by Payload). */
function cleanCover(value: unknown): string {
  const url = String(value ?? '').trim()
  if (!url) return ''
  if (url.length > 300 || !url.startsWith('/api/media/file/') || url.includes('..')) throw new Error('封面圖片網址錯誤')
  return url
}

export async function updatePage(id: number, patch: PagePatch): Promise<ActionResult<PageSave>> {
  try {
    const session = await requireActionSession()
    const { payload, user } = session
    let saved: PageSave = {}
    if ('content' in patch) {
      const baseRev = patch.baseRev == null ? undefined : clampInt(patch.baseRev, 0, Number.MAX_SAFE_INTEGER)
      const result = await writePageContent(session, id, patch.content, { baseRev })
      if (!result.ok) return { ok: true, data: { conflict: { rev: result.rev, content: result.content } } }
      saved = { savedAt: result.savedAt, rev: result.rev }
    }
    const data: Omit<PagePatch, 'font' | 'content' | 'baseRev'> & { font?: PageFont; editedAt?: string } = {}
    if ('title' in patch) data.title = cleanPageTitle(patch.title)
    if ('icon' in patch) data.icon = cleanIcon(patch.icon)
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
    if (!Object.keys(data).length) return { ok: true, data: saved }
    if ('title' in data) data.editedAt = new Date().toISOString()
    await payload.update({ collection: 'note-pages', id: asId(id), data, user, overrideAccess: false })
    return { ok: true, data: { savedAt: Date.now(), ...saved } }
  } catch (error) {
    return fail(error)
  }
}

/**
 * An open page asks, now and then, whether its content changed elsewhere
 * (another tab, Claude). Same revision: just `rev`; newer: the content too.
 */
export async function syncPage(id: number, knownRev: number): Promise<ActionResult<{ rev: number; content?: unknown[] | null }>> {
  try {
    const { payload, user } = await requireActionSession()
    const page = await payload.findByID({ collection: 'note-pages', id: asId(id), depth: 0, select: { contentRev: true }, user, overrideAccess: false })
    const rev = Number(page.contentRev) || 0
    if (rev === Number(knownRev)) return { ok: true, data: { rev } }
    const full = await payload.findByID({ collection: 'note-pages', id: page.id, depth: 0, select: { content: true, contentRev: true }, user, overrideAccess: false })
    return { ok: true, data: { rev: Number(full.contentRev) || 0, content: Array.isArray(full.content) ? full.content : null } }
  } catch (error) {
    return fail(error)
  }
}

/** Moves a page under `parentId` (null = top level) at `index` among its new siblings. */
export async function movePage(id: number, parentId: number | null, index: number): Promise<ActionResult> {
  try {
    await movePageTo(await requireActionSession(), id, parentId, index)
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

/** Moves a page and everything under it to the trash; returns the ids trashed. */
export async function trashPage(id: number): Promise<ActionResult<number[]>> {
  try {
    const ids = await trashPageTree(await requireActionSession(), id)
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
        childCount: trashBatch(trashed, p.id, p.deletedAt!).length - 1,
      }))
      .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
    return { ok: true, data: items }
  } catch (error) {
    return fail(error)
  }
}

type TrashedNode = Parameters<typeof toPageNode>[0] & { id: number; deletedAt?: string | null }

/**
 * A trashed page and what was trashed together with it (one shared
 * `deletedAt`). Pages under it that were trashed earlier on their own are
 * separate entries in the trash and are left alone.
 */
function trashBatch(all: TrashedNode[], pageId: number, deletedAt: string): number[] {
  const stamp = Date.parse(deletedAt)
  const byId = new Map(all.map((p) => [p.id, p]))
  return subtreeIds(all.map(toPageNode), pageId).filter((pid) => {
    const d = byId.get(pid)?.deletedAt
    return d != null && Date.parse(d) === stamp
  })
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
    const batch = new Set(trashBatch(all, pageId, page.deletedAt))
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

/** Permanently deletes a trashed page and what was trashed together with it. */
export async function deletePageForever(id: number): Promise<ActionResult> {
  try {
    const session = await requireActionSession()
    const { payload, user } = session
    const pageId = asId(id)
    const page = await payload.findByID({ collection: 'note-pages', id: pageId, depth: 0, trash: true, user, overrideAccess: false })
    if (!page.deletedAt) throw new Error('只能永久刪除垃圾桶裡的頁面')
    // Pages under it trashed separately stay in the trash (their parent link
    // is cleared by the foreign key, so they restore at the top level).
    const all = await treeOf(session, idOf(page.notebook)!, true)
    await payload.delete({
      collection: 'note-pages',
      where: { id: { in: trashBatch(all, pageId, page.deletedAt) } },
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

/** A board inside `hostPageId` (a todo database, like Notion's). */
export async function createBoard(hostPageId: number): Promise<ActionResult<PageNode>> {
  try {
    const session = await requireActionSession()
    const { payload, user } = session
    const host = await payload.findByID({ collection: 'note-pages', id: asId(hostPageId), depth: 0, user, overrideAccess: false })
    if (host.kind === 'item') throw new Error('看板卡片裡不能再放看板')
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
    const doc = await createBoardItem(await requireActionSession(), boardId, status, title)
    refreshShelf()
    return { ok: true, data: toBoardItem(doc) }
  } catch (error) {
    return fail(error)
  }
}

/** Item properties (title, icon and content go through updatePage). */
export async function updateItem(id: number, patch: ItemPatch): Promise<ActionResult> {
  try {
    await patchBoardItem(await requireActionSession(), id, patch)
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
  contentRev: number
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
        contentRev: Number(page.contentRev) || 0,
        boardId: page.kind === 'item' ? idOf(page.parent) : null,
      },
    }
  } catch (error) {
    return fail(error)
  }
}

/** Remembers the page opened last in its notebook: opening the notebook goes back there. */
export async function rememberOpenedPage(pageId: number): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    const page = await payload.findByID({
      collection: 'note-pages',
      id: asId(pageId),
      depth: 0,
      select: { notebook: true },
      user,
      overrideAccess: false,
    })
    const notebook = idOf(page.notebook)
    if (notebook != null) {
      await payload.update({ collection: 'notebooks', id: notebook, data: { lastPage: page.id }, depth: 0, user, overrideAccess: false })
    }
    return { ok: true }
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
