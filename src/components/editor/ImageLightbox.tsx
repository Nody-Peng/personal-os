'use client'

// A note's pictures full screen: double-click a picture (click it on a locked
// page, or use the ⤢ button in its toolbar), ← / → for the others in the same
// note, Esc or a click outside the picture to close.

import { ArrowsOut, CaretLeft, CaretRight, X } from '@phosphor-icons/react'
import { useBlockNoteEditor, useComponentsContext, useEditorState } from '@blocknote/react'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type LightboxImage = { src: string; caption: string; blockId: string | null }

export const IMAGE_SELECTOR = '.bn-block-content[data-content-type="image"] img'

/** The pictures under `root`, in reading order (caption from the block, when there is one). */
export function imagesIn(root: HTMLElement, captionOf: (blockId: string) => string): LightboxImage[] {
  return [...root.querySelectorAll<HTMLImageElement>(IMAGE_SELECTOR)]
    .filter((img) => img.getAttribute('src'))
    .map((img) => {
      const blockId = img.closest('[data-node-type="blockContainer"]')?.getAttribute('data-id') ?? null
      return { src: img.getAttribute('src')!, caption: blockId ? captionOf(blockId) : '', blockId }
    })
}

/** Opens the viewer at a picture block (for the toolbar button). */
export const LightboxContext = createContext<(blockId: string) => void>(() => {})

export function ImageLightbox({ images, start, onClose }: { images: LightboxImage[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start)
  const panel = useRef<HTMLDivElement>(null)
  const image = images[index]
  const many = images.length > 1
  const step = (dir: number) => setIndex((i) => (i + dir + images.length) % images.length)

  useEffect(() => {
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && many) step(-1)
      else if (e.key === 'ArrowRight' && many) step(1)
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    // Capture: the viewer answers before the editor or a surrounding panel does.
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
    // step only reads the image count, which doesn't change while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, many])

  if (!image) return null
  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label="圖片"
      tabIndex={-1}
      data-own-escape
      onClick={onClose}
      className="modal-scrim fixed inset-0 z-[70] flex flex-col items-center justify-center gap-3 bg-viewer p-4 text-on-viewer outline-none md:p-10"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- an uploaded picture at full size */}
      <img
        src={image.src}
        alt={image.caption}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-7rem)] max-w-full rounded object-contain shadow-[0_24px_64px_-24px_rgba(0,0,0,0.6)]"
      />
      {(image.caption || many) && (
        <p className="flex max-w-2xl items-center gap-3 text-center text-sm opacity-80" onClick={(e) => e.stopPropagation()}>
          {image.caption && <span>{image.caption}</span>}
          {many && (
            <span className="shrink-0 font-mono text-xs">
              {index + 1} / {images.length}
            </span>
          )}
        </p>
      )}
      <button type="button" onClick={onClose} aria-label="關閉" className="absolute top-3 right-3 rounded-full p-2.5 transition-colors hover:bg-on-viewer/15">
        <X size={22} />
      </button>
      {many && (
        <>
          <button
            type="button"
            aria-label="上一張"
            onClick={(e) => {
              e.stopPropagation()
              step(-1)
            }}
            className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full p-2.5 transition-colors hover:bg-on-viewer/15 md:left-4"
          >
            <CaretLeft size={26} />
          </button>
          <button
            type="button"
            aria-label="下一張"
            onClick={(e) => {
              e.stopPropagation()
              step(1)
            }}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-2.5 transition-colors hover:bg-on-viewer/15 md:right-4"
          >
            <CaretRight size={26} />
          </button>
        </>
      )}
    </div>,
    document.body,
  )
}

/** ⤢ in the toolbar of a selected picture. */
export function ImageZoomButton() {
  const Components = useComponentsContext()!
  const editor = useBlockNoteEditor()
  const open = useContext(LightboxContext)
  const block = useEditorState({
    editor,
    selector: ({ editor }) => {
      const blocks = editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block]
      const only = blocks.length === 1 ? blocks[0] : undefined
      return only?.type === 'image' && (only.props as { url?: string }).url ? only : undefined
    },
  })
  if (!block) return null
  return (
    <Components.FormattingToolbar.Button
      className="bn-button"
      label="放大檢視"
      mainTooltip="放大檢視（或在圖片上點兩下）"
      icon={<ArrowsOut size={18} />}
      onClick={() => open(block.id)}
    />
  )
}
