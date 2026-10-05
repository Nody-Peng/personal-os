'use client'

import { Archive, ArrowCounterClockwise, Plus, X } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { createHabit, updateHabit, type HabitPatch } from '@/app/(frontend)/journal-actions'
import { HABIT_ICONS, MAX_ACTIVE_HABITS, type HabitIconKey, type HabitItem } from '@/lib/habits'
import { HabitIcon } from './HabitIcon'

/** Edit the daily habit list: rename, icon, weekly target, archive, add. */
export function HabitsEditor({ habits: initial, onClose }: { habits: HabitItem[]; onClose: () => void }) {
  const router = useRouter()
  const [habits, setHabits] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [draft, setDraft] = useState<{ name: string; icon: HabitIconKey; weeklyTarget: number }>({
    name: '',
    icon: 'drop',
    weeklyTarget: 7,
  })

  const active = habits.filter((h) => h.active)
  const archived = habits.filter((h) => !h.active)
  const full = active.length >= MAX_ACTIVE_HABITS

  const close = useCallback(() => {
    router.refresh()
    onClose()
  }, [router, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  const apply = (id: number, patch: HabitPatch) => {
    const previous = habits
    setHabits((hs) => hs.map((h) => (h.id === id ? { ...h, ...patch } : h)))
    startTransition(async () => {
      const result = await updateHabit(id, patch)
      if (!result.ok) {
        setHabits(previous)
        setError(result.error)
      } else setError(null)
    })
  }

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.name.trim() || full) return
    startTransition(async () => {
      const result = await createHabit(draft)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setError(null)
      setDraft({ name: '', icon: 'drop', weeklyTarget: 7 })
      router.refresh()
      onClose()
    })
  }

  // Portal: the tracker card animates with a transform, which would trap a
  // fixed-position dialog inside it.
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label="調整每日習慣">
      <button type="button" aria-label="關閉" onClick={close} className="absolute inset-0 bg-scrim" />
      <div className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-[0_0_48px_rgba(17,17,17,0.15)] md:rounded-2xl md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink-strong">每日習慣</h2>
            <p className="text-sm text-muted">
              最多 {MAX_ACTIVE_HABITS} 項。封存的習慣會保留過去的紀錄，隨時可以恢復。
            </p>
          </div>
          <button type="button" onClick={close} aria-label="關閉" className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink-strong">
            <X size={18} />
          </button>
        </div>

        <ul className="mt-5 grid gap-3">
          {active.map((h) => (
            <li key={h.id} className="rounded-xl border border-line p-3">
              <div className="flex items-center gap-2">
                <HabitIcon icon={h.icon} size={20} className="shrink-0 text-ink" />
                <label htmlFor={`habit-name-${h.id}`} className="sr-only">
                  名稱
                </label>
                <input
                  id={`habit-name-${h.id}`}
                  defaultValue={h.name}
                  onBlur={(e) => {
                    const name = e.target.value.trim()
                    if (name && name !== h.name) apply(h.id, { name })
                    else e.target.value = h.name
                  }}
                  className="field py-1.5"
                />
                <button
                  type="button"
                  onClick={() => apply(h.id, { active: false })}
                  disabled={pending}
                  title="封存"
                  aria-label={`封存「${h.name}」`}
                  className="shrink-0 rounded-md p-2 text-muted hover:bg-sunken hover:text-ink-strong"
                >
                  <Archive size={18} />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <IconPicker value={h.icon} onChange={(icon) => apply(h.id, { icon })} name={h.name} />
                <TargetPicker value={h.weeklyTarget} onChange={(weeklyTarget) => apply(h.id, { weeklyTarget })} id={`target-${h.id}`} />
              </div>
            </li>
          ))}
        </ul>

        {full ? (
          <p className="mt-4 rounded-lg bg-sunken px-3 py-2.5 text-sm text-muted">已經有 {MAX_ACTIVE_HABITS} 項了。要新增請先封存一項。</p>
        ) : (
          <form onSubmit={add} className="mt-4 rounded-xl border border-dashed border-line-strong p-3">
            <label htmlFor="habit-new" className="label">
              新增習慣
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="habit-new"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="例如：喝水 2000ml"
                className="field py-1.5"
                autoComplete="off"
              />
              <button type="submit" className="btn btn-primary shrink-0" disabled={pending || !draft.name.trim()}>
                <Plus size={16} weight="bold" />
                新增
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <IconPicker value={draft.icon} onChange={(icon) => setDraft((d) => ({ ...d, icon }))} name="新習慣" />
              <TargetPicker value={draft.weeklyTarget} onChange={(weeklyTarget) => setDraft((d) => ({ ...d, weeklyTarget }))} id="target-new" />
            </div>
          </form>
        )}

        {archived.length > 0 && (
          <div className="mt-5">
            <p className="label">已封存</p>
            <ul className="mt-2 divide-y divide-line">
              {archived.map((h) => (
                <li key={h.id} className="flex items-center gap-2 py-2">
                  <HabitIcon icon={h.icon} size={18} className="text-muted" />
                  <span className="flex-1 text-sm text-muted">{h.name}</span>
                  <button
                    type="button"
                    disabled={pending || full}
                    onClick={() => apply(h.id, { active: true })}
                    className="btn px-2 py-1 text-sm text-accent hover:bg-accent-soft"
                  >
                    <ArrowCounterClockwise size={14} />
                    恢復
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-ink">
            {error}
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}

function IconPicker({ value, onChange, name }: { value: HabitIconKey; onChange: (icon: HabitIconKey) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label={`${name}的圖示`} className="flex flex-wrap gap-1">
      {HABIT_ICONS.map((icon) => (
        <button
          key={icon.value}
          type="button"
          role="radio"
          aria-checked={value === icon.value}
          aria-label={icon.label}
          title={icon.label}
          onClick={() => onChange(icon.value)}
          className={`flex size-8 items-center justify-center rounded-md transition-colors ${
            value === icon.value ? 'bg-ink-strong text-on-ink' : 'text-muted hover:bg-sunken hover:text-ink-strong'
          }`}
        >
          <HabitIcon icon={icon.value} size={16} />
        </button>
      ))}
    </div>
  )
}

function TargetPicker({ value, onChange, id }: { value: number; onChange: (n: number) => void; id: string }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-muted">
      每週
      <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))} className="field w-auto py-1 text-sm">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      天
    </label>
  )
}
