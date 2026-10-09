'use client'

// Fetches an EPUB (with progress) and keeps a copy in the browser's Cache
// Storage, so a book opens instantly the second time and works offline.
// The page-count index epub.js builds (`locations`) is cached the same way.

const CACHE = 'reader-books-v1'

async function openCache(): Promise<Cache | null> {
  try {
    return typeof caches === 'undefined' ? null : await caches.open(CACHE)
  } catch {
    return null
  }
}

export async function fetchBook(url: string, onProgress: (fraction: number | null) => void): Promise<ArrayBuffer> {
  const cache = await openCache()
  const hit = await cache?.match(url).catch(() => undefined)
  if (hit) return hit.arrayBuffer()

  // Same-origin credentials: in production this redirects to a signed storage
  // URL, which must not receive (and can't accept) the login cookie.
  const res = await fetch(url)
  if (!res.ok) throw new Error(res.status === 404 ? '找不到這本書的檔案' : `下載失敗（${res.status}）`)
  const total = Number(res.headers.get('content-length')) || 0
  let buffer: ArrayBuffer
  if (res.body && total) {
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length
      onProgress(Math.min(1, received / total))
    }
    const bytes = new Uint8Array(received)
    let offset = 0
    for (const c of chunks) {
      bytes.set(c, offset)
      offset += c.length
    }
    buffer = bytes.buffer
  } else {
    onProgress(null)
    buffer = await res.arrayBuffer()
  }
  await cache?.put(url, new Response(buffer.slice(0), { headers: { 'Content-Type': 'application/epub+zip' } })).catch(() => undefined)
  return buffer
}

// A path of its own: Cache Storage ignores #fragments, so `${url}#…` would overwrite the book.
const locationsKey = (url: string) => `/__reader/locations?book=${encodeURIComponent(url)}`

export async function cachedLocations(url: string): Promise<string | null> {
  const cache = await openCache()
  const hit = await cache?.match(locationsKey(url)).catch(() => undefined)
  return hit ? hit.text() : null
}

export async function storeLocations(url: string, json: string) {
  const cache = await openCache()
  await cache?.put(locationsKey(url), new Response(json, { headers: { 'Content-Type': 'application/json' } })).catch(() => undefined)
}

/** Drops a deleted book's copy. */
export async function forgetBook(url: string) {
  const cache = await openCache()
  await Promise.all([cache?.delete(url), cache?.delete(locationsKey(url))]).catch(() => undefined)
}
