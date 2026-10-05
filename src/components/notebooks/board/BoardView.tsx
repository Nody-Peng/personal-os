'use client'

import { ArrowsOutSimple, CalendarBlank, Columns, FileText, Kanban, Plus, Table } from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { updatePage } from '@/app/(frontend)/notebook-actions'
import { addItem, moveCard, renameBoard, useBoard } from '@/lib/boardStore'
import { UNTITLED, columnOf, type BoardItem } from '@/lib/notes'
import { ITEM_STATUSES, type ItemStatus } from '@/lib/options'
import { reportNoteError } from '@/lib/uploadMedia'
import { useNotebook } from '../NotebookShell'
import { COLUMN_TINT, StatusTag, formatRange, statusOf } from './StatusTag'
import { NoteIcon } from '../NoteIcon'

type View = 'board' | 'table'

// The chosen view is remembered per board on this device.
const viewListeners = new Set<() => void>()
const viewKey = (id: number) => `board:${id}:view`
function readView(id: number): View {
  try {
    return window.localStorage.getItem(viewKey(id)) === 'table' ? 'table' : 'board'
  } catch {
    return 'board'
  }
}
function writeView(id: number, view: View) {
  try {
    window.localStorage.setItem(viewKey(id), view)
  } catch {
    // Private mode: the choice just isn't remembered.
  }
  viewListeners.forEach((notify) => notify())
}

/** A todo board: cards grouped by status (看板) or as rows (表格). Every card is a page. */
export function BoardView({ boardId, embedded = false }: { boardId: number; embedded?: boolean }) {
  const { notebook, openPeek, patchPage } = useNotebook()
  const { status, data, error } = useBoard(boardId)
  const view = useSyncExternalStore(
    (notify) => {
      viewListeners.add(notify)
      return () => viewListeners.delete(notify)
    },
    () => readView(boardId),
    () => 'board' as View,
  )
  const [title, setTitle] = useState<string | null>(null)
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingTitle = useRef<string | null>(null)
  const saveTitle = useCallback(async () => {
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = null
    const value = pendingTitle.current
    pendingTitle.current = null
    if (value == null) return
    const result = await updatePage(boardId, { title: value })
    if (!result.ok) reportNoteError(result.error)
  }, [boardId])
  // Leaving right after typing still saves the new name.
  useEffect(() => () => void saveTitle(), [saveTitle])

  const create = async (column: ItemStatus) => {
    const result = await addItem(boardId, column)
    if (typeof result === 'string') reportNoteError(result)
    else openPeek(result.id)
  }

  const rename = (value: string) => {
    setTitle(value)
    renameBoard(boardId, value)
    patchPage(boardId, { title: value.trim() })
    pendingTitle.current = value
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(saveTitle, 600)
  }

  if (status === 'loading' && !data) return <div className="my-2 h-40 animate-pulse rounded-xl bg-sunken" aria-label="載入看板" />
  if (!data) return <p className="my-2 rounded-lg bg-red-soft px-3 py-2 text-sm text-red-ink">看板載入失敗：{error}</p>

  return (
    <section className={`note-board ${embedded ? 'my-3' : ''}`} aria-label={data.title || '看板'}>
      {embedded && (
        <div className="mb-2 flex items-center gap-2">
          <Kanban size={20} className="shrink-0 text-muted" />
          <input
            value={title ?? data.title}
            onChange={(e) => rename(e.target.value)}
            placeholder="未命名看板"
            aria-label="看板名稱"
            className="min-w-0 flex-1 bg-transparent text-xl font-semibold tracking-tight text-ink-strong outline-none placeholder:text-faint"
          />
          <Link
            href={`/notebooks/${notebook.id}/${boardId}`}
            title="以整頁開啟"
            aria-label="以整頁開啟看板"
            className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink-strong"
          >
            <ArrowsOutSimple size={16} />
          </Link>
        </div>
      )}

      <div className="mb-3 flex items-center gap-1 border-b border-line pb-2">
        {(
          [
            ['board', '看板', Columns],
            ['table', '表格', Table],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => writeView(boardId, value)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors ${
              view === value ? 'bg-sunken font-medium text-ink-strong' : 'text-muted hover:text-ink-strong'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted">{data.items.length} 項</span>
        <button type="button" onClick={() => create('todo')} className="btn btn-primary ml-2 px-2.5 py-1 text-xs">
          <Plus size={13} weight="bold" />
          新增
        </button>
      </div>

      {view === 'board' ? (
        <KanbanView boardId={boardId} items={data.items} onOpen={openPeek} onCreate={create} />
      ) : (
        <TableView items={data.items} onOpen={openPeek} onCreate={() => create('todo')} />
      )}
    </section>
  )
}

type Drop = { status: ItemStatus; index: number } | null

function KanbanView({
  boardId,
  items,
  onOpen,
  onCreate,
}: {
  boardId: number
  items: BoardItem[]
  onOpen: (id: number) => void
  onCreate: (status: ItemStatus) => void
}) {
  const [dragging, setDragging] = useState<number | null>(null)
  const [drop, setDrop] = useState<Drop>(null)

  const finish = async () => {
    const id = dragging
    const target = drop
    setDragging(null)
    setDrop(null)
    if (id == null || !target) return
    const error = await moveCard(boardId, id, target.status, target.index)
    if (error) reportNoteError(error)
  }

  return (
    <div className="-mx-1 snap-x snap-mandatory overflow-x-auto scroll-px-1 px-1 pb-2 md:snap-none">
      <div className="flex min-w-max items-start gap-3">
        {ITEM_STATUSES.map((s) => {
          const cards = columnOf(items, s.value)
          const visible = cards.filter((c) => c.id !== dragging)
          return (
            <div
              key={s.value}
              className={`w-[min(16rem,78vw)] shrink-0 snap-start rounded-xl p-2 ${COLUMN_TINT[s.tone]}`}
              onDragOver={(e) => {
                if (dragging == null) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                // Insert before the first card whose middle is below the pointer.
                const rows = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-card]')].filter(
                  (el) => Number(el.dataset.card) !== dragging,
                )
                const index = rows.findIndex((el) => {
                  const r = el.getBoundingClientRect()
                  return e.clientY < r.top + r.height / 2
                })
                const next = { status: s.value, index: index === -1 ? rows.length : index }
                if (drop?.status !== next.status || drop.index !== next.index) setDrop(next)
              }}
              onDrop={(e) => {
                e.preventDefault()
                void finish()
              }}
            >
              <div className="mb-2 flex items-center gap-2 px-1">
                <StatusTag status={s.value} />
                <span className="text-xs text-muted">{cards.length}</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {visible.map((card, i) => (
                  <li key={card.id} data-card={card.id}>
                    {drop?.status === s.value && drop.index === i && <DropLine />}
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', String(card.id))
                        setDragging(card.id)
                      }}
                      onDragEnd={() => {
                        setDragging(null)
                        setDrop(null)
                      }}
                      onClick={() => onOpen(card.id)}
                      className="flex w-full flex-col gap-1 rounded-lg border border-line bg-surface px-3 py-2 text-left shadow-[0_1px_2px_rgba(17,17,17,0.04)] transition-colors hover:border-line-strong"
                    >
                      <span className="flex items-start gap-2">
                        <span className="mt-0.5 grid size-4 shrink-0 place-items-center text-sm leading-none text-muted">
                          <NoteIcon icon={card.icon} fallback={<FileText size={15} />} />
                        </span>
                        <span className={`text-sm font-medium break-words ${card.title ? 'text-ink-strong' : 'text-faint'}`}>
                          {card.title || UNTITLED}
                        </span>
                      </span>
                      {card.startDate && (
                        <span className="flex items-center gap-1 pl-6 text-xs text-muted">
                          <CalendarBlank size={12} />
                          {formatRange(card.startDate, card.endDate)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
                {drop?.status === s.value && drop.index >= visible.length && <DropLine />}
              </ul>
              <button
                type="button"
                onClick={() => onCreate(s.value)}
                className="mt-1.5 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-surface/70 hover:text-ink-strong"
              >
                <Plus size={14} />
                新增頁面
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const DropLine = () => <span className="mb-1.5 block h-0.5 rounded bg-accent" aria-hidden />

function TableView({ items, onOpen, onCreate }: { items: BoardItem[]; onOpen: (id: number) => void; onCreate: () => void }) {
  const order = new Map(ITEM_STATUSES.map((s, i) => [s.value, i]))
  const rows = [...items].sort((a, b) => order.get(a.status)! - order.get(b.status)! || a.position - b.position || a.id - b.id)
  const titleOf = (id: number | null) => {
    const found = id == null ? null : items.find((i) => i.id === id)
    return found ? found.title || UNTITLED : ''
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="py-2 pr-3 font-medium">名稱</th>
            <th className="w-28 py-2 pr-3 font-medium">狀態</th>
            <th className="w-32 py-2 pr-3 font-medium">日期</th>
            <th className="w-40 py-2 font-medium">上級項目</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id} onClick={() => onOpen(item.id)} className="cursor-pointer border-b border-line hover:bg-sunken/60">
              <td className="py-2 pr-3">
                <span className="flex items-center gap-2">
                  <span className="grid size-4 shrink-0 place-items-center text-sm leading-none text-muted">
                    <NoteIcon icon={item.icon} fallback={<FileText size={15} />} />
                  </span>
                  <button type="button" className={`truncate text-left font-medium ${item.title ? 'text-ink-strong' : 'text-faint'}`}>
                    {item.title || UNTITLED}
                  </button>
                </span>
              </td>
              <td className="py-2 pr-3">
                <StatusTag status={item.status} />
              </td>
              <td className="py-2 pr-3 text-muted tabular-nums">{formatRange(item.startDate, item.endDate)}</td>
              <td className="truncate py-2 text-muted">{titleOf(item.parentItem)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={onCreate}
        className="mt-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-sunken hover:text-ink-strong"
      >
        <Plus size={14} />
        新增
      </button>
      {!items.length && <p className="px-2 pb-2 text-xs text-faint">還沒有項目，按「新增」建立第一張卡片（{statusOf('todo').label}）。</p>}
    </div>
  )
}
