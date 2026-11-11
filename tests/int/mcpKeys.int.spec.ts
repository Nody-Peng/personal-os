// @vitest-environment node
import { randomBytes } from 'node:crypto'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { deleteKey, hashKey, issueKey, revokeKey, sessionForBearer } from '@/lib/mcpKeys'
import type { Session } from '@/lib/session'
import type { User } from '@/payload-types'

describe('MCP keys', () => {
  let payload: Payload
  let session: Session
  const userIds: number[] = []

  beforeAll(async () => {
    if (!/@(127\.0\.0\.1|localhost):/.test(process.env.DATABASE_URL ?? '')) throw new Error('These tests write to the database: local only.')
    payload = await getPayload({ config: await config })
    const user = await payload.create({
      collection: 'users',
      data: { email: `keys-${randomBytes(4).toString('hex')}@example.test`, password: randomBytes(16).toString('hex') },
    })
    userIds.push(user.id)
    session = { payload, user: { ...user, collection: 'users' } as User }
  }, 60_000)

  afterAll(async () => {
    if (!payload) return
    await payload.delete({ collection: 'mcp-keys', where: { user: { in: userIds } }, overrideAccess: true })
    for (const id of userIds) await payload.delete({ collection: 'users', id })
  })

  it('issues a key that is shown once and stored only as a hash', async () => {
    const { id, key } = await issueKey(session, '  測試排程  ', null)
    expect(key).toMatch(/^pos_[A-Za-z0-9_-]{43}$/)
    const seen = await payload.findByID({ collection: 'mcp-keys', id, depth: 0, user: session.user, overrideAccess: false })
    expect(seen).toMatchObject({ name: '測試排程', prefix: key.slice(0, 12), expiresAt: null })
    expect(seen).not.toHaveProperty('hash')
    const stored = await payload.findByID({ collection: 'mcp-keys', id, depth: 0, overrideAccess: true })
    expect(stored.hash).toBe(hashKey(key))
    expect(stored.hash).not.toContain(key)
  })

  it('lets a live key in as its account, and nothing else', async () => {
    const { id, key } = await issueKey(session, '連線測試', 30)
    const found = await sessionForBearer(payload, `Bearer ${key}`)
    expect(found?.user.id).toBe(session.user.id)
    const used = await payload.findByID({ collection: 'mcp-keys', id, depth: 0, overrideAccess: true })
    expect(used.lastUsedAt).toBeTruthy()

    expect(await sessionForBearer(payload, null)).toBeNull()
    expect(await sessionForBearer(payload, key)).toBeNull()
    expect(await sessionForBearer(payload, `Bearer ${key.slice(0, -1)}x`)).toBeNull()
    expect(await sessionForBearer(payload, `Bearer pos_${'a'.repeat(43)}`)).toBeNull()
  })

  it('stops a revoked or expired key, and deletes only keys that no longer work', async () => {
    const revoked = await issueKey(session, '撤銷測試', null)
    await expect(deleteKey(session, revoked.id)).rejects.toThrow('請先撤銷')
    await revokeKey(session, revoked.id)
    expect(await sessionForBearer(payload, `Bearer ${revoked.key}`)).toBeNull()
    await deleteKey(session, revoked.id)
    expect((await payload.find({ collection: 'mcp-keys', where: { id: { equals: revoked.id } }, overrideAccess: true })).totalDocs).toBe(0)

    const expired = await issueKey(session, '過期測試', 30)
    await payload.update({ collection: 'mcp-keys', id: expired.id, data: { expiresAt: new Date(Date.now() - 1000).toISOString() }, overrideAccess: true })
    expect(await sessionForBearer(payload, `Bearer ${expired.key}`)).toBeNull()
  })

  it('refuses a key without a name or with an unknown lifetime', async () => {
    await expect(issueKey(session, '   ', null)).rejects.toThrow('名字')
    // @ts-expect-error: a lifetime the form doesn't offer
    await expect(issueKey(session, '期限', 7)).rejects.toThrow('期限')
  })
})
