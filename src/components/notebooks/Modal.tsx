'use client'

import { X } from '@phosphor-icons/react'
import { useEffect, useRef, type ReactNode } from 'react'

type Props = {
  title: string
  onClose: () => void
  children: ReactNode
  /** Wider dialogs (search) sit near the top instead of the centre. */
  size?: 'md' | 'lg'
  hideTitle?: boolean
}

/** Centred dialog on desktop, bottom sheet on phones. */
export function Modal({ title, onClose, children, size = 'md', hideTitle = false }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.querySelector<HTMLElement>('[data-autofocus], input, button')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  return (
    <div className={`fixed inset-0 z-50 flex justify-center ${size === 'lg' ? 'items-end md:items-start md:pt-[12vh]' : 'items-end md:items-center'}`}>
      <button type="button" aria-label="關閉" tabIndex={-1} onClick={onClose} className="modal-scrim absolute inset-0 bg-ink-strong/25" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal-panel relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-xl border border-line bg-surface shadow-[0_24px_60px_-20px_rgba(17,17,17,0.35)] md:rounded-xl ${
          size === 'lg' ? 'md:max-w-xl' : 'md:max-w-lg'
        }`}
      >
        {!hideTitle && (
          <header className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-sm font-semibold text-ink-strong">{title}</h2>
            <button type="button" onClick={onClose} aria-label="關閉" className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink-strong">
              <X size={16} />
            </button>
          </header>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{children}</div>
      </div>
    </div>
  )
}
