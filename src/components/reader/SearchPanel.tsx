'use client'

import { MagnifyingGlass, X } from '@phosphor-icons/react'
import type { Book } from 'epubjs'
import { Fragment, useEffect, useRef, useState } from 'react'

// Search the whole book: each chapter is loaded, searched (epub.js matches
// across inline elements), and let go again, so big books don't stay in memory.

export type SearchHit = { cfi: string; excerpt: string; sectionIndex: number }

type Section = {
  index: number
  load: (request: unknown) => Promise<unknown>
  unload: () => void
  search?: (query: string) => { cfi: string; excerpt: string }[]
  find: (query: string) => { cfi: string; excerpt: string }[]
}

const MAX_HITS = 300

function Excerpt({ text, query }: { text: string; query: string }) {
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  const parts: { text: string; hit: boolean }[] = []
  let at = 0
  for (let i = lower.indexOf(q); q && i !== -1; i = lower.indexOf(q, i + q.length)) {
    if (i > at) parts.push({ text: text.slice(at, i), hit: false })
    parts.push({ text: text.slice(i, i + q.length), hit: true })
    at = i + q.length
  }
  parts.push({ text: text.slice(at), hit: false })
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-[3px] bg-[var(--r-accent)]/20 px-0.5 text-[var(--r-ink)]">
            {p.text}
          </mark>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  )
}

export function SearchPanel({
  book,
  chapterLabel,
  onGo,
  onClose,
}: {
  book: Book
  chapterLabel: (sectionIndex: number) => string
  onGo: (hit: SearchHit) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const q = submitted.trim()
    if (!q) return
    let cancelled = false
    const sections = (book.spine as unknown as { spineItems: Section[] }).spineItems
    ;(async () => {
      const found: SearchHit[] = []
      for (const [i, section] of sections.entries()) {
        if (cancelled) return
        setProgress({ done: i, total: sections.length })
        try {
          await section.load(book.load.bind(book))
          const results = section.search ? section.search(q) : section.find(q)
          for (const r of results) found.push({ cfi: r.cfi, excerpt: r.excerpt.trim(), sectionIndex: section.index })
        } catch {
          // A chapter that won't load is skipped.
        } finally {
          section.unload()
        }
        if (cancelled) return
        setHits([...found])
        if (found.length >= MAX_HITS) break
      }
      setProgress(null)
    })()
    return () => {
      cancelled = true
    }
  }, [book, submitted])

  const searching = progress !== null

  return (
    <>
      <button type="button" aria-label="關閉搜尋" onClick={onClose} className="modal-scrim fixed inset-0 z-40 bg-black/25 md:hidden" />
      <aside
        aria-label="搜尋全書"
        className="reader-pop fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl border border-[var(--r-line)] bg-[var(--r-surface)] text-[var(--r-ink)] shadow-[0_-24px_60px_-30px_rgba(0,0,0,0.35)] md:inset-x-auto md:top-14 md:right-4 md:bottom-4 md:max-h-none md:w-[380px] md:rounded-2xl md:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.35)]"
      >
        <form
          className="flex items-center gap-2 border-b border-[var(--r-line)] p-3"
          onSubmit={(e) => {
            e.preventDefault()
            setHits([])
            setActive(null)
            setSubmitted(query)
          }}
        >
          <label className="relative flex flex-1 items-center">
            <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 text-[var(--r-muted)]" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋全書，按 Enter"
              aria-label="搜尋全書"
              className="h-10 w-full rounded-lg border border-[var(--r-line)] bg-transparent pr-3 pl-9 text-sm outline-none focus:border-[var(--r-accent)]"
            />
          </label>
          <button type="button" onClick={onClose} aria-label="關閉" className="rounded-md p-2 text-[var(--r-muted)] hover:bg-[var(--r-sunken)]">
            <X size={16} />
          </button>
        </form>

        <div className="flex items-center justify-between px-4 py-2 font-mono text-[11px] text-[var(--r-muted)]">
          <span>
            {progress
              ? `搜尋中 ${progress.done + 1} / ${progress.total} 章`
              : submitted.trim()
                ? `${hits.length >= MAX_HITS ? `${MAX_HITS}+` : hits.length} 筆結果`
                : '輸入字詞後按 Enter'}
          </span>
          {progress && (
            <span className="h-px w-24 bg-[var(--r-line)]">
              <span className="block h-px bg-[var(--r-accent)] transition-[width] duration-200" style={{ width: `${((progress.done + 1) / progress.total) * 100}%` }} />
            </span>
          )}
        </div>

        <ol className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          {hits.map((hit, i) => {
            const previous = hits[i - 1]
            const newChapter = !previous || previous.sectionIndex !== hit.sectionIndex
            return (
              <li key={`${hit.cfi}-${i}`}>
                {newChapter && <p className="truncate px-3 pt-3 pb-1 text-[11px] font-medium text-[var(--r-muted)]">{chapterLabel(hit.sectionIndex)}</p>}
                <button
                  type="button"
                  onClick={() => {
                    setActive(hit.cfi)
                    onGo(hit)
                  }}
                  aria-current={active === hit.cfi ? 'true' : undefined}
                  className={`w-full rounded-lg px-3 py-2 text-left text-[13px] leading-relaxed transition-colors hover:bg-[var(--r-sunken)] ${
                    active === hit.cfi ? 'bg-[var(--r-sunken)]' : ''
                  }`}
                >
                  <span className="line-clamp-3">
                    <Excerpt text={hit.excerpt} query={submitted.trim()} />
                  </span>
                </button>
              </li>
            )
          })}
          {!searching && submitted.trim() && hits.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-[var(--r-muted)]">找不到「{submitted.trim()}」</li>
          )}
        </ol>
      </aside>
    </>
  )
}
