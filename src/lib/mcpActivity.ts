import 'server-only'
import type { McpActivity } from '@/payload-types'
import { restorePageVersion, restoreTrashedPage, trashPageTree, writePageContent } from './notebookOps'
import type { McpKeyLevel } from './options'
import type { Session } from './session'

// What Claude changes through the MCP endpoint, kept for /studio's 最近動作
// with a way back (mcp-activity; old rows go in the daily job).

/** Who is calling: a key from /studio, or MCP_TOKEN (keyId null). */
export type McpActor = { keyId: number | null; name: string; level: McpKeyLevel }

export type ActivityEntry = {
  pageId?: number
  notebookId?: number
  pageTitle?: string
  summary: string
  /** The version history entry holding the page as it was just before (content changes). */
  snapshotId?: number | null
  /** A content change to a page that was empty: undoing it empties the page again. */
  emptyBefore?: boolean
}

/** Tools whose change is undone by putting the page's earlier content back. */
const CONTENT_TOOLS = new Set(['append_to_page', 'replace_page_content', 'insert_blocks', 'edit_block', 'delete_block', 'restore_page_version'])
/** Tools that made a page or card: undone by moving it to the trash. */
const CREATING_TOOLS = new Set(['create_page', 'add_board_card'])

export const TOOL_LABELS: Record<string, string> = {
  create_page: '建立頁面',
  append_to_page: '在頁尾加內容',
  insert_blocks: '插入段落',
  edit_block: '修改段落',
  delete_block: '刪除段落',
  replace_page_content: '整頁改寫',
  update_page: '改頁名／圖示／位置',
  trash_page: '移到垃圾桶',
  restore_page: '從垃圾桶救回',
  restore_page_version: '還原版本',
  upload_image: '上傳圖片',
  add_board_card: '新增卡片',
  update_board_card: '更新卡片',
  add_journal_task: '新增日記待辦',
  send_email: '寄信',
}

export type UndoKind = 'version' | 'untrash' | 'trash' | null

/** How an entry can be undone on /studio, if at all. */
export function undoKind(entry: Pick<McpActivity, 'tool' | 'pageId' | 'snapshotId' | 'emptyBefore' | 'undoneAt'>): UndoKind {
  if (entry.undoneAt || !entry.pageId) return null
  if (CONTENT_TOOLS.has(entry.tool)) return entry.snapshotId || entry.emptyBefore ? 'version' : null
  if (entry.tool === 'trash_page') return 'untrash'
  if (CREATING_TOOLS.has(entry.tool)) return 'trash'
  return null
}

/** Never fails the tool call it records. */
export async function recordActivity({ payload, user }: Session, actor: McpActor, tool: string, entry: ActivityEntry): Promise<void> {
  await payload
    .create({
      collection: 'mcp-activity',
      data: {
        key: actor.keyId,
        keyName: actor.name,
        tool,
        pageId: entry.pageId ?? null,
        notebookId: entry.notebookId ?? null,
        pageTitle: entry.pageTitle ?? null,
        summary: entry.summary.slice(0, 500),
        snapshotId: entry.snapshotId ?? null,
        emptyBefore: Boolean(entry.emptyBefore),
      },
      user,
      overrideAccess: false,
    })
    .catch(() => null)
}

/** Takes one recorded change back; returns what was done. */
export async function undoActivity(session: Session, id: number): Promise<string> {
  const { payload, user } = session
  const entry = await payload.findByID({ collection: 'mcp-activity', id, depth: 0, user, overrideAccess: false })
  const kind = undoKind(entry)
  if (!kind || !entry.pageId) throw new Error(entry.undoneAt ? '這個動作已經還原過了' : '這個動作沒有可以還原的方式')
  let done: string
  if (kind === 'version') {
    if (entry.snapshotId) {
      await restorePageVersion(session, entry.pageId, entry.snapshotId)
      done = '已把頁面還原到這次改動之前'
    } else {
      await writePageContent(session, entry.pageId, [], { forceSnapshot: true })
      done = '這一頁改動前是空白的，已清空（現在的內容留在版本紀錄）'
    }
  } else if (kind === 'untrash') {
    await restoreTrashedPage(session, entry.pageId)
    done = '已從垃圾桶救回'
  } else {
    await trashPageTree(session, entry.pageId)
    done = '已把這次新增的頁面移到垃圾桶'
  }
  await payload.update({ collection: 'mcp-activity', id, data: { undoneAt: new Date().toISOString() }, user, overrideAccess: false })
  return done
}
