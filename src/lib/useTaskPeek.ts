'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { closePanel, openPanel } from './panelHistory'

/** The task panel is driven by ?task=<id>, so Back closes it and links can share it. */
export function useTaskPeek() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const openId = Number(params.get('task')) || null

  const withTask = useCallback(
    (id: number | null) => {
      const next = new URLSearchParams(params.toString())
      if (id === null) next.delete('task')
      else next.set('task', String(id))
      const query = next.toString()
      return query ? `${pathname}?${query}` : pathname
    },
    [params, pathname],
  )

  const open = useCallback((id: number) => openPanel(router, withTask(id)), [router, withTask])
  const close = useCallback(() => closePanel(router, withTask(null), { refresh: true }), [router, withTask])

  return { openId, open, close }
}
