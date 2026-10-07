'use server'

import { fail, type ActionResult } from '@/lib/actionUtils'
import type { LinkMeta } from '@/lib/linkMeta'
import { fetchFramePolicy, fetchLinkMeta } from '@/lib/linkPreview'
import { requireActionSession } from '@/lib/session'

function cleanUrl(url: unknown): string {
  const raw = String(url ?? '').trim().slice(0, 2000)
  if (!/^https?:\/\//i.test(raw)) throw new Error('請貼上 http(s) 開頭的網址')
  return raw
}

/** Title, description, picture and icon of a web page, for a bookmark card. */
export async function getLinkPreview(url: string): Promise<ActionResult<LinkMeta>> {
  try {
    await requireActionSession()
    return { ok: true, data: await fetchLinkMeta(cleanUrl(url)) }
  } catch (error) {
    return fail(error)
  }
}

/** Whether a web page may be shown in an embed frame (null: the site won't say). */
export async function getFramePolicy(url: string): Promise<ActionResult<boolean | null>> {
  try {
    await requireActionSession()
    return { ok: true, data: await fetchFramePolicy(cleanUrl(url)) }
  } catch (error) {
    return fail(error)
  }
}
