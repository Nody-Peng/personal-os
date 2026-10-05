import { BlockEditor } from '@/components/editor/BlockEditor'
import { addDays } from '@/lib/day'
import { renderStamp } from '@/lib/notes'
import {
  getHabits,
  getIdeas,
  getImportantTasks,
  getLogsBetween,
  getSettings,
  getWeekReview,
  getWeeklyTasks,
  habitIdsOf,
  habitsForPeriod,
} from '@/lib/queries'
import type { Session } from '@/lib/session'
import { WeekThemePicker } from './WeekThemePicker'

/**
 * The Sunday summary of a week: numbers, a free-form review and next
 * week's theme. Shown on the week note and on Sunday's day page; both
 * edit the same week-note document.
 */
export async function WeekReview({ session, monday }: { session: Session; monday: string }) {
  const sunday = addDays(monday, 6)
  const nextMonday = addDays(monday, 7)
  const [weekly, important, logs, review, nextReview, ideas, settings, allHabits] = await Promise.all([
    getWeeklyTasks(session, [monday]),
    getImportantTasks(session, monday, sunday),
    getLogsBetween(session, monday, sunday),
    getWeekReview(session, monday),
    getWeekReview(session, nextMonday),
    getIdeas(session),
    getSettings(session),
    getHabits(session, true),
  ])

  const activeImportant = important.filter((t) => t.status !== 'migrated')
  const habits = habitsForPeriod(allHabits, logs)
  const stats = [
    { label: 'Important 完成', value: `${activeImportant.filter((t) => t.status === 'done').length}/${activeImportant.length}` },
    { label: '待辦完成', value: `${weekly.filter((t) => t.status === 'done').length}/${weekly.length}` },
    {
      label: '托福',
      value: `${(logs.reduce((s, l) => s + (l.toeflMinutes ?? 0), 0) / 60).toFixed(1)}/${settings.toeflHoursTarget} 小時`,
    },
    ...habits.map((h) => ({
      label: h.name,
      value: `${logs.filter((l) => habitIdsOf(l).includes(h.id)).length}/${h.weeklyTarget} 天`,
    })),
  ]
  const themeOptions = ideas
    .filter((i) => i.status === 'inbox' || i.status === 'selected')
    .map((i) => ({ id: i.id, title: i.title, total: i.total ?? 0 }))
  const nextTheme = nextReview?.theme
  const nextThemeId = typeof nextTheme === 'number' ? nextTheme : (nextTheme?.id ?? null)

  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0 rounded-lg bg-sunken px-3 py-2.5">
            <dt className="truncate text-xs text-muted">{s.label}</dt>
            <dd className="mt-0.5 font-semibold text-ink-strong">{s.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5">
        <BlockEditor
          key={`week-${monday}`}
          target={{ kind: 'week', monday }}
          initial={Array.isArray(review?.review) ? review.review : null}
          renderedAt={renderStamp()}
          placeholder="這週做得好的、斷掉的那天和原因、下週要調整什麼…"
        />
      </div>
      <div className="mt-5 border-t border-line pt-5">
        <WeekThemePicker
          monday={nextMonday}
          label="下週主題（23:00–24:00）"
          hint="下週一起自動成為本週主題；依想學清單的總分排序。"
          options={themeOptions}
          initialTheme={nextThemeId}
          initialReason={nextReview?.themeReason ?? ''}
        />
      </div>
    </div>
  )
}
