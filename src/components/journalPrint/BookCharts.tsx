// Charts for the printed journal: plain SVG drawn in millimetres (the
// viewBox is the printed size, so 2.6 units of text is 2.6 mm on paper).
// Marks use the book's accent ink; text stays in the pencil greys.

const TEXT = 2.5

/** Energy (1–5) over days or months; gaps where nothing was recorded. */
export function LineChart({ points, width, height = 34, empty }: { points: { label?: string; value: number | null }[]; width: number; height?: number; empty: string }) {
  const left = 6
  const right = 10
  const top = 2
  const bottom = 6
  const w = width - left - right
  const h = height - top - bottom
  const n = Math.max(1, points.length - 1)
  const x = (i: number) => left + (points.length === 1 ? w / 2 : (i / n) * w)
  const y = (v: number) => top + h - ((v - 1) / 4) * h
  const values = points.map((p) => p.value).filter((v): v is number => v != null)
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null

  // One path per run of recorded points.
  const runs: string[] = []
  let current: string[] = []
  points.forEach((p, i) => {
    if (p.value == null) {
      if (current.length > 1) runs.push(current.join(' '))
      current = []
      return
    }
    current.push(`${current.length ? 'L' : 'M'}${x(i).toFixed(2)} ${y(p.value).toFixed(2)}`)
  })
  if (current.length > 1) runs.push(current.join(' '))

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="精力曲線">
        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line className="grid" x1={left} x2={left + w} y1={y(v)} y2={y(v)} />
            <text x={left - 2} y={y(v) + 0.9} fontSize={TEXT} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        <line className="axis" x1={left} x2={left + w} y1={top + h} y2={top + h} />
        {points.map((p, i) =>
          p.label ? (
            <text key={`l${i}`} x={x(i)} y={height - 1.5} fontSize={TEXT} textAnchor="middle">
              {p.label}
            </text>
          ) : null,
        )}
        {avg != null && (
          <>
            <line className="avg" x1={left} x2={left + w} y1={y(avg)} y2={y(avg)} />
            <text x={left + w + 1} y={y(avg) + 0.9} fontSize={TEXT} className="value">
              {avg.toFixed(1)}
            </text>
          </>
        )}
        {runs.map((d, i) => (
          <path key={i} className="series" d={d} />
        ))}
        {points.map((p, i) => (p.value == null ? null : <circle key={i} className="mark" cx={x(i)} cy={y(p.value)} r={0.75} />))}
        {!values.length && (
          <text x={left + w / 2} y={top + h / 2} fontSize={TEXT} textAnchor="middle" className="empty">
            {empty}
          </text>
        )}
      </svg>
    </div>
  )
}

/** Vertical bars with their values on top. */
export function BarChart({
  items,
  width,
  height = 36,
  format = (v) => String(v),
  values = true,
  empty,
}: {
  items: { label: string; value: number }[]
  width: number
  height?: number
  format?: (v: number) => string
  /** Each bar's value on top of it (off for a bar per day). */
  values?: boolean
  empty: string
}) {
  const top = 5
  const bottom = 6
  const h = height - top - bottom
  const max = Math.max(...items.map((i) => i.value), 0)
  const slot = width / Math.max(1, items.length)
  const bar = Math.min(9, slot * 0.6)
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <line className="axis" x1={0} x2={width} y1={top + h} y2={top + h} />
        {items.map((item, i) => {
          const bh = max ? (item.value / max) * h : 0
          const cx = slot * i + slot / 2
          return (
            <g key={i}>
              {item.value > 0 && <rect className="mark" x={cx - bar / 2} y={top + h - bh} width={bar} height={bh} rx={0.6} />}
              {values && item.value > 0 && (
                <text x={cx} y={top + h - bh - 1.2} fontSize={TEXT} textAnchor="middle" className="value">
                  {format(item.value)}
                </text>
              )}
              <text x={cx} y={height - 1.5} fontSize={TEXT} textAnchor="middle">
                {item.label}
              </text>
            </g>
          )
        })}
        {!max && (
          <text x={width / 2} y={top + h / 2} fontSize={TEXT} textAnchor="middle" className="empty">
            {empty}
          </text>
        )}
      </svg>
    </div>
  )
}

/** Horizontal bars of a share (0–1), e.g. how often each habit was done. */
export function ShareBars({ items, width }: { items: { label: string; share: number; note: string }[]; width: number }) {
  const row = 6
  const labelW = Math.min(30, width * 0.28)
  const noteW = 16
  const track = width - labelW - noteW - 2
  const height = items.length * row + 1
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        {items.map((item, i) => {
          const y = i * row + 1
          return (
            <g key={i}>
              <text x={0} y={y + 3.4} fontSize={TEXT + 0.3} className="value">
                {item.label.length > 8 ? `${item.label.slice(0, 8)}…` : item.label}
              </text>
              <rect className="mark-off" x={labelW} y={y + 1} width={track} height={3} rx={1.5} />
              <rect className="mark" x={labelW} y={y + 1} width={Math.max(0, Math.min(1, item.share)) * track} height={3} rx={1.5} />
              <text x={width} y={y + 3.4} fontSize={TEXT} textAnchor="end">
                {item.note}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** Every day as a square, a column per week (Monday on top); darker = more energy. */
export function DayGrid({
  days,
  width,
}: {
  days: {
    day: string
    recorded: boolean
    energy: number | null
    inRange: boolean
    monthLabel?: string
  }[]
  width: number
}) {
  const weeks = Math.ceil(days.length / 7)
  const left = 5
  const top = 4
  const cell = Math.min(6, (width - left) / Math.max(1, weeks))
  const gap = cell * 0.18
  const height = top + cell * 7 + 6
  // Month names over their first week; one that would run into the next is left out.
  const labels = days.flatMap((d, i) => (d.monthLabel ? [i] : []))
  const labelled = new Set(labels.filter((i, k) => k === labels.length - 1 || (Math.floor(labels[k + 1] / 7) - Math.floor(i / 7)) * cell >= 7))
  const levelOf = (d: (typeof days)[number]) => (!d.recorded ? 0 : d.energy == null ? 0.55 : 0.25 + (d.energy / 5) * 0.75)
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="每日紀錄">
        {['一', '三', '五', '日'].map((w, i) => (
          <text key={w} x={0} y={top + cell * [0, 2, 4, 6][i] + cell * 0.75} fontSize={TEXT - 0.4}>
            {w}
          </text>
        ))}
        {days.map((d, i) => {
          const col = Math.floor(i / 7)
          const row = i % 7
          const level = levelOf(d)
          return (
            <g key={d.day}>
              {d.monthLabel && labelled.has(i) && (
                <text x={left + col * cell} y={top - 1} fontSize={TEXT - 0.3}>
                  {d.monthLabel}
                </text>
              )}
              {d.inRange && (
                <rect x={left + col * cell} y={top + row * cell} width={cell - gap} height={cell - gap} rx={0.5} className={level ? 'mark' : 'mark-off'} opacity={level || 1} />
              )}
            </g>
          )
        })}
        <text x={width} y={height - 1} fontSize={TEXT - 0.3} textAnchor="end">
          淺：沒記錄　深：精力高
        </text>
      </svg>
    </div>
  )
}
