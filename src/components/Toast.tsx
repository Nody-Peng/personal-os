'use client'

import { useEffect, useState } from 'react'

export type ToastMessage = { text: string; tone: 'error' | 'info' }

/** A short message at the bottom of the screen. */
export function Toast({ text, tone }: ToastMessage) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`toast-in fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border px-4 py-2 text-sm shadow-[0_12px_32px_-16px_rgba(17,17,17,0.3)] ${
        tone === 'error' ? 'border-red-ink/20 bg-red-soft text-red-ink' : 'border-line bg-ink-strong text-canvas'
      }`}
    >
      {text}
    </p>
  )
}

/** Errors stay a little longer than confirmations. */
export function useToastTimeout(toast: ToastMessage | null, clear: () => void) {
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(clear, toast.tone === 'error' ? 5000 : 2200)
    return () => window.clearTimeout(timer)
  }, [toast, clear])
}

/**
 * What editors report from deep inside (a failed upload, a copied block link),
 * on pages outside a notebook; NotebookShell shows the same events itself.
 */
export function EditorToasts() {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  useToastTimeout(toast, () => setToast(null))
  useEffect(() => {
    const onError = (e: Event) => setToast({ text: String((e as CustomEvent<string>).detail), tone: 'error' })
    const onInfo = (e: Event) => setToast({ text: String((e as CustomEvent<string>).detail), tone: 'info' })
    window.addEventListener('notes:error', onError)
    window.addEventListener('notes:info', onInfo)
    return () => {
      window.removeEventListener('notes:error', onError)
      window.removeEventListener('notes:info', onInfo)
    }
  }, [])
  return toast ? <Toast key={toast.text} {...toast} /> : null
}
