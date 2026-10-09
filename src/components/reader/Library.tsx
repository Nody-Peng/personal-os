'use client'

import {
  Check,
  CheckCircle,
  Checks,
  DotsThree,
  FolderSimplePlus,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  SlidersHorizontal,
  SortAscending,
  Tag,
  Trash,
  UploadSimple,
  X,
} from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { deleteBooks, moveBooksShelf, setBooksFinished } from '@/app/(frontend)/book-actions'
import { BookLink } from '@/components/books/BookOpener'
import { Menu, type MenuItem } from '@/components/notebooks/Menu'
import { Modal } from '@/components/notebooks/Modal'
import { Toast, useToastTimeout, type ToastMessage } from '@/components/Toast'
import { READING_STATUSES, statusOf, type BookSummary, type ReadingStatus, type Shelf } from '@/lib/books'
import { EbookCover } from './EbookCover'
import { bookKey, importEpub } from './importEpub'
import { ContinueReading, EditBook, EmptyLibrary, ImportPanel, ShelfProgress, type Job } from './LibraryParts'
import { forgetBook } from './loadBook'
import { afterReaderSaves } from './readingSync'
import { ManageShelves, ShelfPicker } from './ShelfDialogs'

type Sort = 'recent' | 'added' | 'title'
type ShelfFilter = number | 'all'

const SORTS: { value: Sort; label: string }[] = [
  { value: 'recent', label: '最近閱讀' },
  { value: 'added', label: '最近加入' },
  { value: 'title', label: '書名' },
]

const time = (iso: string | null) => (iso ? Date.parse(iso) : 0)

export function Library({ books, shelves, initialShelf }: { books: BookSummary[]; shelves: Shelf[]; initialShelf: number | null }) {
  const router = useRouter()
  const [shelf, setShelf] = useState<ShelfFilter>(initialShelf && shelves.some((s) => s.id === initialShelf) ? initialShelf : 'all')
  const [status, setStatus] = useState<ReadingStatus | 'all'>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [query, setQuery] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [jobs, setJobs] = useState<Job[]>([])
  const [dragging, setDragging] = useState(false)
  const [editing, setEditing] = useState<BookSummary | null>(null)
  const [deleting, setDeleting] = useState<BookSummary[] | null>(null)
  const [picking, setPicking] = useState<BookSummary | null>(null)
  const [managing, setManaging] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  useToastTimeout(toast, clearToast)
  const fileInput = useRef<HTMLInputElement>(null)

  // Back from the reader: show the place just saved.
  useEffect(() => afterReaderSaves(() => router.refresh()), [router])

  const activeShelf = shelf === 'all' ? null : (shelves.find((s) => s.id === shelf) ?? null)
  const chooseShelf = (next: ShelfFilter) => {
    setShelf(next)
    setSelected(new Set())
    window.history.replaceState(null, '', next === 'all' ? '/books' : `/books?shelf=${next}`)
  }

  // ---- importing ----
  const known = useRef(new Set<string>())
  useEffect(() => {
    known.current = new Set(books.map((b) => bookKey(b.title, b.author)))
  }, [books])
  const running = useRef(false)
  const queue = useRef<{ job: Job; shelves: number[] }[]>([])

  const update = (key: string, patch: Partial<Job>) => setJobs((all) => all.map((j) => (j.key === key ? { ...j, ...patch } : j)))

  const runQueue = useCallback(async () => {
    if (running.current) return
    running.current = true
    let added = 0
    // One at a time: parsing an EPUB holds it in memory, and uploads share the line.
    for (let next = queue.current.shift(); next; next = queue.current.shift()) {
      const { key, file } = next.job
      // Claimed before the upload, so the same book twice in one batch is added once.
      let claimed: string | null = null
      const exists = (k: string) => {
        if (known.current.has(k)) return true
        known.current.add(k)
        claimed = k
        return false
      }
      try {
        const result = await importEpub(file, (stage) => update(key, { stage }), exists, next.shelves)
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

  const shelfRef = useRef<ShelfFilter>(shelf)
  useEffect(() => {
    shelfRef.current = shelf
  }, [shelf])

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = [...files].filter((f) => /\.epub$/i.test(f.name) || f.type === 'application/epub+zip')
      const ignored = files.length - list.length
      if (ignored) setToast({ text: `略過 ${ignored} 個不是 EPUB 的檔案`, tone: 'error' })
      if (!list.length) return
      // Books dropped while a category is open go into it.
      const into = shelfRef.current === 'all' ? [] : [shelfRef.current]
      const newJobs = list.map<Job>((file, i) => ({ key: `${Date.now()}-${i}-${file.name}`, file, stage: 'waiting' }))
      queue.current.push(...newJobs.map((job) => ({ job, shelves: into })))
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
  const counts = useMemo(() => {
    const map = new Map<number, number>()
    for (const b of books) for (const s of b.shelves) map.set(s, (map.get(s) ?? 0) + 1)
    return map
  }, [books])

  const current = useMemo(
    () =>
      books
        .filter((b) => statusOf(b) === 'reading')
        .sort((a, b) => time(b.lastReadAt) - time(a.lastReadAt))[0] ?? null,
    [books],
  )

  const inShelf = useMemo(() => (shelf === 'all' ? books : books.filter((b) => b.shelves.includes(shelf))), [books, shelf])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = inShelf.filter(
      (b) => (status === 'all' || statusOf(b) === status) && (!q || `${b.title} ${b.author ?? ''}`.toLowerCase().includes(q)),
    )
    if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'))
    else if (sort === 'added') list.sort((a, b) => time(b.createdAt) - time(a.createdAt))
    else list.sort((a, b) => (time(b.lastReadAt) || time(b.createdAt)) - (time(a.lastReadAt) || time(a.createdAt)))
    return list
  }, [inShelf, query, sort, status])

  const busy = jobs.some((j) => j.stage !== 'done' && j.stage !== 'skipped' && j.stage !== 'error')
  const finishedCount = books.filter((b) => statusOf(b) === 'finished').length

  // ---- actions ----
  const done = (r: { ok: boolean; error?: string }, message?: string) => {
    if (!r.ok) setToast({ text: r.error ?? '發生錯誤', tone: 'error' })
    else {
      if (message) setToast({ text: message, tone: 'info' })
      router.refresh()
    }
    return r.ok
  }

  const remove = async (list: BookSummary[]) => {
    setDeleting(null)
    const ok = done(await deleteBooks(list.map((b) => b.id)), list.length === 1 ? `已刪除《${list[0].title}》` : `已刪除 ${list.length} 本書`)
    if (!ok) return
    for (const b of list) void forgetBook(b.url)
    setSelected(new Set())
  }

  const toggleSelected = (id: number) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const stopSelecting = () => {
    setSelecting(false)
    setSelected(new Set())
  }
  const selectedBooks = books.filter((b) => selected.has(b.id))

  const bookMenu = (book: BookSummary): MenuItem[] => {
    const s = statusOf(book)
    return [
      { label: '分類', icon: <Tag size={16} />, onSelect: () => setPicking(book) },
      { label: '編輯書名和作者', icon: <PencilSimple size={16} />, onSelect: () => setEditing(book) },
      s === 'finished'
        ? { label: '重設進度（從頭讀）', icon: <X size={16} />, onSelect: () => void setBooksFinished([book.id], false).then((r) => done(r, '已重設進度')) }
        : { label: '標記為讀完', icon: <CheckCircle size={16} />, onSelect: () => void setBooksFinished([book.id], true).then((r) => done(r, '已標記為讀完')) },
      ...(s === 'reading'
        ? [{ label: '重設進度（從頭讀）', icon: <X size={16} />, onSelect: () => void setBooksFinished([book.id], false).then((r) => done(r, '已重設進度')) }]
        : []),
      { label: '刪除', icon: <Trash size={16} />, danger: true, onSelect: () => setDeleting([book]) },
    ]
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
            {books.length ? `${books.length} 本書 · 讀完 ${finishedCount} 本` : '把 EPUB 放進來，在哪都能接著讀'}
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
          {current && shelf === 'all' && !selecting && <ContinueReading book={current} />}

          <section aria-labelledby="shelf-heading">
            {/* Categories */}
            <nav aria-label="分類" className="-mx-4 mb-5 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
              <ShelfChip active={shelf === 'all'} count={books.length} onClick={() => chooseShelf('all')}>
                全部
              </ShelfChip>
              {shelves.map((s) => (
                <ShelfChip key={s.id} active={shelf === s.id} count={counts.get(s.id) ?? 0} onClick={() => chooseShelf(s.id)}>
                  {s.name}
                </ShelfChip>
              ))}
              <button
                type="button"
                onClick={() => setManaging(true)}
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 text-[13px] text-muted transition-colors hover:border-ink-strong/40 hover:text-ink-strong"
              >
                {shelves.length ? <SlidersHorizontal size={14} /> : <FolderSimplePlus size={14} />}
                {shelves.length ? '管理分類' : '新增分類'}
              </button>
            </nav>

            {/* Filters */}
            <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-3">
              <h2 id="shelf-heading" className="mr-auto text-xl font-semibold tracking-tight text-ink-strong">
                {activeShelf?.name ?? '書庫'}
                <span className="ml-2 font-mono text-xs font-normal text-muted">{visible.length}</span>
              </h2>
              {inShelf.length > 8 && (
                <label className="relative flex w-full items-center sm:w-52">
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
              <div role="radiogroup" aria-label="閱讀狀態" className="flex gap-1 rounded-lg bg-sunken p-1">
                {[{ value: 'all' as const, label: '全部' }, ...READING_STATUSES].map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={status === o.value}
                    onClick={() => setStatus(o.value)}
                    className={`h-7 rounded-md px-2.5 text-[13px] transition-colors ${
                      status === o.value ? 'bg-surface font-medium text-ink-strong shadow-[0_0_0_1px_var(--color-line)]' : 'text-muted hover:text-ink-strong'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <Menu
                label="排序"
                className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-muted transition-colors hover:bg-sunken hover:text-ink-strong"
                items={SORTS.map((o) => ({
                  label: o.label,
                  icon: o.value === sort ? <Check size={16} /> : <span className="inline-block w-4" />,
                  onSelect: () => setSort(o.value),
                }))}
              >
                <SortAscending size={16} />
                <span className="hidden sm:inline">{SORTS.find((o) => o.value === sort)!.label}</span>
              </Menu>
              <button
                type="button"
                onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
                aria-pressed={selecting}
                className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] transition-colors ${
                  selecting ? 'bg-ink-strong text-on-ink' : 'text-muted hover:bg-sunken hover:text-ink-strong'
                }`}
              >
                <Checks size={16} />
                {selecting ? '完成' : '選取'}
              </button>
            </div>

            {visible.length ? (
              <ul className="grid grid-cols-3 gap-x-4 gap-y-10 sm:grid-cols-4 sm:gap-x-6 md:grid-cols-5 lg:grid-cols-6">
                {visible.map((book, i) => {
                  const isSelected = selected.has(book.id)
                  return (
                    <li key={book.id} className="rise group/book min-w-0" style={{ '--i': Math.min(i, 18) } as CSSProperties}>
                      {selecting ? (
                        <button
                          type="button"
                          onClick={() => toggleSelected(book.id)}
                          aria-pressed={isSelected}
                          aria-label={`選取《${book.title}》`}
                          className="relative block w-full text-left"
                        >
                          <span className={`block transition-[transform,opacity] duration-200 ${isSelected ? 'scale-[0.94]' : 'opacity-80'}`}>
                            <EbookCover title={book.title} author={book.author} coverUrl={book.coverUrl} />
                          </span>
                          <span
                            className={`absolute top-2 right-2 grid size-6 place-items-center rounded-full border-2 shadow-sm transition-colors ${
                              isSelected ? 'border-accent bg-accent text-on-ink' : 'border-white/90 bg-black/20'
                            }`}
                            aria-hidden
                          >
                            {isSelected && <CheckCircle size={22} weight="fill" />}
                          </span>
                        </button>
                      ) : (
                        <BookLink href={`/books/${book.id}`} label={`打開《${book.title}》`}>
                          <EbookCover title={book.title} author={book.author} coverUrl={book.coverUrl} />
                        </BookLink>
                      )}
                      <div className="mt-3 flex items-start gap-1">
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[13px] leading-snug font-medium text-ink-strong">{book.title}</p>
                          {book.author && <p className="mt-0.5 truncate text-xs text-muted">{book.author}</p>}
                        </div>
                        {!selecting && (
                          <Menu
                            label={`《${book.title}》的選項`}
                            className="-mt-1 -mr-1.5 shrink-0 rounded-md p-1 text-muted opacity-100 transition-opacity hover:bg-sunken hover:text-ink-strong md:opacity-0 md:group-hover/book:opacity-100 md:focus-visible:opacity-100"
                            items={bookMenu(book)}
                          >
                            <DotsThree size={18} weight="bold" />
                          </Menu>
                        )}
                      </div>
                      <ShelfProgress book={book} />
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-line-strong px-6 py-14 text-center">
                {inShelf.length === 0 && activeShelf ? (
                  <>
                    <Tag size={24} className="mx-auto text-muted" />
                    <p className="mt-3 text-sm font-medium text-ink-strong">「{activeShelf.name}」還沒有書</p>
                    <p className="mt-1 text-sm text-muted">在這裡拖進 EPUB 會直接放進這個分類，也可以在書的選單裡選「分類」。</p>
                  </>
                ) : (
                  <p className="text-sm text-muted">沒有符合的書</p>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {selecting && (
        <div className="sheet-in fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-40 flex items-center gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1.5 shadow-[0_24px_60px_-24px_rgba(17,17,17,0.4)] md:inset-x-auto md:bottom-6 md:left-1/2 md:-translate-x-1/2">
          <span className="shrink-0 px-3 text-sm font-medium text-ink-strong tabular-nums">已選 {selected.size} 本</span>
          <button
            type="button"
            onClick={() => setSelected(selected.size === visible.length ? new Set() : new Set(visible.map((b) => b.id)))}
            className="btn shrink-0 text-muted hover:bg-sunken"
          >
            {selected.size === visible.length && visible.length ? '全不選' : '全選'}
          </button>
          <span className="h-6 w-px shrink-0 bg-line" aria-hidden />
          <Menu
            label="加入分類"
            className="btn shrink-0 text-ink hover:bg-sunken disabled:opacity-40"
            items={[
              ...shelves.map((s) => ({
                label: s.name,
                onSelect: () =>
                  void moveBooksShelf([...selected], s.id, 'add').then((r) => done(r, `已把 ${selected.size} 本放進「${s.name}」`)),
              })),
              { label: '新增分類…', icon: <Plus size={16} />, onSelect: () => setManaging(true) },
            ]}
          >
            <Tag size={16} />
            加入分類
          </Menu>
          {activeShelf && (
            <button
              type="button"
              disabled={!selected.size}
              onClick={() =>
                void moveBooksShelf([...selected], activeShelf.id, 'remove').then((r) => {
                  if (done(r, `已移出「${activeShelf.name}」`)) setSelected(new Set())
                })
              }
              className="btn shrink-0 text-ink hover:bg-sunken"
            >
              移出「{activeShelf.name}」
            </button>
          )}
          <button
            type="button"
            disabled={!selected.size}
            onClick={() => void setBooksFinished([...selected], true).then((r) => done(r, '已標記為讀完'))}
            className="btn shrink-0 text-ink hover:bg-sunken"
          >
            <CheckCircle size={16} />
            讀完
          </button>
          <button type="button" disabled={!selected.size} onClick={() => setDeleting(selectedBooks)} className="btn shrink-0 text-red-ink hover:bg-red-soft">
            <Trash size={16} />
            刪除
          </button>
          <button type="button" onClick={stopSelecting} aria-label="結束選取" className="btn shrink-0 text-muted hover:bg-sunken">
            <X size={16} />
          </button>
        </div>
      )}

      {jobs.length > 0 && <ImportPanel jobs={jobs} busy={busy} onClose={() => setJobs([])} />}

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-canvas/80 p-6 backdrop-blur-sm">
          <div className="pop-in grid w-full max-w-md place-items-center rounded-2xl border-2 border-dashed border-accent/60 bg-surface px-8 py-14 text-center">
            <UploadSimple size={32} className="text-accent" />
            <p className="mt-4 text-lg font-semibold text-ink-strong">放開來加入書庫</p>
            <p className="mt-1 text-sm text-muted">{activeShelf ? `會放進「${activeShelf.name}」` : '可以一次拖很多本 EPUB'}</p>
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
      {picking && <ShelfPicker book={picking} shelves={shelves} onClose={() => setPicking(null)} onChanged={() => router.refresh()} />}
      {managing && <ManageShelves shelves={shelves} counts={counts} onClose={() => setManaging(false)} onChanged={() => router.refresh()} />}
      {deleting && (
        <Modal title={deleting.length === 1 ? '刪除這本書？' : `刪除 ${deleting.length} 本書？`} onClose={() => setDeleting(null)}>
          <div className="p-5">
            <p className="text-sm text-ink">
              {deleting.length === 1 ? `《${deleting[0].title}》` : `這 ${deleting.length} 本書`}
              的檔案、閱讀進度、書籤和劃線都會一起刪掉，不能復原。
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

function ShelfChip({ active, count, onClick, children }: { active: boolean; count: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-8 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] transition-[background-color,color,border-color] duration-200 active:scale-[0.98] ${
        active ? 'border-ink-strong bg-ink-strong text-on-ink' : 'border-line-strong text-ink hover:border-ink-strong/40'
      }`}
    >
      {children}
      <span className={`font-mono text-[11px] tabular-nums ${active ? 'opacity-70' : 'text-faint'}`}>{count}</span>
    </button>
  )
}
