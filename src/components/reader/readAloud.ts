'use client'

// Read aloud, sentence by sentence: the sentence being read is highlighted and
// pages turn to follow it. Two kinds of voice:
//   browser — the Web Speech API: free, no server; natural voices where the
//             browser has them (Edge's "Online (Natural)", Safari's Siri voices).
//             One utterance per sentence.
//   cloud   — Azure or Gemini through /api/tts (cloudSpeech.ts). A chapter is
//             cut into fixed pieces of a few sentences (so a piece is fetched
//             and paid for once, wherever reading starts), played in an <audio>
//             element (keeps going with the screen locked; lock-screen controls
//             work), and the highlight follows the playback position, spread
//             over the piece's sentences by their length.

import type { Book, Contents, Rendition } from 'epubjs'
import { EpubCFI } from 'epubjs'
import type { Location } from 'epubjs/types/rendition'
import { CHUNK_CHARS, type CloudProvider, type GeminiStyle, type TtsSource } from '@/lib/tts'
import { speechAudio } from './cloudSpeech'
import { segmentDocument, type Segment } from './sentences'
import { TTS_HIGHLIGHT } from './settings'

export type ReadAloudState = 'idle' | 'loading' | 'playing' | 'paused'

export type VoiceChoice =
  | { kind: 'browser'; voice: SpeechSynthesisVoice | null }
  | { kind: 'cloud'; provider: CloudProvider; voice: string; style: string }

type Options = {
  rendition: Rendition
  book: Book
  onState: (state: ReadAloudState) => void
  onError: (message: string) => void
  /** Asked when a chapter has been read to its end; false pauses there (sleep timer). */
  continueAfterChapter?: () => boolean
}

type Chunk = { start: number; end: number }
type HighlightWindow = Window & { CSS?: { highlights?: Map<string, unknown> }; Highlight?: new (...ranges: Range[]) => unknown }

/** Our own page turns cause `relocated` too; those within this window aren't the reader's. */
const OWN_MOVE_MS = 900
/** A sentence break is a short pause: count it as a few characters of time. */
const PAUSE_WEIGHT = 6
/** 0.1 s of silence: played inside the tap so iOS lets the <audio> element play later. */
const SILENT_MP3 =
  'data:audio/mpeg;base64,//NAxAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80LEWwAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80DEpAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsSjAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NCxKMAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV'

const cfiCompare = new EpubCFI()

export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

const sameChoice = (a: VoiceChoice, b: VoiceChoice) =>
  a.kind === 'browser' && b.kind === 'browser'
    ? a.voice?.voiceURI === b.voice?.voiceURI
    : a.kind === 'cloud' && b.kind === 'cloud' && a.provider === b.provider && a.voice === b.voice && a.style === b.style

const waitForMetadata = (audio: HTMLAudioElement) =>
  new Promise<void>((resolve, reject) => {
    if (audio.readyState >= 1) return resolve()
    const cleanup = () => {
      audio.removeEventListener('loadedmetadata', done)
      audio.removeEventListener('error', failed)
    }
    const done = () => {
      cleanup()
      resolve()
    }
    const failed = () => {
      cleanup()
      reject(new Error('聲音檔無法播放'))
    }
    audio.addEventListener('loadedmetadata', done)
    audio.addEventListener('error', failed)
  })

export class ReadAloud {
  /** BCP 47, for splitting sentences and for cloud requests. */
  lang = 'zh-TW'

  private opts: Options
  private choice: VoiceChoice = { kind: 'browser', voice: null }
  private rate = 1
  private meta = { title: '', artist: '' }
  private state: ReadAloudState = 'idle'
  private sectionIndex = -1
  private doc: Document | null = null
  private segments: Segment[] = []
  private chunks: Chunk[] = []
  private index = 0
  /** Bumped on every start/stop, so callbacks of a cancelled utterance or piece do nothing. */
  private generation = 0
  private utterance: SpeechSynthesisUtterance | null = null
  private movedAt = 0
  private wakeLock: { release: () => Promise<void> } | null = null
  /** Paused because a chapter ended (sleep timer): resuming starts the next one. */
  private chapterDone = false
  // Cloud playback
  private audio: HTMLAudioElement | null = null
  private audioUrl: string | null = null
  /** The piece in the <audio> element. */
  private loaded: { key: string; chunk: Chunk } | null = null
  /** The run (generation) the <audio> element is playing for. */
  private audioGen = -1

  constructor(opts: Options) {
    this.opts = opts
  }

  get current() {
    return this.state
  }

  private get cloud() {
    return this.choice.kind === 'cloud'
  }

  /** Voice, speed and language. A new voice restarts the sentence; cloud speed changes in place. */
  configure(next: { choice: VoiceChoice; rate: number; lang: string; title: string; artist: string }) {
    const voiceChanged = !sameChoice(this.choice, next.choice)
    const rateChanged = next.rate !== this.rate
    this.choice = next.choice
    this.rate = next.rate
    this.lang = next.lang
    this.meta = { title: next.title, artist: next.artist }
    if (this.audio) this.audio.playbackRate = next.rate
    if (voiceChanged) {
      this.halt()
      if (this.state === 'playing' || this.state === 'loading') this.speak(++this.generation)
    } else if (rateChanged && !this.cloud && this.state === 'playing') {
      this.speak(++this.generation)
    }
  }

  /** iOS only lets speech or audio start inside a tap: call this first, synchronously. */
  unlock() {
    if (this.cloud) {
      const audio = this.audioElement()
      this.loaded = null
      audio.src = SILENT_MP3
      void audio.play().catch(() => undefined)
      return
    }
    if (!speechSupported()) return
    const u = new SpeechSynthesisUtterance('')
    u.volume = 0
    speechSynthesis.speak(u)
  }

  /** Reads from `fromCfi` (a selection), else from the top of the visible page. */
  async start(fromCfi?: string) {
    this.chapterDone = false
    if (!this.cloud && !speechSupported()) {
      this.opts.onError('這個瀏覽器不支援朗讀')
      return
    }
    const gen = ++this.generation
    if (speechSupported()) speechSynthesis.cancel()
    this.setState('loading')
    const location = this.location()
    if (!location?.start) {
      this.setState('idle')
      return
    }
    const target = fromCfi ?? location.start.cfi
    if (!this.load(location.start.index)) {
      // Nothing to read on this chapter (a picture page): go on to the next.
      if (gen === this.generation) await this.nextSection(gen)
      return
    }
    this.index = this.firstAt(target)
    void this.keepAwake()
    this.speak(gen)
  }

  pause() {
    if (this.state !== 'playing' && this.state !== 'loading') return
    this.generation++
    this.halt()
    this.setState('paused')
    void this.releaseWake()
  }

  resume() {
    if (this.state !== 'paused') return
    if (this.chapterDone) {
      this.chapterDone = false
      void this.keepAwake()
      return void this.nextSection(++this.generation)
    }
    if (!this.ensureDocument()) return void this.start()
    void this.keepAwake()
    this.speak(++this.generation)
  }

  stop() {
    this.generation++
    this.halt()
    this.clearHighlight()
    this.segments = []
    this.chunks = []
    this.doc = null
    this.sectionIndex = -1
    this.loaded = null
    this.setState('idle')
    void this.releaseWake()
  }

  /** Next / previous sentence. */
  skip(delta: 1 | -1) {
    if (this.state === 'idle' || !this.segments.length) return
    const next = this.index + delta
    if (next < 0) return
    const gen = ++this.generation
    this.halt()
    if (next >= this.segments.length) return void this.nextSection(gen)
    this.index = next
    if (this.state === 'paused') {
      this.highlight(this.segments[next])
      void this.follow(this.segments[next])
      return
    }
    this.speak(gen)
  }

  /**
   * The book moved. If the reader turned the page (the sentence being read is
   * gone from view), carry on from the new page instead.
   */
  relocated(location: Location) {
    if (this.state !== 'playing' || Date.now() - this.movedAt < OWN_MOVE_MS) return
    const seg = this.segments[this.index]
    if (seg && this.visible(seg, location)) return
    void this.start()
  }

  destroy() {
    this.stop()
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl)
    this.audioUrl = null
    this.audio?.removeAttribute('src')
    this.audio = null
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined
    if (ms) for (const action of ['play', 'pause', 'nexttrack', 'previoustrack'] as const) ms.setActionHandler(action, null)
  }

  // ---- internals: shared ----

  private setState(state: ReadAloudState) {
    if (this.state === state) return
    this.state = state
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined
    if (ms) ms.playbackState = state === 'playing' ? 'playing' : state === 'paused' ? 'paused' : 'none'
    this.opts.onState(state)
  }

  /** Silences whatever is sounding, without changing the state. */
  private halt() {
    if (speechSupported()) speechSynthesis.cancel()
    this.audio?.pause()
  }

  private speak(gen: number) {
    if (this.cloud) void this.playCloud(gen)
    else this.speakBrowser(gen)
  }

  private location(): Location | null {
    const loc = (this.opts.rendition as unknown as { location?: Location }).location
    return loc?.start ? loc : null
  }

  private contentsFor(sectionIndex: number): Contents | null {
    const all = this.opts.rendition.getContents() as unknown as Contents[]
    return (Array.isArray(all) ? all : [all]).find((c) => c?.sectionIndex === sectionIndex) ?? null
  }

  /** Fixed pieces of a few sentences, counted from the top of the chapter. */
  private planChunks() {
    this.chunks = []
    let start = 0
    let chars = 0
    for (let i = 0; i < this.segments.length; i++) {
      const len = this.segments[i].text.length
      if (i > start && chars + len > CHUNK_CHARS) {
        this.chunks.push({ start, end: i - 1 })
        start = i
        chars = 0
      }
      chars += len
    }
    if (this.segments.length) this.chunks.push({ start, end: this.segments.length - 1 })
  }

  /** Splits the chapter on screen into sentences; false when it has none. */
  private load(sectionIndex: number): boolean {
    const contents = this.contentsFor(sectionIndex)
    if (!contents?.document) return false
    this.sectionIndex = sectionIndex
    this.doc = contents.document
    this.segments = segmentDocument(contents.document, this.lang)
    this.planChunks()
    this.index = 0
    return this.segments.length > 0
  }

  /**
   * epub.js re-renders a chapter after a resize, which leaves our ranges
   * pointing at the old document. The same text splits the same way, so the
   * sentence number still holds.
   */
  private ensureDocument(): boolean {
    const contents = this.contentsFor(this.sectionIndex)
    if (!contents?.document) return false
    if (contents.document !== this.doc) {
      const index = this.index
      this.doc = contents.document
      this.segments = segmentDocument(contents.document, this.lang)
      this.planChunks()
      this.index = Math.min(index, Math.max(0, this.segments.length - 1))
    }
    return this.segments.length > 0
  }

  private cfiOf(range: Range): string | null {
    try {
      return this.contentsFor(this.sectionIndex)?.cfiFromRange(range) ?? null
    } catch {
      return null
    }
  }

  /** The sentence that contains (or first follows) `cfi`. */
  private firstAt(cfi: string): number {
    for (let i = 0; i < this.segments.length; i++) {
      const end = this.segments[i].range.cloneRange()
      end.collapse(false)
      const endCfi = this.cfiOf(end)
      if (endCfi && cfiCompare.compare(endCfi, cfi) > 0) return i
    }
    return 0
  }

  private visible(seg: Segment, location: Location): boolean {
    const cfi = this.cfiOf(seg.range)
    if (!cfi || !location.start || !location.end) return true
    return cfiCompare.compare(cfi, location.start.cfi) >= 0 && cfiCompare.compare(cfi, location.end.cfi) <= 0
  }

  /** Turns the page when the sentence starts off screen. */
  private async follow(seg: Segment) {
    const location = this.location()
    if (location && this.visible(seg, location)) return
    const cfi = this.cfiOf(seg.range)
    if (!cfi) return
    this.movedAt = Date.now()
    await this.opts.rendition.display(cfi)
    this.movedAt = Date.now()
  }

  private highlight(seg: Segment) {
    const win = this.doc?.defaultView as HighlightWindow | null
    if (!win?.CSS?.highlights || !win.Highlight) return
    win.CSS.highlights.set(TTS_HIGHLIGHT, new win.Highlight(seg.range))
  }

  private clearHighlight() {
    const win = this.doc?.defaultView as HighlightWindow | null
    win?.CSS?.highlights?.delete(TTS_HIGHLIGHT)
  }

  /** The chapter is read to its end: go on, unless the sleep timer says stop here. */
  private chapterEnd(gen: number) {
    if (this.opts.continueAfterChapter && !this.opts.continueAfterChapter()) {
      this.pause()
      this.chapterDone = true
    } else {
      void this.nextSection(gen)
    }
  }

  /** Opens the next chapter that has text and reads it from the top. */
  private async nextSection(gen: number) {
    const spine = this.opts.book.spine as unknown as { get: (i: number) => { index: number; href: string } | null }
    for (let i = this.sectionIndex + 1; ; i++) {
      const section = spine.get(i)
      if (!section) {
        this.stop()
        return
      }
      this.setState('loading')
      this.movedAt = Date.now()
      await this.opts.rendition.display(section.href)
      this.movedAt = Date.now()
      if (gen !== this.generation) return
      if (this.load(section.index)) {
        this.speak(gen)
        return
      }
      this.sectionIndex = section.index
    }
  }

  // ---- internals: browser voices ----

  private speakBrowser(gen: number) {
    if (!this.ensureDocument()) return void this.nextSection(gen)
    const seg = this.segments[this.index]
    this.highlight(seg)
    void this.follow(seg)

    const voice = this.choice.kind === 'browser' ? this.choice.voice : null
    const u = new SpeechSynthesisUtterance(seg.text)
    if (voice) u.voice = voice
    u.lang = voice?.lang ?? this.lang
    u.rate = this.rate
    u.onend = () => {
      if (gen !== this.generation) return
      if (this.index + 1 < this.segments.length) {
        this.index++
        this.speakBrowser(gen)
      } else {
        this.chapterEnd(gen)
      }
    }
    u.onerror = (event) => {
      if (gen !== this.generation || event.error === 'interrupted' || event.error === 'canceled') return
      this.opts.onError(event.error === 'not-allowed' ? '瀏覽器擋下了朗讀，請再按一次播放' : '朗讀中斷了')
      this.pause()
    }
    // Kept on the instance: Chrome may garbage-collect a playing utterance and never fire onend.
    this.utterance = u
    speechSynthesis.cancel()
    speechSynthesis.speak(u)
    this.setState('playing')
  }

  // ---- internals: cloud voices ----

  private chunkOf(index: number): Chunk {
    return this.chunks.find((c) => index >= c.start && index <= c.end) ?? { start: index, end: index }
  }

  private weights(chunk: Chunk): number[] {
    const w: number[] = []
    for (let i = chunk.start; i <= chunk.end; i++) w.push(this.segments[i].text.length + PAUSE_WEIGHT)
    return w
  }

  /** Where sentence `index` starts in the piece's audio, in seconds. */
  private timeOf(chunk: Chunk, index: number, duration: number): number {
    const w = this.weights(chunk)
    const total = w.reduce((a, b) => a + b, 0)
    const before = w.slice(0, index - chunk.start).reduce((a, b) => a + b, 0)
    return Number.isFinite(duration) && total ? (before / total) * duration : 0
  }

  /** Which sentence is sounding at `time` seconds into the piece. */
  private indexAt(chunk: Chunk, time: number, duration: number): number {
    if (!Number.isFinite(duration) || duration <= 0) return chunk.start
    const w = this.weights(chunk)
    const total = w.reduce((a, b) => a + b, 0)
    let acc = 0
    for (let i = 0; i < w.length; i++) {
      acc += w[i]
      if ((acc / total) * duration > time) return chunk.start + i
    }
    return chunk.end
  }

  private request(chunk: Chunk) {
    const choice = this.choice as Extract<VoiceChoice, { kind: 'cloud' }>
    const joiner = /^(zh|ja)/i.test(this.lang) ? '' : ' '
    const text = this.segments
      .slice(chunk.start, chunk.end + 1)
      .map((s) => s.text)
      .join(joiner)
    return { provider: choice.provider, voice: choice.voice, style: choice.style, lang: this.lang, text }
  }

  private keyOf(chunk: Chunk) {
    const choice = this.choice as Extract<VoiceChoice, { kind: 'cloud' }>
    return `${this.sectionIndex}:${chunk.start}-${chunk.end}:${choice.provider}:${choice.voice}:${choice.style}`
  }

  private audioElement(): HTMLAudioElement {
    if (this.audio) return this.audio
    const audio = new Audio()
    audio.preload = 'auto'
    audio.preservesPitch = true
    audio.addEventListener('timeupdate', () => {
      if (this.audioGen !== this.generation || !this.loaded || this.state !== 'playing') return
      const i = this.indexAt(this.loaded.chunk, audio.currentTime, audio.duration)
      if (i !== this.index && this.segments[i]) {
        this.index = i
        this.highlight(this.segments[i])
        void this.follow(this.segments[i])
      }
    })
    audio.addEventListener('ended', () => {
      if (this.audioGen !== this.generation || !this.loaded) return
      const gen = this.generation
      this.index = this.loaded.chunk.end + 1
      if (this.index < this.segments.length) void this.playCloud(gen)
      else this.chapterEnd(gen)
    })
    this.audio = audio
    this.setupMediaSession()
    return audio
  }

  private setupMediaSession() {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined
    if (!ms) return
    ms.setActionHandler('play', () => (this.state === 'paused' ? this.resume() : undefined))
    ms.setActionHandler('pause', () => this.pause())
    ms.setActionHandler('nexttrack', () => this.skip(1))
    ms.setActionHandler('previoustrack', () => this.skip(-1))
  }

  private async playCloud(gen: number) {
    if (!this.ensureDocument()) return void this.nextSection(gen)
    const seg = this.segments[this.index]
    this.highlight(seg)
    void this.follow(seg)
    const chunk = this.chunkOf(this.index)
    const key = this.keyOf(chunk)
    const audio = this.audioElement()

    if (this.loaded?.key !== key) {
      this.setState('loading')
      let blob: Blob
      try {
        blob = await speechAudio(this.request(chunk))
      } catch (error) {
        if (gen !== this.generation) return
        this.opts.onError(error instanceof Error ? error.message : '語音產生失敗')
        this.pause()
        return
      }
      if (gen !== this.generation) return
      if (this.audioUrl) URL.revokeObjectURL(this.audioUrl)
      this.audioUrl = URL.createObjectURL(blob)
      this.loaded = { key, chunk }
      audio.src = this.audioUrl
      try {
        await waitForMetadata(audio)
      } catch (error) {
        if (gen !== this.generation) return
        this.opts.onError(error instanceof Error ? error.message : '聲音檔無法播放')
        this.pause()
        return
      }
      if (gen !== this.generation) return
    }

    // Resuming where it paused keeps the spot; anything else starts at the sentence.
    if (audio.ended || this.indexAt(chunk, audio.currentTime, audio.duration) !== this.index) {
      audio.currentTime = this.timeOf(chunk, this.index, audio.duration)
    }
    audio.playbackRate = this.rate
    this.audioGen = gen
    const ms = navigator.mediaSession
    if (ms && typeof MediaMetadata !== 'undefined') ms.metadata = new MediaMetadata({ title: this.meta.title, artist: this.meta.artist })
    try {
      await audio.play()
    } catch {
      if (gen !== this.generation) return
      this.opts.onError('瀏覽器擋下了播放，請再按一次播放')
      this.pause()
      return
    }
    if (gen !== this.generation) return void audio.pause()
    this.setState('playing')

    // Fetch the next piece while this one plays.
    const next = this.chunks.find((c) => c.start === chunk.end + 1)
    if (next) void speechAudio(this.request(next)).catch(() => undefined)
  }

  private async keepAwake() {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }
      if (!this.wakeLock && nav.wakeLock) this.wakeLock = await nav.wakeLock.request('screen')
    } catch {
      // Not allowed (battery saver, hidden tab): the screen may sleep.
    }
  }

  private async releaseWake() {
    const lock = this.wakeLock
    this.wakeLock = null
    await lock?.release().catch(() => undefined)
  }
}

// ---- voices ----

const NATURAL = /natural|online|neural|premium|enhanced|siri/i

export const isNaturalVoice = (v: SpeechSynthesisVoice) => NATURAL.test(v.name)

const base = (lang: string) => lang.toLowerCase().split(/[-_]/)[0]

/** Voices for `lang` first (natural ones on top), then the rest. */
export function rankVoices(voices: SpeechSynthesisVoice[], lang: string): { matching: SpeechSynthesisVoice[]; others: SpeechSynthesisVoice[] } {
  const want = lang.toLowerCase().replace('_', '-')
  const score = (v: SpeechSynthesisVoice) => {
    const l = v.lang.toLowerCase().replace('_', '-')
    let s = 0
    if (l === want) s += 4
    // Traditional Chinese books: Taiwan voices before mainland ones.
    if (base(want) === 'zh' && /tw|hk|hant/.test(l)) s += 2
    if (isNaturalVoice(v)) s += 3
    if (v.localService) s += 0.5
    return s
  }
  const sorted = [...voices].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
  return {
    matching: sorted.filter((v) => base(v.lang) === base(want)),
    others: sorted.filter((v) => base(v.lang) !== base(want)),
  }
}

const TTS_KEY = 'reader-tts'

/** Per-device read-aloud choices. Voices are kept per book language (zh, en…). */
export type TtsPrefs = {
  rate: number
  source: TtsSource
  /** Browser voiceURI per language. */
  voices: Record<string, string>
  /** Azure voice per language. */
  azure: Record<string, string>
  gemini: string
  geminiStyle: GeminiStyle
}

export function loadTtsPrefs(): TtsPrefs {
  const fallback: TtsPrefs = { rate: 1, source: 'browser', voices: {}, azure: {}, gemini: '', geminiStyle: 'narrator' }
  try {
    const p = JSON.parse(localStorage.getItem(TTS_KEY) ?? 'null') as Partial<TtsPrefs> | null
    if (!p || typeof p !== 'object') return fallback
    const rate = Number(p.rate)
    const record = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {})
    return {
      rate: Number.isFinite(rate) && rate >= 0.5 && rate <= 3 ? rate : 1,
      source: p.source === 'azure' || p.source === 'gemini' ? p.source : 'browser',
      voices: record(p.voices),
      azure: record(p.azure),
      gemini: typeof p.gemini === 'string' ? p.gemini : '',
      geminiStyle: p.geminiStyle === 'calm' || p.geminiStyle === 'lively' ? p.geminiStyle : 'narrator',
    }
  } catch {
    return fallback
  }
}

export function saveTtsPrefs(prefs: TtsPrefs) {
  try {
    localStorage.setItem(TTS_KEY, JSON.stringify(prefs))
  } catch {
    // Private mode.
  }
}

export const voiceKey = base
