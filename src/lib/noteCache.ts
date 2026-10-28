'use client'

// Browser back/forward replays the router's cached server payload, which can
// be older than what was typed since; the next autosave would then write that
// old state back. Each server render carries a `renderedAt` stamp: the first
// mount with a stamp is fresh data; a later mount with a stamp already seen is
// a replay, and then the local edits remembered here win.
//
// A server action that revalidates re-renders the current page in place with a
// new stamp but no remount, so mounted components report every stamp they
// receive (`useRenderStamp`); otherwise Back would later mount that stamp as
// "fresh" and drop the edits made after it.

import { useEffect } from 'react'
import type { PageNode } from './notes'
import type { PageFont, TemplateKind } from './options'

const seen = new Set<string>()
const local = new Map<string, unknown>()
/** Keys whose latest local state may not have reached the server yet. */
const unsaved = new Set<string>()
/**
 * Server time of each key's last save, when the save reports it. A render
 * stamped earlier is older than the local copy even if it was never mounted:
 * an action that revalidates (creating a sub-page, say) re-renders the page,
 * and leaving right away caches that render without it ever being seen.
 */
const savedAt = new Map<string, number>()

/** True the first time a server render is mounted. */
function isFresh(key: string, renderedAt: number): boolean {
  const k = `${key}@${renderedAt}`
  if (seen.has(k)) return false
  seen.add(k)
  return true
}

/**
 * Server state for a fresh render; the latest local state for a replay, or
 * while a save is still on its way (a page opened right after typing elsewhere
 * can render before that save lands).
 */
export function withLocal<T>(key: string, server: T, renderedAt: number): T {
  const fresh = isFresh(key, renderedAt)
  const localIsNewer = local.has(key) && (unsaved.has(key) || (savedAt.get(key) ?? 0) > renderedAt)
  if (fresh && !localIsNewer) {
    local.delete(key)
    return server
  }
  return local.has(key) ? (local.get(key) as T) : server
}

/** Remember local state; it counts as unsaved until `markSaved`. */
export function rememberLocal<T>(key: string, value: T, { saved = false } = {}) {
  local.set(key, value)
  if (saved) unsaved.delete(key)
  else unsaved.add(key)
}

/** The latest local state, if any (e.g. an editor's current document). */
export function peekLocal<T>(key: string): T | undefined {
  return local.get(key) as T | undefined
}

// A notebook page's content revision (note-pages.contentRev) as of the text
// remembered here, so an editor that starts from that text saves against it.
const revs = new Map<string, number>()

export function rememberRev(key: string, rev: number) {
  revs.set(key, rev)
}

export function knownRev(key: string): number | undefined {
  return revs.get(key)
}

/** The server has `value` (or, without one, whatever is latest), saved at server time `at` if known. */
export function markSaved(key: string, value?: unknown, at?: number) {
  if (at != null) savedAt.set(key, Math.max(at, savedAt.get(key) ?? 0))
  if (value === undefined || local.get(key) === value) unsaved.delete(key)
}

/** Marks every stamp a mounted component receives as seen (see above). */
export function useRenderStamp(key: string, renderedAt: number | undefined) {
  useEffect(() => {
    if (renderedAt != null) seen.add(`${key}@${renderedAt}`)
  }, [key, renderedAt])
}

// ------------------------------------------------------------ notebook pages

export type PageEdits = {
  title?: string
  icon?: string
  content?: unknown[] | null
  cover?: string
  coverPosition?: number
  font?: PageFont
  smallText?: boolean
  fullWidth?: boolean
  locked?: boolean
  favorite?: boolean
  templateFor?: TemplateKind | null
}

const pageKey = (id: number) => `page:${id}`
const treeKey = (notebookId: number) => `tree:${notebookId}`

// Title, icon and cover saves are quick single requests; the body is covered
// by the editor's own unsaved tracking (BlockEditor with renderedAt).
export function rememberPageEdit(id: number, edit: PageEdits) {
  rememberLocal(pageKey(id), { ...(local.get(pageKey(id)) as PageEdits | undefined), ...edit }, { saved: true })
}

export function pageWithEdits<T extends Required<PageEdits>>(id: number, server: T, renderedAt: number): T {
  const edits = withLocal<PageEdits | undefined>(pageKey(id), undefined, renderedAt)
  return { ...server, ...edits }
}

export const usePageStamp = (id: number, renderedAt: number) => useRenderStamp(pageKey(id), renderedAt)

export function rememberTree(notebookId: number, pages: PageNode[]) {
  rememberLocal(treeKey(notebookId), pages, { saved: true })
}

export function treeWithEdits(notebookId: number, server: PageNode[], renderedAt: number): PageNode[] {
  return withLocal(treeKey(notebookId), server, renderedAt)
}

export const useTreeStamp = (notebookId: number, renderedAt: number) => useRenderStamp(treeKey(notebookId), renderedAt)
