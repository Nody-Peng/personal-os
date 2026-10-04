'use client'

import { Archive, Check } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { createNotebook, updateNotebook } from '@/app/(frontend)/notebook-actions'
import { NotebookCover } from '@/components/books/BookCover'
import { useBookOpen } from '@/components/books/BookOpener'
import { MAX_NOTEBOOK_TITLE, type NotebookItem } from '@/lib/notes'
import { COVER_COLORS, COVER_PATTERNS } from '@/lib/options'
import { Modal } from './Modal'

type Props = {
  /** Omit to create a new notebook. */
  notebook?: NotebookItem
  onClose: () => void
  onSaved?: (notebook: NotebookItem) => void
}

/** Name, cloth colour and pattern, with a live preview of the cover. */
export function NotebookDialog({ notebook, onClose, onSaved }: Props) {
  const router = useRouter()
  const openBook = useBookOpen()
  const preview = useRef<HTMLDivElement>(null)
  const [title, setTitle] = useState(notebook?.title ?? '')
  const [coverColor, setCoverColor] = useState(notebook?.coverColor ?? 'navy')
  const [pattern, setPattern] = useState(notebook?.pattern ?? 'cloth')
  const [error, setError] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return setError('請輸入筆記本名稱')
    startTransition(async () => {
      if (!notebook) {
        const result = await createNotebook({ title, coverColor, pattern })
        if (!result.ok) return setError(result.error)
        const cover = preview.current?.querySelector<HTMLElement>('.book-cover')
        const href = `/notebooks/${result.data!.notebook.id}/${result.data!.pageId}`
        if (cover) openBook(cover, href)
        else router.push(href)
        onClose()
        return
      }
      const result = await updateNotebook(notebook.id, { title, coverColor, pattern })
      if (!result.ok) return setError(result.error)
      onSaved?.({ ...notebook, title: title.trim(), coverColor, pattern })
      onClose()
    })
  }

  const archive = () =>
    startTransition(async () => {
      if (!notebook) return
      const result = await updateNotebook(notebook.id, { archived: true })
      if (!result.ok) return setError(result.error)
      router.push('/journal')
    })

  return (
    <Modal title={notebook ? '筆記本設定' : '新增筆記本'} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-6 p-5 sm:grid-cols-[132px_1fr] md:p-6">
        <div ref={preview} className="mx-auto w-28 sm:w-full" aria-hidden>
          <NotebookCover title={title.trim() || '未命名筆記本'} coverColor={coverColor} pattern={pattern} size="lg" />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="label">名稱</span>
            <input
              data-autofocus
              className="field"
              value={title}
              maxLength={MAX_NOTEBOOK_TITLE}
              placeholder="例如：WebGIS 筆記、讀書心得"
              onChange={(e) => {
                setTitle(e.target.value)
                setError(null)
              }}
            />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="label mb-1.5">封面顏色</legend>
            <div className="flex flex-wrap gap-2">
              {COVER_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-label={c.label}
                  aria-pressed={coverColor === c.value}
                  title={c.label}
                  onClick={() => setCoverColor(c.value)}
                  className={`grid size-8 place-items-center rounded-md ring-offset-2 ring-offset-surface transition-shadow ${
                    coverColor === c.value ? 'ring-2 ring-accent' : 'ring-1 ring-line-strong hover:ring-ink/40'
                  }`}
                  style={{ background: c.hex }}
                >
                  {coverColor === c.value && <Check size={14} weight="bold" className="text-[#d2b574]" />}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="label mb-1.5">花紋</legend>
            <div className="grid grid-cols-3 gap-2">
              {COVER_PATTERNS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={pattern === p.value}
                  onClick={() => setPattern(p.value)}
                  className={`flex items-center gap-2 rounded-lg border p-1.5 pr-2 text-left text-xs transition-colors ${
                    pattern === p.value ? 'border-accent bg-accent-soft/50 text-ink-strong' : 'border-line text-muted hover:border-line-strong'
                  }`}
                >
                  <span
                    className="cover-cloth h-8 w-6 shrink-0 rounded-r-[3px] rounded-l-[1px]"
                    data-pattern={p.value}
                    style={{ '--cover': COVER_COLORS.find((c) => c.value === coverColor)?.hex } as React.CSSProperties}
                    aria-hidden
                  />
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="text-sm text-red-ink">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            {notebook ? (
              confirmArchive ? (
                <span className="flex items-center gap-2">
                  <button type="button" className="btn bg-sunken text-ink-strong" disabled={pending} onClick={archive}>
                    確定封存
                  </button>
                  <button type="button" className="btn text-muted hover:bg-sunken" onClick={() => setConfirmArchive(false)}>
                    取消
                  </button>
                </span>
              ) : (
                <button type="button" className="btn -ml-2 text-muted hover:bg-sunken hover:text-ink-strong" onClick={() => setConfirmArchive(true)}>
                  <Archive size={16} />
                  封存
                </button>
              )
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" className="btn text-muted hover:bg-sunken" onClick={onClose}>
                取消
              </button>
              <button type="submit" className="btn btn-primary" disabled={pending}>
                {notebook ? '儲存' : '建立並打開'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  )
}
