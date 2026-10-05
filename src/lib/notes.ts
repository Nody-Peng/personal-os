// Notebook limits and the tree shape shared by server and client.

import type { ItemStatus, PageKind } from './options'

export const MAX_NOTEBOOK_TITLE = 60
export const MAX_PAGE_TITLE = 200
/** An emoji, a `ph:<name>:<colour>` icon or an uploaded image's URL (lib/noteIcons.ts). */
export const MAX_ICON_LENGTH = 300
/** Trashed pages are purged for good after this many days. */
export const TRASH_DAYS = 30

export const UNTITLED = '未命名'

/** Stamp for a server render (see lib/noteCache.ts). */
export const renderStamp = () => Date.now()

/** What the sidebar needs of a page (no content). */
export type PageNode = {
  id: number
  parent: number | null
  title: string
  icon: string
  position: number
  kind: PageKind
  favorite: boolean
}

export type NotebookItem = {
  id: number
  title: string
  coverColor: string
  pattern: string
  archived: boolean
  pageCount: number
}

const idOf = (value: unknown): number | null =>
  value == null ? null : typeof value === 'number' ? value : (value as { id: number }).id

export function toPageNode(doc: {
  id: number
  parent?: unknown
  title?: string | null
  icon?: string | null
  position?: number | null
  kind?: string | null
  favorite?: boolean | null
}): PageNode {
  return {
    id: doc.id,
    parent: idOf(doc.parent),
    title: doc.title ?? '',
    icon: doc.icon ?? '',
    position: doc.position ?? 0,
    kind: (doc.kind as PageKind | null) ?? 'page',
    favorite: Boolean(doc.favorite),
  }
}

/** A card on a board (a note page with kind `item`). */
export type BoardItem = {
  id: number
  title: string
  icon: string
  status: ItemStatus
  position: number
  startDate: string | null
  endDate: string | null
  parentItem: number | null
}

export function toBoardItem(doc: {
  id: number
  title?: string | null
  icon?: string | null
  status?: string | null
  position?: number | null
  startDate?: string | null
  endDate?: string | null
  parentItem?: unknown
}): BoardItem {
  return {
    id: doc.id,
    title: doc.title ?? '',
    icon: doc.icon ?? '',
    status: (doc.status as ItemStatus | null) ?? 'todo',
    position: doc.position ?? 0,
    startDate: doc.startDate ?? null,
    endDate: doc.endDate ?? null,
    parentItem: idOf(doc.parentItem),
  }
}

/** Items of one board column, in order. */
export function columnOf(items: BoardItem[], status: ItemStatus): BoardItem[] {
  return items.filter((i) => i.status === status).sort((a, b) => a.position - b.position || a.id - b.id)
}

/**
 * The board after moving an item into `status` at `index` (both affected
 * columns renumbered 0..n-1).
 */
export function applyItemMove(items: BoardItem[], id: number, status: ItemStatus, index: number): BoardItem[] {
  const self = items.find((i) => i.id === id)
  if (!self) throw new Error('找不到這個項目')
  const column = columnOf(items, status).filter((i) => i.id !== id)
  column.splice(Math.max(0, Math.min(column.length, Math.round(index) || 0)), 0, self)
  const next = new Map<number, Pick<BoardItem, 'status' | 'position'>>()
  column.forEach((i, position) => next.set(i.id, { status, position }))
  if (self.status !== status) {
    columnOf(items, self.status)
      .filter((i) => i.id !== id)
      .forEach((i, position) => next.set(i.id, { status: self.status, position }))
  }
  return items.map((i) => (next.has(i.id) ? { ...i, ...next.get(i.id)! } : i))
}

/** Items that may become `id`'s 上級項目 (not itself, nor anything under it). */
export function parentCandidates(items: BoardItem[], id: number): BoardItem[] {
  const below = new Set([id])
  for (let grew = true; grew; ) {
    grew = false
    for (const i of items) {
      if (i.parentItem != null && below.has(i.parentItem) && !below.has(i.id)) {
        below.add(i.id)
        grew = true
      }
    }
  }
  return items.filter((i) => !below.has(i.id))
}

/** Children of `parent`, in order. */
export function childrenOf(pages: PageNode[], parent: number | null): PageNode[] {
  return pages.filter((p) => p.parent === parent).sort((a, b) => a.position - b.position || a.id - b.id)
}

/** `id` and every page below it. */
export function subtreeIds(pages: PageNode[], id: number): number[] {
  const out = [id]
  for (let i = 0; i < out.length; i++) for (const p of pages) if (p.parent === out[i]) out.push(p.id)
  return out
}

/** Ancestors from the root down to (not including) `id`. */
export function ancestorsOf(pages: PageNode[], id: number): PageNode[] {
  const byId = new Map(pages.map((p) => [p.id, p]))
  const out: PageNode[] = []
  let current = byId.get(id)?.parent ?? null
  while (current != null && !out.some((p) => p.id === current)) {
    const page = byId.get(current)
    if (!page) break
    out.unshift(page)
    current = page.parent
  }
  return out
}

/** A short excerpt of `text` around the first hit of `query`. */
export function snippetAround(text: string, query: string, radius = 40): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const lower = flat.toLowerCase()
  const hit = words.map((w) => lower.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0]
  if (hit === undefined) return flat.slice(0, radius * 2)
  const start = Math.max(0, hit - radius)
  const end = Math.min(flat.length, hit + radius * 2)
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`
}

/**
 * The tree after moving `id` under `parent` (null = top level) at `index`
 * among its new siblings. Both affected sibling lists get positions 0..n-1.
 * Throws when the move would put a page inside itself.
 */
export function applyMove(pages: PageNode[], id: number, parent: number | null, index: number): PageNode[] {
  const self = pages.find((p) => p.id === id)
  if (!self) throw new Error('找不到這個頁面')
  if (parent != null) {
    if (!pages.some((p) => p.id === parent)) throw new Error('找不到上層頁面')
    if (subtreeIds(pages, id).includes(parent)) throw new Error('不能把頁面放進自己或自己的子頁面裡')
  }
  const siblings = childrenOf(pages, parent).filter((p) => p.id !== id)
  const at = Math.max(0, Math.min(siblings.length, Math.round(index) || 0))
  siblings.splice(at, 0, self)
  const next = new Map<number, Pick<PageNode, 'parent' | 'position'>>()
  siblings.forEach((p, position) => next.set(p.id, { parent, position }))
  if (self.parent !== parent) {
    childrenOf(pages, self.parent)
      .filter((p) => p.id !== id)
      .forEach((p, position) => next.set(p.id, { parent: self.parent, position }))
  }
  return pages.map((p) => (next.has(p.id) ? { ...p, ...next.get(p.id)! } : p))
}

/** Pages in display order with their depth (for pickers and the trash). */
export function flattenTree(pages: PageNode[], parent: number | null = null, depth = 0): { page: PageNode; depth: number }[] {
  return childrenOf(pages, parent).flatMap((page) => [{ page, depth }, ...flattenTree(pages, page.id, depth + 1)])
}

/** Pages shown inside a document (sub-page and board blocks), anywhere in the tree of blocks. */
export function embeddedPageIds(blocks: unknown): Set<number> {
  const ids = new Set<number>()
  const walk = (list: unknown) => {
    if (!Array.isArray(list)) return
    for (const b of list) {
      if (!b || typeof b !== 'object') continue
      const block = b as { type?: string; props?: { pageId?: unknown; boardId?: unknown; mode?: unknown }; children?: unknown }
      if (block.type === 'pageLink' && block.props?.mode !== 'link') ids.add(Number(block.props?.pageId))
      if (block.type === 'board') ids.add(Number(block.props?.boardId))
      walk(block.children)
    }
  }
  walk(blocks)
  ids.delete(0)
  return ids
}
