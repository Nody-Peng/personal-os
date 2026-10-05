'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type MenuItem = { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean }

type Props = {
  label: string
  items: MenuItem[]
  className?: string
  children: ReactNode
}

const WIDTH = 200

/** A small popup menu, fixed-positioned so scrolling sidebars can't clip it. */
export function Menu({ label, items, className = '', children }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)

  useLayoutEffect(() => {
    if (!open || !button.current) return
    const r = button.current.getBoundingClientRect()
    const height = items.length * 36 + 8
    const below = r.bottom + 4 + height < window.innerHeight
    setPos({
      top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - height),
      left: Math.min(Math.max(8, r.right - WIDTH), window.innerWidth - WIDTH - 8),
    })
    list.current?.querySelector('button')?.focus()
  }, [open, items.length])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (!list.current?.contains(t) && !button.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        button.current?.focus()
      }
    }
    const close = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={className}
      >
        {children}
      </button>
      {/* In a portal: an ancestor with a transform or backdrop blur would otherwise be what `fixed` positions against. */}
      {open &&
        pos &&
        createPortal(
          <ul
            ref={list}
            role="menu"
            aria-label={label}
            className="pop-in fixed z-[55] rounded-lg border border-line bg-surface p-1 shadow-[0_12px_32px_-12px_rgba(17,17,17,0.28)]"
            style={{ top: pos.top, left: pos.left, width: WIDTH }}
          >
            {items.map((item) => (
              <li key={item.label} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpen(false)
                    item.onSelect()
                  }}
                  className={`flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm outline-none hover:bg-sunken focus-visible:bg-sunken ${
                    item.danger ? 'text-red-ink' : 'text-ink'
                  }`}
                >
                  <span className="grid size-4 place-items-center text-muted">{item.icon}</span>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  )
}
