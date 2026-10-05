'use client'

import { WarningCircle } from '@phosphor-icons/react'
import { useDayLog } from './DayLogProvider'

/** Taps on the day page save in the background; a failed save must not look saved. */
export function DaySaveStatus() {
  const { status, error } = useDayLog()
  if (status !== 'error') return null
  return (
    <div
      role="alert"
      className="toast-in fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 mx-auto flex max-w-md items-start gap-2 rounded-xl border border-red-ink/20 bg-red-soft px-4 py-3 text-sm text-red-ink shadow-[0_16px_40px_-16px_rgba(17,17,17,0.3)] md:bottom-6"
    >
      <WarningCircle size={18} className="mt-0.5 shrink-0" />
      <span>
        剛剛的變更沒有存到：{error}
        <br />
        請確認網路或重新登入；在那之前先別重新整理這一頁。
      </span>
    </div>
  )
}
