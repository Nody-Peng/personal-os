'use client'

import { Check, Plus } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { DAY_PARTS, MAX_PLAN_ITEMS, MAX_PLAN_TEXT, newPlanItemId, type DayPartKey, type PlanItem } from '@/lib/dayParts'
import { useDayLog } from './DayLogProvider'

/** 早 / 午 / 晚: a quick checklist for each part of the day (day-only, never counted). */
export function PlanFields() {
  return (
    <div className="divide-y divide-line">
      {DAY_PARTS.map(({ key, label }) => (
        <PartList key={key} part={key} label={label} />
      ))}
    </div>
  )
}

function PartList({ part, label }: { part: DayPartKey; label: string }) {
  const { day, log, commit, editText, flush } = useDayLog()
  const items = log[part]
  const [draft, setDraft] = useState('')
  const list = useRef<HTMLUListElement>(null)
  const addInput = useRef<HTMLInputElement>(null)

  const focusItem = (index: number, atEnd = true) =>
    requestAnimationFrame(() => {
      const input = list.current?.querySelectorAll<HTMLInputElement>('input[data-item]')[index]
      if (!input) return addInput.current?.focus()
      input.focus()
      if (atEnd) input.setSelectionRange(input.value.length, input.value.length)
    })

  const save = (next: PlanItem[]) => commit({ [part]: next })

  const add = () => {
    const text = draft.trim()
    if (!text || items.length >= MAX_PLAN_ITEMS) return
    save([...items, { id: newPlanItemId(), text, done: false }])
    setDraft('')
  }

  return (
    <div className="grid grid-cols-[2rem_1fr] items-start gap-3 py-2.5 first:pt-0 last:pb-0">
      <span id={`${part}-${day}`} className="pt-1 text-sm font-semibold text-ink-strong">
        {label}
      </span>
      <div className="min-w-0">
        <ul ref={list} aria-labelledby={`${part}-${day}`}>
          {items.map((item, i) => (
            <li key={item.id} className="group flex items-center gap-2.5">
              <button
                type="button"
                role="checkbox"
                aria-checked={item.done}
                aria-label={`${item.done ? '標示未完成' : '完成'}：${item.text || '（空白）'}`}
                onClick={() => save(items.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)))}
                className={`flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                  item.done ? 'border-ink-strong bg-ink-strong text-white' : 'border-line-strong bg-surface hover:border-ink'
                }`}
              >
                {item.done && <Check size={11} weight="bold" />}
              </button>
              <input
                data-item
                value={item.text}
                maxLength={MAX_PLAN_TEXT}
                aria-label={`${label}的項目`}
                onChange={(e) => editText({ [part]: items.map((x) => (x.id === item.id ? { ...x, text: e.target.value } : x)) })}
                onBlur={() => {
                  // An item left empty disappears.
                  if (!item.text.trim()) save(items.filter((x) => x.id !== item.id))
                  else flush()
                }}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (items.length >= MAX_PLAN_ITEMS) return
                    const next = [...items]
                    next.splice(i + 1, 0, { id: newPlanItemId(), text: '', done: false })
                    save(next)
                    focusItem(i + 1)
                  } else if (e.key === 'Backspace' && !item.text) {
                    e.preventDefault()
                    save(items.filter((x) => x.id !== item.id))
                    focusItem(Math.max(0, i - 1))
                  }
                }}
                className={`min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 outline-none transition-colors hover:bg-sunken focus:bg-sunken ${
                  item.done ? 'text-muted line-through decoration-line-strong' : 'text-ink-strong'
                }`}
              />
            </li>
          ))}
        </ul>
        {items.length < MAX_PLAN_ITEMS && (
          <div className="flex items-center gap-2.5">
            <Plus size={14} className="mx-0.5 shrink-0 text-faint" aria-hidden />
            <input
              ref={addInput}
              value={draft}
              maxLength={MAX_PLAN_TEXT}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={add}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  add()
                }
              }}
              aria-label={`新增${label}的項目`}
              placeholder={items.length ? '新增…' : '安排…'}
              className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-ink-strong outline-none transition-colors placeholder:text-faint hover:bg-sunken focus:bg-sunken"
            />
          </div>
        )}
      </div>
    </div>
  )
}
