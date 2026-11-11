'use server'

import { revalidatePath } from 'next/cache'
import { cleanId, fail, type ActionResult } from '@/lib/actionUtils'
import { deleteKey, issueKey, KEY_LIFETIMES, KEY_NAME_MAX, revokeKey, type KeyLifetime } from '@/lib/mcpKeys'
import { requireActionSession } from '@/lib/session'

// Server actions for /studio: MCP keys (lib/mcpKeys.ts).

export async function createMcpKey(name: string, lifetimeDays: number | null): Promise<ActionResult<{ id: number; key: string }>> {
  try {
    const lifetime = KEY_LIFETIMES.find((d) => d === lifetimeDays)
    if (lifetime === undefined) throw new Error('期限只能選不過期、30、90 或 365 天')
    const session = await requireActionSession()
    const data = await issueKey(session, String(name ?? '').slice(0, KEY_NAME_MAX), lifetime as KeyLifetime)
    revalidatePath('/studio')
    return { ok: true, data }
  } catch (error) {
    return fail(error)
  }
}

export async function revokeMcpKey(id: number): Promise<ActionResult> {
  try {
    id = cleanId(id)
    await revokeKey(await requireActionSession(), id)
    revalidatePath('/studio')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

export async function deleteMcpKey(id: number): Promise<ActionResult> {
  try {
    id = cleanId(id)
    await deleteKey(await requireActionSession(), id)
    revalidatePath('/studio')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}
