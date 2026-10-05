'use client'

import { FileText, Stack } from '@phosphor-icons/react'
import { UNTITLED, childrenOf, flattenTree, subtreeIds } from '@/lib/notes'
import { Modal } from './Modal'
import { useNotebook } from './NotebookShell'
import { NoteIcon } from './NoteIcon'

/** Pick a new parent for a page (works on phones, where dragging doesn't). */
export function MoveDialog({ pageId, onClose }: { pageId: number; onClose: () => void }) {
  const { pages, move } = useNotebook()
  const page = pages.find((p) => p.id === pageId)
  const blocked = new Set(subtreeIds(pages, pageId))
  const targets = flattenTree(pages).filter(({ page: p }) => !blocked.has(p.id))

  const choose = (parent: number | null) => {
    if (page && parent !== page.parent) move(pageId, parent, childrenOf(pages, parent).filter((p) => p.id !== pageId).length)
    onClose()
  }

  const row = 'flex h-9 w-full items-center gap-2 rounded-md pr-3 text-left text-sm hover:bg-sunken disabled:pointer-events-none disabled:opacity-50'

  return (
    <Modal title={`把「${page?.title || UNTITLED}」移動到…`} onClose={onClose}>
      <ul className="p-2">
        <li>
          <button type="button" className={`${row} pl-3`} disabled={page?.parent == null} onClick={() => choose(null)}>
            <Stack size={16} className="text-muted" />
            最上層
            {page?.parent == null && <span className="ml-auto text-xs text-muted">目前位置</span>}
          </button>
        </li>
        {targets.map(({ page: p, depth }) => (
          <li key={p.id}>
            <button type="button" className={row} style={{ paddingLeft: 12 + (depth + 1) * 14 }} disabled={page?.parent === p.id} onClick={() => choose(p.id)}>
              <span className="grid size-4 place-items-center text-sm leading-none text-muted"><NoteIcon icon={p.icon} fallback={<FileText size={16} />} /></span>
              <span className="truncate">{p.title || UNTITLED}</span>
              {page?.parent === p.id && <span className="ml-auto shrink-0 text-xs text-muted">目前位置</span>}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
