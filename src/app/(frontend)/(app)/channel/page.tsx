import { CaretLeft, CaretRight } from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChannelChecklist } from '@/components/channel/ChannelChecklist'
import { BlockEditor } from '@/components/editor/BlockEditor'
import { doneCount } from '@/lib/channel'
import { addDays, formatWeekRange, isDay, isoWeek, isoWeekYear, logicalDay, weekStart, weekdayOf } from '@/lib/day'
import { renderStamp } from '@/lib/notes'
import { CHANNEL_SLOTS } from '@/lib/options'
import { getChannelWeeks, getWeekReview } from '@/lib/queries'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: '頻道' }
export const dynamic = 'force-dynamic'

/** The week list: a couple of weeks ahead (to plan) and the last few. */
const AHEAD_WEEKS = 2
const PAST_WEEKS = 11

const weekHref = (monday: string, current: string) => (monday === current ? '/channel' : `/channel?week=${monday}`)

export default async function ChannelPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week: asked } = await searchParams
  const session = await requireSession(asked ? `/channel?week=${asked}` : '/channel')
  const today = logicalDay()
  const current = weekStart(today)
  const monday = isDay(asked) ? weekStart(asked) : current

  const history = Array.from({ length: AHEAD_WEEKS + 1 + PAST_WEEKS }, (_, i) => addDays(current, 7 * (AHEAD_WEEKS - i)))
  const [weeks, review] = await Promise.all([
    getChannelWeeks(session, history.includes(monday) ? history : [monday, ...history]),
    getWeekReview(session, monday),
  ])
  const renderedAt = renderStamp()
  const total = CHANNEL_SLOTS.length

  return (
    <>
      <header className="mb-6 md:mb-8">
        <p className="font-mono text-xs text-muted">
          {isoWeekYear(monday)} 第 {isoWeek(monday)} 週 · {formatWeekRange(monday)}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-strong md:text-4xl">頻道</h1>
        <nav aria-label="切換週" className="mt-3 flex items-center gap-2 text-sm">
          <Link href={weekHref(addDays(monday, -7), current)} className="btn btn-quiet min-h-10 gap-1 px-3">
            <CaretLeft size={14} />
            上一週
          </Link>
          <Link
            href="/channel"
            aria-current={monday === current ? 'page' : undefined}
            className={`btn min-h-10 px-3 ${monday === current ? 'btn-primary' : 'btn-quiet text-accent'}`}
          >
            本週
          </Link>
          <Link href={weekHref(addDays(monday, 7), current)} className="btn btn-quiet min-h-10 gap-1 px-3">
            下一週
            <CaretRight size={14} />
          </Link>
        </nav>
      </header>

      <section className="card rise p-5 md:p-6">
        <ChannelChecklist key={monday} monday={monday} initial={weeks[monday] ?? {}} renderedAt={renderedAt} today={monday === current ? weekdayOf(today) : null} />
      </section>

      <section className="card rise mt-4 p-5 md:p-6" style={{ '--i': 1 } as React.CSSProperties}>
        <h2 className="mb-3 flex items-baseline gap-2">
          <span className="text-sm font-semibold tracking-wide text-ink-strong">本週筆記</span>
          <span className="text-xs text-muted">選題、靈感、成效、下週要改的</span>
        </h2>
        <BlockEditor
          key={`channel-note-${monday}`}
          target={{ kind: 'channel', monday }}
          initial={Array.isArray(review?.channelNote) ? review.channelNote : null}
          renderedAt={renderedAt}
          placeholder="這週的頻道想記點什麼…"
          allowUploads
        />
      </section>

      <section className="card rise mt-4 p-5 md:p-6" style={{ '--i': 2 } as React.CSSProperties}>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-strong">各週進度</h2>
        <ul className="divide-y divide-line">
          {history.map((m) => {
            const done = doneCount(weeks[m] ?? {})
            return (
              <li key={m}>
                <Link
                  href={weekHref(m, current)}
                  aria-current={m === monday ? 'page' : undefined}
                  className={`-mx-2 flex min-h-11 items-center gap-3 rounded-md px-2 text-sm hover:bg-sunken ${m === monday ? 'bg-sunken' : ''}`}
                >
                  <span className="w-20 shrink-0 font-mono text-xs text-muted md:w-28">
                    {formatWeekRange(m)}
                    {m === current && <span className="ml-1 text-accent">本週</span>}
                  </span>
                  <span className="flex flex-1 gap-1" aria-hidden>
                    {CHANNEL_SLOTS.map((s) => (
                      <span key={s.value} className={`h-2 flex-1 rounded-full ${weeks[m]?.[s.value]?.done ? 'bg-accent' : 'bg-sunken ring-1 ring-line ring-inset'}`} />
                    ))}
                  </span>
                  <span className={`w-12 shrink-0 text-right font-mono text-xs ${done === total ? 'text-accent' : 'text-muted'}`}>
                    {done}/{total}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
