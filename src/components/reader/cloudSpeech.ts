'use client'

import { useEffect, useState } from 'react'
import type { CloudProvider, TtsStatus } from '@/lib/tts'

// Cloud voices in the browser: which services are set up (GET /api/tts, asked
// once per visit) and the audio for a piece of text, kept in Cache Storage so
// a part already heard is never paid for again on this device.

const CACHE = 'reader-tts-v1'
/** Roughly 200–300 MB of audio; the oldest pieces go first. */
const MAX_ENTRIES = 600

let status: Promise<TtsStatus> | null = null

export function loadTtsStatus(): Promise<TtsStatus> {
  status ??= fetch('/api/tts')
    .then((r) => (r.ok ? (r.json() as Promise<TtsStatus>) : { azure: null, gemini: null }))
    .catch(() => {
      status = null
      return { azure: null, gemini: null }
    })
  return status
}

/** Cloud services and voices; null until known. */
export function useTtsStatus(): TtsStatus | null {
  const [value, setValue] = useState<TtsStatus | null>(null)
  useEffect(() => {
    let live = true
    void loadTtsStatus().then((s) => live && setValue(s))
    return () => {
      live = false
    }
  }, [])
  return value
}

export type SpeechRequest = { provider: CloudProvider; voice: string; style: string; lang: string; text: string }

async function keyOf(req: SpeechRequest): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify([req.provider, req.voice, req.provider === 'gemini' ? req.style : '', req.text]))
  const hash = await crypto.subtle.digest('SHA-256', data)
  return `/__tts/${Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')}`
}

async function openCache(): Promise<Cache | null> {
  try {
    return typeof caches === 'undefined' ? null : await caches.open(CACHE)
  } catch {
    return null
  }
}

async function trim(cache: Cache) {
  const keys = await cache.keys()
  if (keys.length <= MAX_ENTRIES) return
  await Promise.all(keys.slice(0, keys.length - MAX_ENTRIES + 50).map((k) => cache.delete(k)))
}

const inFlight = new Map<string, Promise<Blob>>()

/** MP3 for `req.text`, from this device's cache or the server. */
export async function speechAudio(req: SpeechRequest): Promise<Blob> {
  const key = await keyOf(req)
  const running = inFlight.get(key)
  if (running) return running
  const job = (async () => {
    const cache = await openCache()
    const hit = await cache?.match(key).catch(() => undefined)
    if (hit) return hit.blob()
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(body?.error ?? `語音產生失敗（${res.status}）`)
    }
    const blob = await res.blob()
    if (cache) {
      await cache.put(key, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } })).catch(() => undefined)
      void trim(cache).catch(() => undefined)
    }
    return blob
  })()
  inFlight.set(key, job)
  try {
    return await job
  } finally {
    inFlight.delete(key)
  }
}
