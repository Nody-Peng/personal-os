'use client'

import { useCallback, useRef, useState } from 'react'
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

  const enqueue = useCallback((run: () => Promise<ActionResult>) => {
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

  return { enqueue, status, error, savedAt }
}
