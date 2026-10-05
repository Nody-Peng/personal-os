// Pure helper (no server-only imports) so it can be unit tested.

const BASE = 'http://local.invalid'

// Browsers drop tabs and newlines and read '\' as '/' while parsing URLs, so
// "/\t/evil.com" or "/\evil.com" would turn into "//evil.com" (another site).
// Reject every control character, any whitespace and any backslash.
const UNSAFE = /[\u0000-\u001f\u007f-\u009f\s\\]/

/** Only same-site paths are allowed after login (no open redirects). Anything else becomes '/'. */
export function safeRedirect(target: string | null | undefined): string {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//') || UNSAFE.test(target)) return '/'
  try {
    const url = new URL(target, BASE)
    // Must stay on this site, and must not normalise into a "//host" path ("/..//evil.com").
    if (url.origin !== BASE || url.pathname.startsWith('//')) return '/'
  } catch {
    return '/'
  }
  return target
}
