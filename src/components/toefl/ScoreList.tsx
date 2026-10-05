'use client'

import { Trash } from '@phosphor-icons/react'
import { useState, useTransition } from 'react'
import { deleteScore } from '@/app/(frontend)/actions'
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
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!rows.length) {
    return <p className="text-sm text-muted">還沒有任何分數紀錄。</p>
  }

  const remove = (id: number) =>
    startTransition(async () => {
      const result = await deleteScore(id)
      setError(result.ok ? null : result.error)
      setConfirming(null)
    })

  const deleteControl = (r: (typeof rows)[number]) =>
    confirming === r.id ? (
      <span className="inline-flex gap-1">
        <button
          type="button"
          className="btn px-2 py-1 text-red-ink hover:bg-red-soft"
          disabled={pending}
          onClick={() => remove(r.id)}
        >
          刪除
        </button>
        <button
          type="button"
          className="btn px-2 py-1 text-muted hover:bg-sunken"
          onClick={() => setConfirming(null)}
        >
          取消
        </button>
      </span>
    ) : (
      <button
        type="button"
        aria-label={`刪除 ${formatDayShort(r.date)} 的分數`}
        className="rounded-md p-1.5 text-muted transition-colors hover:bg-sunken hover:text-red-ink"
        onClick={() => setConfirming(r.id)}
      >
        <Trash size={16} />
      </button>
    )

  return (
    <div className="-mx-5 md:mx-0">
      {error && (
        <p role="alert" className="px-5 pb-2 text-sm text-red-ink md:px-0">
          {error}
        </p>
      )}
      {/* Phones: one card per score instead of a wide table. */}
      <ul className="divide-y divide-line md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="px-5 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted">
                  <span className="font-mono tabular-nums">{formatDayShort(r.date)}</span> ·{' '}
                  {labelOf(SCORE_TYPES, r.type)} · {labelOf(SCORE_SOURCES, r.source)}
                </p>
                <p className="mt-0.5 tabular-nums">
                  <span className="text-xl font-semibold text-ink-strong">
                    {formatBand(r.overall)}
                  </span>
                  {r.overall != null && (
                    <span className="ml-1.5 text-xs text-muted">{cefrOf(r.overall)}</span>
                  )}
                </p>
              </div>
              <div className="shrink-0">{deleteControl(r)}</div>
            </div>
            <dl className="mt-2 grid grid-cols-4 gap-2 text-center">
              {SECTIONS.map(({ value, label }) => (
                <div key={value} className="rounded-lg bg-sunken px-1 py-1.5">
                  <dt className="text-[11px] text-muted">{label}</dt>
                  <dd className="text-sm font-medium text-ink-strong tabular-nums">
                    {formatBand(r[value])}
                  </dd>
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
            <th className="py-2 pl-4 font-medium">來源</th>
            <th className="py-2 pr-5 md:pr-0" aria-label="操作" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line last:border-0">
              <td className="py-2.5 pl-5 font-mono text-xs tabular-nums md:pl-0">
                {formatDayShort(r.date)}
              </td>
              <td className="py-2.5">{labelOf(SCORE_TYPES, r.type)}</td>
              <td className="py-2.5 text-right tabular-nums">
                <span className="font-semibold text-ink-strong">{formatBand(r.overall)}</span>
                {r.overall != null && (
                  <span className="ml-1 text-xs text-muted">{cefrOf(r.overall)}</span>
                )}
              </td>
              {SECTIONS.map(({ value }) => (
                <td key={value} className="py-2.5 text-right tabular-nums">
                  {formatBand(r[value])}
                </td>
              ))}
              <td className="py-2.5 pl-4 text-muted">{labelOf(SCORE_SOURCES, r.source)}</td>
              <td className="py-2.5 pr-5 text-right md:pr-0">{deleteControl(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
