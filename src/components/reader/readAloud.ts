'use client'

// Read aloud with the browser's own voices (Web Speech API): free, no server,
// and the system's natural voices where the browser has them (Edge's
// "Online (Natural)" voices, Safari's Siri voices). One sentence per utterance,
// so the sentence being read is highlighted and pages turn to follow it.

import type { Book, Contents, Rendition } from 'epubjs'
import { EpubCFI } from 'epubjs'
import type { Location } from 'epubjs/types/rendition'
import { segmentDocument, type Segment } from './sentences'
import { TTS_HIGHLIGHT } from './settings'

export type ReadAloudState = 'idle' | 'loading' | 'playing' | 'paused'

type Options = {
  rendition: Rendition
  book: Book
  onState: (state: ReadAloudState) => void
  onError: (message: string) => void
}

type HighlightWindow = Window & { CSS?: { highlights?: Map<string, unknown> }; Highlight?: new (...ranges: Range[]) => unknown }

/** Our own page turns cause `relocated` too; those within this window aren't the reader's. */
const OWN_MOVE_MS = 900

const cfiCompare = new EpubCFI()

export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

export class ReadAloud {
  voice: SpeechSynthesisVoice | null = null
  rate = 1
  /** BCP 47, for splitting sentences and for the default voice. */
  lang = 'zh-TW'

  private opts: Options
  private state: ReadAloudState = 'idle'
  private sectionIndex = -1
  private doc: Document | null = null
  private segments: Segment[] = []
  private index = 0
  /** Bumped on every start/stop, so callbacks of a cancelled utterance do nothing. */
  private generation = 0
  private utterance: SpeechSynthesisUtterance | null = null
  private movedAt = 0
  private wakeLock: { release: () => Promise<void> } | null = null

  constructor(opts: Options) {
    this.opts = opts
  }

  get current() {
    return this.state
  }

  /** iOS only lets speech start inside a tap: call this first, synchronously. */
  unlock() {
    if (!speechSupported()) return
    const u = new SpeechSynthesisUtterance('')
    u.volume = 0
    speechSynthesis.speak(u)
  }

  /** Reads from `fromCfi` (a selection), else from the top of the visible page. */
  async start(fromCfi?: string) {
    if (!speechSupported()) {
      this.opts.onError('這個瀏覽器不支援朗讀')
      return
    }
    const gen = ++this.generation
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
    speechSynthesis.cancel()
    this.setState('paused')
    void this.releaseWake()
  }

  resume() {
    if (this.state !== 'paused') return
    if (!this.ensureDocument()) return void this.start()
    void this.keepAwake()
    this.speak(++this.generation)
  }

  stop() {
    this.generation++
    if (speechSupported()) speechSynthesis.cancel()
    this.clearHighlight()
    this.segments = []
    this.doc = null
    this.sectionIndex = -1
    this.setState('idle')
    void this.releaseWake()
  }

  /** Next / previous sentence. */
  skip(delta: 1 | -1) {
    if (this.state === 'idle' || !this.segments.length) return
    const next = this.index + delta
    if (next < 0) return
    const gen = ++this.generation
    speechSynthesis.cancel()
    if (next >= this.segments.length) return void this.nextSection(gen)
    this.index = next
    if (this.state === 'paused') {
      this.highlight(this.segments[next])
      void this.follow(this.segments[next])
      return
    }
    this.speak(gen)
  }

  /** New voice or speed: restart the current sentence with it. */
  refresh() {
    if (this.state === 'playing') this.speak(++this.generation)
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
  }

  // ---- internals ----

  private setState(state: ReadAloudState) {
    if (this.state === state) return
    this.state = state
    this.opts.onState(state)
  }

  private location(): Location | null {
    const loc = (this.opts.rendition as unknown as { location?: Location }).location
    return loc?.start ? loc : null
  }

  private contentsFor(sectionIndex: number): Contents | null {
    const all = this.opts.rendition.getContents() as unknown as Contents[]
    return (Array.isArray(all) ? all : [all]).find((c) => c?.sectionIndex === sectionIndex) ?? null
  }

  /** Splits the chapter on screen into sentences; false when it has none. */
  private load(sectionIndex: number): boolean {
    const contents = this.contentsFor(sectionIndex)
    if (!contents?.document) return false
    this.sectionIndex = sectionIndex
    this.doc = contents.document
    this.segments = segmentDocument(contents.document, this.lang)
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

  private speak(gen: number) {
    if (!this.ensureDocument()) return void this.nextSection(gen)
    const seg = this.segments[this.index]
    this.highlight(seg)
    void this.follow(seg)

    const u = new SpeechSynthesisUtterance(seg.text)
    if (this.voice) u.voice = this.voice
    u.lang = this.voice?.lang ?? this.lang
    u.rate = this.rate
    u.onend = () => {
      if (gen !== this.generation) return
      if (this.index + 1 < this.segments.length) {
        this.index++
        this.speak(gen)
      } else {
        void this.nextSection(gen)
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
type TtsPrefs = { rate: number; voices: Record<string, string> }

export function loadTtsPrefs(): TtsPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(TTS_KEY) ?? 'null') as Partial<TtsPrefs> | null
    const rate = Number(p?.rate)
    return {
      rate: Number.isFinite(rate) && rate >= 0.5 && rate <= 3 ? rate : 1,
      voices: p?.voices && typeof p.voices === 'object' ? p.voices : {},
    }
  } catch {
    return { rate: 1, voices: {} }
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
