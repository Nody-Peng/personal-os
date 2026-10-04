// Shared rules for tasks: daily IMPORTANT items and weekly to-dos.

export const TASK_KINDS = [
  { label: 'Important', value: 'important' },
  { label: '週待辦', value: 'weekly' },
] as const
export type TaskKind = (typeof TASK_KINDS)[number]['value']

// "migrated" is the bullet-journal ">": the task was moved to another day and
// a copy lives there. The original stays on its day as a record.
export const TASK_STATUSES = [
  { label: '待辦', value: 'todo' },
  { label: '完成', value: 'done' },
  { label: '已移到明天', value: 'migrated' },
] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]['value']

export const MAX_IMPORTANT_PER_DAY = 3

/** True when [start, end] overlaps [from, to]; all YYYY-MM-DD strings. */
export function overlaps(start: string, end: string, from: string, to: string): boolean {
  return start <= to && end >= from
}
