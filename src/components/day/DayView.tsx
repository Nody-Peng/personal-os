import { ArrowRight, CaretLeft, CaretRight } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { BlockEditor } from '@/components/editor/BlockEditor'
import { TaskList } from '@/components/tasks/TaskList'
import { cleanPlanItems } from '@/lib/dayParts'
import { addDays, daysBetween, formatDayLong, formatDayShort, isoWeek, isoWeekYear, weekStart, weekdayOf } from '@/lib/day'
import { PLAN_SLOTS, TOEFL_SKILLS, labelOf, type ToeflSkill } from '@/lib/options'
import { getHabits, getImportantTasks, getLogsBetween, getSettings, getWeekTheme, getWeeklyTasks, habitIdsOf, habitsForPeriod, planWeek } from '@/lib/queries'
import { renderStamp } from '@/lib/notes'
import type { Session } from '@/lib/session'
import { currentMonday, getCurrentTheme } from '@/lib/weekThemes'
import { WeekReview } from '@/components/week/WeekReview'
import type { DailyLog } from '@/payload-types'
import { Collapsible } from './Collapsible'
import { DayLogProvider, EMPTY_LOG, type DayLog } from './DayLogProvider'
import { DaySaveStatus } from './DaySaveStatus'
import { LiveWeekStrip } from './LiveWeekStrip'
import { PlanFields } from './PlanFields'
import { TrackerPanel } from './TrackerPanel'
import type { WeekDay } from './WeekStrip'

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

function toDayLog(log: DailyLog | undefined | null): DayLog {
  if (!log) return EMPTY_LOG
  return {
    habitsDone: habitIdsOf(log),
    toeflMinutes: log.toeflMinutes ?? 0,
    toeflSkills: (log.toeflSkills ?? []) as ToeflSkill[],
    themeMinutes: log.themeMinutes ?? 0,
    energy: log.energy ?? null,
    morningItems: cleanPlanItems(log.morningItems),
    noonItems: cleanPlanItems(log.noonItems),
    eveningItems: cleanPlanItems(log.eveningItems),
  }
}

const dayHref = (day: string, today: string) => (day === today ? '/' : `/journal/day/${day}`)

/** One page of the journal: today, or any other day. */
export async function DayView({ session, day, today }: { session: Session; day: string; today: string }) {
  const monday = weekStart(day)
  const nextDay = addDays(day, 1)

  const [settings, weekLogs, nextLogs, important, weekly, theme, allHabits] = await Promise.all([
    getSettings(session),
    getLogsBetween(session, monday, addDays(monday, 6)),
    getLogsBetween(session, nextDay, nextDay),
    getImportantTasks(session, day, nextDay),
    getWeeklyTasks(session, [monday]),
    monday === currentMonday() ? getCurrentTheme(session) : getWeekTheme(session, monday),
    getHabits(session, true),
  ])
  // Today shows the active habits; a past day also shows archived ones it used.
  const dayHabits = allHabits.filter((h) => h.active || habitIdsOf(weekLogs.find((l) => l.date === day)).includes(h.id))
  const weekHabits = habitsForPeriod(allHabits, weekLogs)

  const log = weekLogs.find((l) => l.date === day)
  const week: WeekDay[] = WEEK_LABELS.map((label, i) => {
    const date = addDays(monday, i)
    const l = weekLogs.find((x) => x.date === date)
    return { date, label, habitsDone: habitIdsOf(l), toeflMinutes: l?.toeflMinutes ?? 0 }
  })

  const slot = settings.weekPlan[weekdayOf(day)]
  const planSkill = TOEFL_SKILLS.some((s) => s.value === slot) ? (slot as ToeflSkill) : null
  const toeflWeek = planWeek(settings.planStart, day)
  const daysToExam = settings.examDate ? daysBetween(day, settings.examDate) : null
  const renderedAt = renderStamp()
  const todayImportant = important.filter((t) => t.day === day)
  const nextImportant = important.filter((t) => t.day === nextDay)
  const doneImportant = todayImportant.filter((t) => t.status === 'done').length
  const activeImportant = todayImportant.filter((t) => t.status !== 'migrated').length
  const doneWeekly = weekly.filter((t) => t.status === 'done').length
  const isToday = day === today
  const isSunday = weekdayOf(day) === 'sun'

  return (
    <DayLogProvider key={day} day={day} initial={toDayLog(log)} renderedAt={renderedAt}>
      <DaySaveStatus />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 md:mb-8">
        <div>
          <p className="font-mono text-xs text-muted">
            <Link href={`/journal/week/${monday}`} className="hover:text-ink-strong hover:underline">
              {isoWeekYear(day)} 第 {isoWeek(day)} 週
            </Link>
            {toeflWeek >= 1 && ` · 托福第 ${toeflWeek} 週`}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-strong md:text-4xl">{formatDayLong(day)}</h1>
          <nav aria-label="切換日期" className="mt-2 flex items-center gap-1 text-sm">
            <Link href={dayHref(addDays(day, -1), today)} className="rounded-md p-2 text-muted hover:bg-sunken hover:text-ink-strong md:p-1" aria-label="前一天">
              <CaretLeft size={16} />
            </Link>
            {!isToday && (
              <Link href="/" className="rounded-md px-2 py-0.5 text-accent hover:bg-accent-soft">
                回到今天
              </Link>
            )}
            <Link href={dayHref(nextDay, today)} className="rounded-md p-2 text-muted hover:bg-sunken hover:text-ink-strong md:p-1" aria-label="後一天">
              <CaretRight size={16} />
            </Link>
          </nav>
        </div>
        {daysToExam !== null ? (
          <p className="text-right">
            <span className="block text-xs text-muted">距離托福考試</span>
            <span className="text-2xl font-semibold tracking-tight text-ink-strong">{daysToExam >= 0 ? `${daysToExam} 天` : '已考完'}</span>
          </p>
        ) : (
          <Link href="/admin/globals/settings" className="btn btn-quiet">
            設定考試日期
          </Link>
        )}
      </header>

      <div className="grid gap-3 md:grid-cols-6 md:gap-4">
        <section className="card rise p-5 md:col-span-4 md:col-start-1 md:row-start-1 md:p-6" style={{ '--i': 0 } as React.CSSProperties}>
          <SectionHead title="IMPORTANT" meta={activeImportant ? `${doneImportant}/${activeImportant} 完成` : undefined} />
          <TaskList kind="important" scope={day} items={todayImportant} today={today} addLabel="今天最重要的事" />
        </section>

        <section className="card rise p-5 md:col-span-4 md:col-start-1 md:row-start-2 md:p-6" style={{ '--i': 1 } as React.CSSProperties}>
          <PlanFields />
        </section>

        <section className="card rise p-5 md:col-span-2 md:col-start-5 md:row-span-2 md:row-start-1 md:p-6" style={{ '--i': 2 } as React.CSSProperties}>
          <SectionHead
            title="本週待辦"
            meta={weekly.length ? `${doneWeekly}/${weekly.length}` : undefined}
            action={
              <Link href={`/journal/week/${monday}`} className="flex items-center gap-1 text-sm text-accent hover:underline">
                整週
                <ArrowRight size={14} />
              </Link>
            }
          />
          <TaskList kind="weekly" scope={monday} items={weekly} today={today} addLabel="新增本週待辦" compact />
        </section>

        <section className="card rise p-5 md:col-span-6 md:p-6" style={{ '--i': 3 } as React.CSSProperties}>
          <TrackerPanel
            planLabel={labelOf(PLAN_SLOTS, slot)}
            planSkill={planSkill}
            themeTitle={theme?.title ?? null}
            weekHref={`/journal/week/${monday}`}
            habits={dayHabits}
            allHabits={allHabits}
          />
        </section>

        <section className="card rise p-5 md:col-span-6 md:p-6" style={{ '--i': 4 } as React.CSSProperties}>
          <SectionHead title="Note" meta="今天的反思" />
          <BlockEditor
            key={`note-${day}`}
            target={{ kind: 'day', day }}
            initial={Array.isArray(log?.note) ? log.note : null}
            renderedAt={renderedAt}
            placeholder="今天過得怎麼樣？學到什麼、卡在哪裡、明天想怎麼調整…"
          />
        </section>

        {isSunday && (
          <section className="card rise border-ink-strong/20 p-5 md:col-span-6 md:p-6" style={{ '--i': 5 } as React.CSSProperties}>
            <SectionHead
              title="週日統整"
              meta={`第 ${isoWeek(day)} 週`}
              action={
                <Link href={`/journal/week/${monday}`} className="flex items-center gap-1 text-sm text-accent hover:underline">
                  整週筆記
                  <ArrowRight size={14} />
                </Link>
              }
            />
            <p className="mb-4 text-sm text-muted">這裡寫的和週筆記是同一份，兩邊會同步。</p>
            <WeekReview session={session} monday={monday} />
          </section>
        )}

        <section className="card rise p-5 md:col-span-6 md:p-6" style={{ '--i': 6 } as React.CSSProperties}>
          <Collapsible
            title={isToday ? '安排明天' : '安排隔天'}
            hint={`${formatDayShort(nextDay)}${nextImportant.length ? ` · ${nextImportant.filter((t) => t.status !== 'migrated').length} 件 Important` : ''}`}
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted">IMPORTANT</p>
                <TaskList kind="important" scope={nextDay} items={nextImportant} today={today} addLabel="明天最重要的事" />
              </div>
              <DayLogProvider day={nextDay} initial={toDayLog(nextLogs[0])} renderedAt={renderedAt}>
                <DaySaveStatus />
                <PlanFields />
              </DayLogProvider>
            </div>
          </Collapsible>
        </section>

        <section className="card rise p-5 md:col-span-6 md:p-6" style={{ '--i': 6 } as React.CSSProperties}>
          <LiveWeekStrip days={week} habits={weekHabits} toeflHoursTarget={settings.toeflHoursTarget} />
        </section>
      </div>
    </DayLogProvider>
  )
}

function SectionHead({ title, meta, action }: { title: string; meta?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-baseline gap-2">
        <span className="text-sm font-semibold tracking-wide text-ink-strong">{title}</span>
        {meta && <span className="text-xs text-muted">{meta}</span>}
      </h2>
      {action}
    </div>
  )
}
