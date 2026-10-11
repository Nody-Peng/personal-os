'use client'

import type { Icon } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { isUrl } from '@/lib/embeds'
import { useClickAway } from './freshBlock'

/**
 * The empty state of the embed and bookmark blocks: paste an address. Just
 * inserted (`fresh`) it is open and focused; otherwise, and after a click
 * elsewhere, it is a one-line placeholder that opens it again (as in Notion).
 */
export function UrlPrompt({
  icon: Glyph,
  label,
  placeholder,
  action,
  hint,
  fresh,
  onSubmit,
  onCancel,
}: {
  icon: Icon
  /** The closed placeholder's text. */
  label: string
  placeholder: string
  action: string
  hint?: string
  fresh: boolean
  onSubmit: (url: string) => void
  onCancel: () => void
}) {
  const [open, setOpen] = useState(fresh)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  useClickAway(box, () => setOpen(false), open)

  const submit = () => {
    const url = value.trim()
    if (!isUrl(url)) return setError('請貼上 http(s) 開頭的完整網址')
    onSubmit(url)
  }

  if (!open) {
    return (
      <button type="button" contentEditable={false} onClick={() => setOpen(true)} className="note-pagelink">
        <Glyph size={18} className="shrink-0" />
        <span className="truncate">{label}</span>
      </button>
    )
  }
  return (
    <div ref={box} className="note-linkpicker p-3" contentEditable={false} data-own-escape="focus">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Glyph size={18} className="shrink-0 text-muted" />
        <input
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              onCancel()
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          inputMode="url"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink-strong outline-none placeholder:text-faint"
        />
        <button type="submit" className="btn btn-primary shrink-0 px-3 py-1 text-sm">
          {action}
        </button>
      </form>
      {(error || hint) && <p className={`mt-2 text-xs ${error ? 'text-red-ink' : 'text-faint'}`}>{error ?? hint}</p>}
    </div>
  )
}
