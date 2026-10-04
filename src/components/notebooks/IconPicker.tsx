'use client'

import { useEffect, useRef, useState } from 'react'

// Page icons are the person's own content (picked like in Notion), so the
// curated set is emoji; any other emoji can be typed or pasted.
const ICONS = [
  '📝', '📒', '📓', '📚', '📖', '🔖', '📌', '📎',
  '💡', '🧠', '🎯', '✅', '⭐', '🔥', '🌱', '🌙',
  '🗺️', '🧭', '🛰️', '🌏', '💻', '🛠️', '⚙️', '🧪',
  '🎧', '🗣️', '✍️', '🇺🇸', '🏋️', '🍳', '✈️', '🎬',
  '📊', '📅', '💰', '❤️', '🎵', '📷', '🏠', '☕',
]

type Props = {
  value: string
  onChange: (icon: string) => void
  onClose: () => void
}

/** A small emoji grid under the page icon. */
export function IconPicker({ value, onChange, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const [custom, setCustom] = useState('')
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!panel.current?.contains(e.target as Node)) onCloseRef.current()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const pick = (icon: string) => {
    onChange(icon)
    onClose()
  }

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label="選擇圖示"
      className="modal-panel absolute top-full left-0 z-30 mt-2 w-[min(320px,calc(100vw-40px))] rounded-xl border border-line bg-surface p-3 shadow-[0_16px_40px_-16px_rgba(17,17,17,0.3)]"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="label">圖示</span>
        {value && (
          <button type="button" onClick={() => pick('')} className="rounded-md px-2 py-0.5 text-xs text-muted hover:bg-sunken hover:text-ink-strong">
            移除
          </button>
        )}
      </div>
      <div className="grid grid-cols-8 gap-0.5">
        {ICONS.map((icon) => (
          <button
            key={icon}
            type="button"
            onClick={() => pick(icon)}
            aria-label={icon}
            className={`grid aspect-square place-items-center rounded-md text-xl leading-none hover:bg-sunken ${value === icon ? 'bg-sunken ring-1 ring-line-strong' : ''}`}
          >
            {icon}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2 border-t border-line pt-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (custom.trim()) pick(custom.trim())
        }}
      >
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="或輸入、貼上任何表情符號"
          aria-label="自訂圖示"
          className="field py-1.5 text-sm"
          maxLength={16}
        />
        <button type="submit" className="btn btn-quiet py-1">
          使用
        </button>
      </form>
    </div>
  )
}
