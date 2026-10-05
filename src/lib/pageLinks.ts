'use client'

// Titles for page-link blocks that point outside the current notebook's tree
// (other notebooks, board items). Requests in the same tick are batched.

import { useEffect, useSyncExternalStore } from 'react'
import { getPageLinks, type PageLinkInfo } from '@/app/(frontend)/notebook-actions'

type Entry = PageLinkInfo | 'missing'

const cache = new Map<number, Entry>()
const listeners = new Set<() => void>()
let queued = new Set<number>()
let timer: ReturnType<typeof setTimeout> | null = null

const MAX_ATTEMPTS = 3
const attempts = new Map<number, number>()

function flush() {
  const ids = [...queued]
  queued = new Set()
  timer = null
  getPageLinks(ids)
    .then((result) => {
      if (!result.ok) throw new Error(result.error)
      const found = new Map((result.data ?? []).map((p) => [p.id, p]))
      for (const id of ids) cache.set(id, found.get(id) ?? 'missing')
      listeners.forEach((notify) => notify())
    })
    .catch(() => {
      // Offline or a failed request: try again a little later, then give up
      // (shown as missing) rather than loading forever.
      for (const id of ids) {
        const tries = (attempts.get(id) ?? 0) + 1
        attempts.set(id, tries)
        if (tries >= MAX_ATTEMPTS) cache.set(id, 'missing')
        else setTimeout(() => requestPageLink(id), 2000 * tries)
      }
      listeners.forEach((notify) => notify())
    })
}

export function requestPageLink(id: number) {
  if (id <= 0 || queued.has(id)) return
  queued.add(id)
  timer ??= setTimeout(flush, 0)
}

/** Remember a page we already know about (e.g. one just picked). */
export function primePageLink(info: PageLinkInfo) {
  cache.set(info.id, info)
  listeners.forEach((notify) => notify())
}

/** undefined while loading, 'missing' when trashed or deleted. */
export function usePageLink(id: number, skip = false): Entry | undefined {
  const entry = useSyncExternalStore(
    (notify) => {
      listeners.add(notify)
      return () => listeners.delete(notify)
    },
    () => cache.get(id),
    () => undefined,
  )
  useEffect(() => {
    if (!skip && id > 0) requestPageLink(id)
  }, [id, skip])
  return entry
}
