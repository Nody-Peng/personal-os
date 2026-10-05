'use client'

import { createReactBlockSpec } from '@blocknote/react'
import { ArrowUpRight, Kanban } from '@phosphor-icons/react'
import Link from 'next/link'
import { BoardView } from '@/components/notebooks/board/BoardView'
import { NoteIcon } from '@/components/notebooks/NoteIcon'
import { useOptionalNotebook } from '@/components/notebooks/NotebookShell'
import { usePageLink } from '@/lib/pageLinks'
import { UNTITLED } from '@/lib/notes'

/** A todo board (Notion-style inline database) living inside a page. */
export const BoardBlock = createReactBlockSpec(
  { type: 'board', propSchema: { boardId: { default: 0 } }, content: 'none' },
  {
    render: function BoardBlockView({ block }) {
      const notebook = useOptionalNotebook()
      if (block.props.boardId <= 0) return <div className="note-pagelink text-muted">建立看板中…</div>
      // Boards need their notebook; anywhere else (pasted into a day or week
      // note) the block becomes a link to it.
      if (!notebook) return <BoardLink boardId={block.props.boardId} />
      return (
        <div className="w-full" contentEditable={false}>
          <BoardView boardId={block.props.boardId} embedded />
        </div>
      )
    },
  },
)

function BoardLink({ boardId }: { boardId: number }) {
  const info = usePageLink(boardId)
  if (info === undefined) return <div className="note-pagelink text-muted" contentEditable={false}>載入看板…</div>
  if (info === 'missing') return <div className="note-pagelink text-muted" contentEditable={false}>這個看板已經不在了</div>
  return (
    <Link href={`/notebooks/${info.notebookId}/${info.id}`} className="note-pagelink" contentEditable={false}>
      <span className="grid size-5 place-items-center text-base leading-none text-muted">
        <NoteIcon icon={info.icon} fallback={<Kanban size={18} />} />
      </span>
      <span className="truncate underline decoration-line-strong underline-offset-4">{info.title || UNTITLED}</span>
      <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted">
        看板 · {info.notebookTitle}
        <ArrowUpRight size={12} />
      </span>
    </Link>
  )
}
