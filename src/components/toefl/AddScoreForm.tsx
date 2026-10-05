'use client'

import { Plus } from '@phosphor-icons/react'
import { useRef, useState, useTransition } from 'react'
import { addScore } from '@/app/(frontend)/actions'
import { SCORE_SOURCES, SCORE_TYPES } from '@/lib/options'
import { BANDS, SECTIONS, cefrOf, formatBand, legacyRangeOf, overallBand, type Section } from '@/lib/toefl'

type Draft = Record<Section, string>
const EMPTY: Draft = { reading: '', listening: '', speaking: '', writing: '' }

export function AddScoreForm({ today }: { today: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const overall = overallBand({
    reading: draft.reading ? Number(draft.reading) : null,
    listening: draft.listening ? Number(draft.listening) : null,
    speaking: draft.speaking ? Number(draft.speaking) : null,
    writing: draft.writing ? Number(draft.writing) : null,
  })
  const filled = SECTIONS.filter(({ value }) => draft[value]).length

  const submit = (formData: FormData) => {
    setSaved(false)
    startTransition(async () => {
      const result = await addScore(formData)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setError(null)
      setSaved(true)
      formRef.current?.reset()
      setDraft(EMPTY)
    })
  }

  return (
    // onSubmit, not action: React resets an action form even when saving fails.
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault()
        submit(new FormData(e.currentTarget))
      }}
      className="grid gap-5"
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Field label="日期" htmlFor="score-date">
          <input id="score-date" name="date" type="date" required defaultValue={today} className="field" />
        </Field>
        <Field label="類型" htmlFor="score-type">
          <select id="score-type" name="type" required defaultValue="full" className="field">
            {SCORE_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="來源" htmlFor="score-source" className="col-span-2 md:col-span-1">
          <select id="score-source" name="source" defaultValue="ets" className="field">
            {SCORE_SOURCES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {SECTIONS.map(({ value, label }) => (
            <Field key={value} label={`${label}（1–6）`} htmlFor={`score-${value}`}>
              <select
                id={`score-${value}`}
                name={value}
                value={draft[value]}
                onChange={(e) => setDraft((d) => ({ ...d, [value]: e.target.value }))}
                className="field tabular-nums"
              >
                <option value="">沒考</option>
                {BANDS.map((b) => (
                  <option key={b} value={b}>
                    {formatBand(b)}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
        <p className="mt-3 rounded-lg bg-sunken px-4 py-3 text-sm" aria-live="polite">
          {overall !== null ? (
            <>
              <span className="text-muted">總分 </span>
              <strong className="text-base text-ink-strong">{formatBand(overall)}</strong>
              <span className="text-muted">
                {' '}
                · CEFR {cefrOf(overall)} · 約等於舊制 {legacyRangeOf(overall)} 分
              </span>
            </>
          ) : (
            <span className="text-muted">
              {filled === 0 ? '只考單科就只填那一科；四科都填才會算總分。' : `還差 ${4 - filled} 科才會算總分（四科平均，四捨五入到 0.5）。`}
            </span>
          )}
        </p>
      </div>

      <Field label="備註" htmlFor="score-notes">
        <input id="score-notes" name="notes" className="field" />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending || filled === 0}>
          <Plus size={16} weight="bold" />
          {pending ? '儲存中…' : '新增分數'}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-ink">
            {error}
          </p>
        )}
        {saved && !error && <p className="text-sm text-green-ink">已新增</p>}
      </div>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  className = '',
  children,
}: {
  label: string
  htmlFor: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
    </div>
  )
}
