// Journal book export (日記本 → 匯出 PDF): the choices made in the export
// dialog, carried to the print page (/print/journal) in its query string.

import { addDays, daysBetween, isDay } from './day'

export const PAPER_STYLES = [
  { value: 'lined', label: '橫線' },
  { value: 'dots', label: '點格' },
  { value: 'plain', label: '空白' },
] as const
export type PaperStyle = (typeof PAPER_STYLES)[number]['value']

export const PAPER_TONES = [
  { value: 'cream', label: '米白', hex: '#fbf6ea' },
  { value: 'white', label: '純白', hex: '#ffffff' },
] as const
export type PaperTone = (typeof PAPER_TONES)[number]['value']

export const PAGE_SIZES = [
  { value: 'a5', label: 'A5' },
  { value: 'a4', label: 'A4' },
] as const
export type PageSize = (typeof PAGE_SIZES)[number]['value']

/** Handwriting fonts from Google Fonts (loaded by the print page only). */
export const BOOK_FONTS = [
  { value: 'iansui', label: '芫荽', family: 'Iansui' },
  { value: 'wenkai', label: '霞鶩文楷', family: 'LXGW WenKai TC' },
] as const
export type BookFont = (typeof BOOK_FONTS)[number]['value']

/** A year and a day: one page a day keeps the book printable in one go. */
export const MAX_BOOK_DAYS = 366
export const MAX_BOOK_TITLE = 40
export const MAX_BOOK_SUBTITLE = 60

export type BookOptions = {
  from: string
  to: string
  title: string
  subtitle: string
  paper: PaperStyle
  tone: PaperTone
  size: PageSize
  font: BookFont
  /** Days with nothing written still get a page, to fill in by hand. */
  blankDays: boolean
  /** A page for each week (theme, to-dos, review). */
  weekPages: boolean
}

const pick = <T extends string>(list: readonly { value: T }[], value: unknown, fallback: T): T => list.find((o) => o.value === value)?.value ?? fallback

const clean = (value: unknown, max: number) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

type Params = Record<string, string | string[] | undefined>

/** Options from the print page's query string; null when the dates are missing or wrong. */
export function parseBookOptions(params: Params): BookOptions | null {
  const get = (key: string) => {
    const v = params[key]
    return Array.isArray(v) ? v[0] : v
  }
  const from = get('from')
  const to = get('to')
  if (!isDay(from) || !isDay(to) || to < from) return null
  return {
    from,
    // A longer range is cut at a year and a day.
    to: daysBetween(from, to) >= MAX_BOOK_DAYS ? addDays(from, MAX_BOOK_DAYS - 1) : to,
    title: clean(get('title'), MAX_BOOK_TITLE),
    subtitle: clean(get('subtitle'), MAX_BOOK_SUBTITLE),
    paper: pick(PAPER_STYLES, get('paper'), 'lined'),
    tone: pick(PAPER_TONES, get('tone'), 'cream'),
    size: pick(PAGE_SIZES, get('size'), 'a5'),
    font: pick(BOOK_FONTS, get('font'), 'iansui'),
    blankDays: get('blank') !== '0',
    weekPages: get('weeks') !== '0',
  }
}

export function bookQuery(o: BookOptions): string {
  const q = new URLSearchParams({
    from: o.from,
    to: o.to,
    title: o.title,
    subtitle: o.subtitle,
    paper: o.paper,
    tone: o.tone,
    size: o.size,
    font: o.font,
    blank: o.blankDays ? '1' : '0',
    weeks: o.weekPages ? '1' : '0',
  })
  return q.toString()
}

/** Every day from `from` to `to`, both included. */
export function daysOf(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}
