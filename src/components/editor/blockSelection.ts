// Notion-style block selection. Dragging a box from the margin (or from any gap
// between blocks) selects whole blocks; then Backspace/Delete removes them,
// ⌘C / ⌘X copies or cuts them, ⌘D duplicates them, ↑ / ↓ move the selection
// (Shift extends it), Enter edits the last one and Esc lets go. Dragging the ⋮⋮
// handle of any selected block moves them all (BlockMenu).
//
// The selection is a ProseMirror selection (`BlockSelection`, a run of sibling
// blocks), so the highlight follows it and the drop that moves blocks deletes
// exactly it. While blocks are selected, keyboard focus sits on a hidden element
// outside the text, so typing (and the IME) can never land in the selected blocks.

import { createExtension, getNodeById, type ExtensionOptions } from '@blocknote/core'
import { Fragment, Slice, type Node as PMNode, type ResolvedPos } from 'prosemirror-model'
import { Plugin, PluginKey, Selection, TextSelection } from 'prosemirror-state'
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view'

type Mapping = Parameters<Selection['map']>[1]

const isBlockList = (node: PMNode) => node.type.name === 'blockGroup' || node.type.name === 'column'

/** Whole sibling blocks: anchor and head sit between the blocks of one block group (or column). */
export class BlockSelection extends Selection {
  constructor($anchor: ResolvedPos, $head: ResolvedPos) {
    super($anchor, $head)
  }

  static create(doc: PMNode, anchor: number, head: number): BlockSelection {
    return new BlockSelection(doc.resolve(anchor), doc.resolve(head))
  }

  /** The selected blocks (block containers or column lists), top to bottom. */
  get blocks(): { node: PMNode; pos: number }[] {
    const blocks: { node: PMNode; pos: number }[] = []
    let pos = this.from
    for (let i = this.$from.index(); i < this.$to.index(); i++) {
      const node = this.$from.parent.child(i)
      blocks.push({ node, pos })
      pos += node.nodeSize
    }
    return blocks
  }

  get ids(): string[] {
    return this.blocks.map(({ node }) => node.attrs.id as string)
  }

  map(doc: PMNode, mapping: Mapping): Selection {
    const anchor = mapping.mapResult(this.anchor)
    const head = mapping.mapResult(this.head)
    const $anchor = doc.resolve(anchor.pos)
    const $head = doc.resolve(head.pos)
    if (anchor.deleted || head.deleted || anchor.pos === head.pos || !$anchor.sameParent($head) || !isBlockList($anchor.parent)) {
      return Selection.near($anchor)
    }
    return new BlockSelection($anchor, $head)
  }

  content(): Slice {
    return new Slice(Fragment.from(this.blocks.map(({ node }) => node)), 0, 0)
  }

  eq(other: Selection): boolean {
    return other instanceof BlockSelection && other.anchor === this.anchor && other.head === this.head
  }

  toJSON() {
    return { type: 'block', anchor: this.anchor, head: this.head }
  }
}
// Hidden like a node selection; the blocks are tinted instead (styles.css).
BlockSelection.prototype.visible = false

/** The run of sibling blocks covering everything between two positions (any depth), or null. */
function blockRangeBetween(doc: PMNode, a: number, b: number): BlockSelection | null {
  const range = doc.resolve(Math.min(a, b)).blockRange(doc.resolve(Math.max(a, b)), isBlockList)
  return range ? BlockSelection.create(doc, range.start, range.end) : null
}

function rangeOfIds(doc: PMNode, firstId: string, lastId: string): BlockSelection | null {
  const first = getNodeById(firstId, doc)
  const last = getNodeById(lastId, doc)
  if (!first || !last) return null
  return blockRangeBetween(doc, first.posBeforeNode, last.posBeforeNode + last.node.nodeSize)
}

/** The id of the block a `.bn-block-content` belongs to (custom blocks sit in an extra `.react-renderer`). */
const blockIdOf = (content: Element) => content.closest('[data-node-type="blockContainer"]')?.getAttribute('data-id') ?? null

/** The id of the block that holds a position. */
function blockIdAt($pos: ResolvedPos): string | null {
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.isInGroup('bnBlock')) return $pos.node(d).attrs.id as string
  }
  return null
}

/** A copy without ids, so BlockNote gives the copy (and its children) new ones. */
function withoutIds<B extends { id?: string; children: B[] }>(block: B): B {
  return { ...block, id: undefined, children: block.children.map(withoutIds) }
}

// Where a box may start: not on text, controls, menus or the block handles.
const NOT_A_BOX =
  'button, a, input, textarea, select, label, summary, header, nav, [role="button"], [role="menu"], [role="menuitem"], [role="listbox"], [role="option"], [role="slider"], [role="toolbar"], [data-no-block-select], .bn-side-menu, .bn-block-content'
// Clicks here keep the selection: the ⋮⋮ handle (drag, menu) and its menu.
const KEEPS_SELECTION = '.bn-side-menu, [role="menu"], [role="menuitem"]'
// How far above or below an editor a box may start in its surrounding zone.
const ZONE_BAND = 80
const SCROLL_EDGE = 48

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p
  }
  return null
}

function dragPreview(view: EditorView, sel: BlockSelection): HTMLElement {
  const first = view.nodeDOM(sel.from) as HTMLElement
  const list = first.parentElement!
  const preview = list.cloneNode(false) as HTMLElement
  for (const { pos } of sel.blocks) preview.appendChild((view.nodeDOM(pos) as HTMLElement).cloneNode(true))
  preview.querySelectorAll('iframe, embed, object').forEach((el) => el.remove())
  preview.querySelectorAll('.note-block-selected').forEach((el) => el.classList.remove('note-block-selected'))
  const inherited = view.dom.className.split(' ').filter((c) => c && c !== 'ProseMirror' && c !== 'bn-root' && c !== 'bn-editor')
  preview.classList.add('bn-drag-preview', ...inherited)
  preview.style.width = `${list.offsetWidth}px`
  document.body.appendChild(preview)
  document.addEventListener('dragend', () => preview.remove(), { once: true, capture: true })
  return preview
}

/**
 * A click below the last block of a toggle's children (the strip styles.css
 * leaves when that block isn't a line of text) or of a column adds an empty
 * line at the end there, or goes to the empty line already there.
 */
function lineBelow(view: EditorView, target: Element, y: number): boolean {
  if (!target.matches('.bn-block-group, .bn-block-column') || target.parentElement === view.dom) return false
  const last = target.lastElementChild
  if (!last || y <= last.getBoundingClientRect().bottom) return false
  const inside = view.posAtDOM(target, 0)
  const list = view.state.doc.resolve(inside).parent
  if (!isBlockList(list) || !list.lastChild) return false
  const end = inside + list.content.size
  const lastBlock = list.lastChild
  const tr = view.state.tr
  let caret = end + 2
  if (lastBlock.childCount === 1 && lastBlock.firstChild!.type.name === 'paragraph' && lastBlock.firstChild!.content.size === 0) {
    caret = end - lastBlock.nodeSize + 2
  } else {
    const { schema } = view.state
    tr.insert(end, schema.nodes.blockContainer.createAndFill(null, schema.nodes.paragraph.create())!)
  }
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, caret)).scrollIntoView())
  view.focus()
  return true
}

export const blockSelection = createExtension(({ editor }: ExtensionOptions<undefined>) => {
  // Ids of blocks being moved by a ⋮⋮ drag, so they stay selected where they land.
  let moving: string[] | null = null
  let sink: HTMLElement | null = null
  let stopBox: (() => void) | null = null

  const view = () => editor.prosemirrorView!

  function current(): BlockSelection | null {
    const sel = editor.prosemirrorState.selection
    return sel instanceof BlockSelection ? sel : null
  }

  function focusSink() {
    const sel = current()
    if (!sink || !sel) return
    sink.textContent = `已選取 ${sel.blocks.length} 個區塊`
    sink.focus({ preventScroll: true })
    // Keep the page selection inside the sink, so ⌘C / ⌘X are copy and cut events on it.
    const range = document.createRange()
    range.selectNodeContents(sink)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(range)
  }

  function select(sel: BlockSelection) {
    view().dispatch(view().state.tr.setSelection(sel))
    focusSink()
    const edge = view().nodeDOM(sel.head === sel.to ? sel.blocks.at(-1)!.pos : sel.from)
    if (edge instanceof HTMLElement) edge.scrollIntoView({ block: 'nearest' })
  }

  /** Lets go of selected blocks; the caret goes to the first one (shown once the editor has focus). */
  function release() {
    const sel = current()
    if (!sel) return
    const caret = Selection.findFrom(sel.$from, 1, true) ?? Selection.findFrom(sel.$from, -1, true)
    if (caret) view().dispatch(view().state.tr.setSelection(caret))
  }

  function caretAt(id: string, placement: 'start' | 'end') {
    try {
      editor.setTextCursorPosition(id, placement)
    } catch {
      // A block without text (image, board…): leave the caret where it is.
    }
    editor.focus()
  }

  function remove(sel: BlockSelection) {
    // The caret goes to the end of the text above, else the start of the text below.
    const above = Selection.findFrom(sel.$from, -1, true)
    const below = above ? null : Selection.findFrom(sel.$to, 1, true)
    const target = above ? blockIdAt(above.$from) : below ? blockIdAt(below.$from) : null
    const everything = sel.$from.depth === 1 && sel.$from.index() === 0 && sel.$to.index() === sel.$from.parent.childCount
    if (everything) {
      const { insertedBlocks } = editor.replaceBlocks(sel.ids, [{ type: 'paragraph' }])
      return caretAt(insertedBlocks[0].id, 'start')
    }
    editor.removeBlocks(sel.ids)
    if (target) caretAt(target, above ? 'end' : 'start')
  }

  function duplicate(sel: BlockSelection) {
    const blocks = sel.ids.map((id) => editor.getBlock(id)).filter((b) => b != null)
    const copies = editor.insertBlocks(blocks.map(withoutIds), sel.ids.at(-1)!, 'after')
    const copy = copies.length ? rangeOfIds(view().state.doc, copies[0].id, copies.at(-1)!.id) : null
    if (copy) select(copy)
  }

  function writeBlocks(sel: BlockSelection, data: DataTransfer) {
    const blocks = sel.ids.map((id) => editor.getBlock(id)).filter((b) => b != null)
    data.clearData()
    data.setData('blocknote/html', view().serializeForClipboard(sel.content()).dom.innerHTML)
    data.setData('text/html', editor.blocksToHTMLLossy(blocks))
    data.setData('text/plain', editor.blocksToMarkdownLossy(blocks))
  }

  /** ↑ / ↓: the block above or below in reading order. With Shift: grow or shrink the run. */
  function step(sel: BlockSelection, dir: -1 | 1, extend: boolean) {
    const doc = view().state.doc
    if (extend) {
      const down = sel.head >= sel.anchor
      const anchorIndex = down ? sel.$anchor.index() : sel.$anchor.index() - 1
      const headIndex = Math.min(Math.max((down ? sel.$head.index() - 1 : sel.$head.index()) + dir, 0), sel.$from.parent.childCount - 1)
      const at = (i: number) => sel.$from.posAtIndex(i)
      return select(
        headIndex >= anchorIndex
          ? BlockSelection.create(doc, at(anchorIndex), at(headIndex + 1))
          : BlockSelection.create(doc, at(anchorIndex + 1), at(headIndex)),
      )
    }
    const edge = view().nodeDOM(dir < 0 ? sel.from : sel.blocks.at(-1)!.pos)
    if (!(edge instanceof HTMLElement)) return
    const contents = [...view().dom.querySelectorAll<HTMLElement>('.bn-block-content')].filter((el) => el.getClientRects().length > 0 && !edge.contains(el))
    const side = dir < 0 ? Node.DOCUMENT_POSITION_PRECEDING : Node.DOCUMENT_POSITION_FOLLOWING
    const near = contents.filter((el) => edge.compareDocumentPosition(el) & side)
    const content = dir < 0 ? near.at(-1) : near[0]
    const id = content ? blockIdOf(content) : null
    const next = id ? rangeOfIds(doc, id, id) : null
    if (next) select(next)
  }

  function edit(sel: BlockSelection) {
    const caret = Selection.findFrom(sel.$to, -1, true)
    if (caret) view().dispatch(view().state.tr.setSelection(caret))
    view().focus()
  }

  function onKeyDown(e: KeyboardEvent) {
    const sel = current()
    if (!sel || e.isComposing) return
    const mod = e.metaKey || e.ctrlKey
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
    let handled = true
    if (key === 'Backspace' || key === 'Delete') remove(sel)
    else if (key === 'Escape') {
      release()
      sink?.blur()
    } else if (key === 'Enter') edit(sel)
    else if (key === 'ArrowUp' || key === 'ArrowDown') step(sel, key === 'ArrowUp' ? -1 : 1, e.shiftKey)
    else if (mod && key === 'a') {
      const all = view().state.doc.firstChild!
      select(BlockSelection.create(view().state.doc, 1, 1 + all.content.size))
    } else if (mod && key === 'd') duplicate(sel)
    else if (mod && (key === 'z' || key === 'y')) {
      if (key === 'y' || e.shiftKey) editor.redo()
      else editor.undo()
      if (!current()) editor.focus()
    } else if (mod) handled = false // ⌘C / ⌘X arrive as copy and cut events
    else handled = key.length === 1 || key === 'Tab' // typing does nothing while blocks are selected
    if (handled) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  function onClipboard(e: ClipboardEvent) {
    const sel = current()
    if (!sel || !e.clipboardData || document.activeElement !== sink) return
    e.preventDefault()
    writeBlocks(sel, e.clipboardData)
    if (e.type === 'cut') remove(sel)
  }

  /** Whether a press at this target starts a box in this editor (and not in another one). */
  function startsBox(e: MouseEvent, target: Element): boolean {
    if (e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || !editor.isEditable) return false
    if (!window.matchMedia('(pointer: fine)').matches) return false
    const dom = view().dom
    if (target.closest(NOT_A_BOX) || (target instanceof HTMLElement && target.isContentEditable && !dom.contains(target))) return false
    const modal = target.closest('[aria-modal="true"]')
    if (modal && !modal.contains(dom)) return false
    const own = dom.closest('.bn-container')
    if (!own) return false
    const zone = target.closest('.bn-container, [data-block-select-zone]')
    if (zone === own) return true
    if (!zone || zone !== own.parentElement?.closest('[data-block-select-zone]')) return false
    const box = own.getBoundingClientRect()
    return e.clientY > box.top - ZONE_BAND && e.clientY < box.bottom + ZONE_BAND
  }

  /** Blocks whose own content overlaps the rectangle, widened to a run of siblings. */
  function blocksIn(rect: { left: number; right: number; top: number; bottom: number }): BlockSelection | null {
    let first: string | null = null
    let last: string | null = null
    for (const content of view().dom.querySelectorAll<HTMLElement>('.bn-block-content')) {
      const r = content.getBoundingClientRect()
      if (!r.height || r.bottom < rect.top || r.top > rect.bottom || r.right < rect.left || r.left > rect.right) continue
      const id = blockIdOf(content)
      if (!id) continue
      first ??= id
      last = id
    }
    return first && last ? rangeOfIds(view().state.doc, first, last) : null
  }

  function boxSelect(down: MouseEvent, insideText: boolean) {
    const pm = view()
    const scroller = scrollParent(pm.dom)
    const scrollTop = () => (scroller ? scroller.scrollTop : window.scrollY)
    const origin = { x: down.clientX, y: down.clientY + scrollTop() }
    const hadSelection = current() != null
    let pointer = { x: down.clientX, y: down.clientY }
    let box: HTMLDivElement | null = null
    let frame = 0
    let scrollFrame = 0

    const update = () => {
      frame = 0
      if (!box) return
      const top = origin.y - scrollTop()
      const rect = {
        left: Math.min(origin.x, pointer.x),
        right: Math.max(origin.x, pointer.x),
        top: Math.min(top, pointer.y),
        bottom: Math.max(top, pointer.y),
      }
      Object.assign(box.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.right - rect.left}px`,
        height: `${rect.bottom - rect.top}px`,
      })
      const sel = blocksIn(rect)
      const now = pm.state.selection
      if (sel && !sel.eq(now)) pm.dispatch(pm.state.tr.setSelection(sel))
      else if (!sel && now instanceof BlockSelection) release()
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    // Near the top or bottom edge, the page scrolls so long runs can be selected.
    const autoscroll = () => {
      const edges = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight }
      const over = pointer.y < edges.top + SCROLL_EDGE ? pointer.y - edges.top - SCROLL_EDGE : pointer.y > edges.bottom - SCROLL_EDGE ? pointer.y - edges.bottom + SCROLL_EDGE : 0
      if (over) (scroller ?? window).scrollBy(0, Math.max(-24, Math.min(24, Math.round(over / 3))))
      scrollFrame = requestAnimationFrame(autoscroll)
    }

    const onMove = (e: MouseEvent) => {
      pointer = { x: e.clientX, y: e.clientY }
      if (!box) {
        if (Math.hypot(pointer.x - down.clientX, pointer.y - down.clientY) < 4) return
        box = document.createElement('div')
        box.className = 'block-select-box'
        document.body.appendChild(box)
        document.documentElement.classList.add('block-selecting')
        scrollFrame = requestAnimationFrame(autoscroll)
      }
      schedule()
    }
    const stop = () => {
      window.removeEventListener('mousemove', onMove, true)
      window.removeEventListener('mouseup', onUp, true)
      ;(scroller ?? window).removeEventListener('scroll', schedule)
      cancelAnimationFrame(frame)
      cancelAnimationFrame(scrollFrame)
      box?.remove()
      document.documentElement.classList.remove('block-selecting')
      stopBox = null
    }
    const onUp = (e: MouseEvent) => {
      const dragged = box != null
      if (dragged) update()
      stop()
      if (dragged) return focusSink()
      // A plain click: under a toggle's or column's last block it adds a line there;
      // elsewhere in the editor's own margin it still places the caret, as before.
      if (insideText && down.target instanceof Element && lineBelow(pm, down.target, e.clientY)) return
      if (insideText) {
        const at = pm.posAtCoords({ left: e.clientX, top: e.clientY })
        if (at) pm.dispatch(pm.state.tr.setSelection(Selection.near(pm.state.doc.resolve(at.pos))))
        pm.focus()
      } else if (hadSelection) release()
    }

    window.addEventListener('mousemove', onMove, true)
    window.addEventListener('mouseup', onUp, true)
    ;(scroller ?? window).addEventListener('scroll', schedule)
    stopBox = stop
  }

  function onMouseDown(e: MouseEvent) {
    if (!(e.target instanceof Element) || stopBox) return
    if (!startsBox(e, e.target)) {
      if (current() && !e.target.closest(KEEPS_SELECTION)) release()
      return
    }
    const insideText = view().dom.contains(e.target)
    e.preventDefault()
    // In the editor's own margins ProseMirror would start a text selection.
    if (insideText) e.stopPropagation()
    boxSelect(e, insideText)
  }

  return {
    key: 'blockSelection',
    prosemirrorPlugins: [
      new Plugin({
        key: new PluginKey('blockSelection'),
        props: {
          decorations(state) {
            const sel = state.selection
            if (!(sel instanceof BlockSelection)) return null
            return DecorationSet.create(
              state.doc,
              sel.blocks.map(({ node, pos }) => Decoration.node(pos, pos + node.nodeSize, { class: 'note-block-selected' })),
            )
          },
        },
        // Blocks moved by a ⋮⋮ drag stay selected where they land.
        appendTransaction(transactions, _old, state) {
          if (!moving || !transactions.some((tr) => tr.getMeta('uiEvent') === 'drop')) return null
          const sel = rangeOfIds(state.doc, moving[0], moving.at(-1)!)
          moving = null
          return sel ? state.tr.setSelection(sel) : null
        },
        view: () => ({
          update(pmView) {
            const active = pmView.state.selection instanceof BlockSelection
            // Esc lets go of the blocks before it closes a surrounding panel (lib/escape.ts).
            sink?.toggleAttribute('data-own-escape', active)
            // No text formatting toolbar over whole blocks (styles.css).
            pmView.dom.closest('.bn-container')?.toggleAttribute('data-block-selection', active)
            if (active && pmView.hasFocus()) requestAnimationFrame(focusSink)
          },
        }),
      }),
    ],

    mount({ signal }: { signal: AbortSignal }) {
      sink = document.createElement('div')
      sink.className = 'block-select-sink'
      sink.tabIndex = -1
      sink.setAttribute('aria-live', 'polite')
      sink.addEventListener('keydown', onKeyDown)
      document.body.appendChild(sink)
      document.addEventListener('mousedown', onMouseDown, { capture: true, signal })
      document.addEventListener('copy', onClipboard, { signal })
      document.addEventListener('cut', onClipboard, { signal })
      document.addEventListener('dragend', () => (moving = null), { capture: true, signal })
      signal.addEventListener('abort', () => {
        stopBox?.()
        sink?.remove()
        sink = null
      })
    },

    /**
     * Called after BlockNote's own ⋮⋮ dragstart (which picks just that block): when
     * the block is part of selected blocks, the drag carries all of them instead.
     */
    dragFromHandle(event: DragEvent, blockId: string, before: Selection | null) {
      if (!(before instanceof BlockSelection) || before.blocks.length < 2 || !before.ids.includes(blockId) || !event.dataTransfer) return
      const pm = view()
      const sel = BlockSelection.create(pm.state.doc, before.anchor, before.head)
      pm.dispatch(pm.state.tr.setSelection(sel))
      writeBlocks(sel, event.dataTransfer)
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setDragImage(dragPreview(pm, sel), 0, 0)
      // The drop removes the editor selection and inserts this slice.
      pm.dragging = { slice: sel.content(), move: true }
      moving = sel.ids
    },

    /** The ⋮⋮ menu's 刪除: every selected block when this one is among them. */
    removeFrom(blockId: string) {
      const sel = current()
      if (sel?.ids.includes(blockId)) remove(sel)
      else editor.removeBlocks([blockId])
    },

    /** The ⋮⋮ menu's 建立副本: every selected block when this one is among them. */
    duplicateFrom(blockId: string) {
      const sel = current()
      if (sel?.ids.includes(blockId)) return duplicate(sel)
      const block = editor.getBlock(blockId)
      if (block) editor.insertBlocks([withoutIds(block)], block, 'after')
    },
  }
})
