'use client'

// Browser back/forward replays the router's cached server payload, which can
// be older than what was typed since. Each server render carries a
// `renderedAt` stamp: the first mount with a stamp is fresh data; a later
// mount with the same stamp is a replay, and then local edits win.

import type { PageNode } from './notes'

const seen = new Set<string>()

/** True the first time a server render is mounted. */
function isFresh(key: string, renderedAt: number): boolean {
  const k = `${key}@${renderedAt}`
  if (seen.has(k)) return false
  seen.add(k)
  return true
}

export type PageEdits = { title?: string; icon?: string; content?: unknown[] | null }
const pageEdits = new Map<number, PageEdits>()
const trees = new Map<number, PageNode[]>()

export function rememberPageEdit(id: number, edit: PageEdits) {
  pageEdits.set(id, { ...pageEdits.get(id), ...edit })
}

export function pageWithEdits<T extends Required<PageEdits>>(id: number, server: T, renderedAt: number): T {
  if (isFresh(`page:${id}`, renderedAt)) {
    pageEdits.delete(id)
    return server
  }
  return { ...server, ...pageEdits.get(id) }
}

export function rememberTree(notebookId: number, pages: PageNode[]) {
  trees.set(notebookId, pages)
}

export function treeWithEdits(notebookId: number, server: PageNode[], renderedAt: number): PageNode[] {
  if (isFresh(`tree:${notebookId}`, renderedAt)) {
    trees.delete(notebookId)
    return server
  }
  return trees.get(notebookId) ?? server
}
