// Helpers shared by server actions (a 'use server' file may only export
// async functions, so these live here).

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

export function fail(error: unknown): { ok: false; error: string } {
  return { ok: false, error: error instanceof Error ? error.message : '發生錯誤，請再試一次' }
}

export function clampInt(n: unknown, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(Number(n) || 0)))
}

export function cleanText(value: unknown, max: number): string {
  return String(value ?? '').slice(0, max)
}

const MAX_BLOCKS_BYTES = 500_000

/** Editor documents are arrays of blocks; reject anything else or anything huge. */
export function cleanBlocks(value: unknown): unknown[] | null {
  if (value == null) return null
  if (!Array.isArray(value)) throw new Error('內容格式錯誤')
  if (JSON.stringify(value).length > MAX_BLOCKS_BYTES) throw new Error('內容太長了，請拆成幾則')
  return value
}
