'use client'

import { ArrowRight, BookOpenText, CheckCircle, CircleNotch, UploadSimple, WarningCircle, X } from '@phosphor-icons/react'
import { useState, type CSSProperties } from 'react'
import { renameBook } from '@/app/(frontend)/book-actions'
import { BookLink } from '@/components/books/BookOpener'
import { Modal } from '@/components/notebooks/Modal'
import { percentOf, statusOf, type BookSummary } from '@/lib/books'
import { EbookCover } from './EbookCover'

// Pieces of the library page (Library.tsx).

export type Stage = 'waiting' | 'reading' | 'cover' | 'uploading' | 'done' | 'skipped' | 'error'
export type Job = { key: string; file: File; stage: Stage; error?: string }

const STAGE_TEXT: Record<Stage, string> = {
  waiting: '排隊中',
  reading: '讀取書名和封面',
  cover: '上傳封面',
  uploading: '上傳中',
  done: '已加入',
  skipped: '書庫裡已經有了',
  error: '失敗',
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso)
  const min = Math.round(diff / 60_000)
  if (min < 2) return '剛剛'
  if (min < 60) return `${min} 分鐘前`
  const hours = Math.round(min / 60)
  if (hours < 24) return `${hours} 小時前`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' })
}

function sizeText(bytes: number | null) {
  if (!bytes) return ''
  return bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`
}

export function ShelfProgress({ book }: { book: BookSummary }) {
  const status = statusOf(book)
  if (status === 'finished') {
    return (
      <p className="mt-2 flex items-center gap-1 text-[11px] text-green-ink">
        <CheckCircle size={13} weight="fill" />
        讀完了
      </p>
    )
  }
  if (status === 'unread') return <p className="mt-2 font-mono text-[11px] text-faint">未讀</p>
  return (
    <div className="mt-2.5 flex items-center gap-2">
      <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-line">
        <span className="block h-full rounded-full bg-accent" style={{ width: percentOf(book.progress) }} />
      </span>
      <span className="font-mono text-[11px] text-muted tabular-nums">{percentOf(book.progress)}</span>
    </div>
  )
}

/** The book read last, large: cover on one side, the way back in on the other. */
export function ContinueReading({ book }: { book: BookSummary }) {
  return (
    <section aria-label="繼續閱讀" className="rise mb-16 grid grid-cols-[minmax(0,7.5rem)_1fr] items-end gap-6 border-b border-line pb-12 sm:grid-cols-[minmax(0,11rem)_1fr] md:mb-20 md:gap-12 md:pb-16">
      <div className="relative">
        <BookLink href={`/books/${book.id}`} label={`繼續讀《${book.title}》`}>
          <EbookCover title={book.title} author={book.author} coverUrl={book.coverUrl} size="lg" />
        </BookLink>
        <div className="mt-3 h-2 rounded-sm bg-line-strong shadow-[0_6px_10px_-6px_rgba(17,17,17,0.35)]" aria-hidden />
      </div>
      <div className="min-w-0 pb-5">
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">繼續讀 · {relativeTime(book.lastReadAt!)}</p>
        <h2 className="mt-3 line-clamp-3 font-serif text-2xl leading-tight font-semibold tracking-tight text-ink-strong md:text-[2.5rem]">
          {book.title}
        </h2>
        {book.author && <p className="mt-2 truncate text-sm text-muted md:text-base">{book.author}</p>}
        <div className="mt-6 flex max-w-md items-center gap-3">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-line">
            <span className="block h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: percentOf(book.progress) }} />
          </span>
          <span className="font-mono text-xs text-muted tabular-nums">{percentOf(book.progress)}</span>
        </div>
        <BookLink href={`/books/${book.id}`} label={`繼續讀《${book.title}》`}>
          <span className="btn btn-primary mt-6 hidden sm:inline-flex">
            接著讀
            <ArrowRight size={15} />
          </span>
        </BookLink>
      </div>
    </section>
  )
}

export function EmptyLibrary({ onPick }: { onPick: () => void }) {
  return (
    <section className="grid items-center gap-12 border-y border-line py-14 md:grid-cols-[1.1fr_1fr] md:py-20">
      <div className="max-w-md">
        <BookOpenText size={28} className="text-muted" />
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-ink-strong">書庫還是空的</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          點下面的按鈕選 EPUB 檔，或直接把檔案拖進這個頁面。一次可以放很多本；書名、作者和封面會自動讀出來。
        </p>
        <button type="button" onClick={onPick} className="btn btn-primary mt-7">
          <UploadSimple size={16} />
          選擇 EPUB 檔
        </button>
        <p className="mt-4 font-mono text-[11px] text-faint">每本 50 MB 以內 · 存在你自己的 Supabase Storage</p>
      </div>
      <div className="relative mx-auto hidden h-64 w-full max-w-sm md:block" aria-hidden>
        {[
          { left: '8%', rotate: -8, delay: 0 },
          { left: '34%', rotate: 2, delay: 120 },
          { left: '58%', rotate: 9, delay: 240 },
        ].map((b, i) => (
          <span
            key={i}
            className="empty-book absolute bottom-0 aspect-[2/3] w-[34%] rounded-r-md rounded-l-sm border border-line-strong bg-surface"
            style={{ left: b.left, '--r': `${b.rotate}deg`, animationDelay: `${b.delay}ms` } as CSSProperties}
          >
            <span className="absolute inset-y-0 left-0 w-[9%] border-r border-line bg-sunken" />
            <span className="absolute top-[22%] right-[14%] left-[24%] h-1.5 rounded-full bg-line" />
            <span className="absolute top-[30%] right-[30%] left-[24%] h-1.5 rounded-full bg-line" />
          </span>
        ))}
        <span className="absolute inset-x-0 -bottom-2 h-2 rounded-sm bg-line-strong" />
      </div>
    </section>
  )
}

export function ImportPanel({ jobs, busy, onClose }: { jobs: Job[]; busy: boolean; onClose: () => void }) {
  const done = jobs.filter((j) => j.stage === 'done' || j.stage === 'skipped' || j.stage === 'error').length
  return (
    <aside
      aria-label="加入電子書"
      className="sheet-in fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] left-4 z-40 overflow-hidden rounded-xl border border-line bg-surface shadow-[0_24px_60px_-24px_rgba(17,17,17,0.35)] md:bottom-6 md:left-auto md:w-[360px]"
    >
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-sm font-semibold text-ink-strong">
          {busy ? `加入中 ${done} / ${jobs.length}` : `完成 ${jobs.length} 個檔案`}
        </p>
        {!busy && (
          <button type="button" onClick={onClose} aria-label="關閉" className="rounded-md p-1 text-muted hover:bg-sunken">
            <X size={15} />
          </button>
        )}
      </header>
      {busy && (
        <div className="h-0.5 bg-line">
          <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${(done / jobs.length) * 100}%` }} />
        </div>
      )}
      <ul className="max-h-72 divide-y divide-line overflow-y-auto">
        {jobs.map((j) => (
          <li key={j.key} className="flex items-center gap-3 px-4 py-2.5">
            <StageIcon stage={j.stage} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-ink-strong">{j.file.name.replace(/\.epub$/i, '')}</p>
              <p className={`truncate text-[11px] ${j.stage === 'error' ? 'text-red-ink' : 'text-muted'}`}>
                {j.stage === 'error' ? j.error : STAGE_TEXT[j.stage]}
                {j.stage === 'waiting' && ` · ${sizeText(j.file.size)}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}

function StageIcon({ stage }: { stage: Stage }) {
  if (stage === 'done') return <CheckCircle size={18} weight="fill" className="shrink-0 text-green-ink" />
  if (stage === 'skipped') return <CheckCircle size={18} className="shrink-0 text-faint" />
  if (stage === 'error') return <WarningCircle size={18} weight="fill" className="shrink-0 text-red-ink" />
  if (stage === 'waiting') return <span className="size-[18px] shrink-0 rounded-full border border-dashed border-line-strong" />
  return <CircleNotch size={18} className="shrink-0 animate-spin text-accent" />
}

export function EditBook({ book, onClose, onSaved }: { book: BookSummary; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(book.title)
  const [author, setAuthor] = useState(book.author ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  return (
    <Modal title="編輯書籍資訊" onClose={onClose}>
      <form
        className="grid gap-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault()
          setSaving(true)
          const r = await renameBook(book.id, title, author)
          setSaving(false)
          if (r.ok) onSaved()
          else setError(r.error)
        }}
      >
        <label className="grid gap-2">
          <span className="label">書名</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="field" required maxLength={300} data-autofocus />
        </label>
        <label className="grid gap-2">
          <span className="label">作者</span>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} className="field" maxLength={200} />
        </label>
        {error && <p className="text-sm text-red-ink">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-quiet">
            取消
          </button>
          <button type="submit" disabled={saving || !title.trim()} className="btn btn-primary">
            儲存
          </button>
        </div>
      </form>
    </Modal>
  )
}
