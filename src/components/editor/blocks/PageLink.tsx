'use client'

import { ArrowUpRight, FileDashed, FileText, Kanban, MagnifyingGlass } from '@phosphor-icons/react'
import { createReactBlockSpec } from '@blocknote/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { findPages, type PageLinkInfo } from '@/app/(frontend)/notebook-actions'
import { primePageLink, usePageLink } from '@/lib/pageLinks'
import { UNTITLED } from '@/lib/notes'
import { useNoteContext } from '../NoteContext'
import { NoteIcon } from '@/components/notebooks/NoteIcon'

/**
 * A page inside the text. `child` is a sub-page created right here (it also
 * lives under this page in the tree); `link` points at any page in any notebook.
 * pageId 0 = not chosen yet (a picker for links, "creating…" for sub-pages).
 */
export const PageLink = createReactBlockSpec(
  {
    type: 'pageLink',
    propSchema: {
      pageId: { default: 0 },
      mode: { default: 'child', values: ['child', 'link'] as const },
    },
    content: 'none',
  },
  {
    render: function PageLinkView({ block, editor }) {
      const ctx = useNoteContext()
      const router = useRouter()
      const { pageId, mode } = block.props
      const local = ctx?.pages.find((p) => p.id === pageId)
      const remote = usePageLink(pageId, Boolean(local) || pageId <= 0)

      if (pageId <= 0) {
        if (mode === 'link' && editor.isEditable) {
          return (
            <LinkPicker
              exclude={ctx?.pageId}
              onPick={(page) => {
                primePageLink(page)
                editor.updateBlock(block, { props: { pageId: page.id } })
              }}
              onCancel={() => editor.removeBlocks([block])}
            />
          )
        }
        return <div className="note-pagelink text-muted">建立頁面中…</div>
      }

      const info = local
        ? { title: local.title, icon: local.icon, kind: local.kind, notebookId: ctx!.notebookId, notebookTitle: '' }
        : remote && remote !== 'missing'
          ? remote
          : null

      if (!info) {
        return remote === 'missing' ? (
          <div className="note-pagelink text-faint" contentEditable={false}>
            <FileDashed size={18} />
            <span>頁面已刪除或在垃圾桶裡</span>
          </div>
        ) : (
          <div className="note-pagelink" contentEditable={false}>
            <span className="h-4 w-40 animate-pulse rounded bg-sunken" />
          </div>
        )
      }

      const href = `/notebooks/${info.notebookId}/${pageId}`
      const otherBook = info.notebookId !== ctx?.notebookId
      return (
        <a
          href={href}
          contentEditable={false}
          className="note-pagelink"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey) return
            e.preventDefault()
            // Board cards open beside the page, like on the board.
            if (info.kind === 'item' && !otherBook && ctx) ctx.openPeek(pageId)
            else router.push(href)
          }}
        >
          <span className="relative grid size-5 shrink-0 place-items-center text-base leading-none text-muted">
            <NoteIcon icon={info.icon} fallback={info.kind === 'board' ? <Kanban size={18} /> : <FileText size={18} />} />
            {mode === 'link' && (
              <ArrowUpRight size={10} weight="bold" className="absolute -right-1 -bottom-0.5 rounded-sm bg-surface text-ink" />
            )}
          </span>
          <span className={`truncate underline decoration-line-strong underline-offset-4 ${info.title ? 'text-ink-strong' : 'text-muted'}`}>
            {info.title || UNTITLED}
          </span>
          {otherBook && info.notebookTitle && <span className="shrink-0 text-xs text-muted">{info.notebookTitle}</span>}
        </a>
      )
    },
  },
)

/** Inline search for "link to page": any notebook, by title. */
function LinkPicker({ exclude, onPick, onCancel }: { exclude?: number; onPick: (page: PageLinkInfo) => void; onCancel: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PageLinkInfo[]>([])
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
  }, [])

  useEffect(() => {
    let alive = true
    const timer = window.setTimeout(async () => {
      const found = await findPages(query)
      if (!alive) return
      setResults(found.ok ? (found.data ?? []).filter((p) => p.id !== exclude) : [])
      setActive(0)
    }, 180)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [query, exclude])

  return (
    <div className="note-linkpicker" contentEditable={false} data-own-escape>
      <div className="flex items-center gap-2 border-b border-line px-3">
        <MagnifyingGlass size={16} className="text-muted" />
        <input
          ref={input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(results.length - 1, a + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(0, a - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              if (results[active]) onPick(results[active])
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            }
          }}
          placeholder="連結到哪一頁？輸入標題搜尋所有筆記本"
          aria-label="搜尋要連結的頁面"
          className="h-10 min-w-0 flex-1 bg-transparent text-sm text-ink-strong outline-none placeholder:text-muted"
        />
        <button type="button" onClick={onCancel} className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-sunken">
          取消
        </button>
      </div>
      <ul className="max-h-64 overflow-y-auto p-1">
        {results.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              onMouseMove={() => setActive(i)}
              onClick={() => onPick(p)}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm ${i === active ? 'bg-sunken' : ''}`}
            >
              <span className="grid size-5 place-items-center text-base leading-none text-muted">
                <NoteIcon icon={p.icon} fallback={p.kind === 'board' ? <Kanban size={16} /> : <FileText size={16} />} />
              </span>
              <span className={`truncate ${p.title ? 'text-ink-strong' : 'text-muted'}`}>{p.title || UNTITLED}</span>
              <span className="ml-auto shrink-0 text-xs text-muted">{p.notebookTitle}</span>
            </button>
          </li>
        ))}
        {!results.length && <li className="px-3 py-2 text-sm text-muted">{query.trim() ? '找不到符合的頁面' : '還沒有頁面'}</li>}
      </ul>
    </div>
  )
}
