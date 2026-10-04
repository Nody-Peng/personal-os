'use client'

import { ArrowsDownUp, CaretRight, DotsThree, FileText, Plus, Trash } from '@phosphor-icons/react'
import Link from 'next/link'
import { useState } from 'react'
import { UNTITLED, childrenOf, subtreeIds, type PageNode } from '@/lib/notes'
import { Menu } from './Menu'
import { useNotebook } from './NotebookShell'

type Zone = 'before' | 'inside' | 'after'
type Drop = { id: number; zone: Zone } | null

const INDENT = 14

/** The page tree; rows can be dragged above, below or into each other (desktop). */
export function PageTree() {
  const { pages, move } = useNotebook()
  const [dragging, setDragging] = useState<number | null>(null)
  const [drop, setDrop] = useState<Drop>(null)

  const roots = childrenOf(pages, null)
  const blocked = dragging != null ? new Set(subtreeIds(pages, dragging)) : new Set<number>()

  const finish = () => {
    if (dragging != null && drop) {
      const target = pages.find((p) => p.id === drop.id)
      if (target && !blocked.has(target.id)) {
        if (drop.zone === 'inside') move(dragging, target.id, childrenOf(pages, target.id).filter((p) => p.id !== dragging).length)
        else {
          const siblings = childrenOf(pages, target.parent).filter((p) => p.id !== dragging)
          const at = siblings.findIndex((p) => p.id === target.id)
          move(dragging, target.parent, drop.zone === 'before' ? at : at + 1)
        }
      }
    }
    setDragging(null)
    setDrop(null)
  }

  if (!roots.length) return <p className="px-2 py-2 text-sm text-faint">還沒有頁面</p>

  return (
    <ul
      role="tree"
      aria-label="頁面"
      onDragEnd={() => {
        setDragging(null)
        setDrop(null)
      }}
    >
      {roots.map((page) => (
        <TreeItem
          key={page.id}
          page={page}
          depth={0}
          drag={{ dragging, drop, blocked, setDragging, setDrop, finish }}
        />
      ))}
    </ul>
  )
}

type DragState = {
  dragging: number | null
  drop: Drop
  blocked: Set<number>
  setDragging: (id: number | null) => void
  setDrop: (drop: Drop) => void
  finish: () => void
}

function TreeItem({ page, depth, drag }: { page: PageNode; depth: number; drag: DragState }) {
  const { pages, notebook, currentId, expanded, toggle, addPage, trash, openMove } = useNotebook()
  const kids = childrenOf(pages, page.id)
  const open = expanded.has(page.id)
  const active = page.id === currentId
  const dropHere = drag.drop?.id === page.id ? drag.drop.zone : null

  const onDragOver = (e: React.DragEvent) => {
    if (drag.dragging == null || drag.blocked.has(page.id)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const r = e.currentTarget.getBoundingClientRect()
    const y = (e.clientY - r.top) / r.height
    const zone: Zone = y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'inside'
    if (drag.drop?.id !== page.id || drag.drop.zone !== zone) drag.setDrop({ id: page.id, zone })
  }

  return (
    <li role="treeitem" aria-expanded={kids.length ? open : undefined} aria-selected={active}>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', String(page.id))
          drag.setDragging(page.id)
        }}
        onDragOver={onDragOver}
        onDrop={(e) => {
          e.preventDefault()
          drag.finish()
        }}
        className={`group relative flex h-8 items-center gap-0.5 rounded-md pr-1 text-sm transition-colors ${
          active ? 'bg-surface font-medium text-ink-strong ring-1 ring-line' : 'text-ink hover:bg-sunken'
        } ${dropHere === 'inside' ? 'bg-accent-soft ring-1 ring-accent/40' : ''} ${drag.dragging === page.id ? 'opacity-40' : ''}`}
        style={{ paddingLeft: 4 + depth * INDENT }}
      >
        {dropHere === 'before' && <span className="pointer-events-none absolute inset-x-1 -top-px h-0.5 rounded bg-accent" aria-hidden />}
        {dropHere === 'after' && <span className="pointer-events-none absolute inset-x-1 -bottom-px h-0.5 rounded bg-accent" aria-hidden />}

        <button
          type="button"
          onClick={() => toggle(page.id)}
          aria-label={open ? '收合' : '展開'}
          tabIndex={kids.length ? 0 : -1}
          className={`grid size-6 shrink-0 place-items-center rounded text-faint hover:bg-line hover:text-ink-strong ${kids.length ? '' : 'invisible'}`}
        >
          <CaretRight size={12} weight="bold" className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
        </button>

        <Link
          href={`/notebooks/${notebook.id}/${page.id}`}
          aria-current={active ? 'page' : undefined}
          draggable={false}
          className="flex min-w-0 flex-1 items-center gap-2 py-1 outline-none"
        >
          <span className="grid size-5 shrink-0 place-items-center text-[15px] leading-none text-muted">
            {page.icon || <FileText size={16} />}
          </span>
          <span className={`truncate ${page.title ? '' : 'text-muted'}`}>{page.title || UNTITLED}</span>
        </Link>

        <span className="flex shrink-0 items-center md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <Menu
            label="頁面選項"
            className="grid size-6 place-items-center rounded text-muted hover:bg-line hover:text-ink-strong"
            items={[
              { label: '新增子頁面', icon: <Plus size={14} />, onSelect: () => addPage(page.id) },
              { label: '移動到…', icon: <ArrowsDownUp size={14} />, onSelect: () => openMove(page.id) },
              { label: '移到垃圾桶', icon: <Trash size={14} />, onSelect: () => trash(page.id), danger: true },
            ]}
          >
            <DotsThree size={16} weight="bold" />
          </Menu>
          <button
            type="button"
            onClick={() => addPage(page.id)}
            aria-label="新增子頁面"
            title="新增子頁面"
            className="grid size-6 place-items-center rounded text-muted hover:bg-line hover:text-ink-strong"
          >
            <Plus size={14} />
          </button>
        </span>
      </div>

      {open && kids.length > 0 && (
        <ul role="group">
          {kids.map((child) => (
            <TreeItem key={child.id} page={child} depth={depth + 1} drag={drag} />
          ))}
        </ul>
      )}
    </li>
  )
}
