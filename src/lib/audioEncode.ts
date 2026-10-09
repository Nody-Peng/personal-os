// WAV (or raw 16-bit PCM) to MP3, for Gemini's speech (lib/ttsServer.ts).
// Plain functions with no server-only imports, so tests can run them.

const MP3_KBPS = 48

/** 16-bit PCM from a WAV file, or raw 24 kHz mono samples when there's no RIFF header. */
export function readPcm(input: Uint8Array): { samples: Int16Array; sampleRate: number; channels: number } {
  // A Node Buffer is a view into a shared pool: copy into a plain array so .slice().buffer is ours.
  const bytes = Object.getPrototypeOf(input) === Uint8Array.prototype ? input : new Uint8Array(input)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (at: number) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3])
  if (bytes.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') {
    const even = bytes.byteLength - (bytes.byteLength % 2)
    return { samples: new Int16Array(bytes.slice(0, even).buffer), sampleRate: 24000, channels: 1 }
  }
  let sampleRate = 24000
  let channels = 1
  for (let at = 12; at + 8 <= bytes.length; ) {
    const id = tag(at)
    const size = view.getUint32(at + 4, true)
    const body = at + 8
    if (id === 'fmt ') {
      channels = view.getUint16(body + 2, true)
      sampleRate = view.getUint32(body + 4, true)
      if (view.getUint16(body + 14, true) !== 16) throw new Error('不支援的聲音格式')
    } else if (id === 'data') {
      const end = Math.min(bytes.length, body + size)
      const length = Math.floor((end - body) / 2)
      return { samples: new Int16Array(bytes.slice(body, body + length * 2).buffer), sampleRate, channels }
    }
    at = body + size + (size % 2)
  }
  throw new Error('聲音檔沒有內容')
}

export async function pcmToMp3(bytes: Uint8Array): Promise<Uint8Array> {
  const { samples, sampleRate, channels } = readPcm(bytes)
  // Mono for speech: average the channels if there are more.
  const frames = Math.floor(samples.length / channels)
  const mono = new Float32Array(frames)
  for (let i = 0; i < frames; i++) {
    let sum = 0
    for (let c = 0; c < channels; c++) sum += samples[i * channels + c]
    mono[i] = sum / channels / 32768
  }
  const { createMp3Encoder } = await import('wasm-media-encoders')
  const encoder = await createMp3Encoder()
  encoder.configure({ sampleRate, channels: 1, bitrate: MP3_KBPS })
  const parts = [encoder.encode([mono]).slice(), encoder.finalize().slice()]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}
