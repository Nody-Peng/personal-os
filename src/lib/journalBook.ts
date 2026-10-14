import 'server-only'
import type { Idea, Journal } from '@/payload-types'
import { blocksToText, countWords, isBlankDocument } from './blocks'
import { isRecordedLog } from './dailyLog'
import { DAY_PARTS, cleanPlanItems, type PlanItem } from './dayParts'
import { addDays, monthOf, weekStart } from './day'
import type { HabitItem } from './habits'
import { daysOf, type BookOptions } from './journalPrint'
import { countImages, type StatDay } from './journalStats'
import type { ToeflSkill } from './options'
import { getHabits, getJournal, getLogsBetween, habitIdsOf, habitsForPeriod } from './queries'
import type { Session } from './session'
import type { TaskStatus } from './tasks'

// Everything the journal book (/print/journal) prints for a range of days,
// read in a handful of queries.

export type BookTask = { id: number; title: string; status: TaskStatus; body: unknown[] | null }

export type BookDay = StatDay & {
  toeflSkills: ToeflSkill[]
  /** 早 / 午 / 晚 lists that have something in them. */
  parts: { label: string; items: PlanItem[] }[]
  /** The day's note, null when nothing is written. */
  note: unknown[] | null
  tasks: BookTask[]
}

export type BookWeek = {
  monday: string
  theme: string | null
  themeReason: string | null
  review: unknown[] | null
  todos: { id: number; title: string; status: TaskStatus }[]
}

export type BookMonth = { month: string; review: unknown[] | null }

export type JournalBookData = {
  options: BookOptions
  cover: {
    years: string
    title: string
    subtitle: string
    coverColor: Journal['coverColor']
    pattern: Journal['pattern']
  }
  habits: HabitItem[]
  days: BookDay[]
  weeks: BookWeek[]
  months: BookMonth[]
  /** Titles of notebook pages that notes link to (pageLink / board blocks). */
  pageTitles: Record<number, string>
}

const doc = (value: unknown): unknown[] | null => (Array.isArray(value) && !isBlankDocument(value) ? value : null)

function linkedPageIds(blocks: unknown, out: Set<number>) {
  if (!Array.isArray(blocks)) return
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue
    const block = b as { type?: unknown; props?: Record<string, unknown>; children?: unknown }
    const id = Number(block.type === 'pageLink' ? block.props?.pageId : block.type === 'board' ? block.props?.boardId : NaN)
    if (Number.isInteger(id) && id > 0) out.add(id)
    linkedPageIds(block.children, out)
  }
}

export async function loadJournalBook(session: Session, options: BookOptions): Promise<JournalBookData> {
  const { payload, user } = session
  const { from, to } = options
  const allDays = daysOf(from, to)
  const mondays = [...new Set(allDays.map(weekStart))]
  const months = [...new Set(allDays.map(monthOf))]
  const access = { user, overrideAccess: false } as const

  const [journal, logs, important, weekly, reviews, monthNotes, everyHabit] = await Promise.all([
    getJournal(session, Number(from.slice(0, 4))),
    getLogsBetween(session, from, to),
    payload.find({
      collection: 'tasks',
      where: {
        and: [{ kind: { equals: 'important' } }, { day: { greater_than_equal: from } }, { day: { less_than_equal: to } }],
      },
      sort: ['day', 'position', 'id'],
      pagination: false,
      depth: 0,
      select: { title: true, status: true, day: true, body: true },
      ...access,
    }),
    payload.find({
      collection: 'tasks',
      where: { and: [{ kind: { equals: 'weekly' } }, { weekStart: { in: mondays } }] },
      sort: ['weekStart', 'position', 'id'],
      pagination: false,
      depth: 0,
      select: { title: true, status: true, weekStart: true },
      ...access,
    }),
    payload.find({
      collection: 'weekly-reviews',
      where: { weekStart: { in: mondays } },
      pagination: false,
      depth: 1,
      ...access,
    }),
    payload.find({
      collection: 'monthly-notes',
      where: { month: { in: months } },
      pagination: false,
      depth: 0,
      ...access,
    }),
    getHabits(session, true),
  ])

  const logOf = new Map(logs.map((l) => [l.date, l]))
  const tasksOf = new Map<string, BookTask[]>()
  for (const t of important.docs) {
    if (!t.day) continue
    const list = tasksOf.get(t.day) ?? []
    list.push({ id: t.id, title: t.title, status: t.status, body: doc(t.body) })
    tasksOf.set(t.day, list)
  }

  const days: BookDay[] = allDays.map((day) => {
    const log = logOf.get(day)
    const tasks = tasksOf.get(day) ?? []
    const counted = tasks.filter((t) => t.status !== 'migrated')
    const note = doc(log?.note)
    return {
      day,
      recorded: log ? isRecordedLog(log) : false,
      energy: log?.energy ?? null,
      habits: habitIdsOf(log),
      toeflMinutes: log?.toeflMinutes ?? 0,
      toeflSkills: log?.toeflSkills ?? [],
      themeMinutes: log?.themeMinutes ?? 0,
      tasksDone: counted.filter((t) => t.status === 'done').length,
      tasksTotal: counted.length,
      words: note ? countWords(blocksToText(note)).words : 0,
      photos: countImages(note) + tasks.reduce((n, t) => n + countImages(t.body), 0),
      parts: log
        ? DAY_PARTS.map((p) => ({
            label: p.label,
            items: cleanPlanItems(log[p.key]).filter((i) => i.text.trim()),
          })).filter((p) => p.items.length)
        : [],
      note,
      tasks,
    }
  })

  const reviewOf = new Map(reviews.docs.map((r) => [r.weekStart, r]))
  const weeks: BookWeek[] = mondays.map((monday) => {
    const r = reviewOf.get(monday)
    const theme = r?.theme && typeof r.theme === 'object' ? (r.theme as Idea).title : null
    return {
      monday,
      theme,
      themeReason: r?.themeReason?.trim() || null,
      review: doc(r?.review),
      todos: weekly.docs.filter((t) => t.weekStart === monday).map((t) => ({ id: t.id, title: t.title, status: t.status })),
    }
  })

  const noteOf = new Map(monthNotes.docs.map((n) => [n.month, n]))
  const bookMonths: BookMonth[] = months.map((month) => ({
    month,
    review: doc(noteOf.get(month)?.review),
  }))

  const linked = new Set<number>()
  for (const d of days) {
    linkedPageIds(d.note, linked)
    for (const t of d.tasks) linkedPageIds(t.body, linked)
  }
  for (const w of weeks) linkedPageIds(w.review, linked)
  for (const m of bookMonths) linkedPageIds(m.review, linked)
  const pageTitles: Record<number, string> = {}
  if (linked.size) {
    const pages = await payload.find({
      collection: 'note-pages',
      where: { id: { in: [...linked] } },
      pagination: false,
      depth: 0,
      select: { title: true },
      ...access,
    })
    for (const p of pages.docs) pageTitles[p.id] = p.title ?? ''
  }

  const firstYear = from.slice(0, 4)
  const lastYear = to.slice(0, 4)
  return {
    options,
    cover: {
      years: firstYear === lastYear ? firstYear : `${firstYear}–${lastYear}`,
      title: options.title || journal?.title || `${firstYear} 日記本`,
      subtitle: options.subtitle,
      coverColor: journal?.coverColor ?? 'navy',
      pattern: journal?.pattern ?? 'cloth',
    },
    habits: habitsForPeriod(everyHabit, logs),
    days,
    weeks,
    months: bookMonths,
    pageTitles,
  }
}

/** Sunday of the week starting `monday`. */
export const sundayOf = (monday: string) => addDays(monday, 6)
