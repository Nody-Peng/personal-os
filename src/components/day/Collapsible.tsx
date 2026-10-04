'use client'

import { CaretRight } from '@phosphor-icons/react'
import { useId, useState } from 'react'

/** A section that starts folded: "▸ 安排明天". */
export function Collapsible({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string
  hint?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
      >
        <CaretRight size={16} weight="bold" className={`text-muted transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="font-semibold text-ink-strong">{title}</span>
        {hint && <span className="ml-auto text-sm text-muted">{hint}</span>}
      </button>
      <div id={id} hidden={!open} className="mt-4">
        {children}
      </div>
    </div>
  )
}
