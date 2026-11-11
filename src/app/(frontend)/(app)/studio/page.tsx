import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { McpKeysPanel, type ActivityRow, type KeyRow } from '@/components/studio/McpKeysPanel'
import { TOOL_LABELS, undoKind } from '@/lib/mcpActivity'
import { DEFAULT_KEY_LEVEL, isKeyLevel, keyState } from '@/lib/mcpKeys'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Studio' }
export const dynamic = 'force-dynamic'

const when = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
const day = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric' })

export default async function StudioPage() {
  const { payload, user } = await requireSession('/studio')
  const { docs } = await payload.find({
    collection: 'mcp-keys',
    sort: '-createdAt',
    limit: 100,
    depth: 0,
    select: { name: true, prefix: true, level: true, createdAt: true, lastUsedAt: true, expiresAt: true, revokedAt: true },
    user,
    overrideAccess: false,
  })
  const keys: KeyRow[] = docs.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    level: isKeyLevel(k.level) ? k.level : DEFAULT_KEY_LEVEL,
    state: keyState(k),
    created: day.format(new Date(k.createdAt)),
    lastUsed: k.lastUsedAt ? when.format(new Date(k.lastUsedAt)) : null,
    expires: k.expiresAt ? day.format(new Date(k.expiresAt)) : null,
    revoked: k.revokedAt ? day.format(new Date(k.revokedAt)) : null,
  }))

  const recent = await payload.find({ collection: 'mcp-activity', sort: '-createdAt', limit: 50, depth: 0, user, overrideAccess: false })
  // Pages still there (trashed ones aren't linked).
  const pageIds = [...new Set(recent.docs.map((a) => a.pageId).filter((id): id is number => typeof id === 'number'))]
  const live = pageIds.length
    ? new Set(
        (await payload.find({ collection: 'note-pages', where: { id: { in: pageIds } }, select: { title: true }, depth: 0, pagination: false, user, overrideAccess: false })).docs.map(
          (p) => p.id,
        ),
      )
    : new Set<number>()
  const activity: ActivityRow[] = recent.docs.map((a) => ({
    id: a.id,
    when: when.format(new Date(a.createdAt)),
    keyName: a.keyName,
    tool: TOOL_LABELS[a.tool] ?? a.tool,
    summary: a.summary ?? '',
    pageTitle: a.pageTitle ?? null,
    href: a.pageId && a.notebookId && live.has(a.pageId) ? `/notebooks/${a.notebookId}/${a.pageId}` : null,
    undo: undoKind(a),
    undone: a.undoneAt ? when.format(new Date(a.undoneAt)) : null,
  }))

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const envToken = (process.env.MCP_TOKEN?.trim().length ?? 0) >= 32

  return (
    <>
      <header className="mb-6 md:mb-8">
        <p className="font-mono text-xs text-muted">Studio · MCP</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-strong md:text-4xl">MCP 金鑰</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          讓 Claude（排程、Claude Code）透過 MCP 讀寫筆記本、日記與書摘。每把金鑰有自己的權限，只給需要的程度；它做的每個改動都記在下面的「最近動作」，可以退回。
        </p>
      </header>
      <McpKeysPanel initial={keys} activity={activity} endpoint={`${proto}://${host}/api/mcp`} envToken={envToken} />
    </>
  )
}
