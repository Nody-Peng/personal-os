'use client'

import {
  ArrowRight,
  BookOpenText,
  CheckCircle,
  CircleNotch,
  DotsThree,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  UploadSimple,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { deleteBook, renameBook } from '@/app/(frontend)/book-actions'
import { BookLink } from '@/components/books/BookOpener'
import { Menu } from '@/components/notebooks/Menu'
import { Modal } from '@/components/notebooks/Modal'
import { Toast, useToastTimeout, type ToastMessage } from '@/components/Toast'
import { percentOf, type BookSummary } from '@/lib/books'
import { EbookCover } from './EbookCover'
import { bookKey, importEpub } from './importEpub'
import { forgetBook } from './loadBook'

type Sort = 'recent' | 'added' | 'title'
type Stage = 'waiting' | 'reading' | 'cover' | 'uploading' | 'done' | 'skipped' | 'error'
type Job = { key: string; file: File; stage: Stage; error?: string }

const STAGE_TEXT: Record<Stage, string> = {
  waiting: '排隊中',
  reading: '讀取書名和封面',
  cover: '上傳封面',
  uploading: '上傳中',
  done: '已加入',
  skipped: '書庫裡已經有了',
  error: '失敗',
}

const isFinished = (b: BookSummary) => b.progress >= 0.995

function relativeTime(iso: string): string {
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

export function Library({ books }: { books: BookSummary[] }) {
  const router = useRouter()
  const [sort, setSort] = useState<Sort>('recent')
  const [query, setQuery] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [dragging, setDragging] = useState(false)
  const [editing, setEditing] = useState<BookSummary | null>(null)
  const [deleting, setDeleting] = useState<BookSummary | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  useToastTimeout(toast, useCallback(() => setToast(null), []))
  const fileInput = useRef<HTMLInputElement>(null)

  // ---- importing ----
  const known = useRef(new Set<string>())
  useEffect(() => {
    known.current = new Set(books.map((b) => bookKey(b.title, b.author)))
  }, [books])
  const running = useRef(false)
  const queue = useRef<Job[]>([])

  const update = (key: string, patch: Partial<Job>) => setJobs((all) => all.map((j) => (j.key === key ? { ...j, ...patch } : j)))

  const runQueue = useCallback(async () => {
    if (running.current) return
    running.current = true
    let added = 0
    // One at a time: parsing an EPUB holds it in memory, and uploads share the line.
    for (let job = queue.current.shift(); job; job = queue.current.shift()) {
      const { key, file } = job
      // Claimed before the upload, so the same book twice in one batch is added once.
      let claimed: string | null = null
      const exists = (k: string) => {
        if (known.current.has(k)) return true
        known.current.add(k)
        claimed = k
        return false
      }
      try {
        const result = await importEpub(file, (stage) => update(key, { stage }), exists)
        if (result) {
          added++
          update(key, { stage: 'done' })
          router.refresh()
        } else {
          update(key, { stage: 'skipped' })
        }
      } catch (error) {
        if (claimed) known.current.delete(claimed)
        update(key, { stage: 'error', error: error instanceof Error ? error.message : '上傳失敗' })
      }
    }
    running.current = false
    if (added) setToast({ text: `加入了 ${added} 本書`, tone: 'info' })
  }, [router])

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = [...files].filter((f) => /\.epub$/i.test(f.name) || f.type === 'application/epub+zip')
      const ignored = files.length - list.length
      if (ignored) setToast({ text: `略過 ${ignored} 個不是 EPUB 的檔案`, tone: 'error' })
      if (!list.length) return
      const newJobs = list.map<Job>((file, i) => ({ key: `${Date.now()}-${i}-${file.name}`, file, stage: 'waiting' }))
      queue.current.push(...newJobs)
      setJobs((all) => [...all.filter((j) => j.stage !== 'done' && j.stage !== 'skipped'), ...newJobs])
      void runQueue()
    },
    [runQueue],
  )

  // Drop EPUBs anywhere on the page.
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth++
      setDragging(true)
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (!depth) setDragging(false)
    }
    const onOver = (e: DragEvent) => hasFiles(e) && e.preventDefault()
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [addFiles])

  // ---- shelf ----
  const current = useMemo(
    () =>
      books
        .filter((b) => b.lastReadAt && !isFinished(b))
        .sort((a, b) => Date.parse(b.lastReadAt!) - Date.parse(a.lastReadAt!))[0] ?? null,
    [books],
  )

  const shelf = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? books.filter((b) => `${b.title} ${b.author ?? ''}`.toLowerCase().includes(q)) : [...books]
    if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'))
    else if (sort === 'added') list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    else list.sort((a, b) => Date.parse(b.lastReadAt ?? b.createdAt) - Date.parse(a.lastReadAt ?? a.createdAt))
    return list
  }, [books, query, sort])

  const finished = books.filter(isFinished).length
  const busy = jobs.some((j) => j.stage !== 'done' && j.stage !== 'skipped' && j.stage !== 'error')

  const remove = async (book: BookSummary) => {
    setDeleting(null)
    const r = await deleteBook(book.id)
    if (!r.ok) return setToast({ text: r.error, tone: 'error' })
    void forgetBook(book.url)
    setToast({ text: `已刪除《${book.title}》`, tone: 'info' })
    router.refresh()
  }

  const picker = (
    <input
      ref={fileInput}
      type="file"
      accept=".epub,application/epub+zip"
      multiple
      hidden
      onChange={(e) => {
        if (e.target.files?.length) addFiles(e.target.files)
        e.target.value = ''
      }}
    />
  )

  return (
    <>
      {picker}
      <header className="mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-14">
        <div>
          <p className="font-mono text-xs text-muted">
            {books.length ? `${books.length} 本書 · 讀完 ${finished} 本` : '把 EPUB 放進來，在哪都能接著讀'}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-strong md:text-4xl">閱讀</h1>
        </div>
        {books.length > 0 && (
          <button type="button" onClick={() => fileInput.current?.click()} className="btn btn-primary">
            <Plus size={16} weight="bold" />
            加入電子書
          </button>
        )}
      </header>

      {books.length === 0 ? (
        <EmptyLibrary onPick={() => fileInput.current?.click()} />
      ) : (
        <>
          {current && <ContinueReading book={current} />}

          <section aria-labelledby="shelf-heading">
            <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <h2 id="shelf-heading" className="mr-auto text-xl font-semibold tracking-tight text-ink-strong">
                書庫
              </h2>
              {books.length > 8 && (
                <label className="relative flex w-full items-center sm:w-56">
                  <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 text-muted" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="找書名或作者"
                    aria-label="搜尋書庫"
                    className="field h-9 py-0 pl-8 text-sm"
                  />
                </label>
              )}
              <div role="radiogroup" aria-label="排序" className="flex gap-1 rounded-lg bg-sunken p-1">
                {(
                  [
                    ['recent', '最近閱讀'],
                    ['added', '最近加入'],
                    ['title', '書名'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={sort === value}
                    onClick={() => setSort(value)}
                    className={`h-7 rounded-md px-3 text-[13px] transition-colors ${
                      sort === value ? 'bg-surface font-medium text-ink-strong shadow-[0_0_0_1px_var(--color-line)]' : 'text-muted hover:text-ink-strong'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {shelf.length ? (
              <ul className="grid grid-cols-3 gap-x-4 gap-y-10 sm:grid-cols-4 sm:gap-x-6 md:grid-cols-5 lg:grid-cols-6">
                {shelf.map((book, i) => (
                  <li key={book.id} className="rise group/book min-w-0" style={{ '--i': Math.min(i, 18) } as CSSProperties}>
                    <BookLink href={`/books/${book.id}`} label={`打開《${book.title}》`}>
                      <EbookCover title={book.title} author={book.author} coverUrl={book.coverUrl} />
                    </BookLink>
                    <div className="mt-3 flex items-start gap-1">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[13px] leading-snug font-medium text-ink-strong">{book.title}</p>
                        {book.author && <p className="mt-0.5 truncate text-xs text-muted">{book.author}</p>}
                      </div>
                      <Menu
                        label={`《${book.title}》的選項`}
                        className="-mt-1 -mr-1.5 shrink-0 rounded-md p-1 text-muted opacity-100 transition-opacity hover:bg-sunken hover:text-ink-strong md:opacity-0 md:group-hover/book:opacity-100 md:focus-visible:opacity-100"
                        items={[
                          { label: '編輯書名和作者', icon: <PencilSimple size={16} />, onSelect: () => setEditing(book) },
                          { label: '刪除', icon: <Trash size={16} />, danger: true, onSelect: () => setDeleting(book) },
                        ]}
                      >
                        <DotsThree size={18} weight="bold" />
                      </Menu>
                    </div>
                    <ShelfProgress book={book} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-16 text-center text-sm text-muted">沒有符合「{query}」的書</p>
            )}
          </section>
        </>
      )}

      {jobs.length > 0 && <ImportPanel jobs={jobs} busy={busy} onClose={() => setJobs([])} />}

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-canvas/80 p-6 backdrop-blur-sm">
          <div className="pop-in grid w-full max-w-md place-items-center rounded-2xl border-2 border-dashed border-accent/60 bg-surface px-8 py-14 text-center">
            <UploadSimple size={32} className="text-accent" />
            <p className="mt-4 text-lg font-semibold text-ink-strong">放開來加入書庫</p>
            <p className="mt-1 text-sm text-muted">可以一次拖很多本 EPUB</p>
          </div>
        </div>
      )}

      {editing && (
        <EditBook
          book={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      )}
      {deleting && (
        <Modal title="刪除這本書？" onClose={() => setDeleting(null)}>
          <div className="p-5">
            <p className="text-sm text-ink">
              《{deleting.title}》的檔案、閱讀進度和書籤都會一起刪掉，不能復原。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleting(null)} className="btn btn-quiet" data-autofocus>
                取消
              </button>
              <button type="button" onClick={() => void remove(deleting)} className="btn bg-red-ink text-on-ink hover:opacity-90">
                刪除
              </button>
            </div>
          </div>
        </Modal>
      )}
      {toast && <Toast key={toast.text} {...toast} />}
    </>
  )
}

function ShelfProgress({ book }: { book: BookSummary }) {
  if (isFinished(book)) {
    return (
      <p className="mt-2 flex items-center gap-1 text-[11px] text-green-ink">
        <CheckCircle size={13} weight="fill" />
        讀完了
      </p>
    )
  }
  if (!book.lastReadAt) return <p className="mt-2 font-mono text-[11px] text-faint">未讀</p>
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
function ContinueReading({ book }: { book: BookSummary }) {
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

function EmptyLibrary({ onPick }: { onPick: () => void }) {
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

function ImportPanel({ jobs, busy, onClose }: { jobs: Job[]; busy: boolean; onClose: () => void }) {
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

function EditBook({ book, onClose, onSaved }: { book: BookSummary; onClose: () => void; onSaved: () => void }) {
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
