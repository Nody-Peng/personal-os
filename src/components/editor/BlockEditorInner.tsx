'use client'

import '@blocknote/mantine/style.css'
import type { PartialBlock } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/mantine'
import { SuggestionMenuController, useCreateBlockNote } from '@blocknote/react'
import { multiColumnDropCursor } from '@blocknote/xl-multi-column'
import { useEffect, useRef } from 'react'
import { reportNoteError, uploadMedia } from '@/lib/uploadMedia'
import { useNoteContext } from './NoteContext'
import { editorDictionary, editorSchema, notionShortcuts, rankItems, slashItems } from './schema'

type Props = {
  initial: unknown[] | null
  placeholder: string
  onChange: (blocks: unknown[]) => void
  className?: string
  /** Images, video and files (notebook pages). */
  allowUploads?: boolean
}

async function upload(file: File): Promise<string> {
  try {
    return await uploadMedia(file)
  } catch (error) {
    reportNoteError(error instanceof Error ? error.message : '上傳失敗')
    throw error
  }
}

/** BlockNote itself; loaded only in the browser (see BlockEditor). */
export default function BlockEditorInner({ initial, placeholder, onChange, className = '', allowUploads = false }: Props) {
  const note = useNoteContext()
  const noteRef = useRef(note)
  useEffect(() => {
    noteRef.current = note
  })

  const editor = useCreateBlockNote({
    schema: editorSchema,
    initialContent: initial?.length ? (initial as PartialBlock<typeof editorSchema.blockSchema>[]) : undefined,
    dictionary: {
      ...editorDictionary,
      placeholders: { ...editorDictionary.placeholders, default: placeholder, emptyDocument: placeholder },
    },
    extensions: [notionShortcuts],
    dropCursor: multiColumnDropCursor,
    uploadFile: allowUploads ? upload : undefined,
  })

  return (
    <BlockNoteView
      editor={editor}
      theme="light"
      slashMenu={false}
      className={`journal-editor ${className}`}
      onChange={() => onChange(editor.document as unknown[])}
    >
      <SuggestionMenuController triggerCharacter="/" getItems={async (query) => rankItems(slashItems(editor, noteRef.current), query)} />
    </BlockNoteView>
  )
}
