'use server'

import { revalidatePath } from 'next/cache'
import { isDay } from '@/lib/day'
import { cleanPlanItems, type PlanItem } from '@/lib/dayParts'
import { IDEA_STATUSES, type IdeaStatus } from '@/lib/options'
import { clampInt, cleanBlocks, cleanId, fail, type ActionResult } from '@/lib/actionUtils'
import { requireActionSession } from '@/lib/session'
import { upsertOne } from '@/lib/upsert'
import { currentMonday, storedWeekThemeId, writeWeekTheme } from '@/lib/weekThemes'

export type { ActionResult }

const values = <T extends { value: string }>(options: readonly T[]) =>
  new Set(options.map((o) => o.value))
const IDEA_STATUS_VALUES = values(IDEA_STATUSES)

// ---------------------------------------------------------------- daily logs

export type DailyLogPatch = Partial<{
  habitsDone: number[]
  themeMinutes: number
  energy: number | null
  morningItems: PlanItem[]
  noonItems: PlanItem[]
  eveningItems: PlanItem[]
  note: unknown[] | null
}>

/** Keeps only known fields with sane values; the client is never trusted. */
function cleanLogPatch(patch: DailyLogPatch): DailyLogPatch {
  const out: DailyLogPatch = {}
  if ('habitsDone' in patch) {
    out.habitsDone = [...new Set((patch.habitsDone ?? []).map(Number))].filter((id) => Number.isInteger(id) && id > 0)
  }
  if ('themeMinutes' in patch) out.themeMinutes = clampInt(patch.themeMinutes, 0, 24 * 60)
  if ('energy' in patch) out.energy = patch.energy == null ? null : clampInt(patch.energy, 1, 5)
  if ('morningItems' in patch) out.morningItems = cleanPlanItems(patch.morningItems)
  if ('noonItems' in patch) out.noonItems = cleanPlanItems(patch.noonItems)
  if ('eveningItems' in patch) out.eveningItems = cleanPlanItems(patch.eveningItems)
  if ('note' in patch) out.note = cleanBlocks(patch.note)
  return out
}

export async function saveDailyLog(day: string, patch: DailyLogPatch): Promise<ActionResult> {
  try {
    if (!isDay(day)) throw new Error('日期格式錯誤')
    const session = await requireActionSession()
    const data = cleanLogPatch(patch)
    await upsertOne(session, 'daily-logs', { date: { equals: day } }, data, { date: day, ...data })
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

// --------------------------------------------------------------------- ideas

export async function addIdea(title: string, why: string): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    const cleanTitle = title.trim().slice(0, 120)
    if (!cleanTitle) throw new Error('請輸入想學什麼')
    await payload.create({
      collection: 'ideas',
      data: { title: cleanTitle, why: why.trim().slice(0, 300) || null, status: 'inbox' },
      user,
      overrideAccess: false,
    })
    revalidatePath('/ideas')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

export type IdeaPatch = Partial<{
  scoreGoal: number
  scoreUrgency: number
  scorePassion: number
  status: IdeaStatus
}>

export async function updateIdea(id: number, patch: IdeaPatch): Promise<ActionResult> {
  try {
    id = cleanId(id)
    const { payload, user } = await requireActionSession()
    const data: IdeaPatch = {}
    for (const key of ['scoreGoal', 'scoreUrgency', 'scorePassion'] as const) {
      if (key in patch) data[key] = clampInt(patch[key], 0, 3)
    }
    if (patch.status) {
      if (!IDEA_STATUS_VALUES.has(patch.status)) throw new Error('狀態錯誤')
      data.status = patch.status
    }
    await payload.update({ collection: 'ideas', id, data, user, overrideAccess: false })

    // Keep this week's note in step with the ideas page. A theme marked done or
    // dropped stays on its week (week and month reviews list it); only sending
    // it back to the inbox takes it off.
    if (data.status) {
      const session = { payload, user }
      const monday = currentMonday()
      if (data.status === 'selected') await writeWeekTheme(session, monday, id)
      else if (data.status === 'inbox' && (await storedWeekThemeId(session, monday)) === id) await writeWeekTheme(session, monday, null)
    }
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

export async function deleteIdea(id: number): Promise<ActionResult> {
  try {
    id = cleanId(id)
    const { payload, user } = await requireActionSession()
    await payload.delete({ collection: 'ideas', id, user, overrideAccess: false })
    revalidatePath('/ideas')
    revalidatePath('/')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}
