'use client'

import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createBoard, createPage, movePage, trashPage } from '@/app/(frontend)/notebook-actions'
import type { NoteEditorContext } from '@/components/editor/NoteContext'
import { dropItems } from '@/lib/boardStore'
import { rememberTree, treeWithEdits } from '@/lib/noteCache'
import { ancestorsOf, applyMove, childrenOf, subtreeIds, type NotebookItem, type PageNode } from '@/lib/notes'
import { ItemPeek } from './board/ItemPeek'
import { MoveDialog } from './MoveDialog'
import { NotebookDialog } from './NotebookDialog'
import { NoteSearch, useSearchShortcut } from './NoteSearch'
import { Sidebar } from './Sidebar'
import { TrashDialog } from './TrashDialog'

type NotebookContextValue = {
  notebook: NotebookItem
  pages: PageNode[]
  currentId: number | null
  expanded: Set<number>
  toggle: (id: number, open?: boolean) => void
  addPage: (parent: number | null) => void
  patchPage: (id: number, patch: Partial<Pick<PageNode, 'title' | 'icon'>>) => void
  /** `parentHint`: where to go if the page isn't in the tree (board cards). */
  trash: (id: number, parentHint?: number | null) => void
  move: (id: number, parent: number | null, index: number) => void
  /** Pages that appeared elsewhere (restored from the trash, created in the text). */
  restored: (pages: PageNode[]) => void
  /** A page beside the current one (board cards): ?peek=<id>. */
  openPeek: (id: number) => void
  notify: (error: string) => void
  openDrawer: () => void
  openSearch: () => void
  openTrash: () => void
  openSettings: () => void
  openMove: (id: number) => void
}

const NotebookContext = createContext<NotebookContextValue | null>(null)

/** Context for notebook-aware editor blocks inside page `pageId`. */
export function useNoteEditorContext(pageId: number): NoteEditorContext {
  const { notebook, pages, restored, openPeek, notify } = useNotebook()
  return useMemo(
    () => ({
      notebookId: notebook.id,
      pageId,
      pages,
      openPeek,
      createChildPage: async () => {
        const result = await createPage(notebook.id, pageId)
        if (!result.ok || !result.data) {
          notify(result.ok ? '新增頁面失敗' : result.error)
          return null
        }
        restored([result.data])
        return result.data
      },
      createBoard: async () => {
        const result = await createBoard(pageId)
        if (!result.ok || !result.data) {
          notify(result.ok ? '新增看板失敗' : result.error)
          return null
        }
        restored([result.data])
        return result.data
      },
    }),
    [notebook.id, pageId, pages, restored, openPeek, notify],
  )
}

export function useNotebook(): NotebookContextValue {
  const value = useContext(NotebookContext)
  if (!value) throw new Error('useNotebook needs NotebookShell')
  return value
}

const urlOf = (notebookId: number, pageId: number) => `/notebooks/${notebookId}/${pageId}`

// Expanded pages are remembered per notebook on this device (localStorage),
// read through useSyncExternalStore so the server render stays collapsed.
const listeners = new Set<() => void>()
const expandedKey = (notebookId: number) => `notebook:${notebookId}:open`

function readExpanded(notebookId: number): string {
  try {
    return window.localStorage.getItem(expandedKey(notebookId)) ?? '[]'
  } catch {
    return '[]'
  }
}

function writeExpanded(notebookId: number, ids: Set<number>) {
  try {
    window.localStorage.setItem(expandedKey(notebookId), JSON.stringify([...ids]))
  } catch {
    // Private mode: the tree just won't remember.
  }
  listeners.forEach((notify) => notify())
}

function subscribeExpanded(notify: () => void) {
  listeners.add(notify)
  return () => listeners.delete(notify)
}

function parseIds(raw: string): Set<number> {
  try {
    const list: unknown = JSON.parse(raw)
    return new Set(Array.isArray(list) ? list.filter((n): n is number => typeof n === 'number') : [])
  } catch {
    return new Set()
  }
}

type Props = { notebook: NotebookItem; pages: PageNode[]; renderedAt: number; children: ReactNode }

/** Notion-like frame: page tree on the left (a drawer on phones), page on the right. */
export function NotebookShell({ notebook: initialNotebook, pages: serverPages, renderedAt, children }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams<{ pageId?: string }>()
  const currentId = params.pageId ? Number(params.pageId) : null

  const [notebook, setNotebook] = useState(initialNotebook)
  const [pages, setPagesState] = useState(() => treeWithEdits(initialNotebook.id, serverPages, renderedAt))
  const expandedRaw = useSyncExternalStore(
    subscribeExpanded,
    () => readExpanded(initialNotebook.id),
    () => '[]',
  )
  const expanded = useMemo(() => parseIds(expandedRaw), [expandedRaw])
  // The drawer belongs to the path it was opened on, so navigating closes it.
  const [drawerAt, setDrawerAt] = useState<string | null>(null)
  const drawer = drawerAt === pathname
  const [dialog, setDialog] = useState<'search' | 'trash' | 'settings' | { move: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pagesRef = useRef(pages)

  const setPages = useCallback(
    (update: (pages: PageNode[]) => PageNode[]) => {
      const next = update(pagesRef.current)
      pagesRef.current = next
      rememberTree(initialNotebook.id, next)
      setPagesState(next)
    },
    [initialNotebook.id],
  )

  const toggle = useCallback(
    (id: number, open?: boolean) => {
      const next = parseIds(readExpanded(initialNotebook.id))
      if (open ?? !next.has(id)) next.add(id)
      else next.delete(id)
      writeExpanded(initialNotebook.id, next)
    },
    [initialNotebook.id],
  )

  // Always show where the open page sits.
  useEffect(() => {
    if (currentId == null) return
    const parents = ancestorsOf(pagesRef.current, currentId).map((p) => p.id)
    const open = parseIds(readExpanded(initialNotebook.id))
    if (parents.some((id) => !open.has(id))) writeExpanded(initialNotebook.id, new Set([...open, ...parents]))
  }, [currentId, initialNotebook.id])

  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(() => setError(null), 5000)
    return () => window.clearTimeout(timer)
  }, [error])

  useSearchShortcut(() => setDialog('search'))

  // Uploads and blocks deep inside the editor report errors through an event.
  useEffect(() => {
    const onError = (e: Event) => setError(String((e as CustomEvent<string>).detail))
    window.addEventListener('notes:error', onError)
    return () => window.removeEventListener('notes:error', onError)
  }, [])

  const openPeek = useCallback((id: number) => router.push(`${pathname}?peek=${id}`, { scroll: false }), [router, pathname])

  const addPage = useCallback(
    async (parent: number | null) => {
      const result = await createPage(initialNotebook.id, parent)
      if (!result.ok || !result.data) return setError(result.ok ? '新增失敗' : result.error)
      const page = result.data
      setPages((prev) => [...prev, page])
      if (parent != null) toggle(parent, true)
      router.push(urlOf(initialNotebook.id, page.id))
    },
    [initialNotebook.id, router, setPages, toggle],
  )

  const patchPage = useCallback(
    (id: number, patch: Partial<Pick<PageNode, 'title' | 'icon'>>) =>
      setPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    [setPages],
  )

  const trash = useCallback(
    async (id: number, parentHint: number | null = null) => {
      const before = pagesRef.current
      const removed = new Set(subtreeIds(before, id))
      const page = before.find((p) => p.id === id)
      setPages((prev) => prev.filter((p) => !removed.has(p.id)))
      if (currentId != null && removed.has(currentId)) {
        const rest = before.filter((p) => !removed.has(p.id))
        const parent = page ? page.parent : parentHint
        const next = (parent != null && rest.find((p) => p.id === parent)) || childrenOf(rest, null)[0]
        router.replace(next ? urlOf(initialNotebook.id, next.id) : `/notebooks/${initialNotebook.id}`)
      }
      const result = await trashPage(id)
      if (!result.ok) {
        setPages(() => before)
        setError(result.error)
      } else if (parentHint != null) {
        dropItems(parentHint, result.data ?? [id])
      }
    },
    [currentId, initialNotebook.id, router, setPages],
  )

  const move = useCallback(
    async (id: number, parent: number | null, index: number) => {
      const before = pagesRef.current
      try {
        setPages(() => applyMove(before, id, parent, index))
      } catch (e) {
        return setError(e instanceof Error ? e.message : '無法移動')
      }
      if (parent != null) toggle(parent, true)
      const result = await movePage(id, parent, index)
      if (!result.ok) {
        setPages(() => before)
        setError(result.error)
      }
    },
    [setPages, toggle],
  )

  const restored = useCallback(
    (back: PageNode[]) => {
      const ids = new Set(back.map((p) => p.id))
      setPages((prev) => [...prev.filter((p) => !ids.has(p.id)), ...back])
    },
    [setPages],
  )

  const value = useMemo<NotebookContextValue>(
    () => ({
      notebook,
      pages,
      currentId,
      expanded,
      toggle,
      addPage,
      patchPage,
      trash,
      move,
      restored,
      openPeek,
      notify: setError,
      openDrawer: () => setDrawerAt(pathname),
      openSearch: () => setDialog('search'),
      openTrash: () => setDialog('trash'),
      openSettings: () => setDialog('settings'),
      openMove: (id: number) => setDialog({ move: id }),
    }),
    [notebook, pages, currentId, expanded, toggle, addPage, patchPage, trash, move, restored, openPeek, pathname],
  )

  return (
    <NotebookContext.Provider value={value}>
      <div className="flex min-h-[100dvh] bg-surface">
        <aside className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 border-r border-line bg-canvas md:block lg:w-72">
          <Sidebar />
        </aside>

        {drawer && (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="頁面目錄">
            <button type="button" aria-label="關閉目錄" onClick={() => setDrawerAt(null)} className="modal-scrim absolute inset-0 bg-ink-strong/25" />
            <aside className="drawer-in absolute inset-y-0 left-0 w-[86%] max-w-xs border-r border-line bg-canvas shadow-[0_0_48px_rgba(17,17,17,0.18)]">
              <Sidebar onClose={() => setDrawerAt(null)} />
            </aside>
          </div>
        )}

        <div className="min-w-0 flex-1">{children}</div>
      </div>

      {error && (
        <p
          role="alert"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-red-ink/20 bg-red-soft px-4 py-2 text-sm text-red-ink shadow-[0_12px_32px_-16px_rgba(17,17,17,0.3)]"
        >
          {error}
        </p>
      )}

      {dialog === 'search' && <NoteSearch onClose={() => setDialog(null)} />}
      {dialog === 'trash' && <TrashDialog onClose={() => setDialog(null)} />}
      {dialog === 'settings' && (
        <NotebookDialog notebook={notebook} onClose={() => setDialog(null)} onSaved={(n) => setNotebook(n)} />
      )}
      {dialog && typeof dialog === 'object' && <MoveDialog pageId={dialog.move} onClose={() => setDialog(null)} />}
      <Suspense>
        <PeekFromUrl />
      </Suspense>
    </NotebookContext.Provider>
  )
}

function PeekFromUrl() {
  const router = useRouter()
  const pathname = usePathname()
  const id = Number(useSearchParams().get('peek'))
  if (!Number.isInteger(id) || id <= 0) return null
  return <ItemPeek key={id} id={id} onClose={() => router.push(pathname, { scroll: false })} />
}
