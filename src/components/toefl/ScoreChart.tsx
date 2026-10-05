'use client'

import { useState } from 'react'
import { formatDayShort } from '@/lib/day'
import { SCORE_TYPES, labelOf } from '@/lib/options'
import { BAND_MAX, BAND_MIN, SECTIONS, cefrOf, formatBand, type Section } from '@/lib/toefl'
import { useElementWidth } from '@/lib/useElementWidth'

export type ChartScore = {
  id: number
  date: string
  week: number // fractional weeks since plan start
  type: string
  bands: Record<Section | 'overall', number | null>
}

type View = Section | 'overall'
const VIEWS: { value: View; label: string }[] = [{ value: 'overall', label: '總分' }, ...SECTIONS]

type Props = {
  scores: ChartScore[]
  baseline: number // overall band
  target: number // overall band
  endWeek: number // exam (or plan end) in fractional weeks
  checkpoints: { week: number; target: number }[]
}

const HEIGHT = 260
const M = { top: 20, right: 20, bottom: 30, left: 40 }
const ACCENT = 'var(--color-accent)'
const TARGET_INK = 'var(--color-faint)'

/** Bands over time against the straight-line path from baseline to target. */
export function ScoreChart({ scores, baseline, target, endWeek, checkpoints }: Props) {
  const [view, setView] = useState<View>('overall')
  const [active, setActive] = useState<number | null>(null)
  const [ref, width] = useElementWidth<HTMLDivElement>()

  const points = scores
    .filter((s) => s.bands[view] != null)
    .map((s) => ({ ...s, band: s.bands[view] as number }))
    .sort((a, b) => a.week - b.week)

  const bandsShown = [baseline, target, ...points.map((p) => p.band)]
  const yMin = Math.max(BAND_MIN, Math.floor(Math.min(...bandsShown) - 0.5))
  const yMax = Math.min(BAND_MAX, Math.ceil(Math.max(...bandsShown) + 0.5))
  const xMin = Math.min(0, ...points.map((p) => p.week))
  const xMax = Math.max(endWeek, ...points.map((p) => p.week))

  const innerW = Math.max(120, width - M.left - M.right)
  const innerH = HEIGHT - M.top - M.bottom
  const x = (w: number) => M.left + ((w - xMin) / (xMax - xMin || 1)) * innerW
  const y = (b: number) => M.top + (1 - (b - yMin) / (yMax - yMin || 1)) * innerH
  const targetAt = (w: number) => baseline + ((target - baseline) * w) / (endWeek || 1)

  const yTicks: number[] = []
  for (let b = yMin; b <= yMax; b += 0.5) yTicks.push(b)
  const weekStep = innerW < 360 ? 4 : 2
  const xTicks: number[] = []
  for (let w = 0; w <= xMax; w += weekStep) xTicks.push(w)

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.week)},${y(p.band)}`).join(' ')
  const hovered = points.find((p) => p.id === active) ?? null
  const last = points.at(-1)
  const viewLabel = VIEWS.find((v) => v.value === view)?.label ?? ''

  const nearest = (clientX: number, rect: DOMRect) => {
    if (!points.length) return
    const px = clientX - rect.left
    let best = points[0]
    for (const p of points) if (Math.abs(x(p.week) - px) < Math.abs(x(best.week) - px)) best = p
    setActive(best.id)
  }

  return (
    <div>
      <div role="tablist" aria-label="科目" className="flex flex-wrap gap-1.5">
        {VIEWS.map(({ value, label }) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={view === value}
            onClick={() => {
              setView(value)
              setActive(null)
            }}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              view === value ? 'bg-ink-strong font-medium text-on-ink' : 'text-muted hover:bg-sunken hover:text-ink-strong'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-2">
          <svg width="18" height="8" aria-hidden>
            <line x1="1" y1="4" x2="17" y2="4" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" />
          </svg>
          實際級分
        </span>
        <span className="flex items-center gap-2">
          <svg width="18" height="8" aria-hidden>
            <line x1="1" y1="4" x2="17" y2="4" stroke={TARGET_INK} strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          目標路線（{formatBand(baseline)} → {formatBand(target)}）
        </span>
      </div>

      <div ref={ref} className="relative mt-2">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${viewLabel}級分趨勢，共 ${points.length} 筆，目標 ${formatBand(target)}`}
          onPointerMove={(e) => nearest(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setActive(null)}
          className="touch-pan-y select-none overflow-visible"
        >
          {yTicks.map((b) => (
            <g key={b}>
              <line x1={M.left} x2={M.left + innerW} y1={y(b)} y2={y(b)} stroke="var(--color-line)" />
              <text x={M.left - 8} y={y(b) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)" className="tabular-nums">
                {formatBand(b)}
              </text>
            </g>
          ))}
          {xTicks.map((w) => (
            <text key={w} x={x(w)} y={HEIGHT - 8} textAnchor="middle" fontSize="11" fill="var(--color-muted)" className="font-mono">
              W{w}
            </text>
          ))}

          {/* Target path and checkpoints */}
          <line
            x1={x(0)}
            y1={y(baseline)}
            x2={x(endWeek)}
            y2={y(target)}
            stroke={TARGET_INK}
            strokeWidth="2"
            strokeDasharray="5 4"
          />
          {checkpoints.map((c) => {
            const cx = x(c.week - 2 / 7) // Saturday mock of that week
            const cy = y(c.target)
            // Hide the value when a real score sits on top of the checkpoint.
            const crowded = points.some((p) => Math.abs(x(p.week) - cx) < 28)
            return (
              <g key={c.week}>
                <path d={`M${cx},${cy - 6} l6,6 l-6,6 l-6,-6 z`} fill="var(--color-surface)" stroke={TARGET_INK} strokeWidth="1.5" />
                {!crowded && (
                  <text x={cx} y={cy - 11} textAnchor="middle" fontSize="11" fill="var(--color-muted)">
                    {formatBand(c.target)}
                  </text>
                )}
              </g>
            )
          })}

          {/* Actual bands */}
          {hovered && (
            <line x1={x(hovered.week)} x2={x(hovered.week)} y1={M.top} y2={M.top + innerH} stroke="var(--color-line-strong)" />
          )}
          {points.length > 1 && (
            <path d={path} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {points.map((p) => (
            <circle
              key={p.id}
              cx={x(p.week)}
              cy={y(p.band)}
              r={p.id === active ? 6 : 4.5}
              fill={ACCENT}
              stroke="var(--color-surface)"
              strokeWidth="2"
              tabIndex={0}
              aria-label={`${formatDayShort(p.date)} ${labelOf(SCORE_TYPES, p.type)} ${formatBand(p.band)}`}
              onFocus={() => setActive(p.id)}
              onBlur={() => setActive(null)}
              className="outline-none"
            />
          ))}
          {last && !hovered && (
            <text x={x(last.week) + 9} y={y(last.band) + 4} fontSize="12" fontWeight="600" fill="var(--color-ink-strong)">
              {formatBand(last.band)}
            </text>
          )}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute z-10 min-w-36 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-[0_4px_16px_rgba(17,17,17,0.06)]"
            style={{
              left: Math.min(Math.max(x(hovered.week), 80), width - 80),
              top: Math.max(0, y(hovered.band) - 84),
            }}
          >
            <p className="text-xs text-muted">
              {formatDayShort(hovered.date)} · {labelOf(SCORE_TYPES, hovered.type)}
            </p>
            <p className="mt-0.5 flex items-center gap-2">
              <svg width="12" height="4" aria-hidden>
                <line x1="0" y1="2" x2="12" y2="2" stroke={ACCENT} strokeWidth="2" />
              </svg>
              <strong className="text-ink-strong">{formatBand(hovered.band)}</strong>
              <span className="text-muted">實際{view === 'overall' ? ` · ${cefrOf(hovered.band)}` : ''}</span>
            </p>
            <p className="flex items-center gap-2">
              <svg width="12" height="4" aria-hidden>
                <line x1="0" y1="2" x2="12" y2="2" stroke={TARGET_INK} strokeWidth="2" strokeDasharray="3 2" />
              </svg>
              <strong className="text-ink-strong">{targetAt(hovered.week).toFixed(1)}</strong>
              <span className="text-muted">目標</span>
            </p>
          </div>
        )}

        {points.length === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-1/3 px-6 text-center text-sm text-muted">
            {view === 'overall'
              ? '還沒有四科完整的成績。做一次 ETS 官方模擬考，記在下方。'
              : `還沒有${viewLabel}級分。`}
          </p>
        )}
      </div>
    </div>
  )
}
