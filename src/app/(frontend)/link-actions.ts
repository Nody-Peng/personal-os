'use server'

import { fail, type ActionResult } from '@/lib/actionUtils'
import type { LinkMeta } from '@/lib/linkMeta'
import { fetchLinkMeta } from '@/lib/linkPreview'
import { requireActionSession } from '@/lib/session'

/** Title, description, picture and icon of a web page, for a bookmark card. */
export async function getLinkPreview(url: string): Promise<ActionResult<LinkMeta>> {
  try {
    await requireActionSession()
    const raw = String(url ?? '').trim().slice(0, 2000)
    if (!/^https?:\/\//i.test(raw)) throw new Error('請貼上 http(s) 開頭的網址')
    return { ok: true, data: await fetchLinkMeta(raw) }
  } catch (error) {
    return fail(error)
  }
}
