'use client'

import { ArrowDown, ArrowUp, Check, Plus, Trash } from '@phosphor-icons/react'
import { useState } from 'react'
import { createShelf, deleteShelf, renameShelf, reorderShelves, setBookShelves } from '@/app/(frontend)/book-actions'
import { Modal } from '@/components/notebooks/Modal'
import type { BookSummary, Shelf } from '@/lib/books'

/** Typing a name and pressing Enter (or 新增) creates a category. */
function NewShelfField({ onCreated, autoFocus }: { onCreated: (shelf: Shelf) => void; autoFocus?: boolean }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    const r = await createShelf(name)
    setBusy(false)
    if (!r.ok) return setError(r.error)
    setName('')
    setError(null)
    onCreated(r.data!)
  }
  return (
    <div className="grid gap-1.5">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新分類，例如：小說、英文原文書"
          maxLength={40}
          aria-label="新分類名稱"
          className="field h-10 py-0 text-sm"
          data-autofocus={autoFocus ? true : undefined}
        />
        <button type="submit" disabled={!name.trim() || busy} className="btn btn-primary h-10 shrink-0">
          <Plus size={15} weight="bold" />
          新增
        </button>
      </form>
      {error && <p className="text-xs text-red-ink">{error}</p>}
    </div>
  )
}

/** Add, rename, reorder and delete categories. */
export function ManageShelves({ shelves, counts, onClose, onChanged }: {
  shelves: Shelf[]
  counts: Map<number, number>
  onClose: () => void
  onChanged: () => void
}) {
  const [list, setList] = useState(shelves)
  const [confirming, setConfirming] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: Promise<{ ok: boolean; error?: string }>) => {
    const r = await action
    if (!r.ok) setError(r.error ?? '發生錯誤')
    else onChanged()
  }

  const move = (index: number, delta: -1 | 1) => {
    const next = [...list]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    setList(next)
    void run(reorderShelves(next.map((s) => s.id)))
  }

  return (
    <Modal title="管理分類" onClose={onClose}>
      <div className="grid gap-4 p-5">
        <NewShelfField autoFocus onCreated={(shelf) => {
            setList((l) => [...l, shelf])
            onChanged()
          }}
        />
        {list.length > 0 ? (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {list.map((shelf, i) => (
              <li key={shelf.id} className="flex items-center gap-1 px-2 py-1.5">
                <input
                  defaultValue={shelf.name}
                  maxLength={40}
                  aria-label={`分類名稱：${shelf.name}`}
                  onBlur={(e) => {
                    const name = e.target.value.trim()
                    if (name && name !== shelf.name) {
                      setList((l) => l.map((s) => (s.id === shelf.id ? { ...s, name } : s)))
                      void run(renameShelf(shelf.id, name))
                    } else e.target.value = shelf.name
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  className="h-9 min-w-0 flex-1 rounded-md bg-transparent px-2 text-sm text-ink-strong hover:bg-sunken focus:bg-surface focus:ring-2 focus:ring-accent-soft focus:outline-none"
                />
                <span className="w-10 text-right font-mono text-[11px] text-faint tabular-nums">{counts.get(shelf.id) ?? 0} 本</span>
                <button type="button" aria-label="往上" disabled={i === 0} onClick={() => move(i, -1)} className="rounded-md p-1.5 text-muted hover:bg-sunken disabled:opacity-30">
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  aria-label="往下"
                  disabled={i === list.length - 1}
                  onClick={() => move(i, 1)}
                  className="rounded-md p-1.5 text-muted hover:bg-sunken disabled:opacity-30"
                >
                  <ArrowDown size={14} />
                </button>
                {confirming === shelf.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(null)
                      setList((l) => l.filter((s) => s.id !== shelf.id))
                      void run(deleteShelf(shelf.id))
                    }}
                    className="rounded-md bg-red-soft px-2 py-1 text-xs font-medium text-red-ink"
                  >
                    確定刪除
                  </button>
                ) : (
                  <button type="button" aria-label={`刪除分類 ${shelf.name}`} onClick={() => setConfirming(shelf.id)} className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-red-ink">
                    <Trash size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">還沒有分類。分類只是標籤：一本書可以放進好幾個分類，刪掉分類不會刪到書。</p>
        )}
        {error && <p className="text-sm text-red-ink">{error}</p>}
      </div>
    </Modal>
  )
}

/** Which categories one book is in; each tick saves right away. */
export function ShelfPicker({ book, shelves, onClose, onChanged }: {
  book: BookSummary
  shelves: Shelf[]
  onClose: () => void
  onChanged: () => void
}) {
  const [all, setAll] = useState(shelves)
  const [chosen, setChosen] = useState(() => new Set(book.shelves))
  const [error, setError] = useState<string | null>(null)

  const save = async (next: Set<number>) => {
    const before = chosen
    setChosen(next)
    const r = await setBookShelves(book.id, [...next])
    if (!r.ok) {
      setChosen(before)
      setError(r.error)
    } else onChanged()
  }
  const toggle = (id: number) => {
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    void save(next)
  }

  return (
    <Modal title={`《${book.title}》的分類`} onClose={onClose}>
      <div className="grid gap-4 p-5">
        {all.length > 0 && (
          <ul className="grid gap-1">
            {all.map((shelf) => {
              const on = chosen.has(shelf.id)
              return (
                <li key={shelf.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(shelf.id)}
                    className="flex h-10 w-full items-center gap-3 rounded-lg px-2 text-left text-sm text-ink-strong transition-colors hover:bg-sunken"
                  >
                    <span
                      className={`grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors ${
                        on ? 'border-accent bg-accent text-on-ink' : 'border-line-strong'
                      }`}
                    >
                      {on && <Check size={12} weight="bold" />}
                    </span>
                    {shelf.name}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <NewShelfField
          autoFocus={all.length === 0}
          onCreated={(shelf) => {
            setAll((l) => [...l, shelf])
            void save(new Set([...chosen, shelf.id]))
          }}
        />
        {error && <p className="text-sm text-red-ink">{error}</p>}
      </div>
    </Modal>
  )
}
