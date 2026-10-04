'use client'

import { useState } from 'react'
import { formatDayShort } from '@/lib/day'
import { useElementWidth } from '@/lib/useElementWidth'

type Week = { week: number; start: string; minutes: number }

type Props = {
  weeks: Week[]
  currentWeek: number
  targetHours: number
}

const HEIGHT = 180
const M = { top: 16, right: 12, bottom: 28, left: 32 }

/** TOEFL hours per plan week against the weekly target. */
export function WeeklyHours({ weeks, currentWeek, targetHours }: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const hours = (m: number) => Math.round((m / 60) * 10) / 10
  const yMax = Math.max(targetHours + 2, ...weeks.map((w) => Math.ceil(hours(w.minutes))))
  const innerW = Math.max(120, width - M.left - M.right)
  const innerH = HEIGHT - M.top - M.bottom
  const slot = innerW / weeks.length
  const barW = Math.min(24, slot * 0.6)
  const y = (h: number) => M.top + (1 - h / yMax) * innerH
  const yTicks = [0, Math.round(yMax / 2), yMax]
  const hovered = weeks.find((w) => w.week === active) ?? null

  return (
    <div ref={ref} className="relative">
      <svg width={width} height={HEIGHT} role="img" aria-label={`每週托福時數，目標 ${targetHours} 小時`} className="overflow-visible">
        {yTicks.map((h) => (
          <g key={h}>
            <line x1={M.left} x2={M.left + innerW} y1={y(h)} y2={y(h)} stroke="var(--color-line)" />
            <text x={M.left - 8} y={y(h) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)" className="tabular-nums">
              {h}
            </text>
          </g>
        ))}
        <line
          x1={M.left}
          x2={M.left + innerW}
          y1={y(targetHours)}
          y2={y(targetHours)}
          stroke="var(--color-faint)"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
        <text x={M.left + innerW} y={y(targetHours) - 6} textAnchor="end" fontSize="11" fill="var(--color-muted)">
          目標 {targetHours} 小時
        </text>

        {weeks.map((w) => {
          const cx = M.left + slot * (w.week - 0.5)
          const h = hours(w.minutes)
          const top = y(h)
          const base = y(0)
          const future = w.week > currentWeek
          const r = Math.min(4, base - top)
          return (
            <g
              key={w.week}
              tabIndex={future ? -1 : 0}
              onPointerEnter={() => !future && setActive(w.week)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(w.week)}
              onBlur={() => setActive(null)}
              aria-label={`第 ${w.week} 週：${h} 小時`}
              className="outline-none"
            >
              <rect x={cx - slot / 2} y={M.top} width={slot} height={innerH} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${cx - barW / 2},${base} V${top + r} q0,-${r} ${r},-${r} H${cx + barW / 2 - r} q${r},0 ${r},${r} V${base} Z`}
                  fill="var(--color-accent)"
                  opacity={active === null || active === w.week ? 1 : 0.55}
                />
              )}
              <text
                x={cx}
                y={HEIGHT - 8}
                textAnchor="middle"
                fontSize="11"
                fontWeight={w.week === currentWeek ? 600 : 400}
                fill={w.week === currentWeek ? 'var(--color-ink-strong)' : 'var(--color-muted)'}
                className="font-mono"
              >
                {w.week}
              </text>
            </g>
          )
        })}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-[0_4px_16px_rgba(17,17,17,0.06)]"
          style={{
            left: Math.min(Math.max(M.left + slot * (hovered.week - 0.5), 60), width - 60),
            top: Math.max(0, y(hours(hovered.minutes)) - 64),
          }}
        >
          <p className="text-xs text-muted">
            第 {hovered.week} 週 · {formatDayShort(hovered.start)} 起
          </p>
          <p>
            <strong className="text-ink-strong">{hours(hovered.minutes)}</strong>
            <span className="text-muted"> / {targetHours} 小時</span>
          </p>
        </div>
      )}
    </div>
  )
}
