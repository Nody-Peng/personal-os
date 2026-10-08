'use server'

import type { Where } from 'payload'
import { cleanText, fail, type ActionResult } from '@/lib/actionUtils'
import { formatDayLong, formatDayShort, formatWeekRange, isoWeek } from '@/lib/day'
import { snippetAround } from '@/lib/notes'
import { requireActionSession } from '@/lib/session'

export type SearchKind = 'page' | 'day' | 'task' | 'week' | 'month'

export type SearchHit = {
  key: string
  kind: SearchKind
  href: string
  title: string
  /** A page's icon (notebook pages only). */
  icon: string
  /** Where it lives: the notebook, or 日記 / Important · 10/3 / 週回顧… */
  context: string
  snippet: string
  updatedAt: string
}

const MAX_QUERY = 100
const PER_KIND = 20
const MAX_HITS = 40

const idOf = (value: unknown): number | null =>
  value == null ? null : typeof value === 'object' ? ((value as { id?: number }).id ?? null) : Number(value)

const dayTitle = (day: string) => `${day.slice(0, 4)} 年 ${formatDayLong(day)}`

/**
 * Ctrl/⌘ K: every word must appear in the title or the text. Notebook pages
 * and the journal (days, IMPORTANT items and weekly to-dos, week and month
 * notes) together, most recently changed first.
 */
export async function search(query: string): Promise<ActionResult<SearchHit[]>> {
  try {
    const { payload, user } = await requireActionSession()
    const q = cleanText(query, MAX_QUERY).trim()
    const words = q.split(/\s+/).filter(Boolean).slice(0, 5)
    if (!words.length) return { ok: true, data: [] }

    const matching = (fields: string[]): Where => ({
      and: words.map((w): Where => ({ or: fields.map((field): Where => ({ [field]: { contains: w } })) })),
    })
    const common = { depth: 0, limit: PER_KIND, sort: '-updatedAt', user, overrideAccess: false } as const
    const [pages, notebooks, days, tasks, weeks, months] = await Promise.all([
      payload.find({ collection: 'note-pages', where: matching(['title', 'plainText']), select: { title: true, icon: true, notebook: true, plainText: true, updatedAt: true }, ...common }),
      payload.find({ collection: 'notebooks', select: { title: true }, pagination: false, user, overrideAccess: false }),
      payload.find({ collection: 'daily-logs', where: matching(['plainText']), select: { date: true, plainText: true, updatedAt: true }, ...common }),
      payload.find({
        collection: 'tasks',
        where: matching(['title', 'plainText']),
        select: { title: true, kind: true, day: true, weekStart: true, plainText: true, updatedAt: true },
        ...common,
      }),
      payload.find({ collection: 'weekly-reviews', where: matching(['plainText']), select: { weekStart: true, plainText: true, updatedAt: true }, ...common }),
      payload.find({ collection: 'monthly-notes', where: matching(['plainText']), select: { month: true, plainText: true, updatedAt: true }, ...common }),
    ])
    const notebookTitles = new Map(notebooks.docs.map((n) => [n.id, n.title]))
    const snippet = (text: string | null | undefined) => snippetAround(text ?? '', q)

    const hits: SearchHit[] = [
      ...pages.docs.map((p): SearchHit => {
        const notebookId = idOf(p.notebook)!
        return {
          key: `page-${p.id}`,
          kind: 'page',
          href: `/notebooks/${notebookId}/${p.id}`,
          title: p.title ?? '',
          icon: p.icon ?? '',
          context: notebookTitles.get(notebookId) ?? '',
          snippet: snippet(p.plainText),
          updatedAt: p.updatedAt,
        }
      }),
      ...days.docs.map((d): SearchHit => ({
        key: `day-${d.id}`,
        kind: 'day',
        href: `/journal/day/${d.date}`,
        title: dayTitle(d.date),
        icon: '',
        context: '日記',
        snippet: snippet(d.plainText),
        updatedAt: d.updatedAt,
      })),
      ...tasks.docs.map((t): SearchHit => {
        const weekly = t.kind === 'weekly' && t.weekStart
        return {
          key: `task-${t.id}`,
          kind: 'task',
          href: weekly ? `/journal/week/${t.weekStart}?task=${t.id}` : `/journal/day/${t.day}?task=${t.id}`,
          title: t.title,
          icon: '',
          context: weekly ? `週待辦 · ${formatWeekRange(t.weekStart!)}` : t.day ? `Important · ${formatDayShort(t.day)}` : '任務',
          snippet: snippet(t.plainText),
          updatedAt: t.updatedAt,
        }
      }),
      ...weeks.docs.map((w): SearchHit => ({
        key: `week-${w.id}`,
        kind: 'week',
        href: `/journal/week/${w.weekStart}`,
        title: `第 ${isoWeek(w.weekStart)} 週（${formatWeekRange(w.weekStart)}）`,
        icon: '',
        context: '週回顧',
        snippet: snippet(w.plainText),
        updatedAt: w.updatedAt,
      })),
      ...months.docs.map((m): SearchHit => {
        const [year, month] = m.month.split('-')
        return {
          key: `month-${m.id}`,
          kind: 'month',
          href: `/journal/${year}/${Number(month)}`,
          title: `${year} 年 ${Number(month)} 月`,
          icon: '',
          context: '月統整',
          snippet: snippet(m.plainText),
          updatedAt: m.updatedAt,
        }
      }),
    ]
    hits.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    return { ok: true, data: hits.slice(0, MAX_HITS) }
  } catch (error) {
    return fail(error)
  }
}
