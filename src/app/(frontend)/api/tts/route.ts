import { getSession } from '@/lib/session'
import { GEMINI_STYLES, MAX_TTS_CHARS, VOICE_ID } from '@/lib/tts'
import { TtsError, synthesize, ttsConfig, ttsStatus } from '@/lib/ttsServer'

// Read aloud with cloud voices (lib/ttsServer.ts). Logged-in only: every
// request may cost money. GET lists the services that are set up and their
// voices; POST turns a few sentences into MP3.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const fail = (message: string, status: number) => Response.json({ error: message }, { status })

export async function GET() {
  if (!(await getSession())) return fail('請先登入', 401)
  return Response.json(await ttsStatus(ttsConfig()), { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request) {
  if (!(await getSession())) return fail('請先登入', 401)
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return fail('格式錯誤', 400)
  }
  const provider = body.provider
  const voice = String(body.voice ?? '')
  const text = String(body.text ?? '').trim()
  const style = String(body.style ?? '')
  const lang = String(body.lang ?? 'zh-TW').slice(0, 20)
  if (provider !== 'azure' && provider !== 'gemini') return fail('沒有這個語音服務', 400)
  if (!VOICE_ID.test(voice)) return fail('語音名稱錯誤', 400)
  if (!text || text.length > MAX_TTS_CHARS) return fail('朗讀的文字太長或是空的', 400)
  if (provider === 'gemini' && !GEMINI_STYLES.some((s) => s.value === style)) return fail('語氣設定錯誤', 400)

  try {
    const mp3 = await synthesize(ttsConfig(), { provider, voice, text, style, lang })
    return new Response(mp3, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof TtsError) return fail(error.message, error.status)
    console.error('tts failed', error)
    return fail('語音產生失敗', 500)
  }
}
