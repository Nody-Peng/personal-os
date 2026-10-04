'use client'

import { ArrowsDownUp, CaretRight, DotsThree, FileText, List, Plus, Smiley, Trash } from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { updatePage, type PagePatch } from '@/app/(frontend)/notebook-actions'
import { BlockEditor, SaveStatusText } from '@/components/editor/BlockEditor'
import { pageWithEdits, rememberPageEdit } from '@/lib/noteCache'
import { MAX_PAGE_TITLE, UNTITLED, ancestorsOf, childrenOf } from '@/lib/notes'
import { useSaveQueue, type SaveStatus } from '@/lib/useSaveQueue'
import { IconPicker } from './IconPicker'
import { Menu } from './Menu'
import { useNotebook } from './NotebookShell'

export type PageData = { id: number; title: string; icon: string; content: unknown[] | null }

const TITLE_DELAY = 500

/** One page: icon, title, the block editor and its sub-pages. */
export function PageView({ page: serverPage, renderedAt }: { page: PageData; renderedAt: number }) {
  const { notebook, pages, patchPage, addPage, trash, openMove, openDrawer } = useNotebook()
  const [page] = useState(() => pageWithEdits(serverPage.id, serverPage, renderedAt))
  const [title, setTitle] = useState(page.title)
  const [icon, setIcon] = useState(page.icon)
  const [picking, setPicking] = useState(false)
  const [body, setBody] = useState<{ status: SaveStatus; error: string | null }>({ status: 'idle', error: null })
  const { enqueue, status, error } = useSaveQueue()
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingTitle = useRef<string | null>(null)
  const id = page.id

  const save = useCallback((patch: PagePatch) => enqueue(() => updatePage(id, patch)), [enqueue, id])

  const flushTitle = useCallback(() => {
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = null
    if (pendingTitle.current != null) save({ title: pendingTitle.current })
    pendingTitle.current = null
  }, [save])
  useEffect(() => flushTitle, [flushTitle])

  const changeTitle = (value: string) => {
    const next = value.replace(/\n/g, ' ').slice(0, MAX_PAGE_TITLE)
    setTitle(next)
    patchPage(id, { title: next.trim() })
    rememberPageEdit(id, { title: next })
    pendingTitle.current = next
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(flushTitle, TITLE_DELAY)
  }

  const changeIcon = (next: string) => {
    setIcon(next)
    patchPage(id, { icon: next })
    rememberPageEdit(id, { icon: next })
    save({ icon: next })
  }

  useEffect(() => {
    document.title = `${title.trim() || UNTITLED} · ${notebook.title} · Personal OS`
  }, [title, notebook.title])

  const crumbs = ancestorsOf(pages, id)
  const kids = childrenOf(pages, id)
  const merged: { status: SaveStatus; error: string | null } =
    status === 'error' || body.status === 'error'
      ? { status: 'error', error: error ?? body.error }
      : status === 'saving' || body.status === 'saving'
        ? { status: 'saving', error: null }
        : status === 'saved' || body.status === 'saved'
          ? { status: 'saved', error: null }
          : { status: 'idle', error: null }

  return (
    <>
      <header className="sticky top-0 z-20 flex h-12 items-center gap-2 bg-surface/90 px-3 backdrop-blur md:px-5">
        <button type="button" onClick={openDrawer} aria-label="打開頁面目錄" className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink-strong md:hidden">
          <List size={20} />
        </button>
        <nav aria-label="頁面路徑" className="flex min-w-0 flex-1 items-center gap-1 text-sm text-muted">
          <span className="hidden max-w-[10rem] truncate md:inline">{notebook.title}</span>
          {crumbs.map((c, i) => (
            <span key={c.id} className={`min-w-0 items-center gap-1 ${i < crumbs.length - 1 ? 'hidden md:flex' : 'flex'}`}>
              <CaretRight size={10} className={`shrink-0 text-faint ${i === 0 ? 'hidden md:block' : ''}`} />
              <Link href={`/notebooks/${notebook.id}/${c.id}`} className="truncate rounded px-1 hover:bg-sunken hover:text-ink-strong">
                {c.icon && <span className="mr-1">{c.icon}</span>}
                {c.title || UNTITLED}
              </Link>
            </span>
          ))}
          <span className="flex min-w-0 items-center gap-1">
            <CaretRight size={10} className={`shrink-0 text-faint ${crumbs.length ? '' : 'hidden md:block'}`} />
            <span className="truncate px-1 text-ink-strong">
              {icon && <span className="mr-1">{icon}</span>}
              {title.trim() || UNTITLED}
            </span>
          </span>
        </nav>
        <span className="hidden shrink-0 sm:inline">
          <SaveStatusText status={merged.status} error={merged.error} />
        </span>
        <Menu
          label="頁面選項"
          className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink-strong"
          items={[
            { label: '新增子頁面', icon: <Plus size={14} />, onSelect: () => addPage(id) },
            { label: '移動到…', icon: <ArrowsDownUp size={14} />, onSelect: () => openMove(id) },
            { label: '移到垃圾桶', icon: <Trash size={14} />, onSelect: () => trash(id), danger: true },
          ]}
        >
          <DotsThree size={20} weight="bold" />
        </Menu>
      </header>

      <article className="mx-auto max-w-3xl px-5 pt-8 pb-40 md:px-14 md:pt-16">
        <div className="relative">
          {icon ? (
            <button
              type="button"
              onClick={() => setPicking(true)}
              aria-label="更換圖示"
              className="-ml-1 mb-2 grid size-16 place-items-center rounded-lg text-5xl leading-none hover:bg-sunken"
            >
              {icon}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="mb-2 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-faint transition-colors hover:bg-sunken hover:text-muted"
            >
              <Smiley size={16} />
              新增圖示
            </button>
          )}
          {picking && <IconPicker value={icon} onChange={changeIcon} onClose={() => setPicking(false)} />}
        </div>

        <textarea
          value={title}
          onChange={(e) => changeTitle(e.target.value)}
          onBlur={flushTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              flushTitle()
              document.querySelector<HTMLElement>('.note-editor [contenteditable="true"]')?.focus()
            }
          }}
          rows={1}
          placeholder={UNTITLED}
          aria-label="標題"
          autoFocus={!page.title && !page.content?.length}
          className="field-sizing-content w-full resize-none overflow-hidden bg-transparent text-3xl leading-tight font-semibold tracking-tight text-ink-strong outline-none placeholder:text-line-strong md:text-[2.5rem]"
        />

        {/* The editor's left gutter holds the block handles; pull it into the margin so text lines up with the title. */}
        <div className="mt-4 -ml-7 md:-ml-11">
          <BlockEditor
            key={id}
            target={{ kind: 'note', id }}
            initial={page.content}
            className="note-editor"
            placeholder="輸入文字，或按 / 插入標題、清單、待辦、程式碼…"
            onChange={(blocks) => rememberPageEdit(id, { content: blocks })}
            onStatus={(s, err) => setBody({ status: s, error: err })}
          />
        </div>

        <section aria-label="子頁面" className="mt-10 border-t border-line pt-4">
          {kids.length > 0 && (
            <ul className="mb-1">
              {kids.map((k) => (
                <li key={k.id}>
                  <Link
                    href={`/notebooks/${notebook.id}/${k.id}`}
                    className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-ink hover:bg-sunken"
                  >
                    <span className="grid size-5 place-items-center text-base leading-none text-muted">{k.icon || <FileText size={18} />}</span>
                    <span className={`truncate underline decoration-line-strong underline-offset-4 ${k.title ? '' : 'text-muted'}`}>{k.title || UNTITLED}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => addPage(id)} className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-sunken hover:text-ink-strong">
            <Plus size={16} />
            新增子頁面
          </button>
        </section>
      </article>
    </>
  )
}
