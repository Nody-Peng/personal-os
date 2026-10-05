'use client'

import type { Icon } from '@phosphor-icons/react'
import { useState } from 'react'
import { isUrl } from '@/lib/embeds'

/** The empty state of the embed and bookmark blocks: paste an address. */
export function UrlPrompt({
  icon: Glyph,
  placeholder,
  action,
  hint,
  onSubmit,
  onCancel,
}: {
  icon: Icon
  placeholder: string
  action: string
  hint?: string
  onSubmit: (url: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const submit = () => {
    const url = value.trim()
    if (!isUrl(url)) return setError('請貼上 http(s) 開頭的完整網址')
    onSubmit(url)
  }
  return (
    <div className="note-linkpicker p-3" contentEditable={false} data-own-escape>
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
