'use client'

import { ArrowCounterClockwise, Check, Plus, PushPin, Trash, X } from '@phosphor-icons/react'
import { useRef, useState, useTransition } from 'react'
import { addIdea, deleteIdea, updateIdea, type IdeaPatch } from '@/app/(frontend)/actions'
import type { IdeaStatus } from '@/lib/options'

export type IdeaItem = {
  id: number
  title: string
  why: string | null
  scoreGoal: number
  scoreUrgency: number
  scorePassion: number
  status: IdeaStatus
  createdAt: string
}

const CRITERIA = [
  { key: 'scoreGoal', label: '目標', hint: '對托福、工作或長期目標的幫助' },
  { key: 'scoreUrgency', label: '急迫', hint: '有沒有時間壓力' },
  { key: 'scorePassion', label: '熱情', hint: '現在有多想學' },
] as const

const TABS: { status: IdeaStatus; label: string }[] = [
  { status: 'inbox', label: '收件匣' },
  { status: 'done', label: '完成' },
  { status: 'dropped', label: '放棄' },
]

const total = (i: IdeaItem) => i.scoreGoal + i.scoreUrgency + i.scorePassion

export function IdeasBoard({ initial }: { initial: IdeaItem[] }) {
  const [items, setItems] = useState(initial)
  const [tab, setTab] = useState<IdeaStatus>('inbox')
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Take fresh server data after a revalidation without an effect.
  const [lastInitial, setLastInitial] = useState(initial)
  if (initial !== lastInitial) {
    setLastInitial(initial)
    setItems(initial)
  }

  const patch = (id: number, change: IdeaPatch) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === id) return { ...i, ...change }
        // Picking a new theme sends the old one back to the inbox.
        if (change.status === 'selected' && i.status === 'selected') return { ...i, status: 'inbox' }
        return i
      }),
    )
    startTransition(async () => {
      const result = await updateIdea(id, change)
      setError(result.ok ? null : result.error)
    })
  }

  const remove = (id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    startTransition(async () => {
      const result = await deleteIdea(id)
      setError(result.ok ? null : result.error)
    })
  }

  const selected = items.find((i) => i.status === 'selected') ?? null
  const visible = items
    .filter((i) => i.status === tab)
    .sort((a, b) => total(b) - total(a) || b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="grid gap-4">
      <QuickAdd onError={setError} />

      {error && (
        <p role="alert" className="text-sm text-red-ink">
          {error}
        </p>
      )}

      <section className="card rise p-5 md:p-6" style={{ '--i': 1 } as React.CSSProperties}>
        <p className="label">本週主題 · 23:00–24:00</p>
        {selected ? (
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xl font-semibold tracking-tight text-ink-strong">{selected.title}</p>
              {selected.why && <p className="text-sm text-muted">{selected.why}</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-quiet" onClick={() => patch(selected.id, { status: 'done' })}>
                <Check size={16} weight="bold" />
                完成
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => patch(selected.id, { status: 'inbox' })}>
                <ArrowCounterClockwise size={16} />
                放回收件匣
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-1.5 text-muted">還沒選。週日回顧時，從收件匣挑總分最高的一個。</p>
        )}
      </section>

      <section className="card rise p-5 md:p-6" style={{ '--i': 2 } as React.CSSProperties}>
        <div role="tablist" aria-label="清單分類" className="flex gap-1.5 border-b border-line pb-4">
          {TABS.map(({ status, label }) => {
            const count = items.filter((i) => i.status === status).length
            return (
              <button
                key={status}
                role="tab"
                type="button"
                aria-selected={tab === status}
                onClick={() => setTab(status)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  tab === status ? 'bg-ink-strong font-medium text-white' : 'text-muted hover:bg-sunken hover:text-ink-strong'
                }`}
              >
                {label}
                <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
              </button>
            )
          })}
        </div>

        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            {tab === 'inbox' ? '想到想學的東西，就先記在上面。不用馬上行動。' : '這裡還沒有東西。'}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((idea) => (
              <IdeaRow key={idea.id} idea={idea} onPatch={patch} onRemove={remove} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function QuickAdd({ onError }: { onError: (e: string | null) => void }) {
  const [title, setTitle] = useState('')
  const [why, setWhy] = useState('')
  const [pending, startTransition] = useTransition()
  const titleRef = useRef<HTMLInputElement>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    startTransition(async () => {
      const result = await addIdea(title, why)
      onError(result.ok ? null : result.error)
      if (result.ok) {
        setTitle('')
        setWhy('')
        titleRef.current?.focus()
      }
    })
  }

  return (
    <form onSubmit={submit} className="card rise grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto] md:items-end md:p-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="idea-title" className="label">
          想學什麼
        </label>
        <input
          id="idea-title"
          ref={titleRef}
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="idea-why" className="label">
          為什麼想學（選填）
        </label>
        <input id="idea-why" className="field" value={why} onChange={(e) => setWhy(e.target.value)} autoComplete="off" />
      </div>
      <button type="submit" className="btn btn-primary h-[46px]" disabled={pending || !title.trim()}>
        <Plus size={16} weight="bold" />
        記下來
      </button>
    </form>
  )
}

function IdeaRow({
  idea,
  onPatch,
  onRemove,
}: {
  idea: IdeaItem
  onPatch: (id: number, change: IdeaPatch) => void
  onRemove: (id: number) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const sum = total(idea)

  return (
    <li className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center md:gap-6">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-sunken font-semibold tabular-nums text-ink-strong"
          aria-label={`總分 ${sum}`}
        >
          {sum}
        </span>
        <div className="min-w-0">
          <p className="font-medium text-ink-strong">{idea.title}</p>
          {idea.why && <p className="text-sm text-muted">{idea.why}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {idea.status === 'inbox' &&
          CRITERIA.map(({ key, label, hint }) => (
            <div key={key} role="radiogroup" aria-label={`${label}：${hint}`} title={hint} className="flex items-center gap-1.5">
              <span className="text-xs text-muted">{label}</span>
              <span className="flex overflow-hidden rounded-md border border-line-strong">
                {[0, 1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={idea[key] === n}
                    onClick={() => onPatch(idea.id, { [key]: n })}
                    className={`h-8 w-7 border-l border-line-strong text-xs tabular-nums transition-colors first:border-l-0 ${
                      idea[key] === n ? 'bg-ink-strong font-semibold text-white' : 'bg-surface text-ink hover:bg-sunken'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </span>
            </div>
          ))}

        <div className="flex items-center gap-1">
          {idea.status === 'inbox' ? (
            <>
              <button type="button" className="btn btn-primary" onClick={() => onPatch(idea.id, { status: 'selected' })}>
                <PushPin size={16} />
                設為本週主題
              </button>
              <button
                type="button"
                aria-label="放棄"
                title="放棄"
                className="rounded-md p-2 text-muted transition-colors hover:bg-sunken hover:text-ink-strong"
                onClick={() => onPatch(idea.id, { status: 'dropped' })}
              >
                <X size={18} />
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-quiet" onClick={() => onPatch(idea.id, { status: 'inbox' })}>
              <ArrowCounterClockwise size={16} />
              放回收件匣
            </button>
          )}
          {confirming ? (
            <>
              <button type="button" className="btn px-2 py-1 text-red-ink hover:bg-red-soft" onClick={() => onRemove(idea.id)}>
                刪除
              </button>
              <button type="button" className="btn px-2 py-1 text-muted hover:bg-sunken" onClick={() => setConfirming(false)}>
                取消
              </button>
            </>
          ) : (
            <button
              type="button"
              aria-label="刪除"
              title="刪除"
              className="rounded-md p-2 text-muted transition-colors hover:bg-sunken hover:text-red-ink"
              onClick={() => setConfirming(true)}
            >
              <Trash size={18} />
            </button>
          )}
        </div>
      </div>
    </li>
  )
}
