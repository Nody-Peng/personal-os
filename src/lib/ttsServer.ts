import 'server-only'
import { pcmToMp3 } from './audioEncode'
import { GEMINI_VOICES, geminiStyleText, type CloudVoice, type TtsStatus } from './tts'

// Speech synthesis for read aloud, on the server so the keys stay here.
//   Azure  (AZURE_SPEECH_KEY + AZURE_SPEECH_REGION): MP3 straight from the service.
//   Gemini (GEMINI_API_KEY, optional GEMINI_TTS_MODEL): WAV, encoded to MP3 here
//          (about 8x smaller, which matters for the device cache and Vercel's
//          4.5 MB response limit).
// TTS_MOCK=1 (development only) answers with a tone as long as the text would
// take to read, so the reader can be tried without keys.

export type TtsConfig = {
  azure: { key: string; region: string } | null
  gemini: { key: string; model: string } | null
  mock: boolean
}

export function ttsConfig(): TtsConfig {
  const azureKey = process.env.AZURE_SPEECH_KEY?.trim()
  const azureRegion = process.env.AZURE_SPEECH_REGION?.trim()
  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  return {
    azure: azureKey && azureRegion ? { key: azureKey, region: azureRegion } : null,
    gemini: geminiKey ? { key: geminiKey, model: process.env.GEMINI_TTS_MODEL?.trim() || 'gemini-3.8-flash-tts' } : null,
    mock: process.env.TTS_MOCK === '1' && process.env.NODE_ENV !== 'production',
  }
}

export class TtsError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message)
  }
}

// ---- Azure ----

type AzureVoiceInfo = { ShortName: string; LocalName?: string; DisplayName?: string; Locale: string; VoiceType?: string; Gender?: string }

let azureVoicesCache: { at: number; region: string; voices: CloudVoice[] } | null = null
const VOICES_TTL = 12 * 3600_000

/** The service's neural voices (cached for half a day). */
export async function azureVoices(cfg: NonNullable<TtsConfig['azure']>): Promise<CloudVoice[]> {
  if (azureVoicesCache && azureVoicesCache.region === cfg.region && Date.now() - azureVoicesCache.at < VOICES_TTL) {
    return azureVoicesCache.voices
  }
  const res = await fetch(`https://${cfg.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
    headers: { 'Ocp-Apim-Subscription-Key': cfg.key },
  })
  if (!res.ok) throw new TtsError(res.status === 401 ? 'Azure 金鑰或地區設定錯誤' : `Azure 語音清單讀取失敗（${res.status}）`)
  const list = (await res.json()) as AzureVoiceInfo[]
  const voices = list
    .filter((v) => !v.VoiceType || v.VoiceType === 'Neural')
    .map((v) => ({
      id: v.ShortName,
      label: v.LocalName || v.DisplayName || v.ShortName,
      locale: v.Locale,
      note: [v.Gender === 'Female' ? '女聲' : v.Gender === 'Male' ? '男聲' : '', /Multilingual/.test(v.ShortName) ? '多語' : '']
        .filter(Boolean)
        .join(' · '),
    }))
  azureVoicesCache = { at: Date.now(), region: cfg.region, voices }
  return voices
}

const xmlEscape = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!)

async function synthesizeAzure(cfg: NonNullable<TtsConfig['azure']>, voice: string, text: string): Promise<Uint8Array> {
  const locale = voice.split('-').slice(0, 2).join('-')
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${xmlEscape(locale)}"><voice name="${xmlEscape(voice)}">${xmlEscape(text)}</voice></speak>`
  const res = await fetch(`https://${cfg.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': cfg.key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'personal-os-reader',
    },
    body: ssml,
  })
  if (res.status === 401 || res.status === 403) throw new TtsError('Azure 金鑰或地區設定錯誤')
  if (res.status === 429) throw new TtsError('Azure 用量到上限了（免費額度用完，或請求太頻繁）', 429)
  if (!res.ok) throw new TtsError(`Azure 語音產生失敗（${res.status}）`)
  return new Uint8Array(await res.arrayBuffer())
}

// ---- Gemini ----

type GeminiResponse = {
  steps?: { type?: string; content?: { type?: string; data?: string; mime_type?: string }[] }[]
  error?: { message?: string }
}

async function synthesizeGemini(
  cfg: NonNullable<TtsConfig['gemini']>,
  voice: string,
  text: string,
  style: string,
  lang: string,
): Promise<Uint8Array> {
  if (!GEMINI_VOICES.some((v) => v.id === voice)) throw new TtsError('沒有這個 Gemini 語音', 400)
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'x-goog-api-key': cfg.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      input: [
        {
          type: 'user_input',
          content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style: geminiStyleText(style, lang) }] }],
        },
      ],
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice }] },
    }),
  })
  if (res.status === 401 || res.status === 403) throw new TtsError('Gemini API 金鑰錯誤，或沒有權限使用這個模型')
  if (res.status === 429) throw new TtsError('Gemini 用量到上限了（每分鐘或每天的次數），稍等再試', 429)
  const body = (await res.json().catch(() => ({}))) as GeminiResponse
  if (!res.ok) throw new TtsError(`Gemini 語音產生失敗（${res.status}${body.error?.message ? `：${body.error.message.slice(0, 120)}` : ''}）`)
  const audio = (body.steps ?? [])
    .filter((s) => s.type === 'model_output')
    .flatMap((s) => s.content ?? [])
    .filter((c) => c.type === 'audio' && c.data)
    .at(-1)
  if (!audio?.data) throw new TtsError('Gemini 沒有回傳聲音')
  return pcmToMp3(new Uint8Array(Buffer.from(audio.data, 'base64')))
}

// ---- development stand-in ----

/** A soft tone as long as reading the text would take (Chinese ~4.5 chars/s, else ~14). */
async function mockSpeech(text: string): Promise<Uint8Array> {
  const cjk = (text.match(/[㐀-鿿぀-ヿ]/g) ?? []).length
  const seconds = Math.max(1, cjk / 4.5 + (text.length - cjk) / 14)
  const rate = 24000
  const pcm = new Int16Array(Math.round(seconds * rate))
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.round(Math.sin((i / rate) * 2 * Math.PI * 220) * 0.08 * 32767)
  return pcmToMp3(new Uint8Array(pcm.buffer))
}

// ---- entry points ----

export async function ttsStatus(cfg: TtsConfig): Promise<TtsStatus> {
  let azure: CloudVoice[] | null = null
  if (cfg.azure) azure = await azureVoices(cfg.azure).catch(() => [])
  const gemini = cfg.gemini || cfg.mock ? GEMINI_VOICES : null
  return { azure, gemini }
}

export async function synthesize(
  cfg: TtsConfig,
  req: { provider: 'azure' | 'gemini'; voice: string; text: string; style: string; lang: string },
): Promise<Uint8Array> {
  if (req.provider === 'azure') {
    if (!cfg.azure) throw new TtsError('還沒設定 Azure 語音（AZURE_SPEECH_KEY、AZURE_SPEECH_REGION）', 400)
    return synthesizeAzure(cfg.azure, req.voice, req.text)
  }
  if (!cfg.gemini) {
    if (cfg.mock) return mockSpeech(req.text)
    throw new TtsError('還沒設定 Gemini 語音（GEMINI_API_KEY）', 400)
  }
  return synthesizeGemini(cfg.gemini, req.voice, req.text, req.style, req.lang)
}
