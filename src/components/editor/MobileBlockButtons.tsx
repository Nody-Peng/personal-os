'use client'

import { SuggestionMenu } from '@blocknote/core/extensions'
import { useBlockNoteEditor, useComponentsContext, useUIMode } from '@blocknote/react'
import { ArrowDown, ArrowUp, CopySimple, Plus, Trash } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { blockSelection } from './blockSelection'

/**
 * Phones have no hover, and the ⋮⋮ handles sit left of the text, off a narrow
 * screen, so they are hidden there (styles.css). On a touch screen BlockNote
 * keeps its toolbar above the keyboard while typing; this puts what the
 * handles offered at its start, as in Notion's app: insert, move up or down,
 * duplicate, delete. Desktop toolbars leave them out.
 */
export function MobileBlockButtons() {
  const Components = useComponentsContext()!
  const editor = useBlockNoteEditor()
  const mode = useUIMode()
  if (mode !== 'mobile') return null

  const current = () => editor.getTextCursorPosition().block
  const actions: { label: string; icon: ReactNode; run: () => void }[] = [
    // The block menu without typing a "/" (closing it leaves the text as it was).
    { label: '插入區塊', icon: <Plus size={18} />, run: () => editor.getExtension(SuggestionMenu)?.openSuggestionMenu('/') },
    { label: '上移', icon: <ArrowUp size={18} />, run: () => editor.moveBlocksUp() },
    { label: '下移', icon: <ArrowDown size={18} />, run: () => editor.moveBlocksDown() },
    { label: '建立副本', icon: <CopySimple size={18} />, run: () => editor.getExtension(blockSelection)?.duplicateFrom(current().id) },
    { label: '刪除區塊', icon: <Trash size={18} />, run: () => editor.getExtension(blockSelection)?.removeFrom(current().id) },
  ]
  return (
    <>
      {actions.map((a) => (
        <Components.FormattingToolbar.Button key={a.label} className="bn-button" label={a.label} mainTooltip={a.label} icon={a.icon} onClick={a.run} />
      ))}
      <span aria-hidden className="mx-1 h-5 w-px shrink-0 self-center bg-line" />
    </>
  )
}
