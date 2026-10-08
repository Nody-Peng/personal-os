'use client'

import '@blocknote/mantine/style.css'
import type { PartialBlock } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/mantine'
import {
  FormattingToolbar,
  FormattingToolbarController,
  getFormattingToolbarItems,
  GridSuggestionMenuController,
  SuggestionMenuController,
  useCreateBlockNote,
} from '@blocknote/react'
import { multiColumnDropCursor } from '@blocknote/xl-multi-column'
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { isBlankDocument } from '@/lib/blocks'
import { isUrl } from '@/lib/embeds'
import type { TemplateKind } from '@/lib/options'
import { useResolvedTheme } from '@/lib/theme'
import { reportNoteError, uploadMedia } from '@/lib/uploadMedia'
import { NoteSideMenu } from './BlockMenu'
import { blockSelection } from './blockSelection'
import { scrollToBlock } from './blocks/TableOfContents'
import { codeHighlighting } from './codeHighlighter'
import { emojiItems } from './emojiItems'
import { IMAGE_SELECTOR, ImageLightbox, ImageZoomButton, imagesIn, LightboxContext, type LightboxImage } from './ImageLightbox'
import { useNoteContext } from './NoteContext'
import { PasteUrlMenu, type PasteUrlMenuHandle } from './PasteUrlMenu'
import { editorDictionary, editorSchema, notionShortcuts, rankItems, slashItems } from './schema'
import { TemplateBar } from './TemplateBar'

/** What a page can do to its editor from outside. */
export type EditorHandle = {
  /** Replaces the whole document (a restored version); it saves like any edit. */
  replace: (blocks: unknown[]) => void
}

type Props = {
  initial: unknown[] | null
  placeholder: string
  onChange: (blocks: unknown[]) => void
  className?: string
  /** Images, video and files. */
  allowUploads?: boolean
  editable?: boolean
  /** While the note is empty, offer the templates made for this kind of note. */
  templateKind?: TemplateKind
  handle?: Ref<EditorHandle>
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
export default function BlockEditorInner({
  initial,
  placeholder,
  onChange,
  className = '',
  allowUploads = false,
  editable = true,
  templateKind,
  handle,
}: Props) {
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

  const replace = useCallback(
    (blocks: unknown[]) => {
      const next = (blocks.length ? blocks : [{ type: 'paragraph' }]) as PartialBlock<typeof editorSchema.blockSchema>[]
      editor.replaceBlocks(editor.document, next)
    },
    [editor],
  )
  useImperativeHandle(handle, () => ({ replace }), [replace])

  // An empty note offers templates (TemplateBar) until something is written.
  const [blank, setBlank] = useState(() => isBlankDocument(editor.document))

  // Pictures full screen: double-click one (click on a locked page) or ⤢ in its toolbar.
  const [viewer, setViewer] = useState<{ images: LightboxImage[]; start: number } | null>(null)
  const closeViewer = useCallback(() => setViewer(null), [])
  const openViewer = useCallback(
    (at: { blockId?: string; src?: string }) => {
      const root = editor.domElement
      if (!root) return
      const captionOf = (id: string) => String((editor.getBlock(id)?.props as { caption?: unknown } | undefined)?.caption ?? '')
      const images = imagesIn(root, captionOf)
      const start = images.findIndex((image) => (at.blockId ? image.blockId === at.blockId : image.src === at.src))
      if (start >= 0) setViewer({ images, start })
    },
    [editor],
  )
  const openBlock = useCallback((blockId: string) => openViewer({ blockId }), [openViewer])
  useEffect(() => {
    const onPicture = (e: MouseEvent) => {
      const img = e.target
      if (!(img instanceof HTMLImageElement) || !editor.domElement?.contains(img) || !img.matches(IMAGE_SELECTOR)) return
      if (e.type === 'click' && editor.isEditable) return
      e.preventDefault()
      openViewer({ src: img.getAttribute('src') ?? '' })
    }
    document.addEventListener('dblclick', onPicture)
    document.addEventListener('click', onPicture)
    return () => {
      document.removeEventListener('dblclick', onPicture)
      document.removeEventListener('click', onPicture)
    }
  }, [editor, openViewer])

  return (
    <LightboxContext.Provider value={openBlock}>
      {templateKind && editable && blank && (
        <TemplateBar
          kind={templateKind}
          onPick={(blocks) => {
            replace(blocks)
            editor.focus()
          }}
        />
      )}
      <BlockNoteView
        editor={editor}
        theme={theme}
        editable={editable}
        slashMenu={false}
        emojiPicker={false}
        sideMenu={false}
        formattingToolbar={false}
        className={`journal-editor ${className}`}
        onChange={() => {
          onChange(editor.document as unknown[])
          if (templateKind) setBlank(isBlankDocument(editor.document))
        }}
      >
        <SuggestionMenuController triggerCharacter="/" getItems={async (query) => rankItems(slashItems(editor, noteRef.current), query)} />
        <GridSuggestionMenuController triggerCharacter=":" columns={10} minQueryLength={1} getItems={(query) => emojiItems(editor, query)} />
        <FormattingToolbarController
          formattingToolbar={() => <FormattingToolbar>{[...getFormattingToolbarItems(), <ImageZoomButton key="imageZoom" />]}</FormattingToolbar>}
        />
        <NoteSideMenu />
        <PasteUrlMenu ref={pasteMenu} editor={editor} />
      </BlockNoteView>
      {viewer && <ImageLightbox images={viewer.images} start={viewer.start} onClose={closeViewer} />}
    </LightboxContext.Provider>
  )
}
