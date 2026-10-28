'use server'

import { fail, type ActionResult } from '@/lib/actionUtils'
import { searchEverything, type SearchHit } from '@/lib/searchCore'
import { requireActionSession } from '@/lib/session'

export type { SearchHit, SearchKind } from '@/lib/searchCore'

/** Ctrl/⌘ K (lib/searchCore.ts). */
export async function search(query: string): Promise<ActionResult<SearchHit[]>> {
  try {
    return { ok: true, data: await searchEverything(await requireActionSession(), query) }
  } catch (error) {
    return fail(error)
  }
}
