'use client'

import { ArrowsDownUp, ImageSquare, Trash } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { reportNoteError, uploadMedia } from '@/lib/uploadMedia'

type Props = {
  cover: string
  position: number
  onChange: (patch: { cover?: string; coverPosition?: number }) => void
  /** Locked page: the picture only, no controls. */
  readOnly?: boolean
}

/** Full-width banner image above the title (Notion's page cover). */
export function PageCover({ cover, position, onChange, readOnly = false }: Props) {
  const [moving, setMoving] = useState(false)
  const [pos, setPos] = useState(position)
  // A new picture (or a position saved elsewhere) starts from the stored position.
  const [shown, setShown] = useState({ cover, position })
  if (shown.cover !== cover || shown.position !== position) {
    setShown({ cover, position })
    setPos(position)
  }
  const drag = useRef<{ y: number; start: number; height: number } | null>(null)
  const picker = useCoverPicker((url) => onChange({ cover: url, coverPosition: 50 }))

  if (!cover) return null

  return (
    <div
      className={`group relative h-[30vh] max-h-72 min-h-36 w-full overflow-hidden bg-sunken ${moving ? 'cursor-ns-resize' : ''}`}
      onPointerDown={(e) => {
        if (!moving) return
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { y: e.clientY, start: pos, height: e.currentTarget.clientHeight }
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        // Dragging the picture down shows more of its top.
        const delta = ((e.clientY - drag.current.y) / drag.current.height) * 100
        setPos(Math.max(0, Math.min(100, Math.round(drag.current.start - delta))))
      }}
      onPointerUp={() => {
        drag.current = null
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- private file behind the login check */}
      <img src={cover} alt="" draggable={false} className="h-full w-full object-cover select-none" style={{ objectPosition: `center ${pos}%` }} />
      {picker.input}
      <div
        hidden={readOnly}
        className={`print:hidden absolute right-3 bottom-3 flex gap-1 rounded-lg border border-line bg-surface/95 p-1 text-xs shadow-[0_8px_24px_-12px_rgba(17,17,17,0.3)] transition-opacity ${
          moving ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100'
        }`}
      >
        {moving ? (
          <>
            <span className="px-2 py-1 text-muted">上下拖曳調整位置</span>
            <button
              type="button"
              className="rounded-md bg-ink-strong px-2 py-1 font-medium text-on-ink"
              onClick={() => {
                setMoving(false)
                onChange({ coverPosition: pos })
              }}
            >
              完成
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={picker.open} disabled={picker.busy} className="flex items-center gap-1 rounded-md px-2 py-1 text-ink hover:bg-sunken">
              <ImageSquare size={14} />
              {picker.busy ? '上傳中…' : '更換'}
            </button>
            <button type="button" onClick={() => setMoving(true)} className="flex items-center gap-1 rounded-md px-2 py-1 text-ink hover:bg-sunken">
              <ArrowsDownUp size={14} />
              調整位置
            </button>
            <button type="button" onClick={() => onChange({ cover: '' })} aria-label="移除封面" className="rounded-md px-1.5 py-1 text-muted hover:bg-sunken hover:text-red-ink">
              <Trash size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** A hidden file input that uploads one image. */
export function useCoverPicker(onUploaded: (url: string) => void) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      hidden
      onChange={async (e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        setBusy(true)
        try {
          onUploaded(await uploadMedia(file))
        } catch (error) {
          reportNoteError(error instanceof Error ? error.message : '上傳失敗')
        } finally {
          setBusy(false)
        }
      }}
    />
  )
  return { input, busy, open: () => ref.current?.click() }
}
