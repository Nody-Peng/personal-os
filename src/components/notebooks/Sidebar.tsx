'use client'

import { ArrowLeft, GearSix, MagnifyingGlass, Plus, Trash, X } from '@phosphor-icons/react'
import Link from 'next/link'
import { NotebookCover } from '@/components/books/BookCover'
import { PageTree } from './PageTree'
import { useNotebook } from './NotebookShell'

/** Notebook header, search, the page tree and the trash. */
export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { notebook, addPage, openSearch, openTrash, openSettings } = useNotebook()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pt-3">
        <Link href="/journal" className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted hover:bg-sunken hover:text-ink-strong">
          <ArrowLeft size={14} />
          書架
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="關閉目錄" className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink-strong">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="group flex items-center gap-3 px-5 pt-4 pb-3">
        <span className="w-7 shrink-0">
          <NotebookCover title={notebook.title} coverColor={notebook.coverColor} pattern={notebook.pattern} size="sm" />
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold text-ink-strong">{notebook.title}</span>
        <button
          type="button"
          onClick={openSettings}
          aria-label="筆記本設定"
          title="筆記本設定"
          className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink-strong"
        >
          <GearSix size={16} />
        </button>
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={openSearch}
          className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-muted hover:bg-sunken hover:text-ink-strong"
        >
          <MagnifyingGlass size={16} />
          <span className="flex-1 text-left">搜尋</span>
          <kbd className="hidden rounded border border-line bg-surface px-1 font-mono text-[10px] md:inline">Ctrl K</kbd>
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between px-5 pb-1">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-faint">頁面</span>
        <button
          type="button"
          onClick={() => addPage(null)}
          aria-label="新增頁面"
          title="新增頁面"
          className="rounded-md p-1 text-muted hover:bg-sunken hover:text-ink-strong"
        >
          <Plus size={14} />
        </button>
      </div>

      <nav aria-label="頁面" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <PageTree />
        <button
          type="button"
          onClick={() => addPage(null)}
          className="mt-1 flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-muted hover:bg-sunken hover:text-ink-strong"
        >
          <Plus size={16} />
          新增頁面
        </button>
      </nav>

      <div className="border-t border-line px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={openTrash}
          className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-muted hover:bg-sunken hover:text-ink-strong"
        >
          <Trash size={16} />
          垃圾桶
        </button>
      </div>
    </div>
  )
}
