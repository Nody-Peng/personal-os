'use client'

import { Check, CircleNotch, MoonStars, Pause, Play, SkipBack, SkipForward, Waveform, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ReadAloudState } from './readAloud'

export const RATES = [0.8, 1, 1.2, 1.4, 1.7, 2] as const

/** Sleep timer: stop after some minutes, or at the end of the chapter. */
export type Sleep = { mode: 'off' } | { mode: 'chapter' } | { mode: 'time'; until: number; minutes: number }

const SLEEP_OPTIONS: { label: string; value: 'off' | 'chapter' | number }[] = [
  { label: '不定時', value: 'off' },
  { label: '15 分鐘', value: 15 },
  { label: '30 分鐘', value: 30 },
  { label: '60 分鐘', value: 60 },
  { label: '這章念完', value: 'chapter' },
]

export function sleepFrom(value: 'off' | 'chapter' | number): Sleep {
  if (value === 'off') return { mode: 'off' }
  if (value === 'chapter') return { mode: 'chapter' }
  return { mode: 'time', until: Date.now() + value * 60_000, minutes: value }
}

/** Minutes left, ticking while it's on screen. */
function SleepLeft({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])
  return <>{Math.max(1, Math.ceil((until - now) / 60_000))} 分</>
}

/** The browser's voices; Chrome fills the list in a moment after load. */
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return
    const update = () => setVoices(speechSynthesis.getVoices())
    update()
    speechSynthesis.addEventListener('voiceschanged', update)
    return () => speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])
  return voices
}

/** Three bars that move while the book is being read. */
function Equalizer({ on }: { on: boolean }) {
  return (
    <span className={`reader-eq ${on ? 'is-on' : ''}`} aria-hidden>
      <span />
      <span />
      <span />
    </span>
  )
}

type Props = {
  state: ReadAloudState
  /** Name of the voice in use, shown on the bar. */
  voiceLabel: string
  /** The voice menu (VoicePicker); `close` hides it after a choice. */
  voicePicker: (close: () => void) => ReactNode
  rate: number
  onPlay: () => void
  onPause: () => void
  onSkip: (delta: 1 | -1) => void
  onRate: (rate: number) => void
  sleep: Sleep
  onSleep: (sleep: Sleep) => void
  onClose: () => void
}

export function ListenBar({ state, voiceLabel, voicePicker, rate, onPlay, onPause, onSkip, onRate, sleep, onSleep, onClose }: Props) {
  const [picking, setPicking] = useState<'voice' | 'sleep' | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const playing = state === 'playing' || state === 'loading'

  useEffect(() => {
    if (!picking) return
    const onDown = (e: PointerEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPicking(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPicking(null)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [picking])

  const nextRate = () => {
    const i = RATES.findIndex((r) => r >= rate - 0.001)
    onRate(RATES[(i + 1) % RATES.length])
  }

  return (
    <div
      ref={pickerRef}
      className="reader-pop absolute bottom-[calc(env(safe-area-inset-bottom)+3.75rem)] left-1/2 z-30 w-[min(30rem,calc(100vw-1.5rem))] -translate-x-1/2"
    >
      {picking === 'sleep' && (
        <div className="reader-pop mb-2 ml-auto w-52 rounded-2xl border border-[var(--r-line)] bg-[var(--r-surface)] p-2 text-[var(--r-ink)] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.35)]">
          <p className="px-3 pt-2 pb-1 text-xs text-[var(--r-muted)]">定時停止</p>
          <ul>
            {SLEEP_OPTIONS.map((o) => {
              const active =
                (o.value === 'off' && sleep.mode === 'off') ||
                (o.value === 'chapter' && sleep.mode === 'chapter') ||
                (sleep.mode === 'time' && sleep.minutes === o.value)
              return (
                <li key={String(o.value)}>
                  <button
                    type="button"
                    onClick={() => {
                      onSleep(sleepFrom(o.value))
                      setPicking(null)
                    }}
                    className="flex h-9 w-full items-center justify-between rounded-lg px-3 text-left text-[13px] hover:bg-[var(--r-sunken)]"
                  >
                    {o.label}
                    {active && <Check size={15} className="text-[var(--r-accent)]" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {picking === 'voice' && voicePicker(() => setPicking(null))}

      <div
        role="toolbar"
        aria-label="朗讀"
        className="flex items-center gap-1 rounded-full border border-[var(--r-line)] bg-[var(--r-surface)]/95 p-1.5 text-[var(--r-ink)] shadow-[0_18px_48px_-20px_rgba(0,0,0,0.4)] backdrop-blur-md"
      >
        <button type="button" onClick={() => onSkip(-1)} aria-label="上一句" className="grid size-10 place-items-center rounded-full hover:bg-[var(--r-sunken)] active:scale-95">
          <SkipBack size={18} weight="fill" />
        </button>
        <button
          type="button"
          onClick={playing ? onPause : onPlay}
          aria-label={playing ? '暫停' : '播放'}
          className="grid size-11 place-items-center rounded-full bg-[var(--r-ink)] text-[var(--r-surface)] transition-transform active:scale-95"
        >
          {state === 'loading' ? (
            <CircleNotch size={18} weight="bold" className="animate-spin" />
          ) : playing ? (
            <Pause size={18} weight="fill" />
          ) : (
            <Play size={18} weight="fill" className="translate-x-px" />
          )}
        </button>
        <button type="button" onClick={() => onSkip(1)} aria-label="下一句" className="grid size-10 place-items-center rounded-full hover:bg-[var(--r-sunken)] active:scale-95">
          <SkipForward size={18} weight="fill" />
        </button>

        <span className="mx-1 h-6 w-px bg-[var(--r-line)]" aria-hidden />

        <button
          type="button"
          onClick={nextRate}
          aria-label={`語速 ${rate} 倍，按一下換`}
          className="h-9 min-w-14 rounded-full px-2.5 font-mono text-[13px] tabular-nums hover:bg-[var(--r-sunken)] active:scale-95"
        >
          {rate.toFixed(1)}×
        </button>
        <button
          type="button"
          onClick={() => setPicking((p) => (p === 'voice' ? null : 'voice'))}
          aria-expanded={picking === 'voice'}
          aria-label="選擇語音"
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full px-3 text-left text-[13px] hover:bg-[var(--r-sunken)]"
        >
          {state === 'idle' ? <Waveform size={16} className="shrink-0 text-[var(--r-muted)]" /> : <Equalizer on={state === 'playing'} />}
          <span className="truncate">{voiceLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => setPicking((p) => (p === 'sleep' ? null : 'sleep'))}
          aria-expanded={picking === 'sleep'}
          aria-label="定時停止"
          title="定時停止"
          className={`flex h-9 shrink-0 items-center gap-1 rounded-full px-2.5 font-mono text-[12px] tabular-nums hover:bg-[var(--r-sunken)] ${
            sleep.mode === 'off' ? 'text-[var(--r-muted)]' : 'text-[var(--r-accent)]'
          }`}
        >
          <MoonStars size={16} weight={sleep.mode === 'off' ? 'regular' : 'fill'} />
          {sleep.mode === 'time' && <SleepLeft until={sleep.until} />}
          {sleep.mode === 'chapter' && <span className="font-sans">本章</span>}
        </button>
        <button type="button" onClick={onClose} aria-label="關閉朗讀" className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--r-muted)] hover:bg-[var(--r-sunken)]">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
