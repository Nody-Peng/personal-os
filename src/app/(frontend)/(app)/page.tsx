import type { Metadata } from 'next'
import Link from 'next/link'
import { TodayBoard, type TodayLog } from '@/components/today/TodayBoard'
import type { WeekDay } from '@/components/today/WeekStrip'
import {
  addDays,
  daysBetween,
  formatDayLong,
  formatDayShort,
  logicalDay,
  weekStart,
  weekdayOf,
} from '@/lib/day'
import { PLAN_SLOTS, TOEFL_SKILLS, labelOf, type ToeflSkill } from '@/lib/options'
import { getLog, getLogsBetween, getSelectedIdea, getSettings, planWeek } from '@/lib/queries'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: '今天' }
export const dynamic = 'force-dynamic'

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export default async function TodayPage() {
  const session = await requireSession('/')
  const today = logicalDay()
  const monday = weekStart(today)

  const [settings, weekLogs, yesterday, theme] = await Promise.all([
    getSettings(session),
    getLogsBetween(session, monday, addDays(monday, 6)),
    getLog(session, addDays(today, -1)),
    getSelectedIdea(session),
  ])

  const log = weekLogs.find((l) => l.date === today)
  const initial: TodayLog = {
    morningListening: log?.morningListening ?? false,
    gym: log?.gym ?? false,
    toeflMinutes: log?.toeflMinutes ?? 0,
    toeflSkills: (log?.toeflSkills ?? []) as ToeflSkill[],
    themeMinutes: log?.themeMinutes ?? 0,
    energy: log?.energy ?? null,
    notes: log?.notes ?? '',
    tomorrowTop1: log?.tomorrowTop1 ?? '',
  }

  const week: WeekDay[] = WEEK_LABELS.map((label, i) => {
    const date = addDays(monday, i)
    const l = weekLogs.find((x) => x.date === date)
    return {
      date,
      label,
      listening: l?.morningListening ?? false,
      gym: l?.gym ?? false,
      toeflMinutes: l?.toeflMinutes ?? 0,
    }
  })

  const slot = settings.weekPlan[weekdayOf(today)]
  const planSkill = TOEFL_SKILLS.some((s) => s.value === slot) ? (slot as ToeflSkill) : null
  const week1 = planWeek(settings.planStart, today)
  const daysToExam = settings.examDate ? daysBetween(today, settings.examDate) : null

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 md:mb-8">
        <div>
          <p className="font-mono text-xs text-muted">
            {week1 >= 1 ? `托福計畫第 ${week1} 週` : `計畫 ${formatDayShort(settings.planStart)} 開始`}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-strong md:text-4xl">
            {formatDayLong(today)}
          </h1>
        </div>
        {daysToExam !== null ? (
          <p className="text-right">
            <span className="block text-xs text-muted">距離托福考試</span>
            <span className="text-2xl font-semibold tracking-tight text-ink-strong">
              {daysToExam >= 0 ? `${daysToExam} 天` : '已考完'}
            </span>
          </p>
        ) : (
          <Link href="/admin/globals/settings" className="btn btn-quiet">
            設定考試日期
          </Link>
        )}
      </header>

      <TodayBoard
        day={today}
        initial={initial}
        top1={yesterday?.tomorrowTop1 || null}
        planLabel={labelOf(PLAN_SLOTS, slot)}
        planSkill={planSkill}
        theme={theme ? { title: theme.title } : null}
        week={week}
        targets={{ toeflHours: settings.toeflHoursTarget, gym: settings.gymTarget }}
      />
    </>
  )
}
