'use client'

import { ArrowCounterClockwise, FileText } from '@phosphor-icons/react'
import { useEffect, useState, useTransition } from 'react'
import { deletePageForever, listTrash, restorePage, type TrashItem } from '@/app/(frontend)/notebook-actions'
import { TRASH_DAYS, UNTITLED } from '@/lib/notes'
import { Modal } from './Modal'
import { useNotebook } from './NotebookShell'
import { NoteIcon } from './NoteIcon'

function ago(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (minutes < 1) return '剛剛'
  if (minutes < 60) return `${minutes} 分鐘前`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} 小時前`
  return `${Math.round(hours / 24)} 天前`
}

/** This notebook's trashed pages: restore them, or delete them for good. */
export function TrashDialog({ onClose }: { onClose: () => void }) {
  const { notebook, restored } = useNotebook()
  const [items, setItems] = useState<TrashItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let alive = true
    listTrash(notebook.id).then((result) => {
      if (!alive) return
      if (result.ok) setItems(result.data ?? [])
      else setError(result.error)
    })
    return () => {
      alive = false
    }
  }, [notebook.id])

  const restore = (id: number) =>
    startTransition(async () => {
      const result = await restorePage(id)
      if (!result.ok) return setError(result.error)
      restored(result.data ?? [])
      setItems((list) => list?.filter((i) => i.id !== id) ?? null)
    })

  const destroy = (id: number) =>
    startTransition(async () => {
      const result = await deletePageForever(id)
      if (!result.ok) return setError(result.error)
      setItems((list) => list?.filter((i) => i.id !== id) ?? null)
      setConfirm(null)
    })

  return (
    <Modal title="垃圾桶" onClose={onClose}>
      <p className="border-b border-line px-5 py-3 text-xs text-muted">刪除的頁面會連同子頁面一起放在這裡，{TRASH_DAYS} 天後自動永久刪除。</p>
      {!items && !error && <div className="m-5 h-24 animate-pulse rounded-lg bg-sunken" />}
      {items && !items.length && <p className="px-5 py-10 text-center text-sm text-muted">垃圾桶是空的</p>}
      {items && items.length > 0 && (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-5 py-3">
              <span className="grid size-5 shrink-0 place-items-center text-base leading-none text-muted"><NoteIcon icon={item.icon} fallback={<FileText size={18} />} /></span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate ${item.title ? 'text-ink-strong' : 'text-muted'}`}>{item.title || UNTITLED}</span>
                <span className="text-xs text-muted">
                  {ago(item.deletedAt)}刪除{item.childCount > 0 && ` · 含 ${item.childCount} 個子頁面`}
                </span>
              </span>
              {confirm === item.id ? (
                <span className="flex shrink-0 gap-1">
                  <button type="button" className="btn bg-red-soft py-1 text-red-ink" disabled={pending} onClick={() => destroy(item.id)}>
                    永久刪除
                  </button>
                  <button type="button" className="btn py-1 text-muted hover:bg-sunken" onClick={() => setConfirm(null)}>
                    取消
                  </button>
                </span>
              ) : (
                <span className="flex shrink-0 gap-1">
                  <button type="button" className="btn btn-quiet py-1" disabled={pending} onClick={() => restore(item.id)}>
                    <ArrowCounterClockwise size={14} />
                    還原
                  </button>
                  <button type="button" className="btn py-1 text-muted hover:bg-sunken hover:text-red-ink" onClick={() => setConfirm(item.id)}>
                    刪除
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="px-5 py-3 text-sm text-red-ink">
          {error}
        </p>
      )}
    </Modal>
  )
}
