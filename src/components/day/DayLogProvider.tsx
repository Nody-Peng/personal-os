'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { saveDailyLog, type DailyLogPatch } from '@/app/(frontend)/actions'
import type { PlanItem } from '@/lib/dayParts'
import { markSaved, rememberLocal, useRenderStamp, withLocal } from '@/lib/noteCache'
import type { ToeflSkill } from '@/lib/options'
import { useSaveQueue, type SaveStatus } from '@/lib/useSaveQueue'

export type DayLog = {
  habitsDone: number[]
  toeflMinutes: number
  toeflSkills: ToeflSkill[]
  themeMinutes: number
  energy: number | null
  morningItems: PlanItem[]
  noonItems: PlanItem[]
  eveningItems: PlanItem[]
}

export const EMPTY_LOG: DayLog = {
  habitsDone: [],
  toeflMinutes: 0,
  toeflSkills: [],
  themeMinutes: 0,
  energy: null,
  morningItems: [],
  noonItems: [],
  eveningItems: [],
}

type TextField = 'morningItems' | 'noonItems' | 'eveningItems'

type DayLogContext = {
  day: string
  log: DayLog
  /** Taps: update now and save immediately. */
  commit: (patch: Partial<DayLog>) => void
  /** Typing: update now, save after a pause (or on blur via flush). */
  editText: (patch: Partial<Pick<DayLog, TextField>>) => void
  flush: () => void
  status: SaveStatus
  error: string | null
  savedAt: Date | null
}

const Ctx = createContext<DayLogContext | null>(null)
const TEXT_SAVE_DELAY = 800

type Props = {
  day: string
  initial: DayLog
  /** The server render's stamp: back/forward then keeps the latest taps (lib/noteCache.ts). */
  renderedAt: number
  children: React.ReactNode
}

/** One day's log: shared state plus a serial save queue for every section. */
export function DayLogProvider({ day, initial, renderedAt, children }: Props) {
  const key = `daylog:${day}`
  const [log, setLogState] = useState(() => withLocal(key, initial, renderedAt))
  useRenderStamp(key, renderedAt)
  const { enqueue: enqueueSave, status, error, savedAt } = useSaveQueue()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingText = useRef<DailyLogPatch>({})
  const inFlight = useRef(0)

  const setLog = useCallback(
    (update: (prev: DayLog) => DayLog) =>
      setLogState((prev) => {
        const next = update(prev)
        rememberLocal(key, next)
        return next
      }),
    [key],
  )
  // Saved once every queued save has landed and no typing is waiting.
  const enqueue = useCallback(
    (run: () => ReturnType<typeof saveDailyLog>) => {
      inFlight.current += 1
      enqueueSave(async () => {
        const result = await run()
        inFlight.current -= 1
        if (result.ok && inFlight.current === 0 && !Object.keys(pendingText.current).length) markSaved(key)
        return result
      })
    },
    [enqueueSave, key],
  )

  const commit = useCallback(
    (patch: Partial<DayLog>) => {
      setLog((prev) => ({ ...prev, ...patch }))
      // This save supersedes any typing still waiting for the same fields.
      for (const key of Object.keys(patch)) delete pendingText.current[key as keyof DailyLogPatch]
      enqueue(() => saveDailyLog(day, patch))
    },
    [day, enqueue, setLog],
  )

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const patch = pendingText.current
    pendingText.current = {}
    if (Object.keys(patch).length) enqueue(() => saveDailyLog(day, patch))
  }, [day, enqueue])

  const editText = useCallback(
    (patch: Partial<Pick<DayLog, TextField>>) => {
      setLog((prev) => ({ ...prev, ...patch }))
      pendingText.current = { ...pendingText.current, ...patch }
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, TEXT_SAVE_DELAY)
    },
    [flush, setLog],
  )

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [flush])

  return (
    <Ctx.Provider value={{ day, log, commit, editText, flush, status, error, savedAt }}>{children}</Ctx.Provider>
  )
}

export function useDayLog(): DayLogContext {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDayLog must be used inside DayLogProvider')
  return ctx
}
