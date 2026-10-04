import { CaretLeft, CaretRight, Check } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { TaskList } from '@/components/tasks/TaskList'
import { addDays, formatDayShort, formatWeekRange, isoWeek, monthOf, weekdayLabel } from '@/lib/day'
import { getIdeas, getImportantTasks, getWeekReview, getWeekTheme, getWeeklyTasks } from '@/lib/queries'
import type { Session } from '@/lib/session'
import { currentMonday, getCurrentTheme } from '@/lib/weekThemes'
import { WeekReview } from './WeekReview'
import { WeekThemePicker } from './WeekThemePicker'

const dayHref = (day: string, today: string) => (day === today ? '/' : `/journal/day/${day}`)

/** A week's note: theme and to-dos on top, the Sunday summary below. */
export async function WeekNote({
  session,
  monday,
  today,
  inDrawer = false,
}: {
  session: Session
  monday: string
  today: string
  inDrawer?: boolean
}) {
  const sunday = addDays(monday, 6)
  const isCurrent = monday === currentMonday()
  const [weekly, important, review, ideas, theme] = await Promise.all([
    getWeeklyTasks(session, [monday]),
    getImportantTasks(session, monday, sunday),
    getWeekReview(session, monday),
    getIdeas(session),
    isCurrent ? getCurrentTheme(session) : getWeekTheme(session, monday),
  ])

  const themeOptions = ideas
    .filter((i) => i.status === 'inbox' || i.status === 'selected' || i.id === theme?.id)
    .map((i) => ({ id: i.id, title: i.title, total: i.total ?? 0 }))
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted">
            <Link href={`/journal/${monday.slice(0, 4)}/${Number(monthOf(monday).slice(5))}`} className="hover:text-ink-strong hover:underline">
              {monday.slice(0, 4)} 年 {Number(monday.slice(5, 7))} 月
            </Link>
            {' · '}
            {formatWeekRange(monday)}
          </p>
          <h1 className={`mt-1 font-semibold tracking-tight text-ink-strong ${inDrawer ? 'text-2xl' : 'text-3xl md:text-4xl'}`}>
            第 {isoWeek(monday)} 週
          </h1>
        </div>
        {!inDrawer && (
          <nav aria-label="切換週" className="flex items-center gap-1">
            <Link href={`/journal/week/${addDays(monday, -7)}`} className="btn btn-quiet px-2" aria-label="上一週">
              <CaretLeft size={16} />
            </Link>
            {!isCurrent && (
              <Link href={`/journal/week/${currentMonday()}`} className="btn btn-quiet">
                本週
              </Link>
            )}
            <Link href={`/journal/week/${addDays(monday, 7)}`} className="btn btn-quiet px-2" aria-label="下一週">
              <CaretRight size={16} />
            </Link>
          </nav>
        )}
      </header>

      <section className="card p-5 md:p-6">
        <WeekThemePicker
          monday={monday}
          label="本週主題（23:00–24:00）"
          hint={isCurrent ? '隨時可以換；會同步到今天頁和想學清單。' : '這一週的主題紀錄。'}
          options={themeOptions}
          initialTheme={theme?.id ?? null}
          initialReason={review?.themeReason ?? ''}
        />
      </section>

      <section className="card p-5 md:p-6">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-strong">本週待辦</h2>
        <TaskList kind="weekly" scope={monday} items={weekly} today={today} addLabel="新增本週待辦" />
      </section>

      <section className="card p-5 md:p-6">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-strong">每天的 IMPORTANT</h2>
        <ol className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {days.map((day) => {
            const list = important.filter((t) => t.day === day)
            return (
              <li key={day}>
                <Link href={dayHref(day, today)} className="text-xs text-muted hover:text-ink-strong hover:underline">
                  {formatDayShort(day)} {weekdayLabel(day)}
                </Link>
                {list.length ? (
                  <ul className="mt-1 grid gap-0.5 text-sm">
                    {list.map((t) => (
                      <li key={t.id} className="flex items-center gap-2">
                        <span className="w-3 shrink-0 text-center text-muted" aria-hidden>
                          {t.status === 'done' ? <Check size={12} weight="bold" className="text-green-ink" /> : t.status === 'migrated' ? '>' : '·'}
                        </span>
                        <span className={t.status === 'todo' ? 'text-ink-strong' : 'text-muted line-through decoration-line-strong'}>
                          {t.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-faint">—</p>
                )}
              </li>
            )
          })}
        </ol>
      </section>

      <section className="card p-5 md:p-6">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-ink-strong">週日統整</h2>
        <WeekReview session={session} monday={monday} />
      </section>
    </div>
  )
}
