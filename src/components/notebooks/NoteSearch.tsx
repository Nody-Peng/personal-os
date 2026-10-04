'use client'

import { FileText, MagnifyingGlass } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { searchNotes, type SearchHit } from '@/app/(frontend)/notebook-actions'
import { UNTITLED } from '@/lib/notes'
import { Modal } from './Modal'

const DEBOUNCE = 220

/** Ctrl/⌘ K anywhere the hook is mounted. */
export function useSearchShortcut(onOpen: () => void) {
  const ref = useRef(onOpen)
  useEffect(() => {
    ref.current = onOpen
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ref.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
}

function Highlight({ text, query }: { text: string; query: string }) {
  const words = query.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return <>{text}</>
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return (
    <>
      {text.split(pattern).map((part, i) =>
        i % 2 ? (
          <mark key={i} className="rounded-[3px] bg-accent-soft px-0.5 text-ink-strong">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  )
}

/** Full-text search across every notebook. */
export function NoteSearch({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  // The last finished search; results for an older query read as "loading".
  const [result, setResult] = useState<{ query: string; hits: SearchHit[]; ok: boolean }>({ query: '', hits: [], ok: true })
  const [active, setActive] = useState(0)
  const q = query.trim()

  useEffect(() => {
    if (!q) return
    let alive = true
    const timer = window.setTimeout(async () => {
      const found = await searchNotes(q)
      if (!alive) return
      setResult({ query: q, hits: found.ok ? (found.data ?? []) : [], ok: found.ok })
      setActive(0)
    }, DEBOUNCE)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [q])

  const state = !q ? 'idle' : result.query !== q ? 'loading' : result.ok ? 'done' : 'error'
  const hits = state === 'idle' ? [] : result.hits

  const go = (hit: SearchHit | undefined) => {
    if (!hit) return
    router.push(`/notebooks/${hit.notebookId}/${hit.id}`)
    onClose()
  }

  return (
    <Modal title="搜尋筆記" onClose={onClose} size="lg" hideTitle>
      <div className="flex items-center gap-3 border-b border-line px-4">
        <MagnifyingGlass size={18} className="shrink-0 text-muted" />
        <input
          data-autofocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(hits.length - 1, a + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(0, a - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              go(hits[active])
            }
          }}
          placeholder="搜尋所有筆記本的標題和內容"
          aria-label="搜尋"
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls="note-search-results"
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink-strong outline-none placeholder:text-muted"
        />
        <kbd className="hidden rounded border border-line bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-muted md:block">Esc</kbd>
      </div>

      <ul id="note-search-results" role="listbox" className="max-h-[60dvh] overflow-y-auto p-2">
        {hits.map((hit, i) => (
          <li key={hit.id} role="option" aria-selected={i === active}>
            <button
              type="button"
              onClick={() => go(hit)}
              onMouseMove={() => setActive(i)}
              className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left ${i === active ? 'bg-sunken' : ''}`}
            >
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center text-base leading-none text-muted">
                {hit.icon || <FileText size={18} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate font-medium text-ink-strong">
                    <Highlight text={hit.title || UNTITLED} query={query} />
                  </span>
                  <span className="shrink-0 text-xs text-muted">{hit.notebookTitle}</span>
                </span>
                {hit.snippet && (
                  <span className="mt-0.5 line-clamp-2 text-sm text-muted">
                    <Highlight text={hit.snippet} query={query} />
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {state === 'done' && !hits.length && <p className="px-5 pb-6 text-sm text-muted">找不到符合「{q}」的頁面。</p>}
      {state === 'error' && <p className="px-5 pb-6 text-sm text-red-ink">搜尋失敗，請再試一次。</p>}
      {state === 'idle' && <p className="px-5 pb-6 text-sm text-muted">輸入關鍵字，多個字詞用空格分開。</p>}
    </Modal>
  )
}
