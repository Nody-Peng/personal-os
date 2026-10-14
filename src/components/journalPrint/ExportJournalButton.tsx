'use client'

import { FilePdf } from '@phosphor-icons/react'
import { useState } from 'react'
import { Modal } from '@/components/notebooks/Modal'
import { daysBetween } from '@/lib/day'
import { BOOK_FONTS, MAX_BOOK_DAYS, MAX_BOOK_SUBTITLE, MAX_BOOK_TITLE, PAGE_SIZES, PAPER_STYLES, PAPER_TONES, bookQuery, type BookOptions } from '@/lib/journalPrint'

// 匯出 PDF on a journal's year page: pick the days and the paper, then the
// book is laid out in a new tab (/print/journal) and saved with the browser's
// print dialog. The paper choices are remembered on this device.

const PREFS_KEY = 'journal-print'
type Look = Pick<BookOptions, 'paper' | 'tone' | 'size' | 'font' | 'blankDays' | 'weekPages'>
const DEFAULT_LOOK: Look = {
  paper: 'lined',
  tone: 'cream',
  size: 'a5',
  font: 'iansui',
  blankDays: true,
  weekPages: true,
}

function loadLook(): Look {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<Look> | null
    if (!saved || typeof saved !== 'object') return DEFAULT_LOOK
    const pick = <T extends string>(list: readonly { value: T }[], v: unknown, fallback: T) => list.find((o) => o.value === v)?.value ?? fallback
    return {
      paper: pick(PAPER_STYLES, saved.paper, DEFAULT_LOOK.paper),
      tone: pick(PAPER_TONES, saved.tone, DEFAULT_LOOK.tone),
      size: pick(PAGE_SIZES, saved.size, DEFAULT_LOOK.size),
      font: pick(BOOK_FONTS, saved.font, DEFAULT_LOOK.font),
      blankDays: saved.blankDays !== false,
      weekPages: saved.weekPages !== false,
    }
  } catch {
    return DEFAULT_LOOK
  }
}

function saveLook(look: Look) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(look))
  } catch {
    // Private mode: chosen again next time.
  }
}

type Props = { year: number; title: string; subtitle: string; today: string }

export function ExportJournalButton(props: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm text-ink hover:border-line-strong hover:text-ink-strong"
      >
        <FilePdf size={16} />
        匯出 PDF
      </button>
      {open && <ExportDialog {...props} onClose={() => setOpen(false)} />}
    </>
  )
}

function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 text-sm text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex flex-1 rounded-lg border border-line bg-sunken p-0.5">
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={`min-h-10 flex-1 rounded-md px-2 text-sm transition-colors duration-200 ${
                on ? 'bg-surface font-medium text-ink-strong shadow-[0_1px_2px_rgb(17_17_17/0.08)]' : 'text-muted hover:text-ink-strong'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ExportDialog({ year, title: defaultTitle, subtitle: defaultSubtitle, today, onClose }: Props & { onClose: () => void }) {
  const yearEnd = `${year}-12-31`
  const [from, setFrom] = useState(`${year}-01-01`)
  const [to, setTo] = useState(today.startsWith(String(year)) ? today : yearEnd)
  const [title, setTitle] = useState(defaultTitle)
  const [subtitle, setSubtitle] = useState(defaultSubtitle)
  const [look, setLook] = useState<Look>(loadLook)
  const change = (patch: Partial<Look>) =>
    setLook((l) => {
      const next = { ...l, ...patch }
      saveLook(next)
      return next
    })

  const days = from && to ? daysBetween(from, to) + 1 : 0
  const error = !from || !to ? '請選起訖日期' : days < 1 ? '結束日要在開始日之後' : days > MAX_BOOK_DAYS ? `最多 ${MAX_BOOK_DAYS} 天，請縮短範圍` : null
  const ranges = [
    { label: '全年', from: `${year}-01-01`, to: yearEnd },
    { label: '上半年', from: `${year}-01-01`, to: `${year}-06-30` },
    { label: '下半年', from: `${year}-07-01`, to: yearEnd },
  ]

  const make = () => {
    if (error) return
    const url = `/print/journal?${bookQuery({ from, to, title: title.trim(), subtitle: subtitle.trim(), ...look })}`
    // A new tab keeps this page; where pop-ups are blocked, go there instead
    // (a full page load: the print page fills <head> with Paged.js styles).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (!window.open(url, '_blank')) window.location.assign(url)
    onClose()
  }

  const field = 'min-h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink-strong outline-none focus:border-line-strong'

  return (
    <Modal title="匯出日記本 PDF" onClose={onClose}>
      <form
        className="space-y-5 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault()
          make()
        }}
      >
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-ink-strong">日期</legend>
          <div className="flex items-center gap-2">
            <input type="date" aria-label="開始日" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
            <span className="text-muted">—</span>
            <input type="date" aria-label="結束日" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ranges.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => {
                  setFrom(r.from)
                  setTo(r.to)
                }}
                className={`min-h-10 rounded-full border px-3 text-xs ${
                  from === r.from && to === r.to ? 'border-ink-strong text-ink-strong' : 'border-line text-muted hover:text-ink-strong'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-ink-strong">封面</legend>
          <input
            data-autofocus
            value={title}
            maxLength={MAX_BOOK_TITLE}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`${year} 日記本`}
            aria-label="標題"
            className={field}
          />
          <input value={subtitle} maxLength={MAX_BOOK_SUBTITLE} onChange={(e) => setSubtitle(e.target.value)} placeholder="副標（可不填）" aria-label="副標" className={field} />
        </fieldset>

        <fieldset className="space-y-2.5">
          <legend className="mb-2 text-sm font-medium text-ink-strong">紙張</legend>
          <Choice label="內頁" options={PAPER_STYLES} value={look.paper} onChange={(paper) => change({ paper })} />
          <Choice label="紙色" options={PAPER_TONES} value={look.tone} onChange={(tone) => change({ tone })} />
          <Choice label="尺寸" options={PAGE_SIZES} value={look.size} onChange={(size) => change({ size })} />
          <Choice label="字體" options={BOOK_FONTS} value={look.font} onChange={(font) => change({ font })} />
        </fieldset>

        <fieldset className="space-y-1">
          <label className="flex min-h-10 items-center gap-2.5 text-sm text-ink">
            <input type="checkbox" checked={look.blankDays} onChange={(e) => change({ blankDays: e.target.checked })} className="size-4 accent-[var(--color-accent)]" />
            沒寫的日子也留一頁（可以手寫補上）
          </label>
          <label className="flex min-h-10 items-center gap-2.5 text-sm text-ink">
            <input type="checkbox" checked={look.weekPages} onChange={(e) => change({ weekPages: e.target.checked })} className="size-4 accent-[var(--color-accent)]" />
            每週一頁週回顧
          </label>
        </fieldset>

        <div className="flex items-center gap-3 border-t border-line pt-4">
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted">{error ?? `${days} 天。會在新分頁排版（一整年約一、兩分鐘），好了再按「列印／存成 PDF」。`}</p>
          <button
            type="submit"
            disabled={Boolean(error)}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-ink-strong px-4 text-sm font-medium text-on-ink disabled:opacity-40"
          >
            <FilePdf size={16} />
            製作 PDF
          </button>
        </div>
      </form>
    </Modal>
  )
}
