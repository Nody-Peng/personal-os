'use client'

import { useEffect, useState } from 'react'
import { NoteSearch, useSearchShortcut } from '@/components/notebooks/NoteSearch'

const OPEN = 'search:open'

/** Opens the search dialog from anywhere outside a notebook (a button, the bookshelf). */
export function openSearch() {
  window.dispatchEvent(new Event(OPEN))
}

/**
 * Ctrl/⌘ K on the journal side of the app (the (app) layout); a notebook
 * page has its own (NotebookShell). Searches notebooks and the journal.
 */
export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  useSearchShortcut(() => setOpen(true))
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN, onOpen)
    return () => window.removeEventListener(OPEN, onOpen)
  }, [])
  return open ? <NoteSearch onClose={() => setOpen(false)} /> : null
}
