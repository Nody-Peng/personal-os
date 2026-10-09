/**
 * Supabase Storage refuses object keys with characters outside ASCII (a
 * Chinese file name fails with "Invalid key"), so files are stored under a
 * plain name; titles live in the document, not the file name. A name that
 * had to change gets a random suffix so two books can't end up on one key.
 */
export function storageName(name: string, fallback: string): string {
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, '') : ''
  const raw = dot > 0 ? name.slice(0, dot) : name
  const base = raw
    .replace(/[^A-Za-z0-9_.-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80)
  if (base === raw && base) return `${base}${ext}`
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${base || fallback}-${suffix}${ext}`
}
