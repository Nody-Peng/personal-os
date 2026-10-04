import type { Metadata } from 'next'
import { AddScoreForm } from '@/components/toefl/AddScoreForm'
import { ScoreChart, type ChartScore } from '@/components/toefl/ScoreChart'
import { ScoreList } from '@/components/toefl/ScoreList'
import { WeeklyHours } from '@/components/toefl/WeeklyHours'
import { addDays, daysBetween, logicalDay } from '@/lib/day'
import { getLogsBetween, getScores, getSettings, minutesPerWeek, planWeek } from '@/lib/queries'
import { requireSession } from '@/lib/session'
import { cefrOf, formatBand, legacyRangeOf } from '@/lib/toefl'

export const metadata: Metadata = { title: '托福' }
export const dynamic = 'force-dynamic'

const DEFAULT_PLAN_WEEKS = 13

export default async function ToeflPage() {
  const session = await requireSession('/toefl')
  const today = logicalDay()
  const [settings, scores] = await Promise.all([getSettings(session), getScores(session)])

  const examWeek = settings.examDate ? daysBetween(settings.planStart, settings.examDate) / 7 : DEFAULT_PLAN_WEEKS
  const weekCount = Math.max(DEFAULT_PLAN_WEEKS, Math.ceil(examWeek))
  const logs = await getLogsBetween(session, settings.planStart, addDays(settings.planStart, weekCount * 7 - 1))
  const currentWeek = planWeek(settings.planStart, today)

  const chartScores: ChartScore[] = scores.map((s) => ({
    id: s.id,
    date: s.date,
    week: daysBetween(settings.planStart, s.date) / 7,
    type: s.type,
    bands: {
      overall: s.overall ?? null,
      reading: s.reading ?? null,
      listening: s.listening ?? null,
      speaking: s.speaking ?? null,
      writing: s.writing ?? null,
    },
  }))

  // Scores come newest first.
  const overalls = scores.filter((s) => s.overall != null)
  const latest = overalls[0]?.overall ?? null
  const previous = overalls[1]?.overall ?? null
  const nextCheckpoint = settings.checkpoints.find((c) => c.week >= currentWeek) ?? null

  return (
    <>
      <header className="mb-6 md:mb-8">
        <p className="font-mono text-xs text-muted">
          {formatBand(settings.baselineBand)} → {formatBand(settings.targetBand)} · {cefrOf(settings.baselineBand)} →{' '}
          {cefrOf(settings.targetBand)}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-strong md:text-4xl">托福進度</h1>
      </header>

      <dl className="rise mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <Stat label="最新總分" note={latest !== null ? `${cefrOf(latest)} · 舊制約 ${legacyRangeOf(latest)}` : '四科都考才有總分'}>
          {formatBand(latest)}
          {latest !== null && previous !== null && latest !== previous && (
            <span className={`ml-2 text-sm font-medium ${latest > previous ? 'text-green-ink' : 'text-red-ink'}`}>
              {latest > previous ? '+' : '−'}
              {Math.abs(latest - previous).toFixed(1)}
            </span>
          )}
        </Stat>
        <Stat label="距離目標" note={`目標 ${formatBand(settings.targetBand)}（${cefrOf(settings.targetBand)}）`}>
          {latest !== null ? `${Math.max(0, settings.targetBand - latest).toFixed(1)} 級` : '—'}
        </Stat>
        <Stat
          label="下一個檢查點"
          className="col-span-2 md:col-span-1"
          note={
            nextCheckpoint
              ? `第 ${nextCheckpoint.week} 週${nextCheckpoint.week > currentWeek ? `，還有 ${nextCheckpoint.week - currentWeek} 週` : ''}`
              : undefined
          }
        >
          {nextCheckpoint ? `≥ ${formatBand(nextCheckpoint.target)}` : '—'}
        </Stat>
      </dl>

      <section className="card rise mb-4 p-5 md:p-6" style={{ '--i': 1 } as React.CSSProperties}>
        <h2 className="mb-4 font-semibold text-ink-strong">級分趨勢</h2>
        <ScoreChart
          scores={chartScores}
          baseline={settings.baselineBand}
          target={settings.targetBand}
          endWeek={examWeek}
          checkpoints={settings.checkpoints}
        />
      </section>

      <section className="card rise mb-4 p-5 md:p-6" style={{ '--i': 2 } as React.CSSProperties}>
        <h2 className="mb-4 font-semibold text-ink-strong">每週練習時數</h2>
        <WeeklyHours
          weeks={minutesPerWeek(logs, settings.planStart, weekCount)}
          currentWeek={currentWeek}
          targetHours={settings.toeflHoursTarget}
        />
      </section>

      <section className="card rise mb-4 p-5 md:p-6" style={{ '--i': 3 } as React.CSSProperties}>
        <h2 className="mb-4 font-semibold text-ink-strong">新增分數</h2>
        <AddScoreForm today={today} />
      </section>

      <section className="card rise p-5 md:p-6" style={{ '--i': 4 } as React.CSSProperties}>
        <h2 className="mb-2 font-semibold text-ink-strong">所有紀錄</h2>
        <ScoreList
          rows={scores.map((s) => ({
            id: s.id,
            date: s.date,
            type: s.type,
            source: s.source ?? null,
            overall: s.overall ?? null,
            reading: s.reading ?? null,
            listening: s.listening ?? null,
            speaking: s.speaking ?? null,
            writing: s.writing ?? null,
          }))}
        />
      </section>
    </>
  )
}

function Stat({
  label,
  note,
  className = '',
  children,
}: {
  label: string
  note?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`card p-4 md:p-5 ${className}`}>
      <dt className="label">{label}</dt>
      <dd className="mt-1">
        <span className="block text-3xl font-semibold tracking-tight text-ink-strong">{children}</span>
        {note && <span className="mt-1 block text-xs text-muted">{note}</span>}
      </dd>
    </div>
  )
}
