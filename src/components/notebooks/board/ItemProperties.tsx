'use client'

import { ArrowUpRight, CalendarBlank, CaretDown, FileText, SpinnerGap, TreeStructure, X } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { patchItem, useBoard } from '@/lib/boardStore'
import { UNTITLED, parentCandidates } from '@/lib/notes'
import { ITEM_STATUSES } from '@/lib/options'
import { reportNoteError } from '@/lib/uploadMedia'
import { Menu } from '../Menu'
import { useNotebook } from '../NotebookShell'
import { StatusTag } from './StatusTag'

/** 狀態 / 日期 / 上級項目 / 子項目 for one board card (in the peek and on its own page). */
export function ItemProperties({ boardId, itemId }: { boardId: number; itemId: number }) {
  const { openPeek } = useNotebook()
  const { data } = useBoard(boardId)
  const items = data?.items ?? []
  const item = items.find((i) => i.id === itemId)
  if (!item) return <div className="h-32 animate-pulse rounded-lg bg-sunken" />

  const set = async (patch: Parameters<typeof patchItem>[2], target = itemId) => {
    const error = await patchItem(boardId, target, patch)
    if (error) reportNoteError(error)
  }

  const children = items.filter((i) => i.parentItem === itemId)
  // A card can't take one of its own ancestors as a child.
  const byId = new Map(items.map((i) => [i.id, i]))
  const ancestors = new Set<number>()
  let up = item.parentItem
  while (up != null && !ancestors.has(up)) {
    ancestors.add(up)
    up = byId.get(up)?.parentItem ?? null
  }
  const childCandidates = items.filter((i) => i.id !== itemId && !ancestors.has(i.id) && i.parentItem !== itemId)
  const titleOf = (id: number) => byId.get(id)?.title || UNTITLED

  return (
    <dl className="grid grid-cols-[7rem_1fr] items-center gap-x-3 gap-y-1 text-sm">
      <Row icon={<SpinnerGap size={16} />} label="狀態">
        <Menu
          label="選擇狀態"
          className="flex items-center gap-1 rounded-md px-1 py-1 hover:bg-sunken"
          items={ITEM_STATUSES.map((s) => ({ label: s.label, onSelect: () => set({ status: s.value }) }))}
        >
          <StatusTag status={item.status} />
          <CaretDown size={12} className="text-faint" />
        </Menu>
      </Row>

      <Row icon={<CalendarBlank size={16} />} label="日期">
        <span className="flex flex-wrap items-center gap-1.5">
          <input
            type="date"
            aria-label="開始日期"
            value={item.startDate ?? ''}
            max={item.endDate ?? undefined}
            onChange={(e) => set({ startDate: e.target.value || null, ...(e.target.value ? {} : { endDate: null }) })}
            className="field w-auto px-2 py-1 text-sm"
          />
          <span className="text-faint">→</span>
          <input
            type="date"
            aria-label="結束日期"
            value={item.endDate ?? ''}
            min={item.startDate ?? undefined}
            onChange={(e) => set({ endDate: e.target.value || null, ...(e.target.value ? {} : { startDate: null }) })}
            className="field w-auto px-2 py-1 text-sm"
          />
          {item.startDate && (
            <button
              type="button"
              aria-label="清除日期"
              onClick={() => set({ startDate: null, endDate: null })}
              className="rounded-md p-1 text-muted hover:bg-sunken hover:text-ink-strong"
            >
              <X size={13} />
            </button>
          )}
        </span>
      </Row>

      <Row icon={<ArrowUpRight size={16} />} label="上級項目">
        <select
          aria-label="上級項目"
          value={item.parentItem ?? ''}
          onChange={(e) => set({ parentItem: e.target.value ? Number(e.target.value) : null })}
          className="max-w-full rounded-md bg-transparent px-1 py-1 text-ink outline-none hover:bg-sunken focus:bg-sunken"
        >
          <option value="">空白</option>
          {parentCandidates(items, itemId).map((i) => (
            <option key={i.id} value={i.id}>
              {i.title || UNTITLED}
            </option>
          ))}
        </select>
      </Row>

      <Row icon={<TreeStructure size={16} />} label="子項目">
        <span className="flex flex-wrap items-center gap-1.5 py-1">
          {children.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1 rounded-md bg-sunken py-0.5 pr-1 pl-2 text-xs">
              <button type="button" onClick={() => openPeek(c.id)} className="flex items-center gap-1 text-ink-strong hover:underline">
                <FileText size={12} className="text-muted" />
                {titleOf(c.id)}
              </button>
              <button
                type="button"
                aria-label={`移除子項目 ${titleOf(c.id)}`}
                onClick={() => set({ parentItem: null }, c.id)}
                className="rounded p-0.5 text-muted hover:bg-line hover:text-ink-strong"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          {childCandidates.length > 0 && (
            <select
              aria-label="加入子項目"
              value=""
              onChange={(e) => e.target.value && set({ parentItem: itemId }, Number(e.target.value))}
              className="rounded-md bg-transparent px-1 py-0.5 text-xs text-muted outline-none hover:bg-sunken"
            >
              <option value="">＋ 加入</option>
              {childCandidates.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title || UNTITLED}
                </option>
              ))}
            </select>
          )}
          {!children.length && !childCandidates.length && <span className="text-faint">空白</span>}
        </span>
      </Row>
    </dl>
  )
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <>
      <dt className="flex items-center gap-2 text-muted">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}
