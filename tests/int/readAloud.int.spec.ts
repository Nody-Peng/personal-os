import type { Book, Rendition } from 'epubjs'
import { EpubCFI } from 'epubjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReadAloud } from '@/components/reader/readAloud'

// A browser voice in the background: Chrome for Android stops speech when the
// app is left and refuses the next sentence, so reading picks the cut-off
// sentence up again when the page is shown.

type Utterance = { text: string; onend?: () => void; onerror?: (e: { error: string }) => void }

class FakeUtterance {
  voice: unknown = null
  lang = ''
  rate = 1
  volume = 1
  onend?: () => void
  onerror?: (e: { error: string }) => void
  constructor(public text: string) {}
}

/** Speaks nothing; tests end or interrupt the current sentence themselves. */
const engine = {
  spoken: [] as string[],
  current: null as Utterance | null,
  get speaking() {
    return this.current != null
  },
  pending: false,
  speak(u: Utterance) {
    if (!u.text) return
    this.current = u
    this.spoken.push(u.text)
  },
  cancel() {
    const u = this.current
    this.current = null
    u?.onerror?.({ error: 'interrupted' })
  },
  getVoices: () => [],
}

let hidden = false
const setHidden = (value: boolean) => {
  hidden = value
  document.dispatchEvent(new Event('visibilitychange'))
}

function setup() {
  document.body.innerHTML = '<p>第一句話。第二句話。第三句話。</p>'
  const contents = { sectionIndex: 0, document, cfiFromRange: (range: Range) => new EpubCFI(range, '/6/2').toString() }
  const first = document.createRange()
  first.setStart(document.querySelector('p')!.firstChild!, 0)
  const rendition = {
    location: { start: { cfi: new EpubCFI(first, '/6/2').toString(), index: 0 }, end: { cfi: 'epubcfi(/6/2!/4/2/1:999)' } },
    getContents: () => [contents],
    display: vi.fn(async () => undefined),
  }
  const onError = vi.fn()
  const onNotice = vi.fn()
  const reader = new ReadAloud({
    rendition: rendition as unknown as Rendition,
    book: { spine: { get: () => null } } as unknown as Book,
    onState: () => undefined,
    onError,
    onNotice,
  })
  reader.configure({ choice: { kind: 'browser', voice: null }, rate: 1, lang: 'zh-TW', title: '書', artist: '' })
  return { reader, onError, onNotice }
}

beforeEach(() => {
  engine.spoken = []
  engine.current = null
  hidden = false
  vi.stubGlobal('speechSynthesis', engine)
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('browser voice in the background', () => {
  it('picks the cut-off sentence up again when the page is shown, and says why once', async () => {
    const { reader, onError, onNotice } = setup()
    await reader.start()
    expect(engine.spoken).toEqual(['第一句話。'])

    engine.current?.onend?.()
    expect(engine.spoken).toEqual(['第一句話。', '第二句話。'])

    // The app is left: the system stops the sentence.
    setHidden(true)
    engine.cancel()
    expect(reader.current).toBe('playing')
    expect(onError).not.toHaveBeenCalled()

    setHidden(false)
    expect(engine.spoken.at(-1)).toBe('第二句話。')
    expect(onNotice).toHaveBeenCalledTimes(1)

    // Again: resumed, but not told twice.
    setHidden(true)
    engine.cancel()
    setHidden(false)
    expect(engine.spoken.at(-1)).toBe('第二句話。')
    expect(onNotice).toHaveBeenCalledTimes(1)
    reader.destroy()
  })

  it('takes a refused sentence in the background as a pause, not an error', async () => {
    const { reader, onError } = setup()
    await reader.start()
    setHidden(true)
    // The sentence ends in the background and the next one is refused.
    const refused = engine.current
    engine.current = null
    refused?.onend?.()
    const next = engine.current as Utterance | null
    engine.current = null
    next?.onerror?.({ error: 'synthesis-failed' })
    expect(onError).not.toHaveBeenCalled()
    expect(reader.current).toBe('playing')

    setHidden(false)
    expect(engine.spoken.at(-1)).toBe('第二句話。')
    reader.destroy()
  })

  it('leaves a voice that kept speaking alone', async () => {
    const { reader, onNotice } = setup()
    await reader.start()
    setHidden(true)
    setHidden(false)
    expect(engine.spoken).toEqual(['第一句話。'])
    expect(onNotice).not.toHaveBeenCalled()
    reader.destroy()
  })
})
