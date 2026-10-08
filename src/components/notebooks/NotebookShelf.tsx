'use client'

import { ArrowCounterClockwise, CaretDown, MagnifyingGlass, Plus } from '@phosphor-icons/react'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { updateNotebook } from '@/app/(frontend)/notebook-actions'
import { NotebookCover } from '@/components/books/BookCover'
import { BookLink } from '@/components/books/BookOpener'
import type { NotebookItem } from '@/lib/notes'
import { openSearch } from '@/components/search/GlobalSearch'
import { NotebookDialog } from './NotebookDialog'

/** The lower shelf: notebooks you make yourself, plus a blank book to add one. */
export function NotebookShelf({ notebooks, offset }: { notebooks: NotebookItem[]; offset: number }) {
  const [creating, setCreating] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const active = notebooks.filter((n) => !n.archived)
  const archived = notebooks.filter((n) => n.archived)

  const unarchive = (id: number) =>
    startTransition(async () => {
      const result = await updateNotebook(id, { archived: false })
      setError(result.ok ? null : result.error)
    })

  return (
    <section aria-labelledby="notebooks-heading" className="mt-16 md:mt-20">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-muted">自己新增</p>
          <h2 id="notebooks-heading" className="mt-1 text-xl font-semibold tracking-tight text-ink-strong">
            筆記本
          </h2>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-quiet" onClick={openSearch}>
            <MagnifyingGlass size={16} />
            搜尋
            <kbd className="ml-1 hidden rounded border border-line bg-canvas px-1 font-mono text-[10px] text-muted md:inline">Ctrl K</kbd>
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} weight="bold" />
            新增
          </button>
        </div>
      </div>

      <ul className="grid grid-cols-2 items-end gap-x-6 gap-y-14 sm:grid-cols-3 md:grid-cols-4 md:gap-x-10">
        {active.map((n, i) => (
          <li key={n.id} className="rise" style={{ '--i': offset + i } as React.CSSProperties}>
            <BookLink href={`/notebooks/${n.id}`} label={`打開 ${n.title}`}>
              <NotebookCover title={n.title} coverColor={n.coverColor} pattern={n.pattern} pageCount={n.pageCount} />
            </BookLink>
            <div className="mt-4 h-2 rounded-sm bg-line-strong shadow-[0_6px_10px_-6px_rgba(17,17,17,0.35)]" aria-hidden />
          </li>
        ))}
        <li className="rise" style={{ '--i': offset + active.length } as React.CSSProperties}>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="group flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-r-md rounded-l-[3px] border border-dashed border-line-strong text-muted transition-colors hover:border-ink/40 hover:bg-surface hover:text-ink-strong"
          >
            <Plus size={22} />
            <span className="text-sm">新增筆記本</span>
          </button>
          <div className="mt-4 h-2 rounded-sm bg-line-strong shadow-[0_6px_10px_-6px_rgba(17,17,17,0.35)]" aria-hidden />
        </li>
      </ul>

      {archived.length > 0 && (
        <div className="mt-12 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-ink-strong"
          >
            <CaretDown size={14} className={`transition-transform ${showArchived ? '' : '-rotate-90'}`} />
            已封存的筆記本（{archived.length}）
          </button>
          {showArchived && (
            <ul className="mt-3 divide-y divide-line">
              {archived.map((n) => (
                <li key={n.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-7 shrink-0">
                    <NotebookCover title={n.title} coverColor={n.coverColor} pattern={n.pattern} size="sm" />
                  </span>
                  <Link href={`/notebooks/${n.id}`} className="min-w-0 flex-1 truncate text-ink hover:underline">
                    {n.title}
                  </Link>
                  <span className="text-xs text-muted">{n.pageCount} 頁</span>
                  <button type="button" className="btn btn-quiet py-1" disabled={pending} onClick={() => unarchive(n.id)}>
                    <ArrowCounterClockwise size={14} />
                    放回書架
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-ink">
              {error}
            </p>
          )}
        </div>
      )}

      {creating && <NotebookDialog onClose={() => setCreating(false)} />}
    </section>
  )
}
