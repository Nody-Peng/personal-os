import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import type { Payload } from 'payload'
import type { McpKey, User } from '@/payload-types'
import type { McpActor } from './mcpActivity'
import { MCP_KEY_LEVELS, type McpKeyLevel } from './options'
import type { Session } from './session'

// Keys for the MCP endpoint, issued on /studio. A key is "pos_" plus 32 random
// bytes; only its SHA-256 hash is stored (a key this random needs no slow
// hash), so a key shown once can't be recovered from the database. Requests
// carry it as "Authorization: Bearer <key>" and act as the account that made it,
// with only the tools its level allows (lib/mcp/tools.ts, TOOL_LEVELS).

export const KEY_PREFIX = 'pos_'
export const MAX_ACTIVE_KEYS = 20
export const KEY_NAME_MAX = 60
/** Choices for a new key's lifetime; null = never expires. */
export const KEY_LIFETIMES = [null, 30, 90, 365] as const
export type KeyLifetime = (typeof KEY_LIFETIMES)[number]
export const DEFAULT_KEY_LEVEL: McpKeyLevel = 'add'

export const isKeyLevel = (value: unknown): value is McpKeyLevel => MCP_KEY_LEVELS.some((l) => l.value === value)

/** lastUsedAt is written at most this often, so busy clients don't write on every call. */
const LAST_USED_EVERY_MS = 10 * 60_000
const KEY_PATTERN = /^Bearer\s+(pos_[A-Za-z0-9_-]{43})\s*$/

export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex')

export type KeyState = 'active' | 'revoked' | 'expired'

export function keyState(key: Pick<McpKey, 'revokedAt' | 'expiresAt'>, now = Date.now()): KeyState {
  if (key.revokedAt) return 'revoked'
  if (key.expiresAt && Date.parse(key.expiresAt) <= now) return 'expired'
  return 'active'
}

/** Makes a key for the session's account. The key itself is returned only here. */
export async function issueKey(
  { payload, user }: Session,
  name: string,
  lifetime: KeyLifetime,
  level: McpKeyLevel = DEFAULT_KEY_LEVEL,
): Promise<{ id: number; key: string }> {
  const cleanName = String(name ?? '').trim().slice(0, KEY_NAME_MAX)
  if (!cleanName) throw new Error('請替金鑰取個名字，例如用在哪裡')
  if (!KEY_LIFETIMES.includes(lifetime)) throw new Error('期限只能選不過期、30、90 或 365 天')
  if (!isKeyLevel(level)) throw new Error('權限只能選唯讀、可新增、可編輯或完整')
  const { totalDocs } = await payload.count({
    collection: 'mcp-keys',
    where: {
      and: [
        { revokedAt: { exists: false } },
        { or: [{ expiresAt: { exists: false } }, { expiresAt: { greater_than: new Date().toISOString() } }] },
      ],
    },
    user,
    overrideAccess: false,
  })
  if (totalDocs >= MAX_ACTIVE_KEYS) throw new Error(`最多 ${MAX_ACTIVE_KEYS} 把使用中的金鑰，請先撤銷用不到的`)

  const key = KEY_PREFIX + randomBytes(32).toString('base64url')
  const doc = await payload.create({
    collection: 'mcp-keys',
    data: {
      name: cleanName,
      prefix: key.slice(0, KEY_PREFIX.length + 8),
      hash: hashKey(key),
      user: user.id,
      level,
      expiresAt: lifetime ? new Date(Date.now() + lifetime * 86_400_000).toISOString() : null,
    },
    user,
    overrideAccess: false,
  })
  return { id: doc.id, key }
}

export async function setKeyLevel({ payload, user }: Session, id: number, level: McpKeyLevel): Promise<void> {
  if (!isKeyLevel(level)) throw new Error('權限只能選唯讀、可新增、可編輯或完整')
  await payload.update({ collection: 'mcp-keys', id, data: { level }, user, overrideAccess: false })
}

export async function revokeKey({ payload, user }: Session, id: number): Promise<void> {
  await payload.update({ collection: 'mcp-keys', id, data: { revokedAt: new Date().toISOString() }, user, overrideAccess: false })
}

/** Only keys that no longer work can be deleted, so a live key is never lost without a trace. */
export async function deleteKey({ payload, user }: Session, id: number): Promise<void> {
  const key = await payload.findByID({ collection: 'mcp-keys', id, depth: 0, user, overrideAccess: false })
  if (keyState(key) === 'active') throw new Error('請先撤銷這把金鑰')
  await payload.delete({ collection: 'mcp-keys', id, user, overrideAccess: false })
}

/**
 * The account an Authorization header's key acts as, and who is calling (the
 * key and its level), or null when the header holds no live key. Runs before
 * anyone is known, hence overrideAccess.
 */
export async function sessionForBearer(payload: Payload, header: string | null): Promise<{ session: Session; actor: McpActor } | null> {
  const key = KEY_PATTERN.exec(header ?? '')?.[1]
  if (!key) return null
  const { docs } = await payload.find({
    collection: 'mcp-keys',
    where: { hash: { equals: hashKey(key) } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const found = docs[0]
  if (!found || keyState(found) !== 'active') return null
  const userId = typeof found.user === 'object' ? found.user.id : found.user
  const user = await payload.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true }).catch(() => null)
  if (!user) return null
  if (!found.lastUsedAt || Date.now() - Date.parse(found.lastUsedAt) > LAST_USED_EVERY_MS) {
    await payload
      .update({ collection: 'mcp-keys', id: found.id, data: { lastUsedAt: new Date().toISOString() }, depth: 0, overrideAccess: true })
      .catch(() => null)
  }
  return {
    session: { payload, user: { ...user, collection: 'users' } as User },
    actor: { keyId: found.id, name: found.name, level: isKeyLevel(found.level) ? found.level : DEFAULT_KEY_LEVEL },
  }
}
