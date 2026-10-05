'use client'

import { ArrowBendUpRight, Check, Trash, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { deleteTask, getTask, moveTaskToNextDay, updateTask, type TaskPatch } from '@/app/(frontend)/journal-actions'
import { BlockEditor, SaveStatusText } from '@/components/editor/BlockEditor'
import { formatDayLong, formatWeekRange, isoWeek } from '@/lib/day'
import { escapeHandledElsewhere } from '@/lib/escape'
import type { TaskDetail } from '@/lib/taskItems'
import { useTaskPeek } from '@/lib/useTaskPeek'
import type { SaveStatus } from '@/lib/useSaveQueue'

/** Right-hand task panel, like opening a Notion page as a side peek. */
export function TaskPeek() {
  const { openId, close } = useTaskPeek()
  if (!openId) return null
  return <Panel key={openId} id={openId} onClose={close} />
}

function Panel({ id, onClose }: { id: number; onClose: () => void }) {
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [bodyStatus, setBodyStatus] = useState<{ status: SaveStatus; error: string | null }>({ status: 'idle', error: null })
  const [pending, startTransition] = useTransition()
  const titleRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let alive = true
    getTask(id).then((result) => {
      if (!alive) return
      if (result.ok && result.data) setTask(result.data)
      else setLoadError(result.ok ? '找不到這個任務' : result.error)
    })
    return () => {
      alive = false
    }
  }, [id])

  const apply = (patch: TaskPatch) => {
    if (!task) return
    const previous = task
    setTask({ ...task, ...patch } as TaskDetail)
    startTransition(async () => {
      const result = await updateTask(task.id, patch)
      if (!result.ok) {
        setTask(previous)
        setError(result.error)
      } else setError(null)
    })
  }

  const saveTitle = () => {
    const title = titleRef.current?.value.trim() ?? ''
    if (task && title && title !== task.title) apply({ title })
  }

  // Closing (Esc, the X, the backdrop) saves a title still being edited.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = () => {
      saveTitle()
      onClose()
    }
  })
  const close = () => closeRef.current()

  useEffect(() => {
    // Capture phase: decide while an editor menu or picker is still open (it
    // closes itself on this Esc, and the panel stays).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !escapeHandledElsewhere()) closeRef.current()
    }
    document.addEventListener('keydown', onKey, true)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = ''
    }
  }, [])

  const setPeriod = (field: 'startDate' | 'endDate', value: string) => {
    if (!task) return
    const next = { startDate: task.startDate, endDate: task.endDate, [field]: value || null }
    // A period needs both ends: fill the other end with the same day.
    if (next.startDate && !next.endDate) next.endDate = next.startDate
    if (next.endDate && !next.startDate) next.startDate = next.endDate
    apply(next)
  }

  const where =
    task?.kind === 'important' && task.day
      ? `Important · ${formatDayLong(task.day)}`
      : task?.weekStart
        ? `週待辦 · 第 ${isoWeek(task.weekStart)} 週（${formatWeekRange(task.weekStart)}）`
        : ''

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={task?.title ?? '任務'}>
      <button type="button" aria-label="關閉" onClick={close} className="modal-scrim absolute inset-0 bg-scrim backdrop-blur-[1px]" />
      <aside className="peek-in absolute inset-y-0 right-0 flex w-full max-w-[640px] flex-col bg-surface shadow-[0_0_48px_rgba(17,17,17,0.12)] md:border-l md:border-line">
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <p className="truncate text-xs text-muted">{where}</p>
          <div className="flex items-center gap-3">
            <SaveStatusText status={bodyStatus.status} error={bodyStatus.error} />
            <button type="button" onClick={close} aria-label="關閉" className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink-strong">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-24 md:px-8">
          {loadError && <p className="text-red-ink">{loadError}</p>}
          {!task && !loadError && <div className="h-40 animate-pulse rounded-lg bg-sunken" />}
          {task && (
            <>
              <textarea
                ref={titleRef}
                defaultValue={task.title}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.currentTarget.blur()
                  }
                }}
                rows={1}
                aria-label="標題"
                className="field-sizing-content w-full resize-none overflow-hidden bg-transparent text-2xl font-semibold tracking-tight text-ink-strong outline-none md:text-3xl"
              />

              <dl className="mt-5 grid grid-cols-[88px_1fr] items-center gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted">狀態</dt>
                <dd>
                  {task.status === 'migrated' ? (
                    <span className="text-muted">已移到明天</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => apply({ status: task.status === 'done' ? 'todo' : 'done' })}
                      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 ${
                        task.status === 'done' ? 'border-green-ink/30 bg-green-soft text-green-ink' : 'border-line-strong text-ink'
                      }`}
                    >
                      {task.status === 'done' && <Check size={14} weight="bold" />}
                      {task.status === 'done' ? '完成' : '待辦'}
                    </button>
                  )}
                </dd>

                <dt className="text-muted">到期日</dt>
                <dd className="flex items-center gap-2">
                  <input
                    type="date"
                    aria-label="到期日"
                    value={task.dueDate ?? ''}
                    onChange={(e) => apply({ dueDate: e.target.value || null })}
                    className="field w-auto py-1 text-sm"
                  />
                  {task.dueDate && <ClearButton label="清除到期日" onClick={() => apply({ dueDate: null })} />}
                </dd>

                <dt className="text-muted">期間</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    aria-label="期間開始"
                    value={task.startDate ?? ''}
                    max={task.endDate ?? undefined}
                    onChange={(e) => setPeriod('startDate', e.target.value)}
                    className="field w-auto py-1 text-sm"
                  />
                  <span className="text-muted">到</span>
                  <input
                    type="date"
                    aria-label="期間結束"
                    value={task.endDate ?? ''}
                    min={task.startDate ?? undefined}
                    onChange={(e) => setPeriod('endDate', e.target.value)}
                    className="field w-auto py-1 text-sm"
                  />
                  {task.startDate && <ClearButton label="清除期間" onClick={() => apply({ startDate: null, endDate: null })} />}
                </dd>
              </dl>

              <div className="mt-5 flex flex-wrap gap-2">
                {task.kind === 'important' && task.status === 'todo' && (
                  <button
                    type="button"
                    className="btn btn-quiet"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await moveTaskToNextDay(task.id)
                        if (result.ok) onClose()
                        else setError(result.error)
                      })
                    }
                  >
                    <ArrowBendUpRight size={16} />
                    移到明天
                  </button>
                )}
                {confirmDelete ? (
                  <>
                    <button
                      type="button"
                      className="btn bg-red-soft text-red-ink"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await deleteTask(task.id)
                          if (result.ok) onClose()
                          else setError(result.error)
                        })
                      }
                    >
                      確定刪除
                    </button>
                    <button type="button" className="btn text-muted hover:bg-sunken" onClick={() => setConfirmDelete(false)}>
                      取消
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn text-muted hover:bg-sunken hover:text-red-ink" onClick={() => setConfirmDelete(true)}>
                    <Trash size={16} />
                    刪除
                  </button>
                )}
              </div>

              {error && (
                <p role="alert" className="mt-3 text-sm text-red-ink">
                  {error}
                </p>
              )}

              <div className="mt-6 border-t border-line pt-5">
                <BlockEditor
                  target={{ kind: 'task', id: task.id }}
                  initial={task.body}
                  placeholder="寫下細項，或按 / 插入標題、待辦清單…"
                  onStatus={(status, err) => setBodyStatus({ status, error: err })}
                />
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

function ClearButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="rounded-md p-1 text-muted hover:bg-sunken hover:text-ink-strong">
      <X size={14} />
    </button>
  )
}
