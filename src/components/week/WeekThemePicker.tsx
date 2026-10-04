'use client'

import { useRef, useState, useTransition } from 'react'
import { updateIdea } from '@/app/(frontend)/actions'
import { saveWeekNote } from '@/app/(frontend)/journal-actions'

type Option = { id: number; title: string; total: number }

/** Sunday decision: pick next week's theme from the backlog, and say why. */
export function WeekThemePicker({
  monday,
  options,
  initialTheme,
  initialReason,
}: {
  monday: string
  options: Option[]
  initialTheme: number | null
  initialReason: string
}) {
  const [theme, setTheme] = useState(initialTheme)
  const [reason, setReason] = useState(initialReason)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const savedReason = useRef(initialReason)

  const choose = (value: string) => {
    const id = value ? Number(value) : null
    setTheme(id)
    startTransition(async () => {
      const saved = await saveWeekNote(monday, { nextTheme: id })
      // The chosen idea becomes the active theme straight away.
      const promoted = id ? await updateIdea(id, { status: 'selected' }) : { ok: true as const }
      setError(!saved.ok ? saved.error : !promoted.ok ? promoted.error : null)
    })
  }

  const saveReason = () => {
    if (reason === savedReason.current) return
    savedReason.current = reason
    startTransition(async () => {
      const result = await saveWeekNote(monday, { themeReason: reason })
      setError(result.ok ? null : result.error)
    })
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <label htmlFor={`theme-${monday}`} className="label">
          下週主題（23:00–24:00）
        </label>
        <select id={`theme-${monday}`} value={theme ?? ''} onChange={(e) => choose(e.target.value)} className="field">
          <option value="">還沒決定</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}（{o.total} 分）
            </option>
          ))}
        </select>
        <p className="text-xs text-muted">清單依想學清單的總分排序；選了會立刻成為目前的主題。</p>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`reason-${monday}`} className="label">
          為什麼選它
        </label>
        <textarea
          id={`reason-${monday}`}
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={saveReason}
          className="field resize-none"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-ink md:col-span-2">
          {error}
        </p>
      )}
    </div>
  )
}
