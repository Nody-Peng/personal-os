import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { McpKeysPanel, type KeyRow } from '@/components/studio/McpKeysPanel'
import { keyState } from '@/lib/mcpKeys'
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
    select: { name: true, prefix: true, createdAt: true, lastUsedAt: true, expiresAt: true, revokedAt: true },
    user,
    overrideAccess: false,
  })
  const keys: KeyRow[] = docs.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    state: keyState(k),
    created: day.format(new Date(k.createdAt)),
    lastUsed: k.lastUsedAt ? when.format(new Date(k.lastUsedAt)) : null,
    expires: k.expiresAt ? day.format(new Date(k.expiresAt)) : null,
    revoked: k.revokedAt ? day.format(new Date(k.revokedAt)) : null,
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
          讓 Claude（排程、Claude Code）透過 MCP 讀寫筆記本、日記與書摘。每把金鑰能做的事和你登入後一樣，只給信任的地方，用不到就撤銷。
        </p>
      </header>
      <McpKeysPanel initial={keys} endpoint={`${proto}://${host}/api/mcp`} envToken={envToken} />
    </>
  )
}
