'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState, type Ref } from 'react'
import { saveDailyLog } from '@/app/(frontend)/actions'
import { saveMonthNote, saveWeekNote, updateTask } from '@/app/(frontend)/journal-actions'
import { updatePage } from '@/app/(frontend)/notebook-actions'
import type { ActionResult } from '@/lib/actionUtils'
import type { TemplateKind } from '@/lib/options'
import { markSaved, rememberLocal, useRenderStamp, withLocal } from '@/lib/noteCache'
import { useSaveQueue, type SaveStatus } from '@/lib/useSaveQueue'
import type { EditorHandle } from './BlockEditorInner'

export type { EditorHandle } from './BlockEditorInner'

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
  | { kind: 'note'; id: number }

/** Notebook pages also report when the server saved (noteCache uses it to spot older renders). */
function save(target: EditorTarget, blocks: unknown[]): Promise<ActionResult<{ savedAt: number } | undefined>> {
  switch (target.kind) {
    case 'day':
      return saveDailyLog(target.day, { note: blocks })
    case 'task':
      return updateTask(target.id, { body: blocks })
    case 'week':
      return saveWeekNote(target.monday, { review: blocks })
    case 'month':
      return saveMonthNote(target.month, blocks)
    case 'note':
      return updatePage(target.id, { content: blocks })
  }
}

function targetKey(target: EditorTarget): string {
  switch (target.kind) {
    case 'day':
      return `doc:day:${target.day}`
    case 'task':
      return `doc:task:${target.id}`
    case 'week':
      return `doc:week:${target.monday}`
    case 'month':
      return `doc:month:${target.month}`
    case 'note':
      return `doc:note:${target.id}`
  }
}

const SAVE_DELAY = 1000
/** Waits before saving again after a failure: 2 s, 5 s, 15 s, then every 30 s. */
const RETRY_DELAYS = [2000, 5000, 15000, 30000]

type Props = {
  target: EditorTarget
  initial: unknown[] | null
  /**
   * The server render's stamp (`renderStamp()`) when `initial` comes from a
   * server page: back/forward then shows what was typed, not the cached
   * payload (lib/noteCache.ts).
   */
  renderedAt?: number
  placeholder?: string
  onStatus?: (status: SaveStatus, error: string | null) => void
  /** Sees every change as it happens (before the debounced save). */
  onChange?: (blocks: unknown[]) => void
  className?: string
  allowUploads?: boolean
  /** False for a locked page: read-only, no menus. */
  editable?: boolean
  /** While empty, offer the templates for this kind of note (editor/TemplateBar). */
  templateKind?: TemplateKind
  /** Lets the page replace the content (restoring a version) and move the caret in from its title. */
  editorHandle?: Ref<EditorHandle>
  /** ↑ / Backspace at the very top of the text go back to the page title. */
  onLeaveTop?: () => void
}

/** Notion-style editor that autosaves a second after typing stops. */
export function BlockEditor({
  target,
  initial,
  renderedAt,
  placeholder = '輸入文字，或按 / 插入區塊',
  onStatus,
  onChange: onEdit,
  className,
  allowUploads,
  editable = true,
  templateKind,
  editorHandle,
  onLeaveTop,
}: Props) {
  const { enqueue, status, error } = useSaveQueue()
  // Every editor records its latest document (so a board card edited in the
  // side peek and on its own page share one record); only editors fed by a
  // server render read it back.
  const key = targetKey(target)
  const [start] = useState(() => (renderedAt == null ? initial : withLocal(key, initial, renderedAt)))
  useRenderStamp(key, renderedAt)
  const pending = useRef<unknown[] | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const targetRef = useRef(target)
  const onStatusRef = useRef(onStatus)
  const onEditRef = useRef(onEdit)
  useEffect(() => {
    targetRef.current = target
    onStatusRef.current = onStatus
    onEditRef.current = onEdit
  })

  // Saves in flight, and failed attempts in a row (for the retry backoff).
  const inFlight = useRef(0)
  const failures = useRef(0)
  const closed = useRef(false)
  // The retry timer calls the latest flush (set below).
  const retry = useRef<() => void>(() => {})

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const blocks = pending.current
    pending.current = null
    if (!blocks) return
    const t = targetRef.current
    inFlight.current += 1
    // A failed save (offline, signed out, server hiccup) is tried again with
    // the same document unless newer text is already waiting.
    const retryLater = () => {
      if (closed.current) return
      pending.current ??= blocks
      failures.current += 1
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => retry.current(), RETRY_DELAYS[Math.min(failures.current, RETRY_DELAYS.length) - 1])
    }
    enqueue(async () => {
      try {
        const result = await save(t, blocks)
        if (result.ok) {
          failures.current = 0
          markSaved(key, blocks, result.data?.savedAt)
        } else retryLater()
        return result
      } catch (e) {
        retryLater()
        throw e
      } finally {
        inFlight.current -= 1
      }
    })
  }, [enqueue, key])
  useEffect(() => {
    retry.current = flush
  })

  const onChange = useCallback(
    (blocks: unknown[]) => {
      onEditRef.current?.(blocks)
      rememberLocal(key, blocks)
      pending.current = blocks
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, SAVE_DELAY)
    },
    [flush, key],
  )

  // Never drop the last keystrokes when the tab hides or the panel closes; back
  // online, a failed save goes again at once. Closing or reloading the tab with
  // text not yet saved asks first (the text only lives in this tab until then).
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush()
    const onOnline = () => pending.current && flush()
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!pending.current && !inFlight.current) return
      flush()
      e.preventDefault()
      e.returnValue = '' // Safari still needs this
    }
    closed.current = false
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('online', onOnline)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('beforeunload', onUnload)
      flush()
      // Leaving: this last save is the final try (no retries from a closed editor).
      closed.current = true
      if (timer.current) clearTimeout(timer.current)
    }
  }, [flush])

  useEffect(() => onStatusRef.current?.(status, error), [status, error])

  return (
    <div className="-mx-1">
      <Inner
        initial={start}
        placeholder={placeholder}
        onChange={onChange}
        className={className}
        allowUploads={allowUploads}
        editable={editable}
        templateKind={templateKind}
        handle={editorHandle}
        onLeaveTop={onLeaveTop}
      />
      {/* Editors without their own status line still must not fail silently. */}
      {!onStatus && status === 'error' && (
        <p role="alert" className="mt-2 px-1 text-xs text-red-ink">
          沒有存到：{error}（請確認網路或重新登入）
        </p>
      )}
    </div>
  )
}

export function SaveStatusText({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === 'error') {
    // Short on a phone header (the text itself is saved again by BlockEditor).
    return (
      <span role="alert" title={error ?? undefined} className="text-xs text-red-ink">
        <span className="sm:hidden">沒有存到</span>
        <span className="hidden sm:inline">{error}</span>
      </span>
    )
  }
  if (status === 'saving') return <span className="text-xs text-muted">儲存中…</span>
  if (status === 'saved') return <span className="text-xs text-muted">已儲存</span>
  return <span className="text-xs text-muted">自動儲存</span>
}
