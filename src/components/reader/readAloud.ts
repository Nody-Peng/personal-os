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
//
// In the background (another app, screen off) the book can't be laid out:
// epub.js waits for animation frames, which a hidden page doesn't get. So the
// next chapter's text is read straight from the book file, page turns wait,
// and coming back shows the sentence being read. The spot is saved now and
// then meanwhile (`onPosition`), in case the app is never opened again.
// Only cloud voices get there on phones: Chrome for Android stops the Web
// Speech API as soon as the app has no visible window (and refuses new
// sentences until it has one again), so a browser voice picks up the
// sentence it was cut off in when the page is shown again.

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
  /** Where reading has got to while the page is hidden (a point CFI), at most every half minute. */
  onPosition?: (cfi: string) => void
  /** Something to tell the reader that isn't an error. */
  onNotice?: (message: string) => void
}

type Chunk = { start: number; end: number }
/** A chapter loaded from the book file rather than shown on screen. */
type OffscreenSection = {
  index: number
  href: string
  document?: Document
  load: (request: unknown) => Promise<unknown>
  unload: () => void
  cfiFromRange: (range: Range) => string
}
type HighlightWindow = Window & { CSS?: { highlights?: Map<string, unknown> }; Highlight?: new (...ranges: Range[]) => unknown }

/** Our own page turns cause `relocated` too; those within this window aren't the reader's. */
const OWN_MOVE_MS = 900
/** A sentence break is a short pause: count it as a few characters of time. */
const PAUSE_WEIGHT = 6
/** How often the spot is saved while reading in the background. */
const POSITION_EVERY = 30_000

const pageHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'

/** True once `promise` settles; false as soon as the page is hidden (epub.js stalls until it's back). */
const unlessHidden = (promise: Promise<unknown>) =>
  new Promise<boolean>((resolve) => {
    if (pageHidden()) return resolve(false)
    const finish = (shown: boolean) => {
      document.removeEventListener('visibilitychange', onChange)
      resolve(shown)
    }
    const onChange = () => pageHidden() && finish(false)
    document.addEventListener('visibilitychange', onChange)
    promise.then(
      () => finish(true),
      () => finish(true),
    )
  })

/** 0.1 s of silence: played inside the tap so iOS lets the <audio> element play later. */
const SILENT_MP3 =
  'data:audio/mpeg;base64,//NAxAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80LEWwAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80DEpAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsSjAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NCxKMAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV'

const cfiCompare = new EpubCFI()

/** Fixed pieces of a few sentences, counted from the top of the chapter. */
function chunksOf(segments: Segment[]): Chunk[] {
  const chunks: Chunk[] = []
  let start = 0
  let chars = 0
  for (let i = 0; i < segments.length; i++) {
    const len = segments[i].text.length
    if (i > start && chars + len > CHUNK_CHARS) {
      chunks.push({ start, end: i - 1 })
      start = i
      chars = 0
    }
    chars += len
  }
  if (segments.length) chunks.push({ start, end: segments.length - 1 })
  return chunks
}

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
  private meta: { title: string; artist: string; cover: string | null } = { title: '', artist: '', cover: null }
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
  /** Set while the sentences come from a chapter read in the background (not on screen). */
  private offscreen: OffscreenSection | null = null
  /** Turning to the sentence being read after the page was hidden. */
  private catching = false
  private positionAt = 0
  /** The phone has stopped a browser voice in the background before (told once). */
  private toldBackground = false
  // Cloud playback
  private audio: HTMLAudioElement | null = null
  private audioUrl: string | null = null
  /** The piece in the <audio> element. */
  private loaded: { key: string; chunk: Chunk } | null = null
  /** The run (generation) the <audio> element is playing for. */
  private audioGen = -1

  constructor(opts: Options) {
    this.opts = opts
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibility)
  }

  get current() {
    return this.state
  }

  private get cloud() {
    return this.choice.kind === 'cloud'
  }

  /** Voice, speed and language. A new voice restarts the sentence; cloud speed changes in place. */
  configure(next: { choice: VoiceChoice; rate: number; lang: string; title: string; artist: string; cover?: string | null }) {
    const voiceChanged = !sameChoice(this.choice, next.choice)
    const rateChanged = next.rate !== this.rate
    this.choice = next.choice
    this.rate = next.rate
    this.lang = next.lang
    this.meta = { title: next.title, artist: next.artist, cover: next.cover ?? null }
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
    this.leaveOffscreen()
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
    if (this.state !== 'playing' || this.offscreen || this.catching || Date.now() - this.movedAt < OWN_MOVE_MS) return
    const seg = this.segments[this.index]
    if (seg && this.visible(seg, location)) return
    void this.start()
  }

  destroy() {
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility)
    this.stop()
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl)
    this.audioUrl = null
    this.audio?.removeAttribute('src')
    this.audio = null
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined
    if (ms) for (const action of ['play', 'pause', 'nexttrack', 'previoustrack'] as const) ms.setActionHandler(action, null)
  }

  // ---- internals: shared ----

  /** Back on screen: turn to the sentence being read (page turns waited meanwhile). */
  private onVisibility = () => {
    const seg = this.segments[this.index]
    if (pageHidden() || this.state === 'idle' || !seg) return
    if (!this.cloud && this.state === 'playing' && speechSupported() && !speechSynthesis.speaking && !speechSynthesis.pending) {
      // The system silenced the browser voice while the app was away: carry on from that sentence.
      if (!this.toldBackground) {
        this.toldBackground = true
        this.opts.onNotice?.('手機在背景時會停掉瀏覽器語音，已從剛才那句接著念。要在背景聽，請在語音選單改用雲端語音。')
      }
      this.speak(++this.generation)
      return
    }
    void this.follow(seg)
  }

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

  private planChunks() {
    this.chunks = chunksOf(this.segments)
  }

  /** Splits the chapter on screen into sentences; false when it has none. */
  private load(sectionIndex: number): boolean {
    const contents = this.contentsFor(sectionIndex)
    if (!contents?.document) return false
    this.leaveOffscreen()
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
    // A chapter read in the background goes on from the book file until it's shown.
    if (!contents?.document) return this.offscreen != null && this.segments.length > 0
    if (contents.document !== this.doc) {
      const index = this.index
      this.leaveOffscreen()
      this.doc = contents.document
      this.segments = segmentDocument(contents.document, this.lang)
      this.planChunks()
      this.index = Math.min(index, Math.max(0, this.segments.length - 1))
    }
    return this.segments.length > 0
  }

  /**
   * A chapter read in the background, from the book file. Its sentences split
   * the same way as when it's shown, so the numbering carries over.
   */
  private async loadOffscreen(section: OffscreenSection, gen: number): Promise<boolean> {
    try {
      await section.load(this.opts.book.load.bind(this.opts.book))
    } catch {
      return false
    }
    if (gen !== this.generation || !section.document) return false
    this.clearHighlight()
    this.leaveOffscreen()
    this.offscreen = section
    this.sectionIndex = section.index
    this.doc = section.document
    this.segments = segmentDocument(section.document, this.lang)
    this.planChunks()
    this.index = 0
    this.reportPosition(true)
    return this.segments.length > 0
  }

  private leaveOffscreen() {
    const section = this.offscreen
    this.offscreen = null
    section?.unload()
  }

  private cfiOf(range: Range): string | null {
    try {
      if (this.offscreen) return this.offscreen.cfiFromRange(range)
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

  /** Where the sentence starts, as a point CFI. */
  private startCfi(seg: Segment): string | null {
    const start = seg.range.cloneRange()
    start.collapse(true)
    return this.cfiOf(start)
  }

  /** Turns the page when the sentence starts off screen (not while the page is hidden). */
  private async follow(seg: Segment) {
    if (pageHidden()) return
    if (this.offscreen) return this.catchUp()
    const location = this.location()
    if (location && this.visible(seg, location)) return
    const cfi = this.cfiOf(seg.range)
    if (!cfi) return
    this.movedAt = Date.now()
    await this.opts.rendition.display(cfi)
    this.movedAt = Date.now()
  }

  /** The chapter was read in the background: show it, then carry on in the shown copy. */
  private async catchUp() {
    const seg = this.segments[this.index]
    const cfi = seg && this.startCfi(seg)
    if (this.catching || !cfi) return
    this.catching = true
    try {
      this.movedAt = Date.now()
      await this.opts.rendition.display(cfi)
    } catch {
      // Left as it is: the next sentence tries again.
    } finally {
      this.catching = false
      this.movedAt = Date.now()
    }
    // ensureDocument moves over to the shown copy once the chapter is on screen.
    if (this.state === 'idle' || !this.ensureDocument() || this.offscreen) return
    const now = this.segments[this.index]
    if (!now) return
    this.highlight(now)
    void this.follow(now)
  }

  /** Saves the spot now and then while the page is hidden (no page turns report it then). */
  private reportPosition(force = false) {
    if (!this.opts.onPosition || !(pageHidden() || this.offscreen)) return
    if (!force && Date.now() - this.positionAt < POSITION_EVERY) return
    const seg = this.segments[this.index]
    const cfi = seg && this.startCfi(seg)
    if (!cfi) return
    this.positionAt = Date.now()
    this.opts.onPosition(cfi)
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

  /** Opens the next chapter that has text and reads it from the top (from the book file while hidden). */
  private async nextSection(gen: number) {
    const spine = this.opts.book.spine as unknown as { get: (i: number) => OffscreenSection | null }
    for (let i = this.sectionIndex + 1; ; i++) {
      const section = spine.get(i)
      if (!section) {
        this.stop()
        return
      }
      this.setState('loading')
      let shown = false
      if (!pageHidden()) {
        this.movedAt = Date.now()
        shown = await unlessHidden(this.opts.rendition.display(section.href))
        this.movedAt = Date.now()
      }
      if (gen !== this.generation) return
      if (shown ? this.load(section.index) : await this.loadOffscreen(section, gen)) {
        this.speak(gen)
        return
      }
      if (gen !== this.generation) return
      this.sectionIndex = section.index
    }
  }

  // ---- internals: browser voices ----

  private speakBrowser(gen: number) {
    if (!this.ensureDocument()) return void this.nextSection(gen)
    const seg = this.segments[this.index]
    this.highlight(seg)
    void this.follow(seg)
    this.reportPosition()

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
      // In the background a phone stops speech and refuses the next sentence: picked up again when shown.
      if (gen !== this.generation || event.error === 'interrupted' || event.error === 'canceled' || pageHidden()) return
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

  private request(chunk: Chunk, segments = this.segments) {
    const choice = this.choice as Extract<VoiceChoice, { kind: 'cloud' }>
    const joiner = /^(zh|ja)/i.test(this.lang) ? '' : ' '
    const text = segments
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
        this.reportPosition()
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
    if (ms && typeof MediaMetadata !== 'undefined') {
      const { title, artist, cover } = this.meta
      ms.metadata = new MediaMetadata({ title, artist, artwork: cover ? [{ src: cover }] : [] })
    }
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

    // Fetch the next piece while this one plays. In the background, the next
    // chapter's first one too: a long silence lets the phone stop the page.
    const next = this.chunks.find((c) => c.start === chunk.end + 1)
    if (next) void speechAudio(this.request(next)).catch(() => undefined)
    else if (pageHidden()) void this.prefetchNextChapter()
  }

  /** The first piece of the next chapter with text, read from the book file. */
  private async prefetchNextChapter() {
    const spine = this.opts.book.spine as unknown as { get: (i: number) => OffscreenSection | null }
    // A few picture pages at most are skipped looking for text.
    for (let i = this.sectionIndex + 1; i <= this.sectionIndex + 3; i++) {
      const section = spine.get(i)
      if (!section) return
      try {
        // Left loaded: reading goes on in it next.
        await section.load(this.opts.book.load.bind(this.opts.book))
        if (!section.document) return
        const segments = segmentDocument(section.document, this.lang)
        const first = chunksOf(segments)[0]
        if (!first) continue
        await speechAudio(this.request(first, segments))
      } catch {
        // Fetched again when the chapter starts.
      }
      return
    }
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
