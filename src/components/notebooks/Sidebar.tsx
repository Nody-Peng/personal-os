'use client'

import { ArrowLeft, DownloadSimple, FileText, GearSix, Kanban, MagnifyingGlass, Plus, Trash, X } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { createPage, updatePage } from '@/app/(frontend)/notebook-actions'
import { NotebookCover } from '@/components/books/BookCover'
import { ThemeCycleButton } from '@/components/ThemeSwitch'
import { UNTITLED } from '@/lib/notes'
import { NoteIcon } from './NoteIcon'
import { PageTree } from './PageTree'
import { useNotebook } from './NotebookShell'

/** Notebook header, search, favorites, the page tree, import and the trash. */
export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { notebook, pages, currentId, addPage, openSearch, openTrash, openSettings, restored, notify, say } = useNotebook()
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const favorites = pages.filter((p) => p.favorite && p.kind !== 'item')

  /** Markdown / HTML files become new top-level pages (Notion's 匯入). */
  const importFiles = async (files: File[]) => {
    if (!files.length) return
    setImporting(true)
    let last: number | null = null
    try {
      const { parseImport } = await import('@/lib/exportNote')
      for (const file of files) {
        const { title, blocks } = await parseImport(file)
        const created = await createPage(notebook.id, null)
        if (!created.ok || !created.data) throw new Error(created.ok ? '匯入失敗' : created.error)
        const saved = await updatePage(created.data.id, { title, content: blocks })
        if (!saved.ok) throw new Error(saved.error)
        restored([{ ...created.data, title }])
        last = created.data.id
      }
      say(files.length > 1 ? `已匯入 ${files.length} 頁` : '已匯入')
    } catch (error) {
      notify(error instanceof Error ? error.message : '匯入失敗')
    } finally {
      setImporting(false)
    }
    if (last != null) {
      onClose?.()
      router.push(`/notebooks/${notebook.id}/${last}`)
    }
  }

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
          className="flex h-10 w-full items-center gap-2 rounded-md px-2 text-sm text-muted md:h-8 hover:bg-sunken hover:text-ink-strong"
        >
          <MagnifyingGlass size={16} />
          <span className="flex-1 text-left">搜尋</span>
          <kbd className="hidden rounded border border-line bg-surface px-1 font-mono text-[10px] md:inline">Ctrl K</kbd>
        </button>
      </div>

      <nav aria-label="頁面" className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {favorites.length > 0 && (
          <section aria-label="我的最愛" className="mb-3">
            <h2 className="px-2 pt-1 pb-1 text-[11px] font-semibold tracking-[0.08em] text-faint">我的最愛</h2>
            <ul>
              {favorites.map((p) => {
                const active = p.id === currentId
                return (
                  <li key={p.id}>
                    <Link
                      href={`/notebooks/${notebook.id}/${p.id}`}
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-10 items-center gap-2 rounded-md px-2 text-sm transition-colors md:h-8 ${
                        active ? 'bg-surface font-medium text-ink-strong ring-1 ring-line' : 'text-ink hover:bg-sunken'
                      }`}
                    >
                      <span className="grid size-5 shrink-0 place-items-center text-[15px] leading-none text-muted">
                        <NoteIcon icon={p.icon} fallback={p.kind === 'board' ? <Kanban size={16} /> : <FileText size={16} />} />
                      </span>
                      <span className={`truncate ${p.title ? '' : 'text-muted'}`}>{p.title || UNTITLED}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <div className="flex items-center justify-between px-2 pb-1">
          <h2 className="text-[11px] font-semibold tracking-[0.08em] text-faint">頁面</h2>
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
        <PageTree />
        <button
          type="button"
          onClick={() => addPage(null)}
          className="mt-1 flex h-10 w-full items-center gap-2 rounded-md px-2 text-sm text-muted md:h-8 hover:bg-sunken hover:text-ink-strong"
        >
          <Plus size={16} />
          新增頁面
        </button>
      </nav>

      <div className="border-t border-line px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <input
          ref={fileInput}
          type="file"
          accept=".md,.markdown,.txt,.html,.htm,text/markdown,text/plain,text/html"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            void importFiles(files)
          }}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={importing}
          className="flex h-10 w-full items-center gap-2 rounded-md px-2 text-sm text-muted md:h-8 hover:bg-sunken hover:text-ink-strong disabled:opacity-60"
        >
          <DownloadSimple size={16} />
          {importing ? '匯入中…' : '匯入 Markdown／HTML'}
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openTrash}
            className="flex h-10 flex-1 items-center gap-2 rounded-md px-2 text-sm text-muted md:h-8 hover:bg-sunken hover:text-ink-strong"
          >
            <Trash size={16} />
            垃圾桶
          </button>
          <ThemeCycleButton className="size-8 text-muted" />
        </div>
      </div>
    </div>
  )
}
