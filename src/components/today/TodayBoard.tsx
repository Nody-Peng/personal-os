'use client'

import { ArrowRight, Barbell, Check, Headphones, Minus, Plus } from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { saveDailyLog, type DailyLogPatch } from '@/app/(frontend)/actions'
import { TOEFL_SKILLS, type ToeflSkill } from '@/lib/options'
import { useSaveQueue } from '@/lib/useSaveQueue'
import { WeekStrip, type WeekDay } from './WeekStrip'

export type TodayLog = {
  morningListening: boolean
  gym: boolean
  toeflMinutes: number
  toeflSkills: ToeflSkill[]
  themeMinutes: number
  energy: number | null
  notes: string
  tomorrowTop1: string
}

type Props = {
  day: string
  initial: TodayLog
  top1: string | null
  planLabel: string
  planSkill: ToeflSkill | null
  theme: { title: string } | null
  week: WeekDay[]
  targets: { toeflHours: number; gym: number }
}

const TEXT_SAVE_DELAY = 800

export function TodayBoard({ day, initial, top1, planLabel, planSkill, theme, week, targets }: Props) {
  const [log, setLog] = useState<TodayLog>(initial)
  const { enqueue, status, error, savedAt } = useSaveQueue()
  const textTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingText = useRef<DailyLogPatch>({})

  const commit = (patch: DailyLogPatch) => {
    setLog((prev) => ({ ...prev, ...patch }))
    enqueue(() => saveDailyLog(day, patch))
  }

  const flushText = () => {
    if (textTimer.current) clearTimeout(textTimer.current)
    textTimer.current = null
    const patch = pendingText.current
    pendingText.current = {}
    if (Object.keys(patch).length) enqueue(() => saveDailyLog(day, patch))
  }

  const editText = (patch: Pick<DailyLogPatch, 'notes' | 'tomorrowTop1'>) => {
    setLog((prev) => ({ ...prev, ...patch }))
    pendingText.current = { ...pendingText.current, ...patch }
    if (textTimer.current) clearTimeout(textTimer.current)
    textTimer.current = setTimeout(flushText, TEXT_SAVE_DELAY)
  }

  // Don't lose a half-typed note when the tab is closed or hidden.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flushText()
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  })

  const addToefl = (delta: number) => {
    const toeflMinutes = Math.max(0, log.toeflMinutes + delta)
    const patch: DailyLogPatch = { toeflMinutes }
    // The first minutes of the day default to tonight's planned skill.
    if (delta > 0 && log.toeflSkills.length === 0 && planSkill) patch.toeflSkills = [planSkill]
    commit(patch)
  }

  const toggleSkill = (skill: ToeflSkill) => {
    const has = log.toeflSkills.includes(skill)
    commit({ toeflSkills: has ? log.toeflSkills.filter((s) => s !== skill) : [...log.toeflSkills, skill] })
  }

  const liveWeek = week.map((d) =>
    d.date === day
      ? { ...d, listening: log.morningListening, gym: log.gym, toeflMinutes: log.toeflMinutes }
      : d,
  )

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-6 md:gap-4">
      {/* Today's one thing, written last night */}
      <section className="card rise col-span-2 p-5 md:col-span-6 md:p-6" style={{ '--i': 0 } as React.CSSProperties}>
        <p className="label">今天最重要的一件事</p>
        {top1 ? (
          <p className="mt-1.5 text-xl font-semibold tracking-tight text-ink-strong md:text-2xl">{top1}</p>
        ) : (
          <p className="mt-1.5 text-muted">昨晚沒有寫。睡前在下方「關機儀式」填好明天的。</p>
        )}
      </section>

      <HabitTile
        className="md:col-span-2 md:col-start-5 md:row-start-2"
        index={1}
        label="早上聽英文"
        hint="07:20–08:10"
        Icon={Headphones}
        done={log.morningListening}
        onToggle={() => commit({ morningListening: !log.morningListening })}
      />
      <HabitTile
        className="md:col-span-2 md:col-start-5 md:row-start-3"
        index={2}
        label="健身"
        hint="下班後"
        Icon={Barbell}
        done={log.gym}
        onToggle={() => commit({ gym: !log.gym })}
      />

      {/* TOEFL minutes */}
      <section
        className="card rise col-span-2 flex flex-col p-5 md:col-span-4 md:col-start-1 md:row-span-2 md:row-start-2 md:p-6"
        style={{ '--i': 3 } as React.CSSProperties}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-ink-strong">托福</h2>
          <span className="tag bg-accent-soft text-accent">今晚：{planLabel}</span>
        </div>
        <p className="mt-4 flex items-baseline gap-2">
          <span className="text-6xl font-semibold tracking-tighter text-ink-strong">{log.toeflMinutes}</span>
          <span className="text-muted">分鐘</span>
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          <button type="button" className="btn btn-quiet" onClick={() => addToefl(-15)} disabled={log.toeflMinutes === 0} aria-label="減 15 分鐘">
            <Minus size={16} weight="bold" />
            15
          </button>
          {[15, 30, 60].map((m) => (
            <button key={m} type="button" className="btn btn-primary" onClick={() => addToefl(m)} aria-label={`加 ${m} 分鐘`}>
              <Plus size={16} weight="bold" />
              {m}
            </button>
          ))}
        </div>
        <div role="group" aria-labelledby="skills-label" className="mt-5 md:mt-auto md:pt-6">
          <p id="skills-label" className="label mb-2">
            練了什麼
          </p>
          <div className="flex flex-wrap gap-2">
            {TOEFL_SKILLS.map(({ value, label }) => {
              const on = log.toeflSkills.includes(value)
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleSkill(value)}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    on
                      ? 'border-accent bg-accent-soft font-medium text-accent'
                      : 'border-line-strong bg-surface text-ink hover:bg-sunken'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* This week's theme */}
      <section className="card rise col-span-2 p-5 md:col-span-3 md:p-6" style={{ '--i': 4 } as React.CSSProperties}>
        <div className="flex items-center justify-between gap-3">
          <p className="label">本週主題 · 23:00–24:00</p>
          <Link href="/ideas" className="flex items-center gap-1 text-sm text-accent hover:underline">
            {theme ? '換主題' : '去選一個'}
            <ArrowRight size={14} />
          </Link>
        </div>
        <p className="mt-1.5 truncate text-lg font-semibold text-ink-strong">{theme?.title ?? '還沒選主題'}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tracking-tight text-ink-strong">{log.themeMinutes}</span>
            <span className="text-sm text-muted">分鐘</span>
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-quiet" onClick={() => commit({ themeMinutes: Math.max(0, log.themeMinutes - 30) })} disabled={log.themeMinutes === 0} aria-label="減 30 分鐘">
              <Minus size={16} weight="bold" />
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => commit({ themeMinutes: log.themeMinutes + 30 })} aria-label="加 30 分鐘">
              <Plus size={16} weight="bold" />
              30
            </button>
          </div>
        </div>
      </section>

      {/* Energy */}
      <section className="card rise col-span-2 p-5 md:col-span-3 md:p-6" style={{ '--i': 5 } as React.CSSProperties}>
        <p className="label" id="energy-label">今天的精力</p>
        <div role="radiogroup" aria-labelledby="energy-label" className="mt-3 grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => {
            const on = log.energy === n
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => commit({ energy: on ? null : n })}
                className={`h-11 rounded-md border text-base font-medium transition-colors ${
                  on ? 'border-ink-strong bg-ink-strong text-white' : 'border-line-strong bg-surface text-ink hover:bg-sunken'
                }`}
              >
                {n}
              </button>
            )
          })}
        </div>
        <p className="mt-2 flex justify-between text-xs text-muted">
          <span>很累</span>
          <span>很有精神</span>
        </p>
      </section>

      {/* Shutdown ritual */}
      <section className="card rise col-span-2 p-5 md:col-span-6 md:p-6" style={{ '--i': 6 } as React.CSSProperties}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-ink-strong">關機儀式</h2>
          <SaveIndicator status={status} error={error} savedAt={savedAt} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="notes" className="label">三行筆記</label>
            <textarea
              id="notes"
              rows={3}
              className="field resize-none"
              value={log.notes}
              onChange={(e) => editText({ notes: e.target.value })}
              onBlur={flushText}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="top1" className="label">明天最重要的一件事</label>
            <input
              id="top1"
              className="field"
              value={log.tomorrowTop1}
              onChange={(e) => editText({ tomorrowTop1: e.target.value })}
              onBlur={flushText}
            />
            <p className="text-xs text-muted">明天早上會顯示在這一頁最上方。</p>
          </div>
        </div>
      </section>

      <section className="card rise col-span-2 p-5 md:col-span-6 md:p-6" style={{ '--i': 7 } as React.CSSProperties}>
        <WeekStrip days={liveWeek} today={day} targets={targets} />
      </section>
    </div>
  )
}

function HabitTile({
  className,
  index,
  label,
  hint,
  Icon,
  done,
  onToggle,
}: {
  className: string
  index: number
  label: string
  hint: string
  Icon: typeof Headphones
  done: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={done}
      aria-label={label}
      onClick={onToggle}
      style={{ '--i': index } as React.CSSProperties}
      className={`rise col-span-1 flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-colors active:scale-[0.98] md:p-5 ${
        done ? 'border-green-ink/30 bg-green-soft' : 'border-line bg-surface hover:bg-sunken'
      } ${className}`}
    >
      <span className="flex w-full items-center justify-between">
        <Icon size={24} className={done ? 'text-green-ink' : 'text-ink'} />
        <span
          className={`flex size-6 items-center justify-center rounded-full border ${
            done ? 'border-green-ink bg-green-ink text-white' : 'border-line-strong'
          }`}
        >
          {done && <Check size={14} weight="bold" />}
        </span>
      </span>
      <span>
        <span className={`block font-semibold ${done ? 'text-green-ink' : 'text-ink-strong'}`}>{label}</span>
        <span className="block text-xs text-muted">{done ? '完成' : hint}</span>
      </span>
    </button>
  )
}

function SaveIndicator({ status, error, savedAt }: { status: string; error: string | null; savedAt: Date | null }) {
  if (status === 'error') return <p role="alert" className="text-sm text-red-ink">{error}</p>
  if (status === 'saving') return <p className="text-sm text-muted">儲存中…</p>
  if (status === 'saved' && savedAt) {
    const time = savedAt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
    return <p className="text-sm text-muted">已儲存 {time}</p>
  }
  return <p className="text-sm text-muted">自動儲存</p>
}
