import 'server-only'
import type { DailyLog, Idea, Setting, ToeflScore } from '@/payload-types'
import { addDays, daysBetween } from './day'
import type { Session } from './session'

export type ResolvedSettings = {
  planStart: string
  examDate: string | null
  baselineBand: number
  targetBand: number
  checkpoints: { week: number; target: number }[]
  toeflHoursTarget: number
  gymTarget: number
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
    gymTarget: s.weeklyTargets?.gymSessions ?? 3,
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
