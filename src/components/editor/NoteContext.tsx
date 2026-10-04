'use client'

import { createContext, useContext } from 'react'
import type { PageNode } from '@/lib/notes'

/** What notebook-aware blocks (page links, boards) need from the page around the editor. */
export type NoteEditorContext = {
  notebookId: number
  pageId: number
  /** The notebook's page tree, for live titles. */
  pages: PageNode[]
  createChildPage: () => Promise<PageNode | null>
  createBoard: () => Promise<PageNode | null>
  openPeek: (id: number) => void
}

export const NoteContext = createContext<NoteEditorContext | null>(null)

export const useNoteContext = () => useContext(NoteContext)
