'use client'

import '@blocknote/mantine/style.css'
import type { PartialBlock } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/mantine'
import { GridSuggestionMenuController, SuggestionMenuController, useCreateBlockNote } from '@blocknote/react'
import { multiColumnDropCursor } from '@blocknote/xl-multi-column'
import { useEffect, useRef } from 'react'
import { useResolvedTheme } from '@/lib/theme'
import { reportNoteError, uploadMedia } from '@/lib/uploadMedia'
import { NoteSideMenu } from './BlockMenu'
import { blockSelection } from './blockSelection'
import { scrollToBlock } from './blocks/TableOfContents'
import { codeHighlighting } from './codeHighlighter'
import { emojiItems } from './emojiItems'
import { PasteUrlMenu, type PasteUrlMenuHandle } from './PasteUrlMenu'
import { isUrl } from '@/lib/embeds'
import { useNoteContext } from './NoteContext'
import { editorDictionary, editorSchema, notionShortcuts, rankItems, slashItems } from './schema'

type Props = {
  initial: unknown[] | null
  placeholder: string
  onChange: (blocks: unknown[]) => void
  className?: string
  /** Images, video and files (notebook pages). */
  allowUploads?: boolean
  editable?: boolean
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
export default function BlockEditorInner({ initial, placeholder, onChange, className = '', allowUploads = false, editable = true }: Props) {
  const note = useNoteContext()
  const noteRef = useRef(note)
  const theme = useResolvedTheme()
  const pasteMenu = useRef<PasteUrlMenuHandle>(null)
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
    extensions: [notionShortcuts, codeHighlighting, blockSelection()],
    dropCursor: multiColumnDropCursor,
    uploadFile: allowUploads ? upload : undefined,
    // A pasted web address becomes a link, then asks: keep, bookmark or embed?
    pasteHandler: ({ event, editor, defaultPasteHandler }) => {
      const text = event.clipboardData?.getData('text/plain') ?? ''
      const block = editor.getTextCursorPosition().block
      if (!isUrl(text) || block.type === 'codeBlock' || !Array.isArray(block.content)) return defaultPasteHandler()
      const url = text.trim()
      const { from, to } = editor.prosemirrorState.selection
      // Pasting over selected words links them instead.
      if (from !== to) {
        editor.createLink(url)
        return true
      }
      editor.insertInlineContent([{ type: 'link', href: url, content: url }])
      pasteMenu.current?.open({ url, blockId: block.id, from, to: editor.prosemirrorState.selection.from })
      return true
    },
  })

  // A link to a block (#block-<id>, from 複製區塊連結) scrolls there once it is drawn.
  useEffect(() => {
    const target = decodeURIComponent(window.location.hash).match(/^#block-(.+)$/)?.[1]
    if (target && editor.getBlock(target)) requestAnimationFrame(() => scrollToBlock(target))
  }, [editor])

  return (
    <BlockNoteView
      editor={editor}
      theme={theme}
      editable={editable}
      slashMenu={false}
      emojiPicker={false}
      sideMenu={false}
      className={`journal-editor ${className}`}
      onChange={() => onChange(editor.document as unknown[])}
    >
      <SuggestionMenuController triggerCharacter="/" getItems={async (query) => rankItems(slashItems(editor, noteRef.current), query)} />
      <GridSuggestionMenuController triggerCharacter=":" columns={10} minQueryLength={1} getItems={(query) => emojiItems(editor, query)} />
      <NoteSideMenu />
      <PasteUrlMenu ref={pasteMenu} editor={editor} />
    </BlockNoteView>
  )
}
