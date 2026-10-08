'use client'

import { ClockCounterClockwise } from '@phosphor-icons/react'
import { useEffect, useState, useTransition } from 'react'
import { getSnapshot, listSnapshots, snapshotPage, type SnapshotItem } from '@/app/(frontend)/notebook-actions'
import { Modal } from './Modal'

const when = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * A page's earlier versions (kept while it's edited, at most every ten
 * minutes): read one, and put it back. Restoring keeps the current text as a
 * version first, so it can be undone the same way.
 */
export function HistoryDialog({
  pageId,
  locked,
  onRestore,
  onClose,
}: {
  pageId: number
  locked: boolean
  onRestore: (content: unknown[], at: string) => void
  onClose: () => void
}) {
  const [items, setItems] = useState<SnapshotItem[] | null>(null)
  const [chosen, setChosen] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let alive = true
    listSnapshots(pageId).then((result) => {
      if (!alive) return
      if (result.ok) {
        setItems(result.data ?? [])
        setChosen(result.data?.[0]?.id ?? null)
      } else setError(result.error)
    })
    return () => {
      alive = false
    }
  }, [pageId])

  const item = items?.find((i) => i.id === chosen)

  const restore = () =>
    startTransition(async () => {
      if (!item) return
      const kept = await snapshotPage(pageId)
      if (!kept.ok) return setError(kept.error)
      const snapshot = await getSnapshot(item.id)
      if (!snapshot.ok || !snapshot.data) return setError(snapshot.ok ? '讀不到這個版本' : snapshot.error)
      onRestore(snapshot.data.content, when.format(new Date(item.createdAt)))
      onClose()
    })

  return (
    <Modal title="版本紀錄" onClose={onClose} size="lg">
      {items === null && !error && <div className="m-5 h-40 animate-pulse rounded-lg bg-sunken" />}
      {items?.length === 0 && (
        <p className="px-5 pt-2 pb-6 text-sm text-muted">
          還沒有較早的版本。編輯這一頁時，每隔十分鐘會保留一份當時的內容（最多 50 份）。
        </p>
      )}
      {items && items.length > 0 && (
        <div className="grid gap-0 md:grid-cols-[13rem_1fr]">
          <ul className="max-h-[50dvh] overflow-y-auto border-line p-2 md:max-h-[60dvh] md:border-r">
            {items.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => setChosen(i.id)}
                  aria-pressed={i.id === chosen}
                  className={`flex w-full flex-col items-start rounded-lg px-3 py-2 text-left transition-colors ${i.id === chosen ? 'bg-sunken' : 'hover:bg-sunken/60'}`}
                >
                  <span className="text-sm text-ink-strong">{when.format(new Date(i.createdAt))}</span>
                  <span className="text-xs text-muted">{i.words.toLocaleString()} 字</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex min-h-0 flex-col p-4">
            {item && (
              <>
                <p className="mb-2 text-xs text-muted">
                  {item.title ? `「${item.title}」· ` : ''}
                  前幾行內容
                </p>
                <p className="max-h-[40dvh] flex-1 overflow-y-auto rounded-lg border border-line bg-canvas px-3 py-2 text-sm leading-relaxed whitespace-pre-line text-ink md:max-h-[48dvh]">
                  {item.preview || '（這個版本只有圖片或其他區塊）'}
                </p>
                <div className="mt-3 flex items-center justify-end gap-3">
                  {locked && <span className="text-xs text-faint">頁面已鎖定，解除鎖定後才能還原</span>}
                  <button type="button" className="btn btn-primary" disabled={locked || pending} onClick={restore}>
                    <ClockCounterClockwise size={16} />
                    {pending ? '還原中…' : '還原這個版本'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="px-5 pb-4 text-sm text-red-ink">
          {error}
        </p>
      )}
    </Modal>
  )
}
