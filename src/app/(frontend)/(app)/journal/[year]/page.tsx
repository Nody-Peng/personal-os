import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { JournalCover } from '@/components/books/BookCover'
import { addDays, daysInMonth, logicalDay, weekStart } from '@/lib/day'
import { getImportantTasks, getJournal, getLogsBetween } from '@/lib/queries'
import { requireSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ year: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year } = await params
  return { title: `${year} 日記本` }
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

export default async function YearPage({ params }: Props) {
  const { year: yearParam } = await params
  if (!/^\d{4}$/.test(yearParam)) notFound()
  const year = Number(yearParam)
  const session = await requireSession(`/journal/${year}`)
  const today = logicalDay()

  const [journal, logs, important] = await Promise.all([
    getJournal(session, year),
    getLogsBetween(session, `${year}-01-01`, `${year}-12-31`),
    getImportantTasks(session, `${year}-01-01`, `${year}-12-31`),
  ])
  const logged = new Set(logs.map((l) => l.date))
  const importantByDay = new Map<string, { done: number; total: number }>()
  for (const t of important) {
    if (!t.day || t.status === 'migrated') continue
    const entry = importantByDay.get(t.day) ?? { done: 0, total: 0 }
    entry.total += 1
    if (t.status === 'done') entry.done += 1
    importantByDay.set(t.day, entry)
  }

  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)

  return (
    <>
      <header className="mb-8 flex items-center gap-5 md:mb-10">
        <div className="w-16 shrink-0 md:w-20">
          <JournalCover
            year={year}
            title={journal?.title ?? `${year} 日記本`}
            coverColor={journal?.coverColor ?? 'navy'}
            pattern={journal?.pattern}
            size="sm"
          />
        </div>
        <div>
          <p className="font-mono text-xs text-muted">
            <Link href="/journal" className="hover:text-ink-strong hover:underline">
              書架
            </Link>
            {` · ${logged.size} 天紀錄`}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-strong md:text-4xl">{journal?.title ?? `${year} 日記本`}</h1>
          {journal?.subtitle && <p className="mt-1 text-muted">{journal.subtitle}</p>}
        </div>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {months.map((month, i) => {
          const first = `${month}-01`
          const length = daysInMonth(month)
          const lead = Array.from({ length: (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7 })
          const days = Array.from({ length }, (_, d) => addDays(first, d))
          const count = days.filter((d) => logged.has(d)).length
          const isCurrent = month === today.slice(0, 7)
          return (
            <li key={month} className="rise" style={{ '--i': i } as React.CSSProperties}>
              <Link
                href={`/journal/${year}/${i + 1}`}
                className={`card block p-4 transition-colors hover:border-line-strong ${isCurrent ? 'ring-1 ring-ink-strong' : ''}`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-ink-strong">{i + 1} 月</span>
                  <span className="text-xs text-muted">{count ? `${count} 天` : ''}</span>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[9px] text-faint" aria-hidden>
                  {WEEKDAYS.map((w) => (
                    <span key={w}>{w}</span>
                  ))}
                  {lead.map((_, k) => (
                    <span key={`lead-${k}`} />
                  ))}
                  {days.map((d) => {
                    const imp = importantByDay.get(d)
                    const allDone = imp && imp.total > 0 && imp.done === imp.total
                    return (
                      <span
                        key={d}
                        title={d}
                        className={`block aspect-square rounded-[3px] ${
                          d === today
                            ? 'bg-accent'
                            : allDone
                              ? 'bg-green-ink/70'
                              : logged.has(d)
                                ? 'bg-ink-strong/25'
                                : 'bg-sunken'
                        }`}
                      />
                    )
                  })}
                </div>
                <p className="sr-only">
                  {i + 1} 月有 {count} 天紀錄，{weekStart(first)} 起
                </p>
              </Link>
            </li>
          )
        })}
      </ul>

      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-ink-strong/25" /> 有紀錄
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-green-ink/70" /> Important 全部完成
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-accent" /> 今天
        </span>
      </p>
    </>
  )
}
