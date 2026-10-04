'use client'

import { useRef, useState, useTransition } from 'react'
import { saveWeekNote, setWeekTheme } from '@/app/(frontend)/journal-actions'

type Option = { id: number; title: string; total: number }

/** Pick the theme (23:00–24:00 block) for one week, and say why. */
export function WeekThemePicker({
  monday,
  label,
  hint,
  options,
  initialTheme,
  initialReason,
}: {
  /** The week whose theme this sets. */
  monday: string
  label: string
  hint: string
  options: Option[]
  initialTheme: number | null
  initialReason: string
}) {
  const [theme, setTheme] = useState(initialTheme)
  const [reason, setReason] = useState(initialReason)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [, startTransition] = useTransition()
  const savedReason = useRef(initialReason)

  const choose = (value: string) => {
    const id = value ? Number(value) : null
    setTheme(id)
    setSaved(false)
    startTransition(async () => {
      const result = await setWeekTheme(monday, id)
      setError(result.ok ? null : result.error)
      setSaved(result.ok)
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

  // Keep the current choice listed even if it is no longer in the backlog.
  const listed = theme && !options.some((o) => o.id === theme) ? [{ id: theme, title: '（目前的主題）', total: 0 }, ...options] : options

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <label htmlFor={`theme-${monday}`} className="label">
          {label}
        </label>
        <select id={`theme-${monday}`} value={theme ?? ''} onChange={(e) => choose(e.target.value)} className="field">
          <option value="">還沒決定</option>
          {listed.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
              {o.total ? `（${o.total} 分）` : ''}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted">{saved ? '已更新' : hint}</p>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`reason-${monday}`} className="label">
          為什麼選它
        </label>
        <textarea
          id={`reason-${monday}`}
          rows={2}
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
