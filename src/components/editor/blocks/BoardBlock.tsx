'use client'

import { createReactBlockSpec } from '@blocknote/react'
import { BoardView } from '@/components/notebooks/board/BoardView'

/** A todo board (Notion-style inline database) living inside a page. */
export const BoardBlock = createReactBlockSpec(
  { type: 'board', propSchema: { boardId: { default: 0 } }, content: 'none' },
  {
    render: function BoardBlockView({ block }) {
      if (block.props.boardId <= 0) return <div className="note-pagelink text-muted">建立看板中…</div>
      return (
        <div className="w-full" contentEditable={false}>
          <BoardView boardId={block.props.boardId} embedded />
        </div>
      )
    },
  },
)
