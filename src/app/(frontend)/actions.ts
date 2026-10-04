'use server'

import { revalidatePath } from 'next/cache'
import { DAY_PATTERN } from '@/lib/day'
import {
  IDEA_STATUSES,
  SCORE_SOURCES,
  SCORE_TYPES,
  TOEFL_SKILLS,
  type IdeaStatus,
  type ToeflSkill,
} from '@/lib/options'
import { clampInt, cleanBlocks, cleanText, fail, type ActionResult } from '@/lib/actionUtils'
import { requireActionSession } from '@/lib/session'
import { SECTIONS, isBand, type Section } from '@/lib/toefl'

export type { ActionResult }

const values = <T extends { value: string }>(options: readonly T[]) =>
  new Set(options.map((o) => o.value))
const TOEFL_SKILL_VALUES = values(TOEFL_SKILLS)
const IDEA_STATUS_VALUES = values(IDEA_STATUSES)
const SCORE_TYPE_VALUES = values(SCORE_TYPES)
const SCORE_SOURCE_VALUES = values(SCORE_SOURCES)

// ---------------------------------------------------------------- daily logs

export type DailyLogPatch = Partial<{
  morningListening: boolean
  gym: boolean
  toeflMinutes: number
  toeflSkills: ToeflSkill[]
  themeMinutes: number
  energy: number | null
  morningPlan: string
  noonPlan: string
  eveningPlan: string
  note: unknown[] | null
}>

/** Keeps only known fields with sane values; the client is never trusted. */
function cleanLogPatch(patch: DailyLogPatch): DailyLogPatch {
  const out: DailyLogPatch = {}
  if ('morningListening' in patch) out.morningListening = Boolean(patch.morningListening)
  if ('gym' in patch) out.gym = Boolean(patch.gym)
  if ('toeflMinutes' in patch) out.toeflMinutes = clampInt(patch.toeflMinutes, 0, 24 * 60)
  if ('themeMinutes' in patch) out.themeMinutes = clampInt(patch.themeMinutes, 0, 24 * 60)
  if ('toeflSkills' in patch)
    out.toeflSkills = (patch.toeflSkills ?? []).filter((s) => TOEFL_SKILL_VALUES.has(s))
  if ('energy' in patch) out.energy = patch.energy == null ? null : clampInt(patch.energy, 1, 5)
  if ('morningPlan' in patch) out.morningPlan = cleanText(patch.morningPlan, 2000)
  if ('noonPlan' in patch) out.noonPlan = cleanText(patch.noonPlan, 2000)
  if ('eveningPlan' in patch) out.eveningPlan = cleanText(patch.eveningPlan, 2000)
  if ('note' in patch) out.note = cleanBlocks(patch.note)
  return out
}

export async function saveDailyLog(day: string, patch: DailyLogPatch): Promise<ActionResult> {
  try {
    if (!DAY_PATTERN.test(day)) throw new Error('日期格式錯誤')
    const { payload, user } = await requireActionSession()
    const data = cleanLogPatch(patch)
    const { docs } = await payload.find({
      collection: 'daily-logs',
      where: { date: { equals: day } },
      limit: 1,
      user,
      overrideAccess: false,
    })
    if (docs[0]) {
      await payload.update({
        collection: 'daily-logs',
        id: docs[0].id,
        data,
        user,
        overrideAccess: false,
      })
    } else {
      await payload.create({
        collection: 'daily-logs',
        data: { date: day, ...data },
        user,
        overrideAccess: false,
      })
    }
    revalidatePath('/toefl')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

// ------------------------------------------------------------- TOEFL scores

export async function addScore(formData: FormData): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    const date = String(formData.get('date') ?? '')
    const type = String(formData.get('type') ?? '')
    const source = String(formData.get('source') ?? 'ets')

    if (!DAY_PATTERN.test(date)) throw new Error('請選擇日期')
    if (!SCORE_TYPE_VALUES.has(type)) throw new Error('請選擇類型')
    if (!SCORE_SOURCE_VALUES.has(source)) throw new Error('請選擇來源')

    const bands: Partial<Record<Section, number | null>> = {}
    for (const { value, label } of SECTIONS) {
      const raw = String(formData.get(value) ?? '').trim()
      if (!raw) {
        bands[value] = null
        continue
      }
      const band = Number(raw)
      if (!isBand(band)) throw new Error(`${label}的級分要是 1–6，以 0.5 為單位`)
      bands[value] = band
    }
    if (Object.values(bands).every((b) => b == null)) throw new Error('至少要填一科的級分')

    await payload.create({
      collection: 'toefl-scores',
      data: {
        date,
        type: type as 'mini',
        source: source as 'ets',
        ...bands,
        notes: String(formData.get('notes') ?? '').slice(0, 1000) || null,
      },
      user,
      overrideAccess: false,
    })
    revalidatePath('/toefl')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

export async function deleteScore(id: number): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    await payload.delete({ collection: 'toefl-scores', id, user, overrideAccess: false })
    revalidatePath('/toefl')
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
    revalidatePath('/ideas')
    revalidatePath('/')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

export async function deleteIdea(id: number): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    await payload.delete({ collection: 'ideas', id, user, overrideAccess: false })
    revalidatePath('/ideas')
    revalidatePath('/')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}
