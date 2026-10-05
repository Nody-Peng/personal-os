'use client'

import { ArrowCounterClockwise, House } from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect } from 'react'

/** Anything that fails while rendering a page lands here instead of a blank "Application error". */
export default function FrontendError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-5 text-center">
      <p className="label">出了點問題</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-strong">這一頁沒有順利顯示</h1>
      <p className="mt-3 text-sm text-muted">已經儲存的內容都還在。可以重試一次，或先回到今天。</p>
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={reset} className="btn btn-primary">
          <ArrowCounterClockwise size={16} />
          重試
        </button>
        <Link href="/" className="btn btn-quiet">
          <House size={16} />
          回到今天
        </Link>
      </div>
    </main>
  )
}
