import 'server-only'
import config from '@payload-config'
import { getPayload } from 'payload'
import type { User } from '@/payload-types'
import type { Session } from '../session'

// Claude acts as the site's owner (a single-owner site): the account named by
// MCP_USER_EMAIL, or else the first account. It still goes through the normal
// access rules (`user` + overrideAccess: false), like a logged-in browser.

export async function ownerSession(): Promise<Session> {
  const payload = await getPayload({ config })
  const email = process.env.MCP_USER_EMAIL?.trim().toLowerCase()
  const { docs } = await payload.find({
    collection: 'users',
    where: email ? { email: { equals: email } } : undefined,
    sort: 'id',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const user = docs[0]
  if (!user) throw new Error(email ? `找不到 ${email} 這個帳號` : '還沒有任何帳號')
  return { payload, user: { ...user, collection: 'users' } as User }
}
