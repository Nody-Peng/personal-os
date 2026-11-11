import 'server-only'
import { cleanBlocks, cleanText } from './actionUtils'
import { isBlankDocument } from './blocks'
import { isDay } from './day'
import {
  MAX_ICON_LENGTH,
  MAX_PAGE_TITLE,
  childrenOf,
  columnOf,
  parentCandidates,
  subtreeIds,
  toBoardItem,
  toPageNode,
  applyMove,
  type BoardItem,
} from './notes'
import { cleanNoteIcon } from './noteIcons'
import { ITEM_STATUSES, type ItemStatus } from './options'
import type { Session } from './session'

// Notebook operations shared by the server actions (notebook-actions.ts, which
// check the login cookie) and the MCP endpoint (api/mcp, which checks its
// token). Each takes the session it acts for.

export const idOf = (value: unknown): number | null =>
  value == null ? null : typeof value === 'number' ? value : (value as { id: number }).id

export const asId = (value: unknown): number => {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw new Error('找不到這個項目')
  return n
}

export const optionalId = (value: unknown): number | null => (value == null ? null : asId(value))

/** Single-line titles; emptiness is fine (shown as 未命名). */
export const cleanPageTitle = (value: unknown) => cleanText(value, MAX_PAGE_TITLE).replace(/\s+/g, ' ').trim()

/** One emoji (or a couple of characters), or a coloured `ph:` icon. */
export const cleanIcon = (value: unknown) => cleanNoteIcon(value).slice(0, MAX_ICON_LENGTH)

export function cleanStatus(value: unknown): ItemStatus {
  const found = ITEM_STATUSES.find((s) => s.value === value)
  if (!found) throw new Error('狀態錯誤')
  return found.value
}

export const optionalDay = (value: unknown): string | null => {
  if (value == null || value === '') return null
  if (!isDay(value)) throw new Error('日期格式錯誤')
  return value
}

/** Every page of a notebook as tree nodes, optionally including the trash. */
export async function treeOf({ payload, user }: Session, notebookId: number, withTrash = false) {
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

// ------------------------------------------------------------------ pages

/** A new page at the end of `parentId`'s children (or of the top level). */
export async function createPageIn(
  session: Session,
  notebookId: number,
  parentId: number | null,
  init: { title?: string; icon?: string; content?: unknown[] | null } = {},
) {
  const { payload, user } = session
  const notebook = asId(notebookId)
  const parent = optionalId(parentId)
  const pages = (await treeOf(session, notebook)).map(toPageNode)
  const host = parent == null ? null : pages.find((p) => p.id === parent)
  if (parent != null && !host) throw new Error('找不到上層頁面')
  if (host?.kind === 'item') throw new Error('看板卡片裡不能再放頁面')
  const siblings = childrenOf(pages, parent)
  const content = cleanBlocks(init.content ?? null)
  return payload.create({
    collection: 'note-pages',
    data: {
      notebook,
      parent,
      title: cleanPageTitle(init.title ?? ''),
      ...(init.icon ? { icon: cleanIcon(init.icon) } : {}),
      ...(content ? { content, editedAt: new Date().toISOString() } : {}),
      position: siblings.length ? siblings[siblings.length - 1].position + 1 : 0,
    },
    user,
    overrideAccess: false,
  })
}

// Version history (PageSnapshots): saving a page keeps the content it replaces
// when the page's newest snapshot is older than this, and this many per page.
const SNAPSHOT_EVERY = 10 * 60_000
export const SNAPSHOTS_KEPT = 50

/**
 * Keeps the page's current title and content as a snapshot (`force`: whatever
 * the newest one's age). Returns the new snapshot's id, or null when none was
 * needed (a recent one exists, or the page is empty).
 */
export async function keepSnapshot({ payload, user }: Session, pageId: number, force = false): Promise<number | null> {
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
  if (!force && newest.docs[0] && Date.now() - Date.parse(newest.docs[0].createdAt) < SNAPSHOT_EVERY) return null
  const page = await payload.findByID({ collection: 'note-pages', id: pageId, depth: 0, select: { title: true, content: true }, user, overrideAccess: false })
  if (isBlankDocument(page.content)) return null
  const snapshot = await payload.create({ collection: 'page-snapshots', data: { page: pageId, title: page.title ?? '', content: page.content }, user, overrideAccess: false })
  const surplus = newest.docs.slice(SNAPSHOTS_KEPT - 1).map((s) => s.id)
  if (surplus.length) {
    await payload.delete({ collection: 'page-snapshots', where: { id: { in: surplus } }, user, overrideAccess: false })
  }
  return snapshot.id
}

export type ContentWrite =
  /** `snapshotId`: the version history entry holding what this save replaced, if one was made. */
  | { ok: true; rev: number; savedAt: number; snapshotId: number | null }
  /** Someone else saved since `baseRev`: nothing was written; here is what is there now. */
  | { ok: false; rev: number; content: unknown[] | null }

/**
 * Saves a page's content. With `baseRev` the save only goes through when the
 * page is still at that revision, so an editor that missed a change made
 * elsewhere (another tab, Claude) can't overwrite it unseen. `forceSnapshot`
 * keeps the replaced content in the version history whatever its age.
 */
export async function writePageContent(
  session: Session,
  pageId: number,
  content: unknown,
  opts: { baseRev?: number; forceSnapshot?: boolean } = {},
): Promise<ContentWrite> {
  const { payload, user } = session
  const id = asId(pageId)
  const blocks = cleanBlocks(content)
  if (opts.baseRev != null) {
    const current = await payload.findByID({ collection: 'note-pages', id, depth: 0, select: { contentRev: true, content: true }, user, overrideAccess: false })
    const rev = Number(current.contentRev) || 0
    if (rev !== opts.baseRev) return { ok: false, rev, content: Array.isArray(current.content) ? current.content : null }
  }
  const snapshotId = await keepSnapshot(session, id, opts.forceSnapshot)
  const doc = await payload.update({
    collection: 'note-pages',
    id,
    data: { content: blocks, editedAt: new Date().toISOString() },
    depth: 0,
    user,
    overrideAccess: false,
  })
  return { ok: true, rev: Number(doc.contentRev) || 0, savedAt: Date.now(), snapshotId }
}

/** A page's version history, newest first. */
export async function pageVersions({ payload, user }: Session, pageId: number) {
  const { docs } = await payload.find({
    collection: 'page-snapshots',
    where: { page: { equals: asId(pageId) } },
    sort: '-createdAt',
    limit: SNAPSHOTS_KEPT,
    depth: 0,
    user,
    overrideAccess: false,
  })
  return docs
}

/** One version of a page (it must belong to that page). */
export async function pageVersion({ payload, user }: Session, pageId: number, versionId: number) {
  const snapshot = await payload.findByID({ collection: 'page-snapshots', id: asId(versionId), depth: 0, user, overrideAccess: false }).catch(() => null)
  if (!snapshot || idOf(snapshot.page) !== asId(pageId)) throw new Error('這一頁沒有這個版本（可能已經被清掉了）')
  return snapshot
}

/** Puts an old version's content back; what was there goes into the history first. */
export async function restorePageVersion(session: Session, pageId: number, versionId: number) {
  const snapshot = await pageVersion(session, pageId, versionId)
  const result = await writePageContent(session, pageId, Array.isArray(snapshot.content) ? snapshot.content : [], { forceSnapshot: true })
  if (!result.ok) throw new Error('還原失敗，請再試一次')
  return { snapshot, ...result }
}

/** Moves a page under `parentId` (null = top level) at `index` among its new siblings. */
export async function movePageTo(session: Session, pageId: number, parentId: number | null, index: number) {
  const { payload, user } = session
  const id = asId(pageId)
  const page = await payload.findByID({ collection: 'note-pages', id, depth: 0, user, overrideAccess: false })
  // Cards move between board columns (moveItem); a page can't live inside a
  // card, where the sidebar would never show it.
  if (page.kind === 'item') throw new Error('看板卡片請在看板裡移動')
  const before = (await treeOf(session, idOf(page.notebook)!)).map(toPageNode)
  const target = optionalId(parentId)
  if (target != null && before.find((p) => p.id === target)?.kind === 'item') throw new Error('不能把頁面放進看板卡片裡')
  const after = applyMove(before, id, target, Number(index))
  const changed = after.filter((p, i) => p.parent !== before[i].parent || p.position !== before[i].position)
  // The moved page first, so its new parent is checked before siblings shift.
  changed.sort((a, b) => Number(b.id === id) - Number(a.id === id))
  for (const p of changed) {
    await payload.update({
      collection: 'note-pages',
      id: p.id,
      data: { parent: p.parent, position: p.position },
      user,
      overrideAccess: false,
    })
  }
}

type TrashedNode = Parameters<typeof toPageNode>[0] & { id: number; deletedAt?: string | null }

/**
 * A trashed page and what was trashed together with it (one shared
 * `deletedAt`). Pages under it that were trashed earlier on their own are
 * separate entries in the trash and are left alone.
 */
export function trashBatch(all: TrashedNode[], pageId: number, deletedAt: string): number[] {
  const stamp = Date.parse(deletedAt)
  const byId = new Map(all.map((p) => [p.id, p]))
  return subtreeIds(all.map(toPageNode), pageId).filter((pid) => {
    const d = byId.get(pid)?.deletedAt
    return d != null && Date.parse(d) === stamp
  })
}

export type TrashItem = { id: number; title: string; icon: string; deletedAt: string; childCount: number }

/** A notebook's trash: pages trashed on their own (not along with a trashed parent), newest first. */
export async function trashedPages(session: Session, notebookId: number): Promise<TrashItem[]> {
  const all = await treeOf(session, asId(notebookId), true)
  const byId = new Map(all.map((p) => [p.id, p]))
  const trashed = all.filter((p) => p.deletedAt)
  const sameBatch = (a?: string | null, b?: string | null) => Boolean(a && b && Date.parse(a) === Date.parse(b))
  return trashed
    .filter((p) => !sameBatch(byId.get(idOf(p.parent) ?? -1)?.deletedAt, p.deletedAt))
    .map((p) => ({
      id: p.id,
      title: p.title ?? '',
      icon: p.icon ?? '',
      deletedAt: p.deletedAt!,
      childCount: trashBatch(trashed, p.id, p.deletedAt!).length - 1,
    }))
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
}

/** Restores a trashed page with whatever was trashed along with it; returns the restored ids. */
export async function restoreTrashedPage(session: Session, pageId: number): Promise<{ notebookId: number; ids: number[] }> {
  const { payload, user } = session
  const id = asId(pageId)
  const page = await payload.findByID({ collection: 'note-pages', id, depth: 0, trash: true, user, overrideAccess: false })
  if (!page.deletedAt) throw new Error('這一頁不在垃圾桶裡')
  const notebookId = idOf(page.notebook)!
  const all = await treeOf(session, notebookId, true)
  const ids = trashBatch(all, id, page.deletedAt)

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
      id,
      data: { parent: newParent, position, ...(orphanCard ? { kind: 'page' as const, parentItem: null } : {}) },
      user,
      overrideAccess: false,
    })
  }
  return { notebookId, ids }
}

/** Moves a page and everything under it to the trash; returns the ids trashed. */
export async function trashPageTree(session: Session, pageId: number): Promise<number[]> {
  const { payload, user } = session
  const id = asId(pageId)
  const page = await payload.findByID({ collection: 'note-pages', id, depth: 0, user, overrideAccess: false })
  const ids = subtreeIds((await treeOf(session, idOf(page.notebook)!)).map(toPageNode), id)
  // One shared timestamp marks what was trashed together, so it restores together.
  await payload.update({
    collection: 'note-pages',
    where: { id: { in: ids } },
    data: { deletedAt: new Date().toISOString() },
    user,
    overrideAccess: false,
  })
  return ids
}

// ----------------------------------------------------------------- boards

const ITEM_SELECT = {
  title: true,
  icon: true,
  status: true,
  position: true,
  startDate: true,
  endDate: true,
  parentItem: true,
} as const

export async function boardItems({ payload, user }: Session, boardId: number): Promise<BoardItem[]> {
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

export async function boardOf({ payload, user }: Session, boardId: number) {
  const board = await payload.findByID({ collection: 'note-pages', id: boardId, depth: 0, user, overrideAccess: false })
  if (board.kind !== 'board') throw new Error('這不是看板')
  return board
}

/** A new card at the bottom of a column. */
export async function createBoardItem(session: Session, boardId: number, status: unknown, title: unknown = '') {
  const { payload, user } = session
  const board = await boardOf(session, asId(boardId))
  const column = cleanStatus(status)
  const items = columnOf(await boardItems(session, board.id), column)
  return payload.create({
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
}

export type ItemPatch = Partial<{ status: ItemStatus; startDate: string | null; endDate: string | null; parentItem: number | null }>

/** Card properties (title, icon and content are saved like any page's). */
export async function patchBoardItem(session: Session, itemId: number, patch: ItemPatch) {
  const { payload, user } = session
  const item = await payload.findByID({ collection: 'note-pages', id: asId(itemId), depth: 0, user, overrideAccess: false })
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
}
