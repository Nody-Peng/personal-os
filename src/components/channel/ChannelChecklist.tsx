'use client'

import { Check } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { saveChannelWeek } from '@/app/(frontend)/journal-actions'
import { MAX_CHANNEL_NOTE, doneCount, type ChannelEntry, type ChannelWeek } from '@/lib/channel'
import { markSaved, rememberLocal, useRenderStamp, withLocal } from '@/lib/noteCache'
import type { Weekday } from '@/lib/day'
import { CHANNEL_GROUPS, CHANNEL_SLOTS, type ChannelSlot } from '@/lib/options'
import { useSaveQueue } from '@/lib/useSaveQueue'

type Props = {
  monday: string
  initial: ChannelWeek
  /** The server render's stamp: back/forward then keeps the latest edits (lib/noteCache.ts). */
  renderedAt: number
  /** Marks that day's AI 報報 (when the week shown is the current one). */
  today?: Weekday | null
}

const TEXT_SAVE_DELAY = 800
const EMPTY: ChannelEntry = { done: false, note: '' }

/** The week's channel output: a daily AI 報報, 2 videos, 4 shorts, each a tick plus a line of text. */
export function ChannelChecklist({ monday, initial, renderedAt, today = null }: Props) {
  const key = `channel:${monday}`
  const [week, setWeek] = useState(() => withLocal(key, initial, renderedAt))
  useRenderStamp(key, renderedAt)
  const { enqueue, error } = useSaveQueue()
  const latest = useRef(week)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Every save sends the whole week as it is by then, so the queue never writes an older state.
  const save = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    enqueue(async () => {
      const sent = latest.current
      const result = await saveChannelWeek(monday, sent)
      if (result.ok) markSaved(key, sent)
      return result
    })
  }, [enqueue, key, monday])

  const update = useCallback(
    (slot: ChannelSlot, patch: Partial<ChannelEntry>, { typing = false } = {}) => {
      const next = { ...latest.current, [slot]: { ...EMPTY, ...latest.current[slot], ...patch } }
      latest.current = next
      setWeek(next)
      rememberLocal(key, next)
      if (!typing) return save()
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(save, TEXT_SAVE_DELAY)
    },
    [key, save],
  )

  const flush = useCallback(() => {
    if (timer.current) save()
  }, [save])

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [flush])

  return (
    <div>
      <Progress done={doneCount(week)} total={CHANNEL_SLOTS.length} />
      <div className="mt-4 grid gap-5 md:grid-cols-3 md:gap-6">
        {CHANNEL_GROUPS.map((group) => {
          const slots = CHANNEL_SLOTS.filter((s) => s.group === group.value)
          const count = slots.filter((s) => week[s.value]?.done).length
          return (
            <div key={group.value}>
              <p className="mb-2 flex items-baseline justify-between text-sm">
                <span className="font-semibold text-ink-strong">{group.label}</span>
                <span className="font-mono text-xs text-muted">
                  {count}/{slots.length}
                </span>
              </p>
              <div className="grid gap-2">
                {slots.map((s) => (
                  <Slot
                    key={s.value}
                    label={s.label}
                    isToday={'weekday' in s && s.weekday === today}
                    entry={week[s.value] ?? EMPTY}
                    onToggle={() => update(s.value, { done: !week[s.value]?.done })}
                    onNote={(note) => update(s.value, { note }, { typing: true })}
                    onBlur={flush}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-ink">
          {error}
        </p>
      )}
    </div>
  )
}

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken"
        role="progressbar"
        aria-label="本週完成度"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <span className="shrink-0 font-mono text-xs text-muted">{done === total ? '全部完成' : `${done}/${total}`}</span>
    </div>
  )
}

type SlotProps = {
  label: string
  isToday: boolean
  entry: ChannelEntry
  onToggle: () => void
  onNote: (note: string) => void
  onBlur: () => void
}

function Slot({ label, isToday, entry, onToggle, onNote, onBlur }: SlotProps) {
  const { done, note } = entry
  return (
    <div
      className={`flex items-center gap-1 rounded-lg border pr-3 transition-colors ${
        done ? 'border-green-ink/30 bg-green-soft' : isToday ? 'border-accent/40' : 'border-line'
      }`}
    >
      <button
        type="button"
        aria-pressed={done}
        aria-label={`${label}${done ? '：已完成' : ''}`}
        onClick={onToggle}
        className="grid size-11 shrink-0 place-items-center rounded-lg active:scale-95"
      >
        <span className={`flex size-5 items-center justify-center rounded-full border ${done ? 'border-green-ink bg-green-ink text-on-ink' : 'border-line-strong'}`}>
          {done && <Check size={12} weight="bold" className="check-in" />}
        </span>
      </button>
      <label className="min-w-0 flex-1 py-1.5">
        <span className={`flex items-center gap-1.5 text-xs ${done ? 'text-green-ink' : 'text-muted'}`}>
          {label}
          {isToday && <span className="tag bg-accent-soft text-accent">今天</span>}
        </span>
        <input
          value={note}
          maxLength={MAX_CHANNEL_NOTE}
          onChange={(e) => onNote(e.target.value)}
          onBlur={onBlur}
          placeholder="寫點什麼…"
          className="w-full truncate bg-transparent text-sm text-ink-strong outline-none placeholder:text-faint"
        />
      </label>
    </div>
  )
}
