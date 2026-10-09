import { describe, expect, it } from 'vitest'
import { pcmToMp3, readPcm } from '@/lib/audioEncode'
import { GEMINI_STYLES, GEMINI_VOICES, VOICE_ID, geminiStyleText } from '@/lib/tts'

/** A mono 16-bit WAV with an extra chunk before the samples, as some encoders write. */
function wav(samples: Int16Array, sampleRate: number): Uint8Array {
  const extra = 12
  const buf = new ArrayBuffer(44 + extra + samples.byteLength)
  const v = new DataView(buf)
  const text = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  v.setUint32(4, buf.byteLength - 8, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  text(36, 'LIST')
  v.setUint32(40, 4, true)
  text(44, 'INFO')
  text(48, 'data')
  v.setUint32(52, samples.byteLength, true)
  new Int16Array(buf, 56).set(samples)
  return new Uint8Array(buf)
}

describe('audio encoding', () => {
  const tone = Int16Array.from({ length: 24000 }, (_, i) => Math.round(Math.sin(i / 10) * 8000))

  it('reads samples and rate from a WAV, skipping other chunks', () => {
    const { samples, sampleRate, channels } = readPcm(wav(tone, 24000))
    expect(sampleRate).toBe(24000)
    expect(channels).toBe(1)
    expect(samples.length).toBe(tone.length)
    expect(samples[123]).toBe(tone[123])
  })

  it('treats headerless data as 24 kHz mono PCM, also from a Node Buffer view', () => {
    const pooled = Buffer.concat([Buffer.alloc(8), Buffer.from(tone.buffer)]).subarray(8)
    const { samples, sampleRate } = readPcm(pooled)
    expect(sampleRate).toBe(24000)
    expect(samples[500]).toBe(tone[500])
  })

  it('encodes one second of speech-rate audio to a small MP3', async () => {
    const mp3 = await pcmToMp3(wav(tone, 24000))
    expect(mp3[0]).toBe(0xff)
    expect(mp3[1] & 0xe0).toBe(0xe0)
    // 48 kbps: about 6 KB a second, a fraction of the 48 KB WAV.
    expect(mp3.length).toBeGreaterThan(3000)
    expect(mp3.length).toBeLessThan(10000)
  })
})

describe('voice settings', () => {
  it('accepts Azure and Gemini voice names and nothing that could break out of SSML', () => {
    expect(VOICE_ID.test('zh-TW-HsiaoChenNeural')).toBe(true)
    expect(VOICE_ID.test('zh-CN-Xiaochen:DragonHDLatestNeural')).toBe(true)
    expect(VOICE_ID.test('a"><voice name="x')).toBe(false)
    expect(GEMINI_VOICES).toHaveLength(30)
  })

  it('asks for a Taiwan accent for Chinese books only', () => {
    expect(geminiStyleText('narrator', 'zh-TW')).toContain('台灣口音')
    expect(geminiStyleText('calm', 'en')).toMatch(/^Read calm/)
    expect(geminiStyleText('unknown', 'en')).toContain(GEMINI_STYLES[0].en)
  })
})
