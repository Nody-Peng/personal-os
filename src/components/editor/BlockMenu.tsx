'use client'

import { SideMenuExtension } from '@blocknote/core/extensions'
import {
  BlockColorsItem,
  DragHandleMenu,
  RemoveBlockItem,
  SideMenu,
  SideMenuController,
  TableColumnHeaderItem,
  TableRowHeaderItem,
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
  useExtensionState,
} from '@blocknote/react'
import type { ReactNode } from 'react'
import type { editorSchema } from './schema'

type Schema = typeof editorSchema
type NoteBlock = Schema['Block']

/** Shows a short confirmation in the notebook's toast (NotebookShell listens). */
export function reportNoteInfo(message: string) {
  window.dispatchEvent(new CustomEvent('notes:info', { detail: message }))
}

/** A copy without ids, so BlockNote gives the copy (and its children) new ones. */
function withoutIds(block: NoteBlock): Schema['PartialBlock'] {
  return { ...block, id: undefined, children: block.children.map(withoutIds) }
}

function useMenuBlock() {
  const editor = useBlockNoteEditor<Schema['blockSchema'], Schema['inlineContentSchema'], Schema['styleSchema']>()
  const block = useExtensionState(SideMenuExtension, { editor, selector: (state) => state?.block })
  return { editor, block }
}

function DuplicateBlockItem({ children }: { children: ReactNode }) {
  const Components = useComponentsContext()!
  const { editor, block } = useMenuBlock()
  if (!block) return null
  return (
    <Components.Generic.Menu.Item
      className="bn-menu-item"
      onClick={() => {
        const current = editor.getBlock(block.id)
        if (current) editor.insertBlocks([withoutIds(current)], current, 'after')
      }}
    >
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

/** The ⋮⋮ handle's menu, Notion-style: delete, duplicate, copy link, colour. */
export function NoteSideMenu() {
  const dict = useDictionary()
  return (
    <SideMenuController
      sideMenu={(props) => (
        <SideMenu
          {...props}
          dragHandleMenu={(menuProps) => (
            <DragHandleMenu {...menuProps}>
              <RemoveBlockItem>{dict.drag_handle.delete_menuitem}</RemoveBlockItem>
              <DuplicateBlockItem>建立副本</DuplicateBlockItem>
              <CopyBlockLinkItem>複製區塊連結</CopyBlockLinkItem>
              <BlockColorsItem>{dict.drag_handle.colors_menuitem}</BlockColorsItem>
              <TableRowHeaderItem>{dict.drag_handle.header_row_menuitem}</TableRowHeaderItem>
              <TableColumnHeaderItem>{dict.drag_handle.header_column_menuitem}</TableColumnHeaderItem>
            </DragHandleMenu>
          )}
        />
      )}
    />
  )
}
