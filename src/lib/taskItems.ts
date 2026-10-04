import type { Task } from '@/payload-types'
import { blocksHaveText } from './blocks'
import type { TaskKind, TaskStatus } from './tasks'

/** What lists and the calendar need to show a task (no body). */
export type TaskItem = {
  id: number
  title: string
  kind: TaskKind
  status: TaskStatus
  day: string | null
  weekStart: string | null
  dueDate: string | null
  startDate: string | null
  endDate: string | null
  hasBody: boolean
}

export type TaskDetail = TaskItem & { body: unknown[] | null }

export function toTaskItem(t: Task): TaskItem {
  return {
    id: t.id,
    title: t.title,
    kind: t.kind,
    status: t.status,
    day: t.day ?? null,
    weekStart: t.weekStart ?? null,
    dueDate: t.dueDate ?? null,
    startDate: t.startDate ?? null,
    endDate: t.endDate ?? null,
    hasBody: blocksHaveText(t.body),
  }
}
