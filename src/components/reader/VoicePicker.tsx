'use client'

import { Check, CloudCheck } from '@phosphor-icons/react'
import { useState } from 'react'
import { GEMINI_STYLES, type CloudVoice, type TtsSource, type TtsStatus } from '@/lib/tts'
import { isNaturalVoice, rankVoices, voiceKey, type TtsPrefs } from './readAloud'

const LANG_NAMES: Record<string, string> = { zh: '中文', en: '英文', ja: '日文', ko: '韓文', fr: '法文', de: '德文', es: '西班牙文' }
export const langName = (lang: string) => LANG_NAMES[voiceKey(lang)] ?? lang

/** "Microsoft HsiaoChen Online (Natural) - Chinese (Taiwanese Mandarin)" → "HsiaoChen" */
export function shortVoiceName(v: SpeechSynthesisVoice) {
  return (
    v.name
      .replace(/^(Microsoft|Google|Apple)\s+/i, '')
      .replace(/\s*\(.*$/, '')
      .replace(/\s+-\s+.*$/, '')
      .replace(/\s+Online$/i, '')
      .trim() || v.name
  )
}

const SOURCES: { value: TtsSource; label: string; sub: string }[] = [
  { value: 'browser', label: '瀏覽器', sub: '免費' },
  { value: 'azure', label: 'Azure', sub: '雲端' },
  { value: 'gemini', label: 'Gemini', sub: '雲端' },
]

const SETUP: Record<'azure' | 'gemini', string> = {
  azure: '還沒設定。在 Vercel 的環境變數加上 AZURE_SPEECH_KEY 和 AZURE_SPEECH_REGION，重新部署後就能用。',
  gemini: '還沒設定。在 Vercel 的環境變數加上 GEMINI_API_KEY，重新部署後就能用。',
}

type Props = {
  lang: string
  status: TtsStatus | null
  source: TtsSource
  browserVoices: SpeechSynthesisVoice[]
  browserVoice: SpeechSynthesisVoice | null
  azureVoice: string | null
  geminiVoice: string
  prefs: TtsPrefs
  onPrefs: (patch: Partial<TtsPrefs>) => void
  onClose: () => void
}

function Row({ active, title, note, sub, onClick }: { active: boolean; title: string; note?: string; sub?: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--r-sunken)]">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[13px]">
            <span className="truncate">{title}</span>
            {note && <span className="shrink-0 rounded-full bg-[var(--r-accent)]/12 px-1.5 py-px text-[10px] font-medium text-[var(--r-accent)]">{note}</span>}
          </span>
          {sub && <span className="block truncate font-mono text-[10.5px] text-[var(--r-muted)]">{sub}</span>}
        </span>
        {active && <Check size={15} className="shrink-0 text-[var(--r-accent)]" />}
      </button>
    </li>
  )
}

/** Choose where the voice comes from (browser / Azure / Gemini) and which voice. */
export function VoicePicker({ lang, status, source, browserVoices, browserVoice, azureVoice, geminiVoice, prefs, onPrefs, onClose }: Props) {
  const [tab, setTab] = useState<TtsSource>(source)
  const key = voiceKey(lang)
  const pick = (patch: Partial<TtsPrefs>) => {
    onPrefs(patch)
    onClose()
  }

  const azure: CloudVoice[] = status?.azure ?? []
  const azureMatching = azure.filter((v) => v.locale && voiceKey(v.locale) === key)
  const azureMultilingual = azure.filter((v) => v.locale && voiceKey(v.locale) !== key && /Multilingual/.test(v.id))
  const { matching, others } = rankVoices(browserVoices, lang)

  return (
    <div className="reader-pop mb-2 flex max-h-[min(30rem,60dvh)] flex-col overflow-hidden rounded-2xl border border-[var(--r-line)] bg-[var(--r-surface)] text-[var(--r-ink)] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.35)]">
      <div role="tablist" aria-label="語音來源" className="grid grid-cols-3 gap-1 border-b border-[var(--r-line)] p-2">
        {SOURCES.map((s) => {
          const ready = s.value === 'browser' || Boolean(status?.[s.value])
          return (
            <button
              key={s.value}
              type="button"
              role="tab"
              aria-selected={tab === s.value}
              onClick={() => setTab(s.value)}
              className={`grid rounded-lg px-2 py-1.5 text-center transition-colors ${
                tab === s.value ? 'bg-[var(--r-sunken)] text-[var(--r-ink)]' : 'text-[var(--r-muted)] hover:text-[var(--r-ink)]'
              }`}
            >
              <span className="flex items-center justify-center gap-1 text-[13px] font-medium">
                {s.label}
                {source === s.value && <Check size={12} weight="bold" className="text-[var(--r-accent)]" />}
              </span>
              <span className="text-[10.5px]">{ready ? s.sub : '未設定'}</span>
            </button>
          )
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {tab === 'browser' && (
          <>
            <p className="px-3 pt-1 pb-1 text-xs text-[var(--r-muted)]">{langName(lang)}語音（這台裝置內建）</p>
            {matching.length ? (
              <ul>
                {matching.map((v) => (
                  <Row
                    key={v.voiceURI}
                    active={source === 'browser' && v.voiceURI === browserVoice?.voiceURI}
                    title={shortVoiceName(v)}
                    note={isNaturalVoice(v) ? '自然' : undefined}
                    sub={v.lang}
                    onClick={() => pick({ source: 'browser', voices: { ...prefs.voices, [key]: v.voiceURI } })}
                  />
                ))}
              </ul>
            ) : (
              <p className="px-3 pb-3 text-[13px] leading-relaxed text-[var(--r-muted)]">
                這台裝置沒有{langName(lang)}語音。可以在系統設定加裝語音，或改用 Edge 瀏覽器（內建自然語音）。
              </p>
            )}
            {others.length > 0 && (
              <details className="mt-1 border-t border-[var(--r-line)] pt-1">
                <summary className="cursor-pointer px-3 py-2 text-xs text-[var(--r-muted)]">其他語言（{others.length}）</summary>
                <ul>
                  {others.map((v) => (
                    <Row
                      key={v.voiceURI}
                      active={source === 'browser' && v.voiceURI === browserVoice?.voiceURI}
                      title={shortVoiceName(v)}
                      sub={v.lang}
                      onClick={() => pick({ source: 'browser', voices: { ...prefs.voices, [key]: v.voiceURI } })}
                    />
                  ))}
                </ul>
              </details>
            )}
          </>
        )}

        {tab !== 'browser' && !status && <p className="px-3 py-6 text-center text-sm text-[var(--r-muted)]">讀取中…</p>}
        {tab !== 'browser' && status && !status[tab] && <p className="px-3 py-4 text-[13px] leading-relaxed text-[var(--r-muted)]">{SETUP[tab]}</p>}

        {tab === 'azure' && status?.azure && (
          <>
            {azure.length === 0 && <p className="px-3 py-4 text-[13px] text-[var(--r-muted)]">讀不到 Azure 的語音清單，請確認金鑰和地區。</p>}
            {azureMatching.length > 0 && <p className="px-3 pt-1 pb-1 text-xs text-[var(--r-muted)]">{langName(lang)}語音</p>}
            <ul>
              {azureMatching.map((v) => (
                <Row
                  key={v.id}
                  active={source === 'azure' && v.id === azureVoice}
                  title={v.label}
                  note={v.note || undefined}
                  sub={v.id}
                  onClick={() => pick({ source: 'azure', azure: { ...prefs.azure, [key]: v.id } })}
                />
              ))}
            </ul>
            {azureMultilingual.length > 0 && (
              <details className="mt-1 border-t border-[var(--r-line)] pt-1">
                <summary className="cursor-pointer px-3 py-2 text-xs text-[var(--r-muted)]">多語語音（也會念{langName(lang)}，{azureMultilingual.length}）</summary>
                <ul>
                  {azureMultilingual.map((v) => (
                    <Row
                      key={v.id}
                      active={source === 'azure' && v.id === azureVoice}
                      title={v.label}
                      note={v.note || undefined}
                      sub={v.id}
                      onClick={() => pick({ source: 'azure', azure: { ...prefs.azure, [key]: v.id } })}
                    />
                  ))}
                </ul>
              </details>
            )}
          </>
        )}

        {tab === 'gemini' && status?.gemini && (
          <>
            <p className="px-3 pt-1 pb-1.5 text-xs text-[var(--r-muted)]">語氣</p>
            <div className="flex gap-1.5 px-3 pb-3">
              {GEMINI_STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={prefs.geminiStyle === s.value}
                  onClick={() => onPrefs({ source: 'gemini', geminiStyle: s.value })}
                  className={`h-8 rounded-full border px-3 text-[12.5px] transition-colors ${
                    prefs.geminiStyle === s.value
                      ? 'border-[var(--r-ink)] bg-[var(--r-ink)] text-[var(--r-surface)]'
                      : 'border-[var(--r-line)] text-[var(--r-muted)] hover:text-[var(--r-ink)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="px-3 pb-1 text-xs text-[var(--r-muted)]">聲音（每個都會念{langName(lang)}）</p>
            <ul>
              {status.gemini.map((v) => (
                <Row
                  key={v.id}
                  active={source === 'gemini' && v.id === geminiVoice}
                  title={v.label}
                  note={v.note}
                  onClick={() => pick({ source: 'gemini', gemini: v.id })}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      {tab !== 'browser' && status?.[tab] && (
        <p className="flex items-start gap-2 border-t border-[var(--r-line)] px-4 py-2.5 text-[11.5px] leading-relaxed text-[var(--r-muted)]">
          <CloudCheck size={15} className="mt-px shrink-0" />
          雲端語音依用量計費：每段第一次念到才產生，念過的會存在這台裝置，重聽不再計費。手機鎖屏也能繼續聽。
        </p>
      )}
    </div>
  )
}
