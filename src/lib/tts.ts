// Cloud voices for read aloud (Azure Speech, Gemini TTS): what the server
// route (app/(frontend)/api/tts) and the reader share. Keys never leave the
// server; the browser only learns which services are set up and their voices.

export type CloudProvider = 'azure' | 'gemini'
export type TtsSource = 'browser' | CloudProvider

export type CloudVoice = { id: string; label: string; locale: string | null; note?: string }

/** GET /api/tts: voices per service, null when the service has no key. */
export type TtsStatus = { azure: CloudVoice[] | null; gemini: CloudVoice[] | null }

/** One request reads about this much text (a few sentences, ~1 minute of audio). */
export const CHUNK_CHARS = 300
export const MAX_TTS_CHARS = 1200

/** Gemini's prebuilt voices; each speaks every language. Notes are Google's descriptions. */
export const GEMINI_VOICES: CloudVoice[] = [
  ['Sulafat', '溫暖'],
  ['Vindemiatrix', '溫柔'],
  ['Achernar', '柔和'],
  ['Gacrux', '成熟'],
  ['Schedar', '平穩'],
  ['Kore', '堅定'],
  ['Charon', '知性'],
  ['Sadaltager', '博學'],
  ['Iapetus', '清晰'],
  ['Erinome', '清晰'],
  ['Algieba', '圓潤'],
  ['Despina', '圓潤'],
  ['Achird', '友善'],
  ['Callirrhoe', '隨和'],
  ['Umbriel', '隨和'],
  ['Zubenelgenubi', '隨性'],
  ['Aoede', '輕鬆'],
  ['Leda', '年輕'],
  ['Zephyr', '明亮'],
  ['Autonoe', '明亮'],
  ['Puck', '輕快'],
  ['Laomedeia', '輕快'],
  ['Sadachbia', '活潑'],
  ['Fenrir', '興奮'],
  ['Orus', '堅定'],
  ['Alnilam', '堅定'],
  ['Rasalgethi', '知性'],
  ['Pulcherrima', '直率'],
  ['Enceladus', '氣音'],
  ['Algenib', '沙啞'],
].map(([id, note]) => ({ id, label: id, locale: null, note }))

export const DEFAULT_GEMINI_VOICE = 'Sulafat'

/** How Gemini should read (it takes a delivery description with the text). */
export const GEMINI_STYLES = [
  { value: 'narrator', label: '有聲書', zh: '像有聲書的說書人，自然、溫暖、語速平穩，句子之間有適當停頓', en: 'like a warm, natural audiobook narrator, at an even pace with natural pauses' },
  { value: 'calm', label: '平靜', zh: '平靜、輕柔，像睡前讀給人聽', en: 'calm and soft, like reading a bedtime story' },
  { value: 'lively', label: '生動', zh: '生動、有感情，對話依角色表現情緒', en: 'lively and expressive, acting out the dialogue with emotion' },
] as const
export type GeminiStyle = (typeof GEMINI_STYLES)[number]['value']

/** The style instruction sent to Gemini; Chinese text asks for a Taiwan accent. */
export function geminiStyleText(style: string, lang: string): string {
  const s = GEMINI_STYLES.find((x) => x.value === style) ?? GEMINI_STYLES[0]
  return lang.toLowerCase().startsWith('zh') ? `用台灣口音的國語朗讀，${s.zh}` : `Read ${s.en}.`
}

/** A reasonable first Azure voice for a book language. */
export const AZURE_DEFAULTS: Record<string, string> = {
  zh: 'zh-TW-HsiaoChenNeural',
  en: 'en-US-AvaMultilingualNeural',
  ja: 'ja-JP-NanamiNeural',
  ko: 'ko-KR-SunHiNeural',
}

export const VOICE_ID = /^[\w:.-]{1,100}$/
