// The plain text each journal record is searched by (Ctrl/⌘ K, search-actions.ts).
// Collections keep it in a read-only `plainText` field (fields/searchText.ts);
// the same functions backfilled the existing rows (migration ux_batch).

import { blocksToText } from './blocks'

type Doc = Record<string, unknown>

const lines = (...parts: unknown[]) =>
  parts
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .join('\n')

const itemsText = (items: unknown) =>
  Array.isArray(items) ? items.map((i) => (i && typeof i === 'object' ? String((i as { text?: unknown }).text ?? '') : '')).join('\n') : ''

/** A day: its note and the 早/午/晚 checklists. */
export const dayLogText = (log: Doc) => lines(blocksToText(log.note), itemsText(log.morningItems), itemsText(log.noonItems), itemsText(log.eveningItems))

/** A task's body (its title is searched as is). */
export const taskText = (task: Doc) => blocksToText(task.body)

/** A week note: the Sunday review and why the theme was picked. */
export const weekText = (week: Doc) => lines(blocksToText(week.review), week.themeReason)

export const monthText = (month: Doc) => blocksToText(month.review)
