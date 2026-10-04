import { Check } from '@phosphor-icons/react'

export type WeekDay = {
  date: string
  label: string // 一 二 … 日
  listening: boolean
  gym: boolean
  toeflMinutes: number
}

type Props = {
  days: WeekDay[]
  today: string
  targets: { toeflHours: number; gym: number }
}

const LISTENING_TARGET = 5 // weekday mornings

/** This week at a glance: TOEFL minutes per day plus habit dots, then totals. */
export function WeekStrip({ days, today, targets }: Props) {
  const toeflHours = days.reduce((sum, d) => sum + d.toeflMinutes, 0) / 60
  const gym = days.filter((d) => d.gym).length
  const listening = days.filter((d) => d.listening).length
  const scaleMax = Math.max(60, ...days.map((d) => d.toeflMinutes))

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
            const summary = `${d.label}：托福 ${d.toeflMinutes} 分鐘，${d.listening ? '有' : '沒有'}聽英文，${d.gym ? '有' : '沒有'}健身`
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
                <div className="mt-2 flex gap-1" aria-hidden>
                  <Dot on={d.listening} />
                  <Dot on={d.gym} square />
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

      <p className="mt-3 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <Dot on /> 聽英文
        </span>
        <span className="flex items-center gap-1.5">
          <Dot on square /> 健身
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2 rounded-t-sm bg-accent" /> 托福分鐘
        </span>
      </p>

      <dl className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
        <Meter label="托福" value={toeflHours} target={targets.toeflHours} unit="小時" decimals={1} />
        <Meter label="健身" value={gym} target={targets.gym} unit="次" />
        <Meter label="早上聽英文" value={listening} target={LISTENING_TARGET} unit="天" />
      </dl>
    </div>
  )
}

function Dot({ on, square = false }: { on: boolean; square?: boolean }) {
  return (
    <span
      className={`inline-block size-2 ${square ? 'rounded-[2px]' : 'rounded-full'} ${
        on ? 'bg-ink-strong' : 'border border-line-strong'
      }`}
    />
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
    <div>
      <dt className="flex items-center justify-between text-sm">
        <span className="text-muted">{label}</span>
        {done && <Check size={14} weight="bold" className="text-green-ink" aria-label="已達標" />}
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
