'use client'

import { X } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Side drawer holding a week note on the month calendar (?week=…). */
export function WeekDrawer({ closeHref, children }: { closeHref: string; children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The task panel sits on top and handles Escape itself.
      if (e.key === 'Escape' && !new URLSearchParams(window.location.search).has('task')) {
        router.replace(closeHref, { scroll: false })
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeHref, router])

  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label="週筆記">
      <button
        type="button"
        aria-label="關閉週筆記"
        onClick={() => router.replace(closeHref, { scroll: false })}
        className="absolute inset-0 bg-ink-strong/15"
      />
      <aside className="absolute inset-y-0 right-0 w-full max-w-[720px] overflow-y-auto bg-canvas px-4 pt-4 pb-24 shadow-[0_0_48px_rgba(17,17,17,0.12)] md:border-l md:border-line md:px-6">
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => router.replace(closeHref, { scroll: false })}
            aria-label="關閉"
            className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink-strong"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  )
}
