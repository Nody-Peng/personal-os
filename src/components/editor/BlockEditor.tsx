'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef } from 'react'
import { saveDailyLog } from '@/app/(frontend)/actions'
import { saveMonthNote, saveWeekNote, updateTask } from '@/app/(frontend)/journal-actions'
import type { ActionResult } from '@/lib/actionUtils'
import { useSaveQueue, type SaveStatus } from '@/lib/useSaveQueue'

const Inner = dynamic(() => import('./BlockEditorInner'), {
  ssr: false,
  loading: () => <div className="h-24 animate-pulse rounded-lg bg-sunken" aria-hidden />,
})

/** Where a document is saved. Plain data so server pages can pass it in. */
export type EditorTarget =
  | { kind: 'day'; day: string }
  | { kind: 'task'; id: number }
  | { kind: 'week'; monday: string }
  | { kind: 'month'; month: string }

function save(target: EditorTarget, blocks: unknown[]): Promise<ActionResult> {
  switch (target.kind) {
    case 'day':
      return saveDailyLog(target.day, { note: blocks })
    case 'task':
      return updateTask(target.id, { body: blocks })
    case 'week':
      return saveWeekNote(target.monday, { review: blocks })
    case 'month':
      return saveMonthNote(target.month, blocks)
  }
}

const SAVE_DELAY = 1000

type Props = {
  target: EditorTarget
  initial: unknown[] | null
  placeholder?: string
  onStatus?: (status: SaveStatus, error: string | null) => void
}

/** Notion-style editor that autosaves a second after typing stops. */
export function BlockEditor({ target, initial, placeholder = '輸入文字，或按 / 插入區塊', onStatus }: Props) {
  const { enqueue, status, error } = useSaveQueue()
  const pending = useRef<unknown[] | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const targetRef = useRef(target)
  const onStatusRef = useRef(onStatus)
  useEffect(() => {
    targetRef.current = target
    onStatusRef.current = onStatus
  })

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const blocks = pending.current
    pending.current = null
    if (blocks) {
      const t = targetRef.current
      enqueue(() => save(t, blocks))
    }
  }, [enqueue])

  const onChange = useCallback(
    (blocks: unknown[]) => {
      pending.current = blocks
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, SAVE_DELAY)
    },
    [flush],
  )

  // Never drop the last keystrokes when the tab hides or the panel closes.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [flush])

  useEffect(() => onStatusRef.current?.(status, error), [status, error])

  return (
    <div className="-mx-1">
      <Inner initial={initial} placeholder={placeholder} onChange={onChange} />
    </div>
  )
}

export function SaveStatusText({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === 'error') return <span role="alert" className="text-xs text-red-ink">{error}</span>
  if (status === 'saving') return <span className="text-xs text-muted">儲存中…</span>
  if (status === 'saved') return <span className="text-xs text-muted">已儲存</span>
  return <span className="text-xs text-muted">自動儲存</span>
}
