// Notebook limits and the tree shape shared by server and client.

export const MAX_NOTEBOOK_TITLE = 60
export const MAX_PAGE_TITLE = 200
export const MAX_ICON_LENGTH = 16
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

export function toPageNode(doc: { id: number; parent?: unknown; title?: string | null; icon?: string | null; position?: number | null }): PageNode {
  return {
    id: doc.id,
    parent: idOf(doc.parent),
    title: doc.title ?? '',
    icon: doc.icon ?? '',
    position: doc.position ?? 0,
  }
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
