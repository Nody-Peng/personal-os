import { Check, Flag } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { layoutWeekBars } from '@/lib/calendar'
import { addDays, isoWeek, monthOf } from '@/lib/day'
import { HabitMark } from '@/components/habits/HabitIcon'
import type { HabitItem } from '@/lib/habits'
import type { TaskItem } from '@/lib/taskItems'

type DayInfo = { logged: boolean; habitsDone: number[] }

type Props = {
  month: string // YYYY-MM
  weeks: string[] // Mondays
  today: string
  basePath: string // e.g. /journal/2026/10
  openWeek: string | null
  important: TaskItem[]
  dated: TaskItem[]
  weekly: TaskItem[]
  days: Record<string, DayInfo>
  habits: HabitItem[]
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const dayHref = (day: string, today: string) => (day === today ? '/' : `/journal/day/${day}`)

/** Wall-calendar month: IMPORTANT per day, period bars, week notes on the left. */
export function MonthCalendar({ month, weeks, today, basePath, openWeek, important, dated, weekly, days, habits }: Props) {
  const spans = dated
    .filter((t): t is TaskItem & { startDate: string; endDate: string } => Boolean(t.startDate && t.endDate))
    .filter((t) => t.status !== 'migrated')
  const spanIds = new Set(spans.map((t) => t.id))
  const dueMarkers = dated.filter((t) => t.dueDate && !t.startDate && t.kind === 'weekly')

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="grid grid-cols-[2.25rem_repeat(7,minmax(0,1fr))] border-b border-line bg-sunken/60 text-center text-xs text-muted md:grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
        <div className="py-2">週</div>
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      {weeks.map((monday) => {
        const bars = layoutWeekBars(monday, spans)
        const lanes = bars.reduce((n, b) => Math.max(n, b.lane + 1), 0)
        const weekTasks = weekly.filter((t) => t.weekStart === monday)
        const weekDone = weekTasks.filter((t) => t.status === 'done').length
        const isOpen = openWeek === monday
        const rows = `auto ${'1.375rem '.repeat(lanes)}minmax(3.5rem,1fr)`

        return (
          <div
            key={monday}
            className="grid grid-cols-[2.25rem_repeat(7,minmax(0,1fr))] border-b border-line last:border-b-0 md:grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]"
            style={{ gridTemplateRows: rows }}
          >
            <Link
              href={`${basePath}?week=${monday}`}
              scroll={false}
              aria-label={`打開第 ${isoWeek(monday)} 週的週筆記`}
              className={`flex flex-col items-center justify-start gap-1 pt-2 text-center transition-colors ${
                isOpen ? 'bg-ink-strong text-on-ink' : 'text-muted hover:bg-sunken hover:text-ink-strong'
              }`}
              style={{ gridColumn: 1, gridRow: '1 / -1' }}
            >
              <span className="font-mono text-[11px] md:text-xs">W{isoWeek(monday)}</span>
              {weekTasks.length > 0 && <span className="text-[10px] tabular-nums md:text-[11px]">{weekDone}/{weekTasks.length}</span>}
            </Link>

            {Array.from({ length: 7 }, (_, i) => {
              const day = addDays(monday, i)
              const inMonth = monthOf(day) === month
              const isToday = day === today
              const info = days[day]
              const items = important.filter((t) => t.day === day && !spanIds.has(t.id))
              const dues = dueMarkers.filter((t) => t.dueDate === day)
              return (
                <div key={day} className="contents">
                  <div
                    className={`border-l border-line ${inMonth ? '' : 'bg-sunken/50'}`}
                    style={{ gridColumn: i + 2, gridRow: '1 / -1' }}
                    aria-hidden
                  />
                  <div className="relative flex items-center justify-between px-1 pt-1 md:px-2" style={{ gridColumn: i + 2, gridRow: 1 }}>
                    <Link
                      href={dayHref(day, today)}
                      className={`flex size-6 items-center justify-center rounded-full text-xs tabular-nums transition-colors md:size-7 md:text-sm ${
                        isToday
                          ? 'bg-ink-strong font-semibold text-on-ink'
                          : inMonth
                            ? 'text-ink-strong hover:bg-sunken'
                            : 'text-faint hover:bg-sunken'
                      }`}
                      aria-label={`${day}${info?.logged ? '，有紀錄' : ''}`}
                    >
                      {Number(day.slice(8))}
                    </Link>
                    <span className="hidden gap-0.5 md:flex" aria-hidden>
                      {habits.map((h, idx) =>
                        info?.habitsDone.includes(h.id) ? <HabitMark key={h.id} index={idx} on size="size-1.5" /> : null,
                      )}
                    </span>
                  </div>
                  <div className="relative min-w-0 px-1 pt-1 pb-2 md:px-2" style={{ gridColumn: i + 2, gridRow: '-2 / -1' }}>
                    {/* Phones: one dot per item. */}
                    <div className="flex flex-wrap gap-1 md:hidden" aria-hidden>
                      {items.map((t) => (
                        <span
                          key={t.id}
                          className={`size-1.5 rounded-full ${
                            t.status === 'done' ? 'bg-ink-strong' : t.status === 'migrated' ? 'bg-faint' : 'border border-ink-strong'
                          }`}
                        />
                      ))}
                    </div>
                    <ul className="hidden gap-0.5 md:grid">
                      {items.map((t) => (
                        <li key={t.id}>
                          <Link
                            href={`${basePath}?task=${t.id}`}
                            scroll={false}
                            className="flex items-start gap-1 rounded px-0.5 text-xs leading-snug hover:bg-sunken"
                          >
                            <span className="mt-[1px] w-3 shrink-0 text-center text-muted" aria-hidden>
                              {t.status === 'done' ? <Check size={11} weight="bold" className="mt-0.5 text-green-ink" /> : t.status === 'migrated' ? '>' : '□'}
                            </span>
                            <span
                              className={`line-clamp-2 break-words ${
                                t.status === 'todo' ? 'text-ink-strong' : 'text-muted line-through decoration-line-strong'
                              }`}
                            >
                              {t.title}
                            </span>
                          </Link>
                        </li>
                      ))}
                      {dues.map((t) => (
                        <li key={`due-${t.id}`}>
                          <Link
                            href={`${basePath}?task=${t.id}`}
                            scroll={false}
                            className={`flex items-start gap-1 rounded px-0.5 text-xs leading-snug hover:bg-sunken ${
                              t.status === 'done' ? 'text-muted line-through' : 'text-red-ink'
                            }`}
                          >
                            <Flag size={11} className="mt-0.5 shrink-0" aria-hidden />
                            <span className="line-clamp-1 break-words">{t.title}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}

            {bars.map((bar) => (
              <Link
                key={bar.item.id}
                href={`${basePath}?task=${bar.item.id}`}
                scroll={false}
                title={bar.item.title}
                className={`z-[1] mx-0.5 my-[2px] flex items-center truncate px-1.5 text-[11px] font-medium transition-colors md:text-xs ${
                  bar.item.status === 'done' ? 'bg-sunken text-muted line-through' : 'bg-accent-soft text-accent hover:bg-accent hover:text-on-ink'
                } ${bar.continuesBefore ? 'rounded-l-none' : 'rounded-l-md'} ${bar.continuesAfter ? 'rounded-r-none' : 'rounded-r-md'}`}
                style={{ gridColumn: `${bar.startCol + 2} / ${bar.endCol + 3}`, gridRow: bar.lane + 2 }}
              >
                {bar.item.title}
              </Link>
            ))}
          </div>
        )
      })}
    </div>
  )
}
