'use client'

import { ArrowBendUpRight, CalendarBlank, Check, Flag, NotePencil, Plus } from '@phosphor-icons/react'
import { useState, useTransition } from 'react'
import { createTask, moveTaskToNextDay, updateTask } from '@/app/(frontend)/journal-actions'
import { formatDayShort } from '@/lib/day'
import type { TaskItem } from '@/lib/taskItems'
import { MAX_IMPORTANT_PER_DAY, type TaskKind } from '@/lib/tasks'
import { useTaskPeek } from '@/lib/useTaskPeek'

type Props = {
  kind: TaskKind
  /** The day (Important) or any day in the week (weekly) new tasks go to. */
  scope: string
  items: TaskItem[]
  /** Day used to flag overdue due dates. */
  today: string
  addLabel?: string
  compact?: boolean
}

/** Important 1·2·3 or a week's to-dos: tick, open, add, migrate. */
export function TaskList({ kind, scope, items: initial, today, addLabel, compact = false }: Props) {
  const [items, setItems] = useState(initial)
  const [lastInitial, setLastInitial] = useState(initial)
  if (initial !== lastInitial) {
    setLastInitial(initial)
    setItems(initial)
  }
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const { open } = useTaskPeek()

  const active = items.filter((t) => t.status !== 'migrated')
  const full = kind === 'important' && active.length >= MAX_IMPORTANT_PER_DAY

  const toggle = (task: TaskItem) => {
    const status = task.status === 'done' ? 'todo' : 'done'
    setItems((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)))
    startTransition(async () => {
      const result = await updateTask(task.id, { status })
      setError(result.ok ? null : result.error)
    })
  }

  const migrate = (task: TaskItem) =>
    startTransition(async () => {
      const result = await moveTaskToNextDay(task.id)
      setError(result.ok ? null : result.error)
      if (result.ok) setItems((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: 'migrated' } : t)))
    })

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const title = draft.trim()
    if (!title || full) return
    startTransition(async () => {
      const result = await createTask(
        kind === 'important' ? { kind, title, day: scope } : { kind, title, weekStart: scope },
      )
      if (!result.ok) {
        setError(result.error)
        return
      }
      setError(null)
      setDraft('')
      if (result.data) setItems((prev) => [...prev, result.data!])
    })
  }

  const numberOf = (id: number) => active.findIndex((t) => t.id === id) + 1
  return (
    <div>
      {items.length > 0 && (
        <ul className={compact ? 'divide-y divide-line' : 'grid gap-1'}>
          {items.map((task) => {
            const migrated = task.status === 'migrated'
            const done = task.status === 'done'
            return (
              <li key={task.id} className="group flex items-start gap-3 py-2">
                {kind === 'important' && (
                  <span className="mt-0.5 w-4 shrink-0 text-right font-mono text-sm text-muted">
                    {migrated ? '>' : numberOf(task.id)}
                  </span>
                )}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={`${done ? '標示未完成' : '完成'}：${task.title}`}
                  disabled={migrated}
                  onClick={() => toggle(task)}
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                    done ? 'border-ink-strong bg-ink-strong text-white' : 'border-line-strong bg-surface hover:border-ink'
                  } ${migrated ? 'opacity-40' : ''}`}
                >
                  {done && <Check size={12} weight="bold" />}
                </button>
                <button
                  type="button"
                  onClick={() => open(task.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span
                    className={`block break-words ${
                      done || migrated ? 'text-muted line-through decoration-line-strong' : 'text-ink-strong'
                    } ${kind === 'important' && !compact ? 'font-medium' : ''}`}
                  >
                    {task.title}
                  </span>
                  <TaskChips task={task} today={today} />
                </button>
                {kind === 'important' && task.status === 'todo' && (
                  <button
                    type="button"
                    onClick={() => migrate(task)}
                    disabled={pending}
                    title="移到明天"
                    aria-label={`把「${task.title}」移到明天`}
                    className="rounded-md p-1 text-muted transition-colors hover:bg-sunken hover:text-ink-strong md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  >
                    <ArrowBendUpRight size={16} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {!full && (
        <form onSubmit={add} className="mt-1 flex items-center gap-3 py-1.5">
          {kind === 'important' && <span className="w-4 shrink-0 text-right font-mono text-sm text-faint">{active.length + 1}</span>}
          <Plus size={16} className="shrink-0 text-faint" aria-hidden />
          <label htmlFor={`add-${kind}-${scope}`} className="sr-only">
            {addLabel ?? '新增'}
          </label>
          <input
            id={`add-${kind}-${scope}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={addLabel ?? '新增'}
            disabled={pending}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent py-0.5 text-ink-strong outline-none placeholder:text-muted"
          />
        </form>
      )}

      {error && (
        <p role="alert" className="mt-1 text-sm text-red-ink">
          {error}
        </p>
      )}
    </div>
  )
}

export function TaskChips({ task, today }: { task: TaskItem; today: string }) {
  const overdue = task.dueDate && task.status === 'todo' && task.dueDate < today
  if (!task.dueDate && !task.startDate && !task.hasBody) return null
  return (
    <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
      {task.dueDate && (
        <span className={`inline-flex items-center gap-1 ${overdue ? 'font-medium text-red-ink' : ''}`}>
          <Flag size={12} />
          {overdue ? '已過期 ' : '到期 '}
          {formatDayShort(task.dueDate)}
        </span>
      )}
      {task.startDate && task.endDate && (
        <span className="inline-flex items-center gap-1">
          <CalendarBlank size={12} />
          {formatDayShort(task.startDate)}–{formatDayShort(task.endDate)}
        </span>
      )}
      {task.hasBody && (
        <span className="inline-flex items-center gap-1">
          <NotePencil size={12} />
          有細項
        </span>
      )}
    </span>
  )
}
