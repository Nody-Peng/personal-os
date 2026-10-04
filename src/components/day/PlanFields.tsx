'use client'

import { useDayLog } from './DayLogProvider'

const SLOTS = [
  { key: 'morningPlan', label: '早' },
  { key: 'noonPlan', label: '午' },
  { key: 'eveningPlan', label: '晚' },
] as const

/** 早 / 午 / 晚: what actually happens in each part of the day. */
export function PlanFields() {
  const { day, log, editText, flush } = useDayLog()
  return (
    <div className="divide-y divide-line">
      {SLOTS.map(({ key, label }) => (
        <div key={key} className="grid grid-cols-[2rem_1fr] items-start gap-3 py-2.5 first:pt-0 last:pb-0">
          <label htmlFor={`${key}-${day}`} className="pt-1 text-sm font-semibold text-ink-strong">
            {label}
          </label>
          <textarea
            id={`${key}-${day}`}
            rows={1}
            value={log[key]}
            onChange={(e) => editText({ [key]: e.target.value })}
            onBlur={flush}
            placeholder="安排…"
            className="field-sizing-content min-h-8 w-full resize-none rounded-md bg-transparent px-2 py-1 text-ink-strong outline-none transition-colors placeholder:text-faint hover:bg-sunken focus:bg-sunken"
          />
        </div>
      ))}
    </div>
  )
}
