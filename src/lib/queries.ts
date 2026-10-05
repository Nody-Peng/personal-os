import 'server-only'
import type { DailyLog, Idea, Journal, MonthlyNote, Setting, ToeflScore, WeeklyReview } from '@/payload-types'
import type { HabitIconKey, HabitItem } from './habits'
import { toTaskItem, type TaskItem } from './taskItems'
import { isRecordedLog } from './dailyLog'
import { addDays, daysBetween } from './day'
import type { Session } from './session'

export type ResolvedSettings = {
  planStart: string
  examDate: string | null
  baselineBand: number
  targetBand: number
  checkpoints: { week: number; target: number }[]
  toeflHoursTarget: number
  weekPlan: Setting['weekPlan']
}

export async function getSettings({ payload, user }: Session): Promise<ResolvedSettings> {
  const s = await payload.findGlobal({ slug: 'settings', user, overrideAccess: false })
  return {
    planStart: s.planStart || '2026-10-05',
    examDate: s.examDate || null,
    baselineBand: s.baselineBand ?? 3.5,
    targetBand: s.targetBand ?? 5,
    checkpoints: (s.checkpoints ?? []).map(({ week, target }) => ({ week, target })),
    toeflHoursTarget: s.weeklyTargets?.toeflHours ?? 8,
    weekPlan: s.weekPlan ?? {
      mon: 'speaking',
      tue: 'writing',
      wed: 'reading',
      thu: 'speaking',
      fri: 'writing',
      sat: 'practice',
      sun: 'rest',
    },
  }
}

/** 1-based week of the plan that `day` falls in (0 or less = before the plan). */
export function planWeek(planStart: string, day: string): number {
  return Math.floor(daysBetween(planStart, day) / 7) + 1
}

export async function getLogsBetween(
  { payload, user }: Session,
  from: string,
  to: string,
): Promise<DailyLog[]> {
  const { docs } = await payload.find({
    collection: 'daily-logs',
    where: { and: [{ date: { greater_than_equal: from } }, { date: { less_than_equal: to } }] },
    sort: 'date',
    limit: 400,
    pagination: false,
    user,
    overrideAccess: false,
  })
  return docs
}

export async function getLog(session: Session, day: string): Promise<DailyLog | null> {
  const [log] = await getLogsBetween(session, day, day)
  return log ?? null
}

export async function getSelectedIdea({ payload, user }: Session): Promise<Idea | null> {
  const { docs } = await payload.find({
    collection: 'ideas',
    where: { status: { equals: 'selected' } },
    limit: 1,
    user,
    overrideAccess: false,
  })
  return docs[0] ?? null
}

export async function getIdeas({ payload, user }: Session): Promise<Idea[]> {
  const { docs } = await payload.find({
    collection: 'ideas',
    sort: ['-total', '-createdAt'],
    limit: 500,
    pagination: false,
    user,
    overrideAccess: false,
  })
  return docs
}

export async function getScores({ payload, user }: Session): Promise<ToeflScore[]> {
  const { docs } = await payload.find({
    collection: 'toefl-scores',
    sort: ['-date', '-createdAt'],
    limit: 500,
    pagination: false,
    user,
    overrideAccess: false,
  })
  return docs
}

/** Total TOEFL minutes per plan week, weeks 1..weekCount. */
export function minutesPerWeek(
  logs: DailyLog[],
  planStart: string,
  weekCount: number,
): { week: number; start: string; minutes: number }[] {
  const weeks = Array.from({ length: weekCount }, (_, i) => ({
    week: i + 1,
    start: addDays(planStart, i * 7),
    minutes: 0,
  }))
  for (const log of logs) {
    const w = planWeek(planStart, log.date)
    if (w >= 1 && w <= weekCount) weeks[w - 1].minutes += log.toeflMinutes ?? 0
  }
  return weeks
}

// ------------------------------------------------------------------ journal

export async function getImportantTasks({ payload, user }: Session, from: string, to: string): Promise<TaskItem[]> {
  const { docs } = await payload.find({
    collection: 'tasks',
    where: { and: [{ kind: { equals: 'important' } }, { day: { greater_than_equal: from } }, { day: { less_than_equal: to } }] },
    sort: ['day', 'position', 'id'],
    pagination: false,
    depth: 0,
    user,
    overrideAccess: false,
  })
  return docs.map(toTaskItem)
}

export async function getWeeklyTasks({ payload, user }: Session, mondays: string[]): Promise<TaskItem[]> {
  if (!mondays.length) return []
  const { docs } = await payload.find({
    collection: 'tasks',
    where: { and: [{ kind: { equals: 'weekly' } }, { weekStart: { in: mondays } }] },
    sort: ['weekStart', 'position', 'id'],
    pagination: false,
    depth: 0,
    user,
    overrideAccess: false,
  })
  return docs.map(toTaskItem)
}

/** Tasks with a period or due date that touch [from, to], of either kind. */
export async function getDatedTasks({ payload, user }: Session, from: string, to: string): Promise<TaskItem[]> {
  const { docs } = await payload.find({
    collection: 'tasks',
    where: {
      or: [
        { and: [{ startDate: { less_than_equal: to } }, { endDate: { greater_than_equal: from } }] },
        { and: [{ dueDate: { greater_than_equal: from } }, { dueDate: { less_than_equal: to } }] },
      ],
    },
    pagination: false,
    depth: 0,
    user,
    overrideAccess: false,
  })
  return docs.map(toTaskItem)
}

export async function getWeekReview({ payload, user }: Session, monday: string): Promise<WeeklyReview | null> {
  const { docs } = await payload.find({
    collection: 'weekly-reviews',
    where: { weekStart: { equals: monday } },
    limit: 1,
    depth: 0,
    user,
    overrideAccess: false,
  })
  return docs[0] ?? null
}

export async function getMonthNote({ payload, user }: Session, month: string): Promise<MonthlyNote | null> {
  const { docs } = await payload.find({
    collection: 'monthly-notes',
    where: { month: { equals: month } },
    limit: 1,
    user,
    overrideAccess: false,
  })
  return docs[0] ?? null
}

/** All journals, creating this year's book on first visit. */
export async function getJournals({ payload, user }: Session, currentYear: number): Promise<Journal[]> {
  const find = () =>
    payload.find({ collection: 'journals', sort: '-year', pagination: false, user, overrideAccess: false })
  let { docs } = await find()
  if (!docs.some((j) => j.year === currentYear)) {
    await payload.create({
      collection: 'journals',
      data: { year: currentYear, title: `${currentYear} 日記本`, coverColor: 'navy', pattern: 'cloth' },
      user,
      overrideAccess: false,
    })
    ;({ docs } = await find())
  }
  return docs
}

export async function getJournal(session: Session, year: number): Promise<Journal | null> {
  const { docs } = await session.payload.find({
    collection: 'journals',
    where: { year: { equals: year } },
    limit: 1,
    user: session.user,
    overrideAccess: false,
  })
  return docs[0] ?? null
}

/** Number of recorded days in `year` (see isRecordedLog). */
export async function countLoggedDays(session: Session, year: number): Promise<number> {
  const logs = await getLogsBetween(session, `${year}-01-01`, `${year}-12-31`)
  return logs.filter(isRecordedLog).length
}

// ------------------------------------------------------------------- habits

/** Active habits by default; with includeArchived, every habit ever made. */
export async function getHabits({ payload, user }: Session, includeArchived = false): Promise<HabitItem[]> {
  const { docs } = await payload.find({
    collection: 'habits',
    where: includeArchived ? undefined : { active: { equals: true } },
    sort: ['position', 'id'],
    pagination: false,
    user,
    overrideAccess: false,
  })
  return docs.map((h) => ({
    id: h.id,
    name: h.name,
    icon: h.icon as HabitIconKey,
    weeklyTarget: h.weeklyTarget,
    active: h.active ?? true,
  }))
}

/** Habit ids ticked in a log (relationship values may be ids or docs). */
export function habitIdsOf(log: DailyLog | null | undefined): number[] {
  return (log?.habitsDone ?? []).map((h) => (typeof h === 'number' ? h : h.id))
}

/**
 * Habits to show for a period: the active ones, plus archived ones that
 * were ticked in these logs (so old weeks keep their history).
 */
export function habitsForPeriod(all: HabitItem[], logs: DailyLog[]): HabitItem[] {
  const used = new Set(logs.flatMap(habitIdsOf))
  return all.filter((h) => h.active || used.has(h.id))
}

// -------------------------------------------------------------- week themes

/** The theme stored on a week's note, if any. */
export async function getWeekTheme(session: Session, monday: string): Promise<Idea | null> {
  const review = await session.payload.find({
    collection: 'weekly-reviews',
    where: { weekStart: { equals: monday } },
    limit: 1,
    depth: 1,
    user: session.user,
    overrideAccess: false,
  })
  const theme = review.docs[0]?.theme
  return theme && typeof theme === 'object' ? theme : null
}
