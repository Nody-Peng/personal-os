'use server'

import { revalidatePath } from 'next/cache'
import { cleanBlocks, cleanText, fail, type ActionResult } from '@/lib/actionUtils'
import { DAY_PATTERN, MONTH_PATTERN, addDays, weekStart } from '@/lib/day'
import { requireActionSession } from '@/lib/session'
import { MAX_IMPORTANT_PER_DAY, type TaskKind, type TaskStatus } from '@/lib/tasks'
import { toTaskItem, type TaskDetail, type TaskItem } from '@/lib/taskItems'
import { HABIT_ICONS, MAX_ACTIVE_HABITS, type HabitIconKey } from '@/lib/habits'
import { currentMonday, writeWeekTheme } from '@/lib/weekThemes'

const optionalDay = (value: unknown): string | null => {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !DAY_PATTERN.test(value)) throw new Error('日期格式錯誤')
  return value
}

const refresh = () => revalidatePath('/', 'layout')

// --------------------------------------------------------------------- tasks

export async function createTask(input: {
  kind: TaskKind
  title: string
  day?: string
  weekStart?: string
}): Promise<ActionResult<TaskItem>> {
  try {
    const { payload, user } = await requireActionSession()
    const title = cleanText(input.title, 200).trim()
    if (!title) throw new Error('請輸入標題')

    let scope: { day: string } | { weekStart: string }
    if (input.kind === 'important') {
      scope = { day: optionalDay(input.day) ?? '' }
      if (!scope.day) throw new Error('Important 一定要有日期')
    } else if (input.kind === 'weekly') {
      const ws = optionalDay(input.weekStart)
      if (!ws) throw new Error('週待辦一定要屬於某一週')
      scope = { weekStart: weekStart(ws) }
    } else {
      throw new Error('類型錯誤')
    }

    const { totalDocs } = await payload.count({
      collection: 'tasks',
      where: { and: [{ kind: { equals: input.kind } }, ...Object.entries(scope).map(([k, v]) => ({ [k]: { equals: v } }))] },
      user,
      overrideAccess: false,
    })
    const doc = await payload.create({
      collection: 'tasks',
      data: { kind: input.kind, title, status: 'todo', position: totalDocs, ...scope },
      user,
      overrideAccess: false,
    })
    refresh()
    return { ok: true, data: toTaskItem(doc) }
  } catch (error) {
    return fail(error)
  }
}

export type TaskPatch = Partial<{
  title: string
  status: TaskStatus
  dueDate: string | null
  startDate: string | null
  endDate: string | null
  body: unknown[] | null
}>

export async function updateTask(id: number, patch: TaskPatch): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    const data: TaskPatch = {}
    if ('title' in patch) {
      data.title = cleanText(patch.title, 200).trim()
      if (!data.title) throw new Error('標題不能是空的')
    }
    if ('status' in patch) {
      if (patch.status !== 'todo' && patch.status !== 'done') throw new Error('狀態錯誤')
      data.status = patch.status
    }
    if ('dueDate' in patch) data.dueDate = optionalDay(patch.dueDate)
    if ('startDate' in patch) data.startDate = optionalDay(patch.startDate)
    if ('endDate' in patch) data.endDate = optionalDay(patch.endDate)
    if ('body' in patch) data.body = cleanBlocks(patch.body)

    await payload.update({ collection: 'tasks', id, data, user, overrideAccess: false })
    // Body edits autosave constantly; only list-visible changes need a refresh.
    if (Object.keys(data).some((k) => k !== 'body')) refresh()
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

export async function deleteTask(id: number): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    await payload.delete({ collection: 'tasks', id, user, overrideAccess: false })
    refresh()
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

/** Bullet-journal migration: copy an unfinished IMPORTANT to the next day. */
export async function moveTaskToNextDay(id: number): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    const task = await payload.findByID({ collection: 'tasks', id, user, overrideAccess: false })
    if (task.kind !== 'important' || !task.day) throw new Error('只有 Important 可以移到明天')
    if (task.status !== 'todo') throw new Error('這件已經完成或移走了')

    const nextDay = addDays(task.day, 1)
    const { totalDocs } = await payload.count({
      collection: 'tasks',
      where: {
        and: [{ kind: { equals: 'important' } }, { day: { equals: nextDay } }, { status: { not_equals: 'migrated' } }],
      },
      user,
      overrideAccess: false,
    })
    if (totalDocs >= MAX_IMPORTANT_PER_DAY) throw new Error(`明天已經有 ${MAX_IMPORTANT_PER_DAY} 件 Important`)

    await payload.create({
      collection: 'tasks',
      data: {
        kind: 'important',
        title: task.title,
        status: 'todo',
        position: totalDocs,
        day: nextDay,
        dueDate: task.dueDate,
        startDate: task.startDate,
        endDate: task.endDate,
        body: task.body,
        migratedFrom: task.id,
      },
      user,
      overrideAccess: false,
    })
    await payload.update({ collection: 'tasks', id, data: { status: 'migrated' }, user, overrideAccess: false })
    refresh()
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

export async function getTask(id: number): Promise<ActionResult<TaskDetail>> {
  try {
    const { payload, user } = await requireActionSession()
    const task = await payload.findByID({ collection: 'tasks', id, depth: 0, user, overrideAccess: false })
    return {
      ok: true,
      data: { ...(toTaskItem(task)), body: Array.isArray(task.body) ? task.body : null },
    }
  } catch (error) {
    return fail(error)
  }
}

// ---------------------------------------------------------------- week notes

export type WeekNotePatch = Partial<{ review: unknown[] | null; themeReason: string }>

export async function saveWeekNote(monday: string, patch: WeekNotePatch): Promise<ActionResult> {
  try {
    if (!DAY_PATTERN.test(monday) || weekStart(monday) !== monday) throw new Error('週的日期錯誤')
    const { payload, user } = await requireActionSession()
    const data: WeekNotePatch = {}
    if ('review' in patch) data.review = cleanBlocks(patch.review)
    if ('themeReason' in patch) data.themeReason = cleanText(patch.themeReason, 2000)

    const { docs } = await payload.find({
      collection: 'weekly-reviews',
      where: { weekStart: { equals: monday } },
      limit: 1,
      user,
      overrideAccess: false,
    })
    if (docs[0]) {
      await payload.update({ collection: 'weekly-reviews', id: docs[0].id, data, user, overrideAccess: false })
    } else {
      await payload.create({ collection: 'weekly-reviews', data: { weekStart: monday, ...data }, user, overrideAccess: false })
    }
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

// --------------------------------------------------------------- month notes

export async function saveMonthNote(month: string, review: unknown[] | null): Promise<ActionResult> {
  try {
    if (!MONTH_PATTERN.test(month)) throw new Error('月份錯誤')
    const { payload, user } = await requireActionSession()
    const data = { review: cleanBlocks(review) }
    const { docs } = await payload.find({
      collection: 'monthly-notes',
      where: { month: { equals: month } },
      limit: 1,
      user,
      overrideAccess: false,
    })
    if (docs[0]) {
      await payload.update({ collection: 'monthly-notes', id: docs[0].id, data, user, overrideAccess: false })
    } else {
      await payload.create({ collection: 'monthly-notes', data: { month, ...data }, user, overrideAccess: false })
    }
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

// ---------------------------------------------------------------- week theme

/** Set any week's theme; for the current week it also becomes the active idea. */
export async function setWeekTheme(monday: string, ideaId: number | null): Promise<ActionResult> {
  try {
    if (!DAY_PATTERN.test(monday) || weekStart(monday) !== monday) throw new Error('週的日期錯誤')
    const session = await requireActionSession()
    const { payload, user } = session
    const id = ideaId == null ? null : Number(ideaId)
    await writeWeekTheme(session, monday, id)

    if (monday === currentMonday()) {
      if (id) {
        await payload.update({ collection: 'ideas', id, data: { status: 'selected' }, user, overrideAccess: false })
      } else {
        await payload.update({
          collection: 'ideas',
          where: { status: { equals: 'selected' } },
          data: { status: 'inbox' },
          user,
          overrideAccess: false,
        })
      }
    }
    refresh()
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

// -------------------------------------------------------------------- habits

const ICON_VALUES = new Set<string>(HABIT_ICONS.map((i) => i.value))

export type HabitPatch = Partial<{ name: string; icon: HabitIconKey; weeklyTarget: number; active: boolean }>

function cleanHabit(patch: HabitPatch): HabitPatch {
  const data: HabitPatch = {}
  if ('name' in patch) {
    data.name = cleanText(patch.name, 40).trim()
    if (!data.name) throw new Error('請輸入習慣名稱')
  }
  if ('icon' in patch) {
    if (!patch.icon || !ICON_VALUES.has(patch.icon)) throw new Error('圖示錯誤')
    data.icon = patch.icon
  }
  if ('weeklyTarget' in patch) data.weeklyTarget = Math.min(7, Math.max(1, Math.round(Number(patch.weeklyTarget) || 7)))
  if ('active' in patch) data.active = Boolean(patch.active)
  return data
}

export async function createHabit(input: { name: string; icon: HabitIconKey; weeklyTarget: number }): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    const data = cleanHabit(input)
    const { totalDocs: active } = await payload.count({
      collection: 'habits',
      where: { active: { equals: true } },
      user,
      overrideAccess: false,
    })
    if (active >= MAX_ACTIVE_HABITS) throw new Error(`每日習慣最多 ${MAX_ACTIVE_HABITS} 項，請先封存一項`)
    const { totalDocs: all } = await payload.count({ collection: 'habits', user, overrideAccess: false })
    await payload.create({
      collection: 'habits',
      data: { name: data.name!, icon: data.icon ?? 'check', weeklyTarget: data.weeklyTarget ?? 7, active: true, position: all },
      user,
      overrideAccess: false,
    })
    refresh()
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

export async function updateHabit(id: number, patch: HabitPatch): Promise<ActionResult> {
  try {
    const { payload, user } = await requireActionSession()
    await payload.update({ collection: 'habits', id, data: cleanHabit(patch), user, overrideAccess: false })
    refresh()
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}
