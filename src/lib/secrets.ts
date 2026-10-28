import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Whether an Authorization header carries `Bearer <secret>`. Compares hashes in
 * constant time, so response timing reveals nothing about the secret.
 */
export function bearerMatches(header: string | null, secret: string): boolean {
  const digest = (text: string) => createHash('sha256').update(text).digest()
  return header != null && timingSafeEqual(digest(header), digest(`Bearer ${secret}`))
}
