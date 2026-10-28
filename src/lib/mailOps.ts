import 'server-only'
import type { Session } from './session'

// Email Claude sends the owner through the MCP endpoint (e.g. the daily
// briefings), through Resend's HTTP API (RESEND_API_KEY). It only ever goes to
// the owner: MAIL_TO, or else the account's own address; the caller can't pick
// a recipient. Without MAIL_FROM it is sent from Resend's test address, which
// may only write to the email the Resend account was opened with.

export const MAX_MAIL_TEXT = 50_000
const DEFAULT_FROM = 'Personal OS <onboarding@resend.dev>'

export type SentMail = { id: string; to: string }

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** The plain text as HTML: lines kept (Outlook ignores pre-wrap) and addresses clickable. */
export function mailHtml(text: string): string {
  const body = escapeHtml(text)
    .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]）。，、；：！？]/g, (url) => `<a href="${url}" style="color:#1F3A68">${url}</a>`)
    .replace(/\r?\n/g, '<br>\n')
  return `<!doctype html><html><body style="margin:0;padding:24px 16px;background:#F2F1EC"><div style="max-width:640px;margin:0 auto;font:15px/1.75 -apple-system,'PingFang TC','Microsoft JhengHei','Noto Sans TC',sans-serif;color:#1A1C22">${body}</div></body></html>`
}

export async function mailOwner({ user }: Session, input: { subject: string; text: string }): Promise<SentMail> {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) throw new Error('還沒設定寄信：請在 Vercel 的環境變數加上 RESEND_API_KEY（resend.com 的 API key）後重新部署')
  const to = process.env.MAIL_TO?.trim() || user.email
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM?.trim() || DEFAULT_FROM,
      to: [to],
      subject: input.subject,
      text: input.text,
      html: mailHtml(input.text),
    }),
    signal: AbortSignal.timeout(20_000),
  })
  const answer = (await res.json().catch(() => null)) as { id?: string; message?: string } | null
  if (!res.ok || !answer?.id) throw new Error(`寄信失敗（${res.status}）${answer?.message ? `：${answer.message}` : ''}`)
  return { id: answer.id, to }
}
