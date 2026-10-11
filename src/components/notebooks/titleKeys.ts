'use client'

import type { KeyboardEvent } from 'react'
import type { EditorHandle } from '@/components/editor/BlockEditor'

type Options = {
  /** The text below the title (null for a board, or before the editor has loaded). */
  editor: EditorHandle | null
  /** Sets the title (Enter keeps only what comes before the caret). */
  setTitle: (title: string) => void
  /** Saves the title now. */
  flush: () => void
}

/**
 * Enter and ↓ in a page title move into the text below, as in Notion. Enter
 * splits the title at the caret: what follows becomes a new first line. ↓ goes
 * there from the end of the title (or from anywhere in a one-line title). The
 * way back is editor/titleNavigation.
 */
export function onTitleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>, { editor, setTitle, flush }: Options) {
  // Enter that picks a Zhuyin candidate must not leave the title.
  if (e.nativeEvent.isComposing || e.keyCode === 229) return
  const el = e.currentTarget
  if (e.key === 'Enter') {
    e.preventDefault()
    if (el.readOnly) return
    const start = el.selectionStart ?? el.value.length
    const rest = el.value.slice(el.selectionEnd ?? start)
    if (rest || start !== el.value.length) setTitle(el.value.slice(0, start).trimEnd())
    flush()
    editor?.enterFromTitle(rest.trim())
    return
  }
  if (e.key === 'ArrowDown' && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey && editor) {
    const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length
    const oneLine = el.scrollHeight <= parseFloat(getComputedStyle(el).lineHeight) * 1.6
    if (!atEnd && !oneLine) return
    e.preventDefault()
    flush()
    editor.focusStart()
  }
}

/** The way back from the text: the caret to the end of the title. */
export function focusTitleEnd(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.focus()
  el.setSelectionRange(el.value.length, el.value.length)
}
