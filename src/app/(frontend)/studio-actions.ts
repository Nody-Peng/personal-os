'use server'

import { revalidatePath } from 'next/cache'
import { cleanId, fail, type ActionResult } from '@/lib/actionUtils'
import { undoActivity } from '@/lib/mcpActivity'
import { deleteKey, isKeyLevel, issueKey, KEY_LIFETIMES, KEY_NAME_MAX, revokeKey, setKeyLevel, type KeyLifetime } from '@/lib/mcpKeys'
import { requireActionSession } from '@/lib/session'

// Server actions for /studio: MCP keys (lib/mcpKeys.ts) and what was done with
// them (lib/mcpActivity.ts).

export async function createMcpKey(name: string, lifetimeDays: number | null, level: string): Promise<ActionResult<{ id: number; key: string }>> {
  try {
    const lifetime = KEY_LIFETIMES.find((d) => d === lifetimeDays)
    if (lifetime === undefined) throw new Error('期限只能選不過期、30、90 或 365 天')
    if (!isKeyLevel(level)) throw new Error('權限只能選唯讀、可新增、可編輯或完整')
    const session = await requireActionSession()
    const data = await issueKey(session, String(name ?? '').slice(0, KEY_NAME_MAX), lifetime as KeyLifetime, level)
    revalidatePath('/studio')
    return { ok: true, data }
  } catch (error) {
    return fail(error)
  }
}

export async function setMcpKeyLevel(id: number, level: string): Promise<ActionResult> {
  try {
    id = cleanId(id)
    if (!isKeyLevel(level)) throw new Error('權限只能選唯讀、可新增、可編輯或完整')
    await setKeyLevel(await requireActionSession(), id, level)
    revalidatePath('/studio')
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

/** Takes back one change Claude made (/studio 最近動作). */
export async function undoMcpActivity(id: number): Promise<ActionResult<string>> {
  try {
    id = cleanId(id)
    const message = await undoActivity(await requireActionSession(), id)
    revalidatePath('/studio')
    revalidatePath('/journal')
    return { ok: true, data: message }
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
