// Notion's Enter in a toggle list (or a collapsible heading). BlockNote splits
// the block and hands its children to the new half, so they fall out of the
// toggle (and the open/closed state, kept per block id, goes with them).
// Instead the children always stay with the toggle:
//   open toggle   → the text after the caret becomes the first line inside it
//   closed toggle → a new toggle below it (a paragraph below a heading)
//   caret at the very start → an empty line above
// A closed toggle with nothing inside keeps BlockNote's own Enter.

import type { ExtensionOptions } from '@blocknote/core'
import { SuggestionMenu } from '@blocknote/core/extensions'
import type { Node as PMNode } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

type Editor = ExtensionOptions['editor']

const isToggle = (node: PMNode) => node.type.name === 'toggleListItem' || (node.type.name === 'heading' && node.attrs.isToggleable === true)

/** Whether the toggle at this position shows its children (BlockNote's toggle button state). */
function isOpen(view: EditorView, pos: number): boolean {
  const dom = view.nodeDOM(pos)
  if (!(dom instanceof HTMLElement)) return false
  const wrapper = dom.querySelector(
    ':scope > .bn-block > .bn-block-content .bn-toggle-wrapper, :scope > .bn-block > .react-renderer > .bn-block-content .bn-toggle-wrapper',
  )
  return wrapper?.getAttribute('data-show-children') === 'true'
}

export function toggleEnter(editor: Editor): boolean {
  // The slash and emoji menus answer Enter themselves.
  if (editor.getExtension(SuggestionMenu)?.shown()) return false
  const view = editor.prosemirrorView
  if (!view) return false
  const { selection, schema } = view.state
  if (!(selection instanceof TextSelection) || !selection.empty) return false
  const $pos = selection.$from
  const content = $pos.parent
  if (!isToggle(content) || content.content.size === 0) return false
  const depth = $pos.depth - 1
  const container = $pos.node(depth)
  if (container.type.name !== 'blockContainer') return false
  const containerPos = $pos.before(depth)
  const children = container.childCount > 1 ? container.lastChild : null
  const open = isOpen(view, containerPos)
  if (!open && !children) return false

  const line = (node: PMNode) => schema.nodes.blockContainer.createAndFill(null, node)!
  const tr = view.state.tr
  if ($pos.parentOffset === 0) {
    // An empty line above; the toggle keeps its text, children and open state (and the caret).
    tr.insert(containerPos, line(content.type.create(content.attrs)))
  } else {
    const rest = content.content.cut($pos.parentOffset)
    const afterContent = containerPos + 1 + content.nodeSize
    tr.delete($pos.pos, $pos.end())
    let at: number
    if (open && children) {
      at = tr.mapping.map(afterContent + 1)
      tr.insert(at, line(schema.nodes.paragraph.create(null, rest)))
    } else if (open) {
      at = tr.mapping.map(afterContent)
      tr.insert(at, schema.nodes.blockGroup.create(null, line(schema.nodes.paragraph.create(null, rest))))
      at += 1
    } else {
      at = tr.mapping.map(containerPos + container.nodeSize)
      tr.insert(at, line(content.type.name === 'heading' ? schema.nodes.paragraph.create(null, rest) : content.type.create(null, rest)))
    }
    tr.setSelection(TextSelection.create(tr.doc, at + 2))
  }
  view.dispatch(tr.scrollIntoView())
  return true
}
