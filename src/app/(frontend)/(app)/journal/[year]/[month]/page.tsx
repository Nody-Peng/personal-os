import { CaretLeft, CaretRight } from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MonthCalendar } from '@/components/calendar/MonthCalendar'
import { WeekDrawer } from '@/components/calendar/WeekDrawer'
import { BlockEditor } from '@/components/editor/BlockEditor'
import { WeekNote } from '@/components/week/WeekNote'
import { addDays, addMonths, daysInMonth, isDay, logicalDay, monthWeeks, weekStart } from '@/lib/day'
import { getDatedTasks, getHabits, getImportantTasks, getLogsBetween, getMonthNote, getWeeklyTasks, habitIdsOf, habitsForPeriod } from '@/lib/queries'
import { isRecordedLog } from '@/lib/dailyLog'
import { renderStamp } from '@/lib/notes'
import { requireSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ year: string; month: string }>
  searchParams: Promise<{ week?: string }>
}

function parse(year: string, month: string): string | null {
  if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month)) return null
  const m = Number(month)
  return m >= 1 && m <= 12 ? `${year}-${String(m).padStart(2, '0')}` : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year, month } = await params
  return { title: `${year} 年 ${Number(month)} 月` }
}

export default async function MonthPage({ params, searchParams }: Props) {
  const { year, month: monthParam } = await params
  const month = parse(year, monthParam)
  if (!month) notFound()
  const basePath = `/journal/${year}/${Number(monthParam)}`
  const session = await requireSession(basePath)
  const today = logicalDay()

  const { week } = await searchParams
  const openWeek = week && isDay(week) && weekStart(week) === week ? week : null

  const weeks = monthWeeks(month)
  const from = weeks[0]
  const to = addDays(weeks[weeks.length - 1], 6)
  const monthFirst = `${month}-01`
  const monthLast = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`

  const [important, dated, weekly, logs, note, allHabits] = await Promise.all([
    getImportantTasks(session, from, to),
    getDatedTasks(session, from, to),
    getWeeklyTasks(session, weeks),
    getLogsBetween(session, from, to),
    getMonthNote(session, month),
    getHabits(session, true),
  ])

  const days = Object.fromEntries(
    logs.map((l) => [l.date, { logged: isRecordedLog(l), habitsDone: habitIdsOf(l) }]),
  )
  const inMonth = <T extends { date: string }>(xs: T[]) => xs.filter((x) => x.date >= monthFirst && x.date <= monthLast)
  const monthLogs = inMonth(logs)
  const habits = habitsForPeriod(allHabits, monthLogs)
  const monthImportant = important.filter((t) => t.day && t.day >= monthFirst && t.day <= monthLast && t.status !== 'migrated')
  const stats = [
    { label: '有紀錄的天數', value: `${monthLogs.filter(isRecordedLog).length} 天` },
    { label: 'Important 完成', value: `${monthImportant.filter((t) => t.status === 'done').length}/${monthImportant.length}` },
    { label: '托福', value: `${(monthLogs.reduce((s, l) => s + (l.toeflMinutes ?? 0), 0) / 60).toFixed(1)} 小時` },
    ...habits.map((h) => ({ label: h.name, value: `${monthLogs.filter((l) => habitIdsOf(l).includes(h.id)).length} 天` })),
  ]

  const prev = addMonths(month, -1)
  const next = addMonths(month, 1)
  const href = (m: string) => `/journal/${m.slice(0, 4)}/${Number(m.slice(5))}`

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 md:mb-8">
        <div>
          <p className="font-mono text-xs text-muted">
            <Link href="/journal" className="hover:text-ink-strong hover:underline">
              書架
            </Link>
            {' / '}
            <Link href={`/journal/${year}`} className="hover:text-ink-strong hover:underline">
              {year} 日記本
            </Link>
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-strong md:text-4xl">
            {year} 年 {Number(monthParam)} 月
          </h1>
        </div>
        <nav aria-label="切換月份" className="flex items-center gap-1">
          <Link href={href(prev)} className="btn btn-quiet px-2" aria-label="上個月">
            <CaretLeft size={16} />
          </Link>
          {month !== today.slice(0, 7) && (
            <Link href={href(today.slice(0, 7))} className="btn btn-quiet">
              本月
            </Link>
          )}
          <Link href={href(next)} className="btn btn-quiet px-2" aria-label="下個月">
            <CaretRight size={16} />
          </Link>
        </nav>
      </header>

      <div className="rise">
        <MonthCalendar
          month={month}
          weeks={weeks}
          today={today}
          basePath={basePath}
          openWeek={openWeek}
          important={important}
          dated={dated}
          weekly={weekly}
          days={days}
          habits={habits}
        />
        <p className="mt-2 text-xs text-muted">點左邊的週數打開週筆記；點日期進入那一天；點任務看細項。</p>
      </div>

      <section className="card rise mt-6 p-5 md:p-6" style={{ '--i': 1 } as React.CSSProperties}>
        <h2 className="text-sm font-semibold tracking-wide text-ink-strong">月統整</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg bg-sunken px-3 py-2.5">
              <dt className="text-xs text-muted">{s.label}</dt>
              <dd className="mt-0.5 font-semibold text-ink-strong">{s.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5">
          <BlockEditor
            key={`month-${month}`}
            target={{ kind: 'month', month }}
            initial={Array.isArray(note?.review) ? note.review : null}
            renderedAt={renderStamp()}
            placeholder="這個月最大的進步、最想改的習慣、下個月的重點…"
          />
        </div>
      </section>

      {openWeek && (
        <WeekDrawer closeHref={basePath}>
          <WeekNote session={session} monday={openWeek} today={today} inDrawer />
        </WeekDrawer>
      )}
    </>
  )
}
