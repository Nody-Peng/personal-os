import 'server-only'
import config from '@payload-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload, type Payload } from 'payload'
import type { User } from '@/payload-types'

export type Session = { payload: Payload; user: User }

export async function getSession(): Promise<Session | null> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  return user ? { payload, user: user as User } : null
}

/** For pages: sends visitors to the login page and back to `returnTo`. */
export async function requireSession(returnTo: string): Promise<Session> {
  const session = await getSession()
  if (!session) redirect(`/login?redirect=${encodeURIComponent(returnTo)}`)
  return session
}

/** Only same-site paths are allowed after login (no open redirects). */
export function safeRedirect(target: string | null | undefined): string {
  return target && target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/\\') ? target : '/'
}

/** For server actions: never trust the caller, always re-check the cookie. */
export async function requireActionSession(): Promise<Session> {
  const session = await getSession()
  if (!session) throw new Error('請先登入')
  return session
}
