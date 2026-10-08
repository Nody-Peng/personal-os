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
  /** Lets the page replace the content (restoring a version). */
  editorHandle?: Ref<EditorHandle>
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

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const blocks = pending.current
    pending.current = null
    if (blocks) {
      const t = targetRef.current
      enqueue(async () => {
        const result = await save(t, blocks)
        if (result.ok) markSaved(key, blocks)
        return result
      })
    }
  }, [enqueue, key])

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
      <Inner
        initial={start}
        placeholder={placeholder}
        onChange={onChange}
        className={className}
        allowUploads={allowUploads}
        editable={editable}
        templateKind={templateKind}
        handle={editorHandle}
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
  if (status === 'error') return <span role="alert" className="text-xs text-red-ink">{error}</span>
  if (status === 'saving') return <span className="text-xs text-muted">儲存中…</span>
  if (status === 'saved') return <span className="text-xs text-muted">已儲存</span>
  return <span className="text-xs text-muted">自動儲存</span>
}
