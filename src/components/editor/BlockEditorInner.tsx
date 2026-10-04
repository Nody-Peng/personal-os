'use client'

import '@blocknote/mantine/style.css'
import type { PartialBlock } from '@blocknote/core'
import { zhTW } from '@blocknote/core/locales'
import { BlockNoteView } from '@blocknote/mantine'
import { useCreateBlockNote } from '@blocknote/react'

type Props = {
  initial: unknown[] | null
  placeholder: string
  onChange: (blocks: unknown[]) => void
}

/** BlockNote itself; loaded only in the browser (see BlockEditor). */
export default function BlockEditorInner({ initial, placeholder, onChange }: Props) {
  const editor = useCreateBlockNote({
    initialContent: initial?.length ? (initial as PartialBlock[]) : undefined,
    dictionary: {
      ...zhTW,
      placeholders: { ...zhTW.placeholders, default: placeholder, emptyDocument: placeholder },
    },
  })

  return (
    <BlockNoteView
      editor={editor}
      theme="light"
      className="journal-editor"
      onChange={() => onChange(editor.document as unknown[])}
    />
  )
}
