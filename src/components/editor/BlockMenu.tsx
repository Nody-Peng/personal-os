'use client'

import { SideMenuExtension } from '@blocknote/core/extensions'
import {
  AddBlockButton,
  BlockColorsItem,
  DragHandleButton,
  DragHandleMenu,
  SideMenu,
  SideMenuController,
  TableColumnHeaderItem,
  TableRowHeaderItem,
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
  useExtensionState,
  type SideMenuProps,
} from '@blocknote/react'
import type { Selection } from 'prosemirror-state'
import { useRef, type ReactNode } from 'react'
import { blockSelection } from './blockSelection'
import type { editorSchema } from './schema'

type Schema = typeof editorSchema

/** Shows a short confirmation in the notebook's toast (NotebookShell listens). */
export function reportNoteInfo(message: string) {
  window.dispatchEvent(new CustomEvent('notes:info', { detail: message }))
}

function useMenuBlock() {
  const editor = useBlockNoteEditor<Schema['blockSchema'], Schema['inlineContentSchema'], Schema['styleSchema']>()
  const block = useExtensionState(SideMenuExtension, { editor, selector: (state) => state?.block })
  return { editor, block }
}

/** Deletes the block, or every selected block when it is one of them. */
function DeleteBlocksItem({ children }: { children: ReactNode }) {
  const Components = useComponentsContext()!
  const { editor, block } = useMenuBlock()
  if (!block) return null
  return (
    <Components.Generic.Menu.Item className="bn-menu-item" onClick={() => editor.getExtension(blockSelection)?.removeFrom(block.id)}>
      {children}
    </Components.Generic.Menu.Item>
  )
}

function DuplicateBlockItem({ children }: { children: ReactNode }) {
  const Components = useComponentsContext()!
  const { editor, block } = useMenuBlock()
  if (!block) return null
  return (
    <Components.Generic.Menu.Item className="bn-menu-item" onClick={() => editor.getExtension(blockSelection)?.duplicateFrom(block.id)}>
      {children}
    </Components.Generic.Menu.Item>
  )
}

function CopyBlockLinkItem({ children }: { children: ReactNode }) {
  const Components = useComponentsContext()!
  const { block } = useMenuBlock()
  if (!block) return null
  return (
    <Components.Generic.Menu.Item
      className="bn-menu-item"
      onClick={() => {
        const url = `${window.location.origin}${window.location.pathname}#block-${block.id}`
        void navigator.clipboard.writeText(url).then(() => reportNoteInfo('已複製區塊連結'))
      }}
    >
      {children}
    </Components.Generic.Menu.Item>
  )
}

/**
 * BlockNote's ⋮⋮ handle, which drags only its own block. When that block is
 * one of several selected blocks, the drag is widened to all of them
 * (blockSelection): the selection is read before BlockNote's dragstart
 * replaces it, and the drag is rewritten after.
 */
function NoteDragHandle(props: SideMenuProps) {
  const { editor, block } = useMenuBlock()
  const before = useRef<Selection | null>(null)
  return (
    <div
      className="contents"
      onDragStartCapture={() => (before.current = editor.prosemirrorState.selection)}
      onDragStart={(e) => {
        if (block) editor.getExtension(blockSelection)?.dragFromHandle(e.nativeEvent, block.id, before.current)
      }}
    >
      <DragHandleButton {...props} />
    </div>
  )
}

/** The ⋮⋮ handle's menu, Notion-style: delete, duplicate, copy link, colour. */
export function NoteSideMenu() {
  const dict = useDictionary()
  return (
    <SideMenuController
      sideMenu={(props) => (
        <SideMenu {...props}>
          <AddBlockButton />
          <NoteDragHandle
            {...props}
            dragHandleMenu={(menuProps) => (
              <DragHandleMenu {...menuProps}>
                <DeleteBlocksItem>{dict.drag_handle.delete_menuitem}</DeleteBlocksItem>
                <DuplicateBlockItem>建立副本</DuplicateBlockItem>
                <CopyBlockLinkItem>複製區塊連結</CopyBlockLinkItem>
                <BlockColorsItem>{dict.drag_handle.colors_menuitem}</BlockColorsItem>
                <TableRowHeaderItem>{dict.drag_handle.header_row_menuitem}</TableRowHeaderItem>
                <TableColumnHeaderItem>{dict.drag_handle.header_column_menuitem}</TableColumnHeaderItem>
              </DragHandleMenu>
            )}
          />
        </SideMenu>
      )}
    />
  )
}
