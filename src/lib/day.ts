// All "days" in this app are Taiwan-local calendar days written as YYYY-MM-DD.
// A day ends at 04:00, not midnight: a log written at 00:30 still belongs to
// the evening before, because the owner goes to bed around 01:00.

export const TIME_ZONE = 'Asia/Taipei'
const DAY_CUTOFF_HOUR = 4
const MS_PER_DAY = 86_400_000

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: '週一',
  tue: '週二',
  wed: '週三',
  thu: '週四',
  fri: '週五',
  sat: '週六',
  sun: '週日',
}

export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Wall-clock parts of `instant` in Taiwan. */
function taipeiParts(instant: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') }
}

/** The logical day `instant` belongs to, honouring the 04:00 cutoff. */
export function logicalDay(instant: Date = new Date()): string {
  const { year, month, day, hour } = taipeiParts(instant)
  const calendar = toDay(Date.UTC(year, month - 1, day))
  return hour < DAY_CUTOFF_HOUR ? addDays(calendar, -1) : calendar
}

function toDay(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10)
}

function dayToUtcMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`)
}

export function addDays(day: string, n: number): string {
  return toDay(dayToUtcMs(day) + n * MS_PER_DAY)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((dayToUtcMs(to) - dayToUtcMs(from)) / MS_PER_DAY)
}

export function weekdayOf(day: string): Weekday {
  return WEEKDAYS[new Date(dayToUtcMs(day)).getUTCDay()]
}

/** Monday of the week containing `day`. */
export function weekStart(day: string): string {
  const offset = (new Date(dayToUtcMs(day)).getUTCDay() + 6) % 7
  return addDays(day, -offset)
}

/** "10月3日 週六" */
export function formatDayLong(day: string): string {
  const [, m, d] = day.split('-').map(Number)
  return `${m}月${d}日 ${WEEKDAY_LABELS[weekdayOf(day)]}`
}

/** "10/3" */
export function formatDayShort(day: string): string {
  const [, m, d] = day.split('-').map(Number)
  return `${m}/${d}`
}
