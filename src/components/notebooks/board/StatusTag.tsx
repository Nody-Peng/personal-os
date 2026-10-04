import { formatDayShort } from '@/lib/day'
import { ITEM_STATUSES, type ItemStatus } from '@/lib/options'

const TONES = {
  gray: 'bg-sunken text-muted',
  blue: 'bg-accent-soft text-accent',
  green: 'bg-green-soft text-green-ink',
} as const

const DOTS = { gray: 'bg-faint', blue: 'bg-accent', green: 'bg-green-ink' } as const

export const statusOf = (value: ItemStatus) => ITEM_STATUSES.find((s) => s.value === value) ?? ITEM_STATUSES[0]

/** A board status as a small pastel pill. */
export function StatusTag({ status }: { status: ItemStatus }) {
  const s = statusOf(status)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${TONES[s.tone]}`}>
      <span className={`size-1.5 rounded-full ${DOTS[s.tone]}`} aria-hidden />
      {s.label}
    </span>
  )
}

/** Column backgrounds: a whisper of the status tone. */
export const COLUMN_TINT = {
  gray: 'bg-sunken/70',
  blue: 'bg-accent-soft/45',
  green: 'bg-green-soft/70',
} as const

/** "10/4" or "10/4 → 10/6". */
export function formatRange(start: string | null, end: string | null): string {
  if (!start) return ''
  return end && end !== start ? `${formatDayShort(start)} → ${formatDayShort(end)}` : formatDayShort(start)
}
