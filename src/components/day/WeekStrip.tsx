import { Check } from '@phosphor-icons/react'
import { HabitMark } from '@/components/habits/HabitIcon'
import type { HabitItem } from '@/lib/habits'

export type WeekDay = {
  date: string
  label: string // 一 二 … 日
  habitsDone: number[]
  toeflMinutes: number
}

type Props = {
  days: WeekDay[]
  today: string
  habits: HabitItem[]
  toeflHoursTarget: number
}

/** This week at a glance: TOEFL minutes per day plus habit marks, then totals. */
export function WeekStrip({ days, today, habits, toeflHoursTarget }: Props) {
  const toeflHours = days.reduce((sum, d) => sum + d.toeflMinutes, 0) / 60
  const scaleMax = Math.max(60, ...days.map((d) => d.toeflMinutes))
  const name = (id: number) => habits.find((h) => h.id === id)?.name

  return (
    <div>
      <h2 className="font-semibold text-ink-strong">本週</h2>

      <div className="mt-5 grid grid-cols-[auto_1fr] gap-x-3">
        <div className="flex flex-col justify-between pb-[52px] text-right text-[11px] text-muted tabular-nums">
          <span>{scaleMax} 分</span>
          <span>0</span>
        </div>
        <ol className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const isToday = d.date === today
            const height = (d.toeflMinutes / scaleMax) * 100
            const done = d.habitsDone.map(name).filter(Boolean)
            const summary = `${d.label}：托福 ${d.toeflMinutes} 分鐘${done.length ? `，完成 ${done.join('、')}` : ''}`
            return (
              <li key={d.date} className="flex flex-col items-center" title={summary} aria-label={summary}>
                <div className="relative flex h-24 w-full items-end justify-center border-b border-line">
                  {d.toeflMinutes > 0 && (
                    <div
                      className="w-full max-w-6 rounded-t bg-accent transition-[height] duration-500 ease-out"
                      style={{ height: `${height}%` }}
                    />
                  )}
                </div>
                <div className="mt-2 flex h-2 gap-0.5" aria-hidden>
                  {habits.map((h, i) => (
                    <HabitMark key={h.id} index={i} on={d.habitsDone.includes(h.id)} size="size-1.5" />
                  ))}
                </div>
                <span
                  className={`mt-1.5 flex size-7 items-center justify-center rounded-full text-xs ${
                    isToday ? 'bg-ink-strong font-semibold text-white' : 'text-muted'
                  }`}
                >
                  {d.label}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {habits.map((h, i) => (
          <span key={h.id} className="flex items-center gap-1.5">
            <HabitMark index={i} on /> {h.name}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2 rounded-t-sm bg-accent" /> 托福分鐘
        </span>
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-3 lg:grid-cols-5">
        <Meter label="托福" value={toeflHours} target={toeflHoursTarget} unit="小時" decimals={1} />
        {habits.map((h) => (
          <Meter
            key={h.id}
            label={h.name}
            value={days.filter((d) => d.habitsDone.includes(h.id)).length}
            target={h.weeklyTarget}
            unit="天"
          />
        ))}
      </dl>
    </div>
  )
}

function Meter({
  label,
  value,
  target,
  unit,
  decimals = 0,
}: {
  label: string
  value: number
  target: number
  unit: string
  decimals?: number
}) {
  const done = value >= target
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  return (
    <div className="min-w-0">
      <dt className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate text-muted">{label}</span>
        {done && <Check size={14} weight="bold" className="shrink-0 text-green-ink" aria-label="已達標" />}
      </dt>
      <dd className="mt-1">
        <span className="text-xl font-semibold text-ink-strong">{value.toFixed(decimals)}</span>
        <span className="text-sm text-muted">
          {' '}
          / {target} {unit}
        </span>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-accent-soft">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
        </div>
      </dd>
    </div>
  )
}
