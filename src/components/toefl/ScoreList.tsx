import { formatDayShort } from '@/lib/day'
import { SCORE_SOURCES, SCORE_TYPES, labelOf } from '@/lib/options'
import { SECTIONS, cefrOf, formatBand, type Section } from '@/lib/toefl'

type Row = {
  id: number
  date: string
  type: string
  source: string | null
  overall: number | null
} & Record<Section, number | null>

export function ScoreList({ rows }: { rows: Row[] }) {
  if (!rows.length) {
    return <p className="text-sm text-muted">還沒有任何分數紀錄。</p>
  }

  return (
    <div className="-mx-5 md:mx-0">
      {/* Phones: one card per score instead of a wide table. */}
      <ul className="divide-y divide-line md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="px-5 py-3">
            <div className="min-w-0">
              <p className="text-xs text-muted">
                <span className="font-mono tabular-nums">{formatDayShort(r.date)}</span> ·{' '}
                {labelOf(SCORE_TYPES, r.type)} · {labelOf(SCORE_SOURCES, r.source)}
              </p>
              <p className="mt-0.5 tabular-nums">
                <span className="text-xl font-semibold text-ink-strong">{formatBand(r.overall)}</span>
                {r.overall != null && <span className="ml-1.5 text-xs text-muted">{cefrOf(r.overall)}</span>}
              </p>
            </div>
            <dl className="mt-2 grid grid-cols-4 gap-2 text-center">
              {SECTIONS.map(({ value, label }) => (
                <div key={value} className="rounded-lg bg-sunken px-1 py-1.5">
                  <dt className="text-[11px] text-muted">{label}</dt>
                  <dd className="text-sm font-medium text-ink-strong tabular-nums">{formatBand(r[value])}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="py-2 pl-5 font-medium md:pl-0">日期</th>
            <th className="py-2 font-medium">類型</th>
            <th className="py-2 text-right font-medium">總分</th>
            {SECTIONS.map(({ value, label }) => (
              <th key={value} className="py-2 text-right font-medium">
                {label}
              </th>
            ))}
            <th className="py-2 pl-4 pr-5 font-medium md:pr-0">來源</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line last:border-0">
              <td className="py-2.5 pl-5 font-mono text-xs tabular-nums md:pl-0">{formatDayShort(r.date)}</td>
              <td className="py-2.5">{labelOf(SCORE_TYPES, r.type)}</td>
              <td className="py-2.5 text-right tabular-nums">
                <span className="font-semibold text-ink-strong">{formatBand(r.overall)}</span>
                {r.overall != null && <span className="ml-1 text-xs text-muted">{cefrOf(r.overall)}</span>}
              </td>
              {SECTIONS.map(({ value }) => (
                <td key={value} className="py-2.5 text-right tabular-nums">
                  {formatBand(r[value])}
                </td>
              ))}
              <td className="py-2.5 pl-4 pr-5 text-muted md:pr-0">{labelOf(SCORE_SOURCES, r.source)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
