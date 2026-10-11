// The page title and the text below it work as one document, as in Notion:
//   ↑ on the first line of the first block   → the end of the title
//   Backspace at the start of the first block → the end of the title (an empty
//                                               first line is removed on the way)
// The other direction (Enter / ↓ in the title) is EditorHandle.enterFromTitle /
// focusStart in BlockEditorInner. Pages without a title (day, week, month
// notes) leave `onLeaveTop` out and nothing changes. The editor registers its
// callback with `setLeaveTop` (an effect in BlockEditorInner).

import { createExtension, type ExtensionOptions } from '@blocknote/core'
import { SuggestionMenu } from '@blocknote/core/extensions'
import { TextSelection } from 'prosemirror-state'

type Editor = ExtensionOptions['editor']

const leaveTop = new WeakMap<object, () => void>()

export function setLeaveTop(editor: object, onLeaveTop: (() => void) | undefined) {
  if (onLeaveTop) leaveTop.set(editor, onLeaveTop)
  else leaveTop.delete(editor)
}

/** The caret, collapsed, in the first top-level block (and at its very start if `atStart`). */
function inFirstBlock(editor: Editor, atStart: boolean) {
  if (editor.getExtension(SuggestionMenu)?.shown()) return null
  const view = editor.prosemirrorView
  const selection = view?.state.selection
  if (!view || !(selection instanceof TextSelection) || !selection.empty) return null
  if (atStart && selection.$from.parentOffset !== 0) return null
  const first = editor.document[0]
  const { block } = editor.getTextCursorPosition()
  return first && block.id === first.id ? { view, block } : null
}

export const titleNavigation = createExtension({
  key: 'title-navigation',
  runsBefore: ['code-block-keyboard-shortcuts'],
  keyboardShortcuts: {
    ArrowUp: ({ editor }) => {
      const leave = leaveTop.get(editor)
      const at = leave && inFirstBlock(editor, false)
      if (!at || !at.view.endOfTextblock('up')) return false
      leave()
      return true
    },
    Backspace: ({ editor }) => {
      const leave = leaveTop.get(editor)
      const at = leave && inFirstBlock(editor, true)
      // Headings and list items first turn into plain text (BlockNote's own Backspace).
      if (!at || at.block.type !== 'paragraph' || at.block.children.length) return false
      const empty = !Array.isArray(at.block.content) || at.block.content.length === 0
      if (empty && editor.document.length > 1) editor.removeBlocks([at.block.id])
      leave()
      return true
    },
  },
})
