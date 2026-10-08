'use client'

import { ArrowsOutSimple, Copy, DotsThree, Smiley, Trash, X } from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { duplicatePage, getPageDetail, trashPage, updatePage, type PageDetail } from '@/app/(frontend)/notebook-actions'
import { BlockEditor, SaveStatusText } from '@/components/editor/BlockEditor'
import { NoteContext } from '@/components/editor/NoteContext'
import { dropItems, loadBoard, renameItem, useBoard } from '@/lib/boardStore'
import { escapeHandledElsewhere } from '@/lib/escape'
import { rememberPageEdit } from '@/lib/noteCache'
import { MAX_PAGE_TITLE, UNTITLED } from '@/lib/notes'
import { useSaveQueue, type SaveStatus } from '@/lib/useSaveQueue'
import { IconPicker } from '../IconPicker'
import { Menu } from '../Menu'
import { useNoteEditorContext, useNotebook } from '../NotebookShell'
import { ItemProperties } from './ItemProperties'
import { NoteIcon } from '../NoteIcon'

/** A board card opened beside the page (Notion's side peek): properties and content. */
export function ItemPeek({ id, onClose }: { id: number; onClose: () => void }) {
  const [page, setPage] = useState<PageDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getPageDetail(id).then((result) => {
      if (!alive) return
      if (result.ok && result.data) setPage(result.data)
      else setLoadError(result.ok ? '找不到這一頁' : result.error)
    })
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    // Esc closes the peek unless it is closing a menu or picker of its own first.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || escapeHandledElsewhere()) return
      onClose()
    }
    // Capture phase: decide before a menu closes itself and disappears.
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={page?.title || UNTITLED}>
      <button type="button" aria-label="關閉" onClick={onClose} className="modal-scrim absolute inset-0 bg-scrim" />
      <aside data-block-select-zone className="peek-in absolute inset-y-0 right-0 flex w-full max-w-[680px] flex-col bg-surface shadow-[0_0_48px_rgba(17,17,17,0.14)] md:border-l md:border-line">
        {loadError && <p className="p-6 text-red-ink">{loadError}</p>}
        {!page && !loadError && <div className="m-6 h-40 animate-pulse rounded-lg bg-sunken" />}
        {page && <PeekBody key={page.id} page={page} onClose={onClose} />}
      </aside>
    </div>
  )
}

function PeekBody({ page, onClose }: { page: PageDetail; onClose: () => void }) {
  const { patchPage, openPeek } = useNotebook()
  const board = useBoard(page.boardId ?? 0)
  const note = useNoteEditorContext(page.id)
  const [title, setTitle] = useState(page.title)
  const [icon, setIcon] = useState(page.icon)
  const [picking, setPicking] = useState(false)
  const [body, setBody] = useState<{ status: SaveStatus; error: string | null }>({ status: 'idle', error: null })
  const { enqueue, status, error } = useSaveQueue()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<string | null>(null)

  const flush = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const value = pending.current
    pending.current = null
    if (value != null) enqueue(() => updatePage(page.id, { title: value }))
  }
  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  })
  useEffect(() => () => flushRef.current(), [])

  const rename = (value: string) => {
    const next = value.replace(/\n/g, ' ').slice(0, MAX_PAGE_TITLE)
    setTitle(next)
    if (page.boardId) renameItem(page.boardId, page.id, { title: next.trim() })
    patchPage(page.id, { title: next.trim() })
    rememberPageEdit(page.id, { title: next })
    pending.current = next
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, 500)
  }

  const changeIcon = (next: string) => {
    setIcon(next)
    if (page.boardId) renameItem(page.boardId, page.id, { icon: next })
    patchPage(page.id, { icon: next })
    rememberPageEdit(page.id, { icon: next })
    enqueue(() => updatePage(page.id, { icon: next }))
  }

  const duplicate = async () => {
    flush()
    const result = await duplicatePage(page.id)
    if (!result.ok || !result.data) return setBody({ status: 'error', error: result.ok ? '建立副本失敗' : result.error })
    if (page.boardId) await loadBoard(page.boardId)
    openPeek(result.data.id)
  }

  const remove = async () => {
    const result = await trashPage(page.id)
    if (!result.ok) return setBody({ status: 'error', error: result.error })
    if (page.boardId) dropItems(page.boardId, result.data ?? [page.id])
    onClose()
  }

  const merged =
    status === 'error' || body.status === 'error'
      ? { status: 'error' as const, error: error ?? body.error }
      : { status: status === 'saving' || body.status === 'saving' ? ('saving' as const) : status === 'saved' || body.status === 'saved' ? ('saved' as const) : ('idle' as const), error: null }

  return (
    <>
      <header className="flex items-center gap-1 border-b border-line px-3 py-2">
        <button type="button" onClick={onClose} aria-label="關閉" className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink-strong">
          <X size={18} />
        </button>
        <Link
          href={`/notebooks/${page.notebookId}/${page.id}`}
          title="以整頁開啟"
          aria-label="以整頁開啟"
          className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink-strong"
        >
          <ArrowsOutSimple size={16} />
        </Link>
        <span className="min-w-0 flex-1 truncate px-1 text-xs text-muted">{board.data?.title}</span>
        <SaveStatusText status={merged.status} error={merged.error} />
        <Menu
          label="頁面選項"
          className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink-strong"
          items={[
            { label: '建立副本', icon: <Copy size={14} />, onSelect: () => void duplicate() },
            { label: '移到垃圾桶', icon: <Trash size={14} />, onSelect: remove, danger: true },
          ]}
        >
          <DotsThree size={18} weight="bold" />
        </Menu>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pt-8 pb-24 md:px-12">
        <div className="relative">
          {icon ? (
            <button type="button" onClick={() => setPicking(true)} aria-label="更換圖示" className="-ml-1 mb-1 grid size-12 place-items-center rounded-lg text-4xl leading-none hover:bg-sunken">
              <NoteIcon icon={icon} />
            </button>
          ) : (
            <button type="button" onClick={() => setPicking(true)} className="mb-1 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-faint hover:bg-sunken hover:text-muted">
              <Smiley size={16} />
              新增圖示
            </button>
          )}
          {picking && <IconPicker value={icon} onChange={changeIcon} onClose={() => setPicking(false)} />}
        </div>
        <textarea
          value={title}
          onChange={(e) => rename(e.target.value)}
          onBlur={flush}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              flush()
            }
          }}
          rows={1}
          placeholder={UNTITLED}
          aria-label="標題"
          autoFocus={!page.title}
          className="field-sizing-content w-full resize-none overflow-hidden bg-transparent text-3xl leading-tight font-semibold tracking-tight text-ink-strong outline-none placeholder:text-line-strong"
        />

        {page.kind === 'item' && page.boardId != null && (
          <div className="mt-5">
            <ItemProperties boardId={page.boardId} itemId={page.id} />
          </div>
        )}

        <div className="mt-6 -ml-7 border-t border-line pt-5 md:-ml-11">
          <NoteContext.Provider value={note}>
            <BlockEditor
              target={{ kind: 'note', id: page.id }}
              initial={page.content}
              className="note-editor note-editor-compact"
              placeholder="寫下細節，或按 / 插入區塊…"
              allowUploads
              templateKind="page"
              onStatus={(s, err) => setBody({ status: s, error: err })}
            />
          </NoteContext.Provider>
        </div>
      </div>
    </>
  )
}
