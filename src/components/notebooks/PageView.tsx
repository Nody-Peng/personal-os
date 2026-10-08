'use client'

import { CaretRight, FileText, ImageSquare, Kanban, List, LockSimple, Plus, Smiley, Star } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { duplicatePage, updatePage, type PagePatch } from '@/app/(frontend)/notebook-actions'
import { BlockEditor, SaveStatusText, type EditorHandle } from '@/components/editor/BlockEditor'
import { NoteContext } from '@/components/editor/NoteContext'
import { forgetTemplates } from '@/components/editor/TemplateBar'
import { blocksToText, countWords } from '@/lib/blocks'
import { loadBoard, renameItem } from '@/lib/boardStore'
import { pageWithEdits, peekLocal, rememberPageEdit, usePageStamp } from '@/lib/noteCache'
import { MAX_PAGE_TITLE, UNTITLED, ancestorsOf, childrenOf, embeddedPageIds, type PageNode } from '@/lib/notes'
import { TEMPLATE_KINDS, type PageFont, type TemplateKind } from '@/lib/options'
import { useSaveQueue, type SaveStatus } from '@/lib/useSaveQueue'
import { Backlinks } from './Backlinks'
import { BoardView } from './board/BoardView'
import { HistoryDialog } from './HistoryDialog'
import { ItemProperties } from './board/ItemProperties'
import { IconPicker } from './IconPicker'
import { useNoteEditorContext, useNotebook } from './NotebookShell'
import { NoteIcon } from './NoteIcon'
import { PageCover, useCoverPicker } from './PageCover'
import { PageMenu, type PageStyle } from './PageMenu'

export type PageData = {
  id: number
  kind: 'page' | 'board' | 'item'
  /** The board an item belongs to. */
  boardId: number | null
  title: string
  icon: string
  content: unknown[] | null
  cover: string
  coverPosition: number
  font: PageFont
  smallText: boolean
  fullWidth: boolean
  locked: boolean
  favorite: boolean
  templateFor: TemplateKind | null
}

const TITLE_DELAY = 500
// Loaded only for pages set to 襯線 (216 unicode-range slices; the browser
// fetches just the ones a page uses).
const SERIF_CSS = 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;600;700&display=swap'

const sameIds = (a: Set<number>, b: Set<number>) => a.size === b.size && [...a].every((id) => b.has(id))

/** 全部展開／收合: press every toggle that isn't already that way. */
function setToggles(open: boolean) {
  document
    .querySelectorAll<HTMLButtonElement>(`.note-editor .bn-toggle-wrapper[data-show-children="${open ? 'false' : 'true'}"] > .bn-toggle-button`)
    .forEach((button) => button.click())
}

/** One page: cover, icon, title, then the editor (or a board) and the sub-pages not shown in the text. */
export function PageView({ page: serverPage, renderedAt }: { page: PageData; renderedAt: number }) {
  const router = useRouter()
  const { notebook, pages, patchPage, addPage, trash, openMove, openDrawer, restored, notify, say } = useNotebook()
  const [page] = useState(() => pageWithEdits(serverPage.id, serverPage, renderedAt))
  usePageStamp(serverPage.id, renderedAt)
  const [title, setTitle] = useState(page.title)
  const [icon, setIcon] = useState(page.icon)
  const [cover, setCover] = useState({ url: page.cover, position: page.coverPosition })
  const [look, setLook] = useState<PageStyle>({
    font: page.font,
    smallText: page.smallText,
    fullWidth: page.fullWidth,
    locked: page.locked,
    favorite: page.favorite,
  })
  const [picking, setPicking] = useState(false)
  const [templateFor, setTemplateFor] = useState(page.templateFor)
  const [showHistory, setShowHistory] = useState(false)
  const editor = useRef<EditorHandle>(null)
  const [embedded, setEmbedded] = useState(() => embeddedPageIds(page.content))
  const [body, setBody] = useState<{ status: SaveStatus; error: string | null }>({ status: 'idle', error: null })
  const { enqueue, status, error } = useSaveQueue()
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingTitle = useRef<string | null>(null)
  const id = page.id
  const note = useNoteEditorContext(id)
  const locked = look.locked
  // The sidebar star and this one share the tree's copy; board cards have none.
  const canFavorite = page.kind !== 'item'
  const favorite = canFavorite && (pages.find((p) => p.id === id)?.favorite ?? look.favorite)

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
    if (page.boardId) renameItem(page.boardId, id, { title: next.trim() })
    rememberPageEdit(id, { title: next })
    pendingTitle.current = next
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(flushTitle, TITLE_DELAY)
  }

  const changeIcon = (next: string) => {
    setIcon(next)
    patchPage(id, { icon: next })
    if (page.boardId) renameItem(page.boardId, id, { icon: next })
    rememberPageEdit(id, { icon: next })
    save({ icon: next })
  }

  const changeCover = (patch: { cover?: string; coverPosition?: number }) => {
    setCover((c) => ({ url: patch.cover ?? c.url, position: patch.coverPosition ?? c.position }))
    rememberPageEdit(id, patch)
    save(patch)
  }
  const coverPicker = useCoverPicker((url) => changeCover({ cover: url, coverPosition: 50 }))

  const changeLook = (patch: Partial<PageStyle>) => {
    setLook((current) => ({ ...current, ...patch }))
    rememberPageEdit(id, patch)
    if ('favorite' in patch) patchPage(id, { favorite: patch.favorite })
    save(patch)
  }

  const changeTemplate = (next: TemplateKind | null) => {
    setTemplateFor(next)
    rememberPageEdit(id, { templateFor: next })
    save({ templateFor: next })
    forgetTemplates()
    say(next ? `已設為${TEMPLATE_KINDS.find((k) => k.value === next)!.label}` : '已不再是範本')
  }

  /** What the editor shows right now (it may not be saved yet). */
  const latestContent = () => peekLocal<unknown[]>(`doc:note:${id}`) ?? page.content

  const duplicate = async () => {
    flushTitle()
    const result = await duplicatePage(id)
    if (!result.ok || !result.data) return notify(result.ok ? '建立副本失敗' : result.error)
    restored(result.data.nodes)
    if (page.boardId) void loadBoard(page.boardId)
    router.push(`/notebooks/${notebook.id}/${result.data.id}`)
  }

  const copyLink = () => {
    void navigator.clipboard.writeText(`${window.location.origin}/notebooks/${notebook.id}/${id}`).then(() => say('已複製頁面連結'))
  }

  const exportAs = async (format: 'markdown' | 'html') => {
    try {
      const { exportPage } = await import('@/lib/exportNote')
      await exportPage(format, title, latestContent())
    } catch (e) {
      notify(e instanceof Error ? e.message : '匯出失敗')
    }
  }

  // Notion's Ctrl/⌘+Alt+T: open every toggle, or close them all if none is shut.
  useEffect(() => {
    if (page.kind === 'board') return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !e.altKey || e.key.toLowerCase() !== 't') return
      e.preventDefault()
      setToggles(document.querySelector('.note-editor .bn-toggle-wrapper[data-show-children="false"]') != null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [page.kind])

  useEffect(() => {
    document.title = `${title.trim() || UNTITLED} · ${notebook.title} · Personal OS`
  }, [title, notebook.title])

  // An item's path runs through its board, which is in the tree.
  const board = page.boardId != null ? pages.find((p) => p.id === page.boardId) : undefined
  const crumbs: PageNode[] = board ? [...ancestorsOf(pages, board.id), board] : ancestorsOf(pages, id)
  const kids = childrenOf(pages, id).filter((k) => !embedded.has(k.id))
  const merged: { status: SaveStatus; error: string | null } =
    status === 'error' || body.status === 'error'
      ? { status: 'error', error: error ?? body.error }
      : status === 'saving' || body.status === 'saving'
        ? { status: 'saving', error: null }
        : status === 'saved' || body.status === 'saved'
          ? { status: 'saved', error: null }
          : { status: 'idle', error: null }

  const width = look.fullWidth ? 'max-w-none' : page.kind === 'board' ? 'max-w-6xl' : 'max-w-3xl'

  return (
    <>
      {look.font === 'serif' && <link rel="stylesheet" href={SERIF_CSS} precedence="default" />}
      <header className="sticky top-0 z-20 flex h-12 items-center gap-1 bg-surface/90 px-3 backdrop-blur print:hidden md:px-5">
        <button type="button" onClick={openDrawer} aria-label="打開頁面目錄" className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink-strong md:hidden">
          <List size={20} />
        </button>
        <nav aria-label="頁面路徑" className="flex min-w-0 flex-1 items-center gap-1 text-sm text-muted">
          <span className="hidden max-w-[10rem] truncate md:inline">{notebook.title}</span>
          {crumbs.map((c, i) => (
            <span key={c.id} className={`min-w-0 items-center gap-1 ${i < crumbs.length - 1 ? 'hidden md:flex' : 'flex'}`}>
              <CaretRight size={10} className={`shrink-0 text-faint ${i === 0 ? 'hidden md:block' : ''}`} />
              <Link href={`/notebooks/${notebook.id}/${c.id}`} className="truncate rounded px-1 hover:bg-sunken hover:text-ink-strong">
                {c.icon && <NoteIcon icon={c.icon} className="mr-1 inline align-[-0.125em]" />}
                {c.title || UNTITLED}
              </Link>
            </span>
          ))}
          <span className="flex min-w-0 items-center gap-1">
            <CaretRight size={10} className={`shrink-0 text-faint ${crumbs.length ? '' : 'hidden md:block'}`} />
            <span className="truncate px-1 text-ink-strong">
              {icon && <NoteIcon icon={icon} className="mr-1 inline align-[-0.125em]" />}
              {title.trim() || UNTITLED}
            </span>
          </span>
        </nav>
        <span className="hidden shrink-0 px-1 sm:inline">
          <SaveStatusText status={merged.status} error={merged.error} />
        </span>
        {locked && (
          <button
            type="button"
            onClick={() => changeLook({ locked: false })}
            title="已鎖定，點一下解除"
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-sunken hover:text-ink-strong"
          >
            <LockSimple size={14} />
            <span className="hidden sm:inline">已鎖定</span>
          </button>
        )}
        {canFavorite && (
          <button
            type="button"
            onClick={() => changeLook({ favorite: !favorite })}
            aria-pressed={favorite}
            aria-label={favorite ? '從我的最愛移除' : '加入我的最愛'}
            title={favorite ? '從我的最愛移除' : '加入我的最愛'}
            className={`rounded-md p-1.5 transition-colors hover:bg-sunken ${favorite ? 'text-yellow-ink' : 'text-muted hover:text-ink-strong'}`}
          >
            <Star size={18} weight={favorite ? 'fill' : 'regular'} className={favorite ? 'star-pop' : ''} />
          </button>
        )}
        <PageMenu
          style={{ ...look, favorite }}
          canFavorite={canFavorite}
          onStyle={changeLook}
          stats={() => countWords(`${title}\n${blocksToText(latestContent())}`)}
          onDuplicate={duplicate}
          onCopyLink={copyLink}
          onMove={page.kind === 'item' ? undefined : () => openMove(id)}
          onExport={exportAs}
          onPrint={() => window.print()}
          onToggles={page.kind === 'board' ? undefined : setToggles}
          onTrash={() => trash(id, page.boardId)}
          onHistory={page.kind === 'board' ? undefined : () => setShowHistory(true)}
          template={page.kind === 'board' ? undefined : { value: templateFor, onChange: changeTemplate }}
        />
      </header>
      {showHistory && (
        <HistoryDialog
          pageId={id}
          locked={locked}
          onClose={() => setShowHistory(false)}
          onRestore={(content, at) => {
            editor.current?.replace(content)
            say(`已還原到 ${at} 的版本`)
          }}
        />
      )}

      <PageCover cover={cover.url} position={cover.position} onChange={changeCover} readOnly={locked} />
      {coverPicker.input}

      <article
        className={`note-page page-in note-font-${look.font} ${look.smallText ? 'note-small' : ''} mx-auto px-5 pb-40 md:px-14 ${width} ${cover.url ? 'pt-6' : 'pt-8 md:pt-16'}`}
      >
        <div className="relative flex flex-wrap items-end gap-1">
          {icon ? (
            <button
              type="button"
              onClick={() => setPicking(true)}
              disabled={locked}
              aria-label="更換圖示"
              className={`-ml-1 grid size-16 place-items-center rounded-lg text-5xl leading-none transition-colors enabled:hover:bg-sunken ${cover.url ? '-mt-14 bg-surface/0' : 'mb-2'}`}
            >
              <NoteIcon icon={icon} />
            </button>
          ) : null}
          {!locked && (
            <div className={`page-affordances flex gap-1 print:hidden ${icon ? 'mb-2 ml-2' : 'mb-2'}`}>
              {!icon && (
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-faint transition-colors hover:bg-sunken hover:text-muted"
                >
                  {page.kind === 'board' ? <Kanban size={16} /> : <Smiley size={16} />}
                  新增圖示
                </button>
              )}
              {!cover.url && (
                <button
                  type="button"
                  onClick={coverPicker.open}
                  disabled={coverPicker.busy}
                  className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-faint transition-colors hover:bg-sunken hover:text-muted"
                >
                  <ImageSquare size={16} />
                  {coverPicker.busy ? '上傳中…' : '新增封面'}
                </button>
              )}
            </div>
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
          readOnly={locked}
          rows={1}
          placeholder={UNTITLED}
          aria-label="標題"
          autoFocus={!locked && !page.title && !page.content?.length && page.kind !== 'board'}
          className="note-title field-sizing-content w-full resize-none overflow-hidden bg-transparent text-3xl leading-tight font-semibold tracking-tight text-ink-strong outline-none placeholder:text-line-strong md:text-[2.5rem]"
        />

        {page.kind === 'item' && page.boardId != null && (
          <div className="mt-5 border-b border-line pb-5">
            <ItemProperties boardId={page.boardId} itemId={id} />
          </div>
        )}

        {page.kind === 'board' ? (
          <div className="mt-6">
            <BoardView boardId={id} />
          </div>
        ) : (
          /* The editor's left gutter holds the block handles; pull it into the margin so text lines up with the title. */
          <div className="mt-4 -ml-7 md:-ml-11">
            <NoteContext.Provider value={note}>
              <BlockEditor
                key={id}
                target={{ kind: 'note', id }}
                initial={page.content}
                renderedAt={renderedAt}
                editable={!locked}
                className="note-editor"
                placeholder="輸入文字，或按 / 插入標題、清單、頁面、看板…"
                allowUploads
                // A template page itself doesn't offer templates.
                templateKind={templateFor ? undefined : 'page'}
                editorHandle={editor}
                onChange={(blocks) => {
                  rememberPageEdit(id, { content: blocks })
                  const next = embeddedPageIds(blocks)
                  setEmbedded((prev) => (sameIds(prev, next) ? prev : next))
                }}
                onStatus={(s, err) => setBody({ status: s, error: err })}
              />
            </NoteContext.Provider>
          </div>
        )}

        <Backlinks pageId={id} />

        {page.kind !== 'board' && (kids.length > 0 || !locked) && (
          <section aria-label="子頁面" className="mt-10 border-t border-line pt-4 print:hidden">
            {kids.length > 0 && (
              <ul className="mb-1">
                {kids.map((k) => (
                  <li key={k.id}>
                    <Link href={`/notebooks/${notebook.id}/${k.id}`} className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-ink hover:bg-sunken">
                      <span className="grid size-5 place-items-center text-base leading-none text-muted">
                        <NoteIcon icon={k.icon} fallback={k.kind === 'board' ? <Kanban size={18} /> : <FileText size={18} />} />
                      </span>
                      <span className={`truncate underline decoration-line-strong underline-offset-4 ${k.title ? '' : 'text-muted'}`}>{k.title || UNTITLED}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {!locked && (
              <>
                <button type="button" onClick={() => addPage(id)} className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-sunken hover:text-ink-strong">
                  <Plus size={16} />
                  新增子頁面
                </button>
                <p className="mt-1 text-xs text-faint">也可以在文章任何地方輸入 /頁面 插入子頁面</p>
              </>
            )}
          </section>
        )}
      </article>
    </>
  )
}
