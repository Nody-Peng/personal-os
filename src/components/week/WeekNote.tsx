import { CaretLeft, CaretRight, Check } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { BlockEditor } from '@/components/editor/BlockEditor'
import { TaskList } from '@/components/tasks/TaskList'
import { addDays, formatDayShort, formatWeekRange, isoWeek, monthOf, weekdayLabel } from '@/lib/day'
import { getIdeas, getImportantTasks, getLogsBetween, getSettings, getWeekReview, getWeeklyTasks } from '@/lib/queries'
import type { Session } from '@/lib/session'
import { WeekThemePicker } from './WeekThemePicker'

const dayHref = (day: string, today: string) => (day === today ? '/' : `/journal/day/${day}`)

/** A week's note: to-dos on top, the Sunday summary below. */
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
  const [weekly, important, logs, review, ideas, settings] = await Promise.all([
    getWeeklyTasks(session, [monday]),
    getImportantTasks(session, monday, sunday),
    getLogsBetween(session, monday, sunday),
    getWeekReview(session, monday),
    getIdeas(session),
    getSettings(session),
  ])

  const activeImportant = important.filter((t) => t.status !== 'migrated')
  const stats = [
    { label: 'Important 完成', value: `${activeImportant.filter((t) => t.status === 'done').length}/${activeImportant.length}` },
    { label: '待辦完成', value: `${weekly.filter((t) => t.status === 'done').length}/${weekly.length}` },
    {
      label: '托福',
      value: `${(logs.reduce((s, l) => s + (l.toeflMinutes ?? 0), 0) / 60).toFixed(1)}/${settings.toeflHoursTarget} 小時`,
    },
    { label: '健身', value: `${logs.filter((l) => l.gym).length}/${settings.gymTarget} 次` },
    { label: '早上聽英文', value: `${logs.filter((l) => l.morningListening).length} 天` },
  ]
  const themeOptions = ideas
    .filter((i) => i.status === 'inbox' || i.status === 'selected')
    .map((i) => ({ id: i.id, title: i.title, total: i.total ?? 0 }))
  const nextTheme = typeof review?.nextTheme === 'number' ? review.nextTheme : null
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted">
            <Link href={`/journal/${monday.slice(0, 4)}/${monthOf(monday).slice(5)}`} className="hover:text-ink-strong hover:underline">
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
            <Link href={`/journal/week/${addDays(monday, 7)}`} className="btn btn-quiet px-2" aria-label="下一週">
              <CaretRight size={16} />
            </Link>
          </nav>
        )}
      </header>

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
        <h2 className="text-sm font-semibold tracking-wide text-ink-strong">週日統整</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg bg-sunken px-3 py-2.5">
              <dt className="text-xs text-muted">{s.label}</dt>
              <dd className="mt-0.5 font-semibold text-ink-strong">{s.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5">
          <BlockEditor
            key={`week-${monday}`}
            target={{ kind: 'week', monday }}
            initial={Array.isArray(review?.review) ? review.review : null}
            placeholder="這週做得好的、斷掉的那天和原因、下週要調整什麼…"
          />
        </div>
        <div className="mt-5 border-t border-line pt-5">
          <WeekThemePicker
            monday={monday}
            options={themeOptions}
            initialTheme={nextTheme}
            initialReason={review?.themeReason ?? ''}
          />
        </div>
      </section>
    </div>
  )
}
