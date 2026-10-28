import { randomBytes } from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mergeBlocks } from '@/lib/blockMerge'
import { markdownToBlocks, pageIdFromUrl } from '@/lib/mcp/markdown'
import { createMcpServer } from '@/lib/mcp/tools'
import { writePageContent } from '@/lib/notebookOps'
import type { Session } from '@/lib/session'
import type { User } from '@/payload-types'

const ORIGIN = 'https://os.example.test'
const p = (id: string, text: string) => ({ id, type: 'paragraph', content: [{ type: 'text', text, styles: {} }], children: [] })

describe('mergeBlocks', () => {
  const base = [p('a', 'A'), p('b', 'B'), p('c', 'C')]

  it('keeps edits from both sides and blocks either side added', () => {
    const local = [p('a', 'A local'), p('b', 'B'), p('l1', 'new local'), p('c', 'C')]
    const remote = [p('a', 'A'), p('b', 'B remote'), p('c', 'C'), p('r1', 'from Claude')]
    expect(mergeBlocks(base, local, remote).map((b) => b.content[0].text)).toEqual(['A local', 'B remote', 'new local', 'C', 'from Claude'])
  })

  it('lets a deletion stand unless the other side changed that block', () => {
    const local = [p('a', 'A'), p('c', 'C')] // deleted b
    const remote = [p('a', 'A'), p('b', 'B'), p('c', 'C changed')] // left b alone
    expect(mergeBlocks(base, local, remote).map((b) => b.id)).toEqual(['a', 'c'])
    // Remote deleted c, but it was edited here: it stays.
    const local2 = [p('a', 'A'), p('b', 'B'), p('c', 'C edited')]
    const remote2 = [p('a', 'A'), p('b', 'B')]
    expect(mergeBlocks(base, local2, remote2).map((b) => b.content[0].text)).toEqual(['A', 'B', 'C edited'])
  })

  it('keeps the local text when both sides changed the same block', () => {
    const merged = mergeBlocks(base, [p('a', 'mine'), p('b', 'B'), p('c', 'C')], [p('a', 'theirs'), p('b', 'B'), p('c', 'C')])
    expect(merged[0].content[0].text).toBe('mine')
  })

  it('puts a new block typed at the very top first', () => {
    const merged = mergeBlocks(base, [p('n', 'top'), ...base], [...base, p('r', 'end')])
    expect(merged.map((b) => b.id)).toEqual(['n', 'a', 'b', 'c', 'r'])
  })
})

describe('Markdown for Claude', () => {
  it('parses Markdown, turning a lone link to one of our pages into a page link', async () => {
    const blocks = (await markdownToBlocks(`# 標題\n\n- [ ] 待辦\n- 項目\n\n[會議](${ORIGIN}/notebooks/3/42)\n\n看 [這裡](https://example.com) 說明`, ORIGIN)) as {
      type: string
      props?: Record<string, unknown>
    }[]
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'checkListItem', 'bulletListItem', 'pageLink', 'paragraph'])
    expect(blocks[3].props).toEqual({ pageId: 42, mode: 'link' })
  })

  it('reads page ids from page addresses only', () => {
    expect(pageIdFromUrl(`${ORIGIN}/notebooks/3/42`, ORIGIN)).toBe(42)
    expect(pageIdFromUrl('/notebooks/3/42?peek=1', ORIGIN)).toBe(42)
    expect(pageIdFromUrl('https://elsewhere.test/notebooks/3/42', ORIGIN)).toBeNull()
    expect(pageIdFromUrl(`${ORIGIN}/journal`, ORIGIN)).toBeNull()
  })
})

describe('MCP tools', () => {
  let payload: Payload
  let session: Session
  let client: Client
  let notebookId: number
  const userIds: number[] = []

  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean }
    return { text: result.content.map((c) => c.text).join('\n'), isError: Boolean(result.isError) }
  }

  beforeAll(async () => {
    if (!/@(127\.0\.0\.1|localhost):/.test(process.env.DATABASE_URL ?? '')) throw new Error('These tests write to the database: local only.')
    payload = await getPayload({ config: await config })
    const user = await payload.create({
      collection: 'users',
      data: { email: `mcp-${randomBytes(4).toString('hex')}@example.test`, password: randomBytes(16).toString('hex') },
    })
    userIds.push(user.id)
    session = { payload, user: { ...user, collection: 'users' } as User }
    const notebook = await payload.create({
      collection: 'notebooks',
      data: { title: 'MCP 測試筆記本', coverColor: 'navy', pattern: 'cloth', position: 999, archived: false },
    })
    notebookId = notebook.id

    const server = createMcpServer({ session, origin: ORIGIN, revalidate: () => {} })
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    await server.connect(serverSide)
    client = new Client({ name: 'test', version: '1.0.0' })
    await client.connect(clientSide)
  }, 60_000)

  afterAll(async () => {
    await client?.close()
    if (!payload) return
    if (notebookId) {
      await payload.delete({ collection: 'note-pages', where: { notebook: { equals: notebookId } }, trash: true })
      await payload.delete({ collection: 'notebooks', id: notebookId })
    }
    for (const id of userIds) await payload.delete({ collection: 'users', id })
  })

  it('lists its tools', async () => {
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(['list_notebooks', 'read_page', 'create_page', 'append_to_page', 'replace_page_content', 'trash_page', 'read_journal_day', 'read_book_notes']),
    )
  })

  it('creates, reads, appends to and rewrites a page', async () => {
    expect((await call('list_notebooks')).text).toContain(`[${notebookId}] MCP 測試筆記本`)

    const created = await call('create_page', { notebook_id: notebookId, title: '會議紀錄', icon: '📝', markdown: '## 重點\n\n- 第一點\n- 第二點' })
    expect(created.isError).toBe(false)
    const pageId = Number(created.text.match(/\[(\d+)\]/)?.[1])
    expect(created.text).toContain(`${ORIGIN}/notebooks/${notebookId}/${pageId}`)

    const read = await call('read_page', { page_id: pageId })
    expect(read.text).toContain('# 📝 會議紀錄')
    expect(read.text).toContain('第一點')

    const appended = await call('append_to_page', { page_id: pageId, markdown: '補充：**下週**再討論' })
    expect(appended.isError).toBe(false)
    const after = (await call('read_page', { page_id: pageId })).text
    expect(after.indexOf('第二點')).toBeLessThan(after.indexOf('下週'))

    // Search sees the new text (plainText is kept by the collection hook).
    expect((await call('search', { query: '再討論' })).text).toContain(`[${pageId}]`)

    const replaced = await call('replace_page_content', { page_id: pageId, markdown: '全部改寫' })
    expect(replaced.text).toContain('版本紀錄')
    const { docs: snapshots } = await payload.find({ collection: 'page-snapshots', where: { page: { equals: pageId } } })
    expect(snapshots.length).toBeGreaterThan(0)
    expect((await call('read_page', { page_id: pageId })).text).not.toContain('第一點')
  })

  it('refuses a stale save and lets a fresh one through', async () => {
    const page = await payload.create({ collection: 'note-pages', data: { notebook: notebookId, title: '版本', position: 50 } })
    const first = await writePageContent(session, page.id, [p('a', 'one')], { baseRev: 0 })
    expect(first).toMatchObject({ ok: true, rev: 1 })
    // An editor still at revision 0 (it missed that save) can't overwrite it.
    const stale = await writePageContent(session, page.id, [p('a', 'stale')], { baseRev: 0 })
    expect(stale).toMatchObject({ ok: false, rev: 1 })
    expect(JSON.stringify(stale.ok ? null : stale.content)).toContain('one')
    expect(await writePageContent(session, page.id, [p('a', 'two')], { baseRev: 1 })).toMatchObject({ ok: true, rev: 2 })
  })

  it('moves, renames and trashes pages without deleting them', async () => {
    const parent = Number((await call('create_page', { notebook_id: notebookId, title: '上層' })).text.match(/\[(\d+)\]/)?.[1])
    const child = Number((await call('create_page', { notebook_id: notebookId, title: '子頁' })).text.match(/\[(\d+)\]/)?.[1])
    const moved = await call('update_page', { page_id: child, parent_id: parent, title: '子頁（改名）' })
    expect(moved.text).toContain(`在 [${parent}] 底下`)
    expect((await call('list_pages', { notebook_id: notebookId })).text).toMatch(new RegExp(`- \\[${parent}\\] 上層\\n  - \\[${child}\\] 子頁（改名）`))

    const trashed = await call('trash_page', { page_id: parent })
    expect(trashed.text).toContain('底下 1 頁')
    const kept = await payload.find({ collection: 'note-pages', where: { id: { in: [parent, child] } }, trash: true })
    expect(kept.docs.every((d) => d.deletedAt)).toBe(true)
  })

  it('adds and updates board cards', async () => {
    const board = await payload.create({ collection: 'note-pages', data: { notebook: notebookId, title: '待辦看板', kind: 'board', position: 60 } })
    const added = await call('add_board_card', { board_id: board.id, title: '寫報告', start_date: '2031-03-01', markdown: '細節' })
    expect(added.isError).toBe(false)
    const cardId = Number(added.text.match(/\[(\d+)\] 寫報告/)?.[1])
    const updated = await call('update_board_card', { card_id: cardId, status: 'done', end_date: '2031-03-03' })
    expect(updated.text).toContain('完成')
    expect(updated.text).toContain('2031-03-01 → 2031-03-03')
    const boardText = (await call('read_page', { page_id: board.id })).text
    expect(boardText).toContain('## 完成 (done)')
    expect(boardText).toContain('寫報告')
  })

  it('refuses text on a board or a locked page', async () => {
    const locked = await payload.create({ collection: 'note-pages', data: { notebook: notebookId, title: '鎖住', locked: true, position: 70 } })
    expect((await call('append_to_page', { page_id: locked.id, markdown: 'x' })).isError).toBe(true)
  })

  it('adds an Important item and reads the day back', async () => {
    const day = '2031-05-04'
    try {
      const added = await call('add_journal_task', { kind: 'important', title: 'MCP 測試事項', date: day })
      expect(added.isError).toBe(false)
      expect((await call('read_journal_day', { date: day })).text).toContain('- [ ] MCP 測試事項')
      expect((await call('read_journal_week', { date: day })).text).toContain('MCP 測試事項')
    } finally {
      await payload.delete({ collection: 'tasks', where: { and: [{ day: { equals: day } }, { title: { equals: 'MCP 測試事項' } }] } })
    }
  })

  it('reports a bad request as a tool error, not a crash', async () => {
    const missing = await call('read_page', { page_id: 999_999_999 })
    expect(missing.isError).toBe(true)
  })
})
