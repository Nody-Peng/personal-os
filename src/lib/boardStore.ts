'use client'

// One shared copy of each board's items, so the board block, the full-page
// board and the side peek all show the same cards. Mutations are optimistic
// and roll back if the server refuses.

import { useEffect, useSyncExternalStore } from 'react'
import { createItem, getBoard, moveItem, updateItem, type BoardData, type ItemPatch } from '@/app/(frontend)/notebook-actions'
import { applyItemMove, type BoardItem } from './notes'
import type { ItemStatus } from './options'

export type BoardState = { status: 'loading' | 'ready' | 'error'; data: BoardData | null; error: string | null }

const LOADING: BoardState = { status: 'loading', data: null, error: null }
const boards = new Map<number, BoardState>()
const listeners = new Map<number, Set<() => void>>()
const inFlight = new Map<number, Promise<void>>()

function set(id: number, state: BoardState) {
  boards.set(id, state)
  listeners.get(id)?.forEach((notify) => notify())
}

function setItems(id: number, update: (items: BoardItem[]) => BoardItem[]) {
  const current = boards.get(id)
  if (current?.data) set(id, { ...current, data: { ...current.data, items: update(current.data.items) } })
}

/** (Re)loads a board; the cards already shown stay until the new ones arrive. */
export function loadBoard(id: number): Promise<void> {
  const running = inFlight.get(id)
  if (running) return running
  const run = getBoard(id).then((result) => {
    inFlight.delete(id)
    if (result.ok && result.data) set(id, { status: 'ready', data: result.data, error: null })
    else set(id, { status: 'error', data: boards.get(id)?.data ?? null, error: result.ok ? '找不到看板' : result.error })
  })
  inFlight.set(id, run)
  return run
}

export function useBoard(id: number): BoardState {
  const state = useSyncExternalStore(
    (notify) => {
      if (!listeners.has(id)) listeners.set(id, new Set())
      listeners.get(id)!.add(notify)
      return () => listeners.get(id)?.delete(notify)
    },
    () => boards.get(id) ?? LOADING,
    () => LOADING,
  )
  // Refresh whenever a view of the board mounts (it may have changed elsewhere).
  useEffect(() => {
    if (id > 0) void loadBoard(id)
  }, [id])
  return state
}

export async function addItem(boardId: number, status: ItemStatus, title = ''): Promise<BoardItem | string> {
  const result = await createItem(boardId, status, title)
  if (!result.ok || !result.data) return result.ok ? '新增失敗' : result.error
  const item = result.data
  setItems(boardId, (items) => [...items, item])
  return item
}

export async function moveCard(boardId: number, id: number, status: ItemStatus, index: number): Promise<string | null> {
  const before = boards.get(boardId)?.data?.items
  if (!before) return null
  setItems(boardId, (items) => applyItemMove(items, id, status, index))
  const result = await moveItem(id, status, index)
  if (result.ok) return null
  setItems(boardId, () => before)
  return result.error
}

export async function patchItem(boardId: number, id: number, patch: ItemPatch): Promise<string | null> {
  const before = boards.get(boardId)?.data?.items
  setItems(boardId, (items) =>
    items.map((i) => {
      if (i.id !== id) return i
      const next = { ...i, ...patch } as BoardItem
      // Mirror the server's rule: a date range always has both ends.
      if (next.startDate && !next.endDate) next.endDate = next.startDate
      if (next.endDate && !next.startDate) next.startDate = next.endDate
      return next
    }),
  )
  const result = await updateItem(id, patch)
  if (result.ok) return null
  if (before) setItems(boardId, () => before)
  return result.error
}

/** Title or icon edited elsewhere (the peek or the page itself). */
export function renameItem(boardId: number, id: number, patch: Partial<Pick<BoardItem, 'title' | 'icon'>>) {
  setItems(boardId, (items) => items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
}

export function dropItems(boardId: number, ids: number[]) {
  const gone = new Set(ids)
  setItems(boardId, (items) => items.filter((i) => !gone.has(i.id)).map((i) => (i.parentItem != null && gone.has(i.parentItem) ? { ...i, parentItem: null } : i)))
}

export function renameBoard(boardId: number, title: string) {
  const current = boards.get(boardId)
  if (current?.data) set(boardId, { ...current, data: { ...current.data, title } })
}
