import 'server-only'
import { cleanText } from './actionUtils'
import { isDay, weekStart } from './day'
import type { Session } from './session'
import type { TaskKind } from './tasks'

// Journal tasks created from the journal pages (journal-actions.ts) and by
// Claude (api/mcp). The Tasks collection itself refuses a fourth Important on a day.

const optionalDay = (value: unknown): string | null => {
  if (value == null || value === '') return null
  if (!isDay(value)) throw new Error('日期格式錯誤')
  return value
}

/** A new IMPORTANT item on `day`, or a to-do of the week containing `weekStart`, at the end of its list. */
export async function createJournalTask({ payload, user }: Session, input: { kind: TaskKind; title: string; day?: string; weekStart?: string }) {
  const title = cleanText(input.title, 200).trim()
  if (!title) throw new Error('請輸入標題')

  let scope: { day: string } | { weekStart: string }
  if (input.kind === 'important') {
    scope = { day: optionalDay(input.day) ?? '' }
    if (!scope.day) throw new Error('Important 一定要有日期')
  } else if (input.kind === 'weekly') {
    const ws = optionalDay(input.weekStart)
    if (!ws) throw new Error('週待辦一定要屬於某一週')
    scope = { weekStart: weekStart(ws) }
  } else {
    throw new Error('類型錯誤')
  }

  const { totalDocs } = await payload.count({
    collection: 'tasks',
    where: { and: [{ kind: { equals: input.kind } }, ...Object.entries(scope).map(([k, v]) => ({ [k]: { equals: v } }))] },
    user,
    overrideAccess: false,
  })
  const doc = await payload.create({
    collection: 'tasks',
    data: { kind: input.kind, title, status: 'todo', position: totalDocs, ...scope },
    user,
    overrideAccess: false,
  })
  return doc
}
