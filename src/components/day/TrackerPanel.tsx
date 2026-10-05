'use client'

import { ArrowRight, Check, Minus, Plus, SlidersHorizontal } from '@phosphor-icons/react'
import Link from 'next/link'
import { useState } from 'react'
import { HabitIcon } from '@/components/habits/HabitIcon'
import { HabitsEditor } from '@/components/habits/HabitsEditor'
import type { HabitItem } from '@/lib/habits'
import { TOEFL_SKILLS, type ToeflSkill } from '@/lib/options'
import { useDayLog } from './DayLogProvider'

type Props = {
  planLabel: string
  planSkill: ToeflSkill | null
  themeTitle: string | null
  weekHref: string
  habits: HabitItem[]
  allHabits: HabitItem[]
}

/** Habits, TOEFL minutes, theme time and energy for the day. */
export function TrackerPanel({ planLabel, planSkill, themeTitle, weekHref, habits, allHabits }: Props) {
  const { log, commit } = useDayLog()
  const [editing, setEditing] = useState(false)

  const toggleHabit = (id: number) =>
    commit({ habitsDone: log.habitsDone.includes(id) ? log.habitsDone.filter((h) => h !== id) : [...log.habitsDone, id] })

  const addToefl = (delta: number) => {
    const patch: Parameters<typeof commit>[0] = { toeflMinutes: Math.max(0, log.toeflMinutes + delta) }
    // The first minutes of the day default to tonight's planned skill.
    if (delta > 0 && log.toeflSkills.length === 0 && planSkill) patch.toeflSkills = [planSkill]
    commit(patch)
  }

  const toggleSkill = (skill: ToeflSkill) => {
    const has = log.toeflSkills.includes(skill)
    commit({ toeflSkills: has ? log.toeflSkills.filter((s) => s !== skill) : [...log.toeflSkills, skill] })
  }

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] md:gap-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-strong">每日習慣</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-sunken hover:text-ink-strong"
          >
            <SlidersHorizontal size={14} />
            調整
          </button>
        </div>
        {habits.length ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
            {habits.map((h) => (
              <Habit key={h.id} habit={h} done={log.habitsDone.includes(h.id)} onToggle={() => toggleHabit(h.id)} />
            ))}
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="w-full rounded-lg border border-dashed border-line-strong px-3 py-4 text-sm text-muted hover:bg-sunken">
            新增每天要做的事（最多 4 項）
          </button>
        )}
        {editing && <HabitsEditor habits={allHabits} onClose={() => setEditing(false)} />}
      </div>

      <div className="md:border-x md:border-line md:px-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink-strong">托福</p>
          <span className="tag bg-accent-soft text-accent">今晚：{planLabel}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="flex items-baseline gap-1.5">
            <span className="text-4xl font-semibold tracking-tighter text-ink-strong">{log.toeflMinutes}</span>
            <span className="text-sm text-muted">分鐘</span>
          </p>
          <div className="flex gap-1.5">
            <button type="button" className="btn btn-quiet px-2.5" onClick={() => addToefl(-15)} disabled={log.toeflMinutes === 0} aria-label="減 15 分鐘">
              <Minus size={14} weight="bold" />
            </button>
            {[15, 30].map((m) => (
              <button key={m} type="button" className="btn btn-primary px-2.5" onClick={() => addToefl(m)} aria-label={`加 ${m} 分鐘`}>
                <Plus size={14} weight="bold" />
                {m}
              </button>
            ))}
          </div>
        </div>
        <div role="group" aria-label="練了什麼" className="mt-3 flex flex-wrap gap-1.5">
          {TOEFL_SKILLS.map(({ value, label }) => {
            const on = log.toeflSkills.includes(value)
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                onClick={() => toggleSkill(value)}
                className={`rounded-full border px-2.5 py-0.5 text-sm transition-colors ${
                  on ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-line-strong text-ink hover:bg-sunken'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm text-muted" title={themeTitle ?? undefined}>
              本週主題：<span className="text-ink-strong">{themeTitle ?? '還沒選'}</span>
            </p>
            <Link href={weekHref} className="flex shrink-0 items-center gap-0.5 text-xs text-accent hover:underline">
              {themeTitle ? '調整' : '選主題'}
              <ArrowRight size={12} />
            </Link>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold tracking-tight text-ink-strong">{log.themeMinutes}</span>
              <span className="text-sm text-muted">分鐘</span>
            </p>
            <div className="flex gap-1.5">
              <button type="button" className="btn btn-quiet px-2.5" onClick={() => commit({ themeMinutes: Math.max(0, log.themeMinutes - 30) })} disabled={log.themeMinutes === 0} aria-label="主題減 30 分鐘">
                <Minus size={14} weight="bold" />
              </button>
              <button type="button" className="btn btn-quiet px-2.5" onClick={() => commit({ themeMinutes: log.themeMinutes + 30 })} aria-label="主題加 30 分鐘">
                <Plus size={14} weight="bold" />
                30
              </button>
            </div>
          </div>
        </div>
        <div>
          <p className="text-sm text-muted" id="energy-label">
            精力
          </p>
          <div role="radiogroup" aria-labelledby="energy-label" className="mt-1 grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => {
              const on = log.energy === n
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => commit({ energy: on ? null : n })}
                  className={`h-9 rounded-md border text-sm font-medium transition-colors ${
                    on ? 'border-ink-strong bg-ink-strong text-on-ink' : 'border-line-strong text-ink hover:bg-sunken'
                  }`}
                >
                  {n}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Habit({ habit, done, onToggle }: { habit: HabitItem; done: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={done}
      aria-label={habit.name}
      onClick={onToggle}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors active:scale-[0.98] ${
        done ? 'border-green-ink/30 bg-green-soft' : 'border-line hover:bg-sunken'
      }`}
    >
      <HabitIcon icon={habit.icon} size={20} className={done ? 'text-green-ink' : 'text-ink'} />
      <span className={`min-w-0 flex-1 truncate text-sm font-medium ${done ? 'text-green-ink' : 'text-ink-strong'}`}>{habit.name}</span>
      <span className={`flex size-5 items-center justify-center rounded-full border ${done ? 'border-green-ink bg-green-ink text-on-ink' : 'border-line-strong'}`}>
        {done && <Check size={12} weight="bold" className="check-in" />}
      </span>
    </button>
  )
}
