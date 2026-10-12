'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActionResult } from '@/app/(frontend)/actions'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Runs saves one after another so rapid taps can't race each other
 * (e.g. two "create today's log" calls at once).
 */
export function useSaveQueue() {
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const pending = useRef(0)
  const lastError = useRef<string | null>(null)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const enqueue = useCallback((run: () => Promise<ActionResult<unknown>>) => {
    pending.current += 1
    setStatus('saving')
    chain.current = chain.current
      .then(run)
      .then((result) => {
        lastError.current = result.ok ? null : result.error
        if (result.ok) setSavedAt(new Date())
      })
      .catch(() => {
        lastError.current = '連線失敗，變更尚未儲存'
      })
      .finally(() => {
        pending.current -= 1
        if (pending.current > 0) return
        setError(lastError.current)
        setStatus(lastError.current ? 'error' : 'saved')
      })
  }, [])

  /** True while a save is still on its way. */
  const busy = useCallback(() => pending.current > 0, [])
  /** Resolves once every save queued so far has finished. */
  const settled = useCallback(() => chain.current.then(() => undefined), [])

  return { enqueue, busy, settled, status, error, savedAt }
}

/**
 * Closing or reloading the tab while something is unsaved: start the save
 * and have the browser ask first (a request started while the page unloads
 * is cancelled, so the last second of typing would otherwise be lost).
 */
export function useLeaveGuard(unsaved: () => boolean, flush: () => void) {
  const latest = useRef({ unsaved, flush })
  useEffect(() => {
    latest.current = { unsaved, flush }
  })
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!latest.current.unsaved()) return
      latest.current.flush()
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [])
}
