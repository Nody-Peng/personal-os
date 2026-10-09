'use client'

import {
  ArrowLeft,
  BookmarkSimple,
  CaretLeft,
  CaretRight,
  CornersIn,
  CornersOut,
  Headphones,
  ListBullets,
  MagnifyingGlass,
  TextAa,
  WarningCircle,
} from '@phosphor-icons/react'
import type { Book, Contents, NavItem, Rendition } from 'epubjs'
import { EpubCFI } from 'epubjs'
import type { Location } from 'epubjs/types/rendition'
import Link from 'next/link'
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties } from 'react'
import { saveBookmarks, saveHighlights, saveReadingPosition } from '@/app/(frontend)/book-actions'
import { Toast, useToastTimeout, type ToastMessage } from '@/components/Toast'
import { HIGHLIGHT_COLORS, percentOf, type Bookmark, type BookSummary, type Highlight, type HighlightColor } from '@/lib/books'
import { useResolvedTheme } from '@/lib/theme'
import { ListenBar, useVoices, type Sleep } from './ListenBar'
import { cachedLocations, fetchBook, storeLocations } from './loadBook'
import { AZURE_DEFAULTS, DEFAULT_GEMINI_VOICE, type TtsSource } from '@/lib/tts'
import { useTtsStatus } from './cloudSpeech'
import {
  ReadAloud,
  loadTtsPrefs,
  rankVoices,
  saveTtsPrefs,
  speechSupported,
  voiceKey,
  type ReadAloudState,
  type TtsPrefs,
  type VoiceChoice,
} from './readAloud'
import { VoicePicker, shortVoiceName } from './VoicePicker'
import { ContentsPanel, SettingsPanel, type TocEntry } from './ReaderPanels'
import { trackSave } from './readingSync'
import { SearchPanel, type SearchHit } from './SearchPanel'
import { SelectionToolbar, type SelectionTarget } from './SelectionToolbar'
import { guessLanguage } from './sentences'
import { HORIZONTAL_CSS, bookCss, loadSettings, paletteOf, saveSettings, type ReaderSettings } from './settings'

type Props = { book: BookSummary; bookmarks: Bookmark[]; highlights: Highlight[] }

type Phase = { kind: 'downloading'; progress: number | null } | { kind: 'opening' } | { kind: 'ready' } | { kind: 'error'; message: string }

const SAVE_DELAY = 1500
const CHROME_IDLE = 3500
const STYLE_KEY = 'pos-reader'
const SEARCH_FLASH_MS = 2200

const highlightHex = (color: HighlightColor) => HIGHLIGHT_COLORS.find((c) => c.value === color)?.hex ?? HIGHLIGHT_COLORS[0].hex
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)
const cfiCompare = new EpubCFI()

const hrefPath = (href: string) => href.split('#')[0]

function flattenToc(book: Book): TocEntry[] {
  const out: TocEntry[] = []
  const walk = (items: NavItem[] | undefined, depth: number) => {
    for (const item of items ?? []) {
      const section = book.spine.get(hrefPath(item.href)) as { index: number } | null
      out.push({ item, depth, spineIndex: section?.index ?? -1 })
      walk(item.subitems, depth + 1)
    }
  }
  walk(book.navigation?.toc, 0)
  return out
}

/**
 * The table-of-contents entry the reader is in: the last chapter at or before
 * this file (its first entry, so a sub-heading inside it doesn't take over).
 */
function chapterOf(toc: TocEntry[], spineIndex: number): TocEntry | null {
  let found: TocEntry | null = null
  for (const entry of toc) {
    if (entry.spineIndex === -1 || entry.spineIndex > spineIndex) continue
    if (!found || entry.spineIndex > found.spineIndex) found = entry
  }
  return found
}

// epub.js reads the package's direction when it lays out, and our serialize
// hook (registered when the book opens) needs the current choice: both kept
// per book here rather than in React state.
const originalDirection = new WeakMap<Book, string | undefined>()
const horizontalBooks = new WeakMap<Book, boolean>()

/** Vertical books turned horizontal also turn their pages left to right. */
function applyDirection(book: Book, horizontal: boolean) {
  const meta = book.packaging.metadata as { direction?: string }
  if (!originalDirection.has(book)) originalDirection.set(book, meta.direction)
  horizontalBooks.set(book, horizontal)
  meta.direction = horizontal ? 'ltr' : originalDirection.get(book)
}

/** Rewrites each chapter horizontal (when chosen) before epub.js measures it. */
function forceHorizontal(book: Book) {
  book.spine.hooks.serialize.register((output: string, section: { output?: string }) => {
    // Build on section.output: epub.js's own hook ran first and swapped resource links for blob URLs there.
    const html = section.output ?? output
    if (horizontalBooks.get(book) && /<\/head>/i.test(html)) {
      section.output = html.replace(/<\/head>/i, `<style id="pos-horizontal">${HORIZONTAL_CSS}</style></head>`)
    }
  })
}

export default function Reader({ book: info, bookmarks: initialBookmarks, highlights: initialHighlights }: Props) {
  const appTheme = useResolvedTheme()
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings)
  const palette = paletteOf(settings.theme, appTheme)
  const css = bookCss(settings, palette)

  const viewerRef = useRef<HTMLDivElement>(null)
  const [book, setBook] = useState<Book | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'downloading', progress: null })
  const [attempt, setAttempt] = useState(0)
  const [rendition, setRendition] = useState<Rendition | null>(null)
  const [location, setLocation] = useState<Location | null>(null)
  const [toc, setToc] = useState<TocEntry[]>([])
  const [locationsReady, setLocationsReady] = useState(false)
  const [panel, setPanel] = useState<'toc' | 'settings' | 'search' | null>(null)
  const [contentsTab, setContentsTab] = useState<'toc' | 'bookmarks' | 'highlights'>('toc')
  const [chrome, setChrome] = useState(true)
  const [scrub, setScrub] = useState<number | null>(null)
  const [bookmarks, setBookmarks] = useState(initialBookmarks)
  const [highlights, setHighlights] = useState(initialHighlights)
  const [target, setTarget] = useState<SelectionTarget | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  useToastTimeout(toast, clearToast)

  // Read aloud
  const [listening, setListening] = useState(false)
  const [ttsState, setTtsState] = useState<ReadAloudState>('idle')
  const [lang, setLang] = useState(info.language || '')
  const voices = useVoices()
  const [ttsPrefs, setTtsPrefs] = useState(loadTtsPrefs)
  const [sleep, setSleep] = useState<Sleep>({ mode: 'off' })
  const ttsRef = useRef<ReadAloud | null>(null)
  const selectionRef = useRef<{ cfi: string; contents: Contents } | null>(null)

  const cfiRef = useRef<string | null>(info.cfi)
  // Reaching the last page says so once (the server marks the book read).
  const endedRef = useRef(Boolean(info.finishedAt))
  const chromeTimer = useRef<number | undefined>(undefined)
  const panelRef = useRef(panel)
  useEffect(() => {
    panelRef.current = panel
  })

  // Some epub.js builds skip 'displayed': the first location means the page is up too.
  const view: Phase = phase.kind === 'opening' && location ? { kind: 'ready' } : phase
  const ready = view.kind === 'ready'

  const effectiveLang = lang || 'zh-TW'
  const ttsStatus = useTtsStatus()
  const langKey = voiceKey(effectiveLang)
  const browserVoice = useMemo(() => {
    const saved = ttsPrefs.voices[langKey]
    return voices.find((v) => v.voiceURI === saved) ?? rankVoices(voices, effectiveLang).matching[0] ?? null
  }, [voices, ttsPrefs.voices, langKey, effectiveLang])
  const azureVoice = useMemo(() => {
    const list = ttsStatus?.azure ?? []
    const saved = ttsPrefs.azure[langKey]
    return (
      list.find((v) => v.id === saved)?.id ??
      list.find((v) => v.id === AZURE_DEFAULTS[langKey])?.id ??
      list.find((v) => v.locale && voiceKey(v.locale) === langKey)?.id ??
      null
    )
  }, [ttsStatus, ttsPrefs.azure, langKey])
  const geminiVoice = ttsPrefs.gemini || DEFAULT_GEMINI_VOICE
  // A cloud choice whose service isn't set up (any more) falls back to the browser's voices.
  const source: TtsSource =
    ttsPrefs.source === 'azure' && azureVoice ? 'azure' : ttsPrefs.source === 'gemini' && ttsStatus?.gemini ? 'gemini' : 'browser'
  const choice = useMemo<VoiceChoice>(() => {
    if (source === 'azure' && azureVoice) return { kind: 'cloud', provider: 'azure', voice: azureVoice, style: '' }
    if (source === 'gemini') return { kind: 'cloud', provider: 'gemini', voice: geminiVoice, style: ttsPrefs.geminiStyle }
    return { kind: 'browser', voice: browserVoice }
  }, [source, azureVoice, geminiVoice, ttsPrefs.geminiStyle, browserVoice])
  const voiceLabel =
    source === 'azure'
      ? (ttsStatus?.azure?.find((v) => v.id === azureVoice)?.label ?? 'Azure')
      : source === 'gemini'
        ? `Gemini · ${geminiVoice}`
        : browserVoice
          ? shortVoiceName(browserVoice)
          : '預設語音'

  // ---- open the book ----
  useEffect(() => {
    let cancelled = false
    let opened: Book | null = null
    ;(async () => {
      try {
        const data = await fetchBook(info.url, (progress) => !cancelled && setPhase({ kind: 'downloading', progress }))
        if (cancelled) return
        setPhase({ kind: 'opening' })
        const { default: ePub } = await import('epubjs')
        opened = ePub(data)
        await opened.opened
        if (cancelled) return
        forceHorizontal(opened)
        await opened.loaded.navigation
        if (cancelled) return
        setToc(flattenToc(opened))
        setBook(opened)
      } catch (error) {
        if (!cancelled) setPhase({ kind: 'error', message: error instanceof Error ? error.message : '打不開這本書' })
      }
    })()
    return () => {
      cancelled = true
      opened?.destroy()
      setBook(null)
    }
  }, [info.url, attempt])

  // epub.js calls these long after it was set up; they read the latest render.
  const currentCss = useEffectEvent(() => css)
  const onRelocated = useEffectEvent((loc: Location) => {
    setLocation(loc)
    setTarget(null)
    cfiRef.current = loc.start.cfi
    ttsRef.current?.relocated(loc)
    if (loc.atEnd && !endedRef.current) {
      endedRef.current = true
      setToast({ text: '讀完了！已標記為讀完', tone: 'info' })
    }
  })
  // Selected text: offer highlight colours, a note, read aloud or copy.
  const onSelected = useEffectEvent((cfi: string, contents: Contents) => {
    selectionRef.current = { cfi, contents }
    const sel = contents.window?.getSelection()
    const text = sel?.toString().trim()
    const frame = (contents.window?.frameElement as HTMLElement | null)?.getBoundingClientRect()
    if (!sel || !sel.rangeCount || !text || !frame) return
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    setTarget({
      kind: 'new',
      cfi,
      text: text.replace(/\s+/g, ' ').slice(0, 1000),
      x: frame.left + rect.left + rect.width / 2,
      top: frame.top + rect.top,
      bottom: frame.top + rect.bottom,
    })
  })
  // The sleep timer set to 這章念完: stop here, once.
  const continueAfterChapter = useEffectEvent(() => {
    if (sleep.mode !== 'chapter') return true
    setSleep({ mode: 'off' })
    setToast({ text: '這章念完了，朗讀已暫停', tone: 'info' })
    return false
  })

  // ---- lay it out (again when the flow or writing direction changes) ----
  useEffect(() => {
    const el = viewerRef.current
    if (!book || !el) return
    applyDirection(book, settings.horizontal)

    const r = book.renderTo(el, {
      width: '100%',
      height: '100%',
      flow: settings.flow === 'scrolled' ? 'scrolled-doc' : 'paginated',
      spread: 'auto',
      minSpreadWidth: 960,
      allowScriptedContent: false,
    })
    r.hooks.content.register((contents: Contents) => {
      contents.addStylesheetCss(currentCss(), STYLE_KEY)
      if (!info.language && contents.document.body) {
        setLang((current) => current || guessLanguage(contents.document.body.textContent ?? ''))
      }
    })

    let disposed = false
    r.display(cfiRef.current ?? undefined).catch(() => (disposed ? undefined : r.display()))
    r.on('relocated', (loc: Location) => !disposed && onRelocated(loc))
    r.on('selected', (cfi: string, contents: Contents) => !disposed && onSelected(cfi, contents))
    r.on('displayed', () => !disposed && setPhase({ kind: 'ready' }))
    setRendition(r)

    const tts = new ReadAloud({
      rendition: r,
      book,
      onState: (s) => !disposed && setTtsState(s),
      onError: (message) => !disposed && setToast({ text: message, tone: 'error' }),
      continueAfterChapter: () => continueAfterChapter(),
    })
    ttsRef.current = tts

    return () => {
      disposed = true
      tts.destroy()
      ttsRef.current = null
      r.destroy()
      setRendition(null)
      setTtsState('idle')
    }
  }, [book, settings.flow, settings.horizontal, info.language])

  // ---- appearance: restyle every chapter on screen, then stay on the same spot ----
  useEffect(() => {
    if (!rendition) return
    const all = rendition.getContents() as unknown as Contents[]
    for (const c of Array.isArray(all) ? all : [all]) c?.addStylesheetCss(css, STYLE_KEY)
  }, [rendition, css])
  const layoutKey = `${settings.fontSize}|${settings.lineHeight}|${settings.font}`
  const lastLayout = useRef(layoutKey)
  useEffect(() => {
    if (!rendition || lastLayout.current === layoutKey) return
    lastLayout.current = layoutKey
    const cfi = cfiRef.current
    if (!cfi) return
    const frame = requestAnimationFrame(() => void rendition.display(cfi))
    return () => cancelAnimationFrame(frame)
  }, [rendition, layoutKey])

  const changeSettings = (patch: Partial<ReaderSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch }
      saveSettings(next)
      return next
    })
  }

  // ---- page numbers for the whole book (slow on big books: cached) ----
  useEffect(() => {
    if (!book || !ready || locationsReady) return
    let cancelled = false
    ;(async () => {
      const saved = await cachedLocations(info.url)
      if (cancelled) return
      if (saved) {
        book.locations.load(saved)
      } else {
        await book.locations.generate(1600)
        if (cancelled) return
        void storeLocations(info.url, book.locations.save())
      }
      setLocationsReady(true)
    })().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [book, ready, locationsReady, info.url])

  const spineLength = (book?.spine as unknown as { length?: number } | undefined)?.length ?? 1
  const progress = useMemo(() => {
    if (!location?.start) return info.progress
    if (locationsReady && book) {
      const p = book.locations.percentageFromCfi(location.start.cfi)
      if (Number.isFinite(p)) return location.atEnd ? 1 : p
    }
    const { page, total } = location.start.displayed ?? { page: 1, total: 1 }
    return Math.min(1, (location.start.index + (total ? (page - 1) / total : 0)) / Math.max(1, spineLength))
  }, [location, locationsReady, book, spineLength, info.progress])

  // ---- remember the place ----
  const pending = useRef<{ cfi: string; progress: number } | null>(null)
  const flush = useEffectEvent(() => {
    const p = pending.current
    if (!p) return
    pending.current = null
    trackSave(saveReadingPosition(info.id, p.cfi, p.progress))
  })
  useEffect(() => {
    const cfi = location?.start?.cfi
    if (!cfi || !ready) return
    pending.current = { cfi, progress }
    const timer = window.setTimeout(() => flush(), SAVE_DELAY)
    return () => window.clearTimeout(timer)
  }, [location, progress, ready])
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush()
    const onPageHide = () => flush()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
      flush()
    }
  }, [])

  // ---- navigation ----
  const rtl = !settings.horizontal && book !== null && originalDirection.get(book) === 'rtl'
  const next = () => void rendition?.next()
  const prev = () => void rendition?.prev()
  const goLeft = rtl ? next : prev
  const goRight = rtl ? prev : next
  const go = (target: string) => {
    setPanel(null)
    void rendition?.display(target)
  }

  const showChrome = () => {
    setChrome(true)
    window.clearTimeout(chromeTimer.current)
    chromeTimer.current = window.setTimeout(() => !panelRef.current && setChrome(false), CHROME_IDLE)
  }
  // The bars step aside a moment after the book opens.
  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => !panelRef.current && setChrome(false), CHROME_IDLE)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(chromeTimer.current)
    }
  }, [ready])

  // Keys work whether focus is on the page or inside the book's frame.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      setPanel('search')
      return
    }
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
    if (e.key === 'Escape') {
      if (target) setTarget(null)
      else if (panelRef.current) setPanel(null)
      else setChrome((c) => !c)
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault()
      if (e.key === 'PageUp') prev()
      else goLeft()
    } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault()
      if (e.key === 'PageDown') next()
      else goRight()
    }
  })
  useEffect(() => {
    if (!rendition) return
    const handler = (e: KeyboardEvent) => onKey(e)
    window.addEventListener('keydown', handler)
    rendition.on('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      rendition.off('keydown', handler)
    }
  }, [rendition])

  // Taps: left / right edge turn pages, the middle shows the bars. Swipes turn pages.
  const onSwipe = useEffectEvent((dx: number) => {
    if (settings.flow === 'scrolled') return
    if (dx < 0) goRight()
    else goLeft()
  })
  const onTap = useEffectEvent((e: MouseEvent) => {
    const doc = (e.target as Node | null)?.ownerDocument
    if ((e.target as Element | null)?.closest?.('a')) return
    if (doc?.getSelection()?.toString()) return
    const frame = (e.view as Window | null)?.frameElement
    const box = viewerRef.current?.getBoundingClientRect()
    if (!frame || !box) return
    const frameBox = frame.getBoundingClientRect()
    const x = frameBox.left + e.clientX
    const y = frameBox.top + e.clientY
    // A tap on a highlight opens its toolbar (onHighlightTap) and does nothing else.
    const onMark = [...document.querySelectorAll('.pos-hl rect')].some((r) => {
      const b = r.getBoundingClientRect()
      return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom
    })
    if (onMark) return
    // Elsewhere, a tap first just closes an open toolbar.
    if (target) {
      setTarget(null)
      return
    }
    const ratio = (x - box.left) / box.width
    if (settings.flow === 'paginated' && ratio < 0.22) goLeft()
    else if (settings.flow === 'paginated' && ratio > 0.78) goRight()
    else if (panelRef.current) setPanel(null)
    else setChrome((c) => !c)
  })
  useEffect(() => {
    if (!rendition) return
    let touch: { x: number; y: number; t: number } | null = null
    const onTouchStart = (e: TouchEvent) => {
      const p = e.changedTouches[0]
      touch = { x: p.screenX, y: p.screenY, t: Date.now() }
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (!touch) return
      const p = e.changedTouches[0]
      const dx = p.screenX - touch.x
      const dy = p.screenY - touch.y
      if (Math.abs(dx) > 50 && Math.abs(dy) < 60 && Date.now() - touch.t < 600) onSwipe(dx)
      touch = null
    }
    const onClick = (e: MouseEvent) => onTap(e)
    rendition.on('touchstart', onTouchStart)
    rendition.on('touchend', onTouchEnd)
    rendition.on('click', onClick)
    return () => {
      rendition.off('touchstart', onTouchStart)
      rendition.off('touchend', onTouchEnd)
      rendition.off('click', onClick)
    }
  }, [rendition])

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => undefined)
  }

  // ---- bookmarks ----
  const pageBookmark = useMemo(() => {
    if (!location?.start || !location.end) return null
    return (
      bookmarks.find(
        (b) => cfiCompare.compare(b.cfi, location.start.cfi) >= 0 && cfiCompare.compare(b.cfi, location.end.cfi) <= 0,
      ) ?? null
    )
  }, [bookmarks, location])

  const chapter = location?.start ? chapterOf(toc, location.start.index) : null

  const persistBookmarks = (list: Bookmark[]) => {
    const before = bookmarks
    setBookmarks(list)
    void saveBookmarks(info.id, list).then((r) => {
      if (!r.ok) {
        setBookmarks(before)
        setToast({ text: r.error, tone: 'error' })
      }
    })
  }
  const toggleBookmark = () => {
    if (!location?.start) return
    if (pageBookmark) {
      persistBookmarks(bookmarks.filter((b) => b.cfi !== pageBookmark.cfi))
      setToast({ text: '已移除書籤', tone: 'info' })
      return
    }
    const label = `${chapter?.item.label.trim() || '書籤'} · ${percentOf(progress)}`
    const list = [...bookmarks, { cfi: location.start.cfi, label, createdAt: new Date().toISOString() }].sort((a, b) =>
      cfiCompare.compare(a.cfi, b.cfi),
    )
    persistBookmarks(list)
    setToast({ text: '已加入書籤', tone: 'info' })
  }

  // ---- highlights ----
  // epub.js passes on a copy of the tap without its position, so the toolbar goes by the mark itself.
  const onHighlightTap = useEffectEvent((id: string) => {
    const highlight = highlights.find((h) => h.id === id)
    const box = document.querySelector(`.pos-hl[data-id="${CSS.escape(id)}"]`)?.getBoundingClientRect()
    if (!highlight || !box) return
    setTarget({ kind: 'existing', highlight, x: box.left + box.width / 2, top: box.top, bottom: box.bottom })
  })
  // epub.js draws highlights over the page; redraw them all when the list,
  // the layout or the light/dark look changes.
  useEffect(() => {
    if (!rendition) return
    const dark = palette.scheme === 'dark'
    const drawn: string[] = []
    for (const h of highlights) {
      rendition.annotations.highlight(h.cfi, { id: h.id }, () => onHighlightTap(h.id), 'pos-hl', {
        fill: highlightHex(h.color),
        'fill-opacity': dark ? '0.3' : '0.38',
        'mix-blend-mode': dark ? 'normal' : 'multiply',
      })
      drawn.push(h.cfi)
    }
    return () => drawn.forEach((cfi) => rendition.annotations.remove(cfi, 'highlight'))
  }, [rendition, highlights, palette.scheme])

  const persistHighlights = (list: Highlight[]) => {
    const before = highlights
    setHighlights(list)
    void saveHighlights(info.id, list).then((r) => {
      if (!r.ok) {
        setHighlights(before)
        setToast({ text: r.error, tone: 'error' })
      }
    })
  }
  const clearSelection = () => {
    selectionRef.current?.contents.window?.getSelection()?.removeAllRanges()
    selectionRef.current = null
  }
  const addHighlight = (color: HighlightColor, note = '') => {
    if (target?.kind !== 'new') return
    const highlight: Highlight = { id: newId(), cfi: target.cfi, text: target.text, color, note, createdAt: new Date().toISOString() }
    persistHighlights([...highlights, highlight].sort((a, b) => cfiCompare.compare(a.cfi, b.cfi)))
    clearSelection()
    setTarget(null)
  }
  const changeHighlight = (id: string, patch: Partial<Highlight>) => {
    persistHighlights(highlights.map((h) => (h.id === id ? { ...h, ...patch } : h)))
    setTarget(null)
  }
  const removeHighlight = (id: string) => {
    persistHighlights(highlights.filter((h) => h.id !== id))
    setTarget(null)
  }
  const copy = (text: string, message = '已複製') => {
    void navigator.clipboard?.writeText(text).then(
      () => setToast({ text: message, tone: 'info' }),
      () => setToast({ text: '無法複製', tone: 'error' }),
    )
  }
  const copyHighlights = () => {
    const body = highlights.map((h) => `> ${h.text}${h.note ? `\n\n${h.note}` : ''}`).join('\n\n---\n\n')
    copy(`# ${info.title}${info.author ? `\n\n${info.author}` : ''}\n\n${body}\n`, `已複製 ${highlights.length} 則劃線`)
  }

  // ---- search: jump there and flash the match ----
  const flashTimer = useRef<number | undefined>(undefined)
  const goToHit = (hit: SearchHit) => {
    if (!rendition) return
    if (window.matchMedia('(max-width: 767px)').matches) setPanel(null)
    void rendition.display(hit.cfi).then(() => {
      window.clearTimeout(flashTimer.current)
      rendition.annotations.highlight(hit.cfi, {}, undefined, 'pos-search', { fill: palette.link, 'fill-opacity': '0.3' })
      flashTimer.current = window.setTimeout(() => rendition.annotations.remove(hit.cfi, 'highlight'), SEARCH_FLASH_MS)
    })
  }
  useEffect(() => () => window.clearTimeout(flashTimer.current), [])

  // ---- sleep timer ----
  useEffect(() => {
    if (sleep.mode !== 'time') return
    const timer = window.setTimeout(
      () => {
        ttsRef.current?.pause()
        setSleep({ mode: 'off' })
        setToast({ text: `${sleep.minutes} 分鐘到了，朗讀已暫停`, tone: 'info' })
      },
      Math.max(0, sleep.until - Date.now()),
    )
    return () => window.clearTimeout(timer)
  }, [sleep])

  // ---- read aloud ----
  useEffect(() => {
    ttsRef.current?.configure({ choice, rate: ttsPrefs.rate, lang: effectiveLang, title: info.title, artist: info.author ?? '' })
  }, [choice, ttsPrefs.rate, effectiveLang, rendition, info.title, info.author])

  const play = (fromCfi?: string) => {
    const tts = ttsRef.current
    if (!tts) return
    tts.unlock()
    if (fromCfi) {
      clearSelection()
      return void tts.start(fromCfi)
    }
    if (tts.current === 'paused') return tts.resume()
    // A selection made in the last moment: start reading there.
    const sel = selectionRef.current
    const fromSelection = sel && sel.contents.window?.getSelection()?.toString() ? sel.cfi : undefined
    selectionRef.current = null
    sel?.contents.window?.getSelection()?.removeAllRanges()
    void tts.start(fromSelection)
  }
  const openListen = (fromCfi?: string) => {
    if (source === 'browser' && !speechSupported()) {
      setToast({ text: '這個瀏覽器不支援朗讀', tone: 'error' })
      return
    }
    setListening(true)
    setPanel(null)
    setTarget(null)
    play(fromCfi)
  }
  const closeListen = () => {
    ttsRef.current?.stop()
    setListening(false)
    setSleep({ mode: 'off' })
  }
  const updateTts = (patch: Partial<TtsPrefs>) => {
    setTtsPrefs((p) => {
      const nextPrefs = { ...p, ...patch }
      saveTtsPrefs(nextPrefs)
      return nextPrefs
    })
  }

  // ---- render ----
  const barsVisible = chrome || panel !== null || listening || !ready
  const vars = {
    '--r-bg': palette.bg,
    '--r-surface': palette.surface,
    '--r-ink': palette.ink,
    '--r-muted': palette.muted,
    '--r-line': palette.line,
    '--r-accent': palette.link,
    '--r-sunken': `color-mix(in oklab, ${palette.ink} 6%, ${palette.surface})`,
    colorScheme: palette.scheme,
  } as CSSProperties
  const page = location?.start?.displayed
  const shown = scrub ?? progress

  return (
    <div
      className="reader-root fixed inset-0 flex flex-col overflow-hidden bg-[var(--r-bg)] text-[var(--r-ink)] transition-colors duration-500"
      style={vars}
      onMouseMove={(e) => {
        // Pointer near the top or bottom edge brings the bars back (desktop).
        if (e.clientY < 72 || window.innerHeight - e.clientY < 72) showChrome()
      }}
    >
      {/* Top bar */}
      <header
        className={`reader-bar relative z-30 flex h-14 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] md:px-4 ${
          barsVisible ? '' : 'is-hidden'
        }`}
      >
        <Link
          href="/books"
          className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] text-[var(--r-muted)] transition-colors hover:bg-[var(--r-sunken)] hover:text-[var(--r-ink)]"
        >
          <ArrowLeft size={18} />
          <span className="hidden sm:inline">書庫</span>
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate font-serif text-[14px] font-medium">{info.title}</p>
          <p className="truncate text-[11px] text-[var(--r-muted)]">{chapter?.item.label.trim() || info.author || ' '}</p>
        </div>
        <div className="flex items-center">
          <IconButton
            label="目錄、書籤與劃線"
            onClick={() => {
              setContentsTab('toc')
              setPanel(panel === 'toc' ? null : 'toc')
            }}
            active={panel === 'toc'}
          >
            <ListBullets size={19} />
          </IconButton>
          <IconButton label="搜尋全書（Ctrl F）" onClick={() => setPanel(panel === 'search' ? null : 'search')} active={panel === 'search'} disabled={!book}>
            <MagnifyingGlass size={19} />
          </IconButton>
          <IconButton label={pageBookmark ? '移除書籤' : '加入書籤'} onClick={toggleBookmark} active={Boolean(pageBookmark)} disabled={!location}>
            <BookmarkSimple size={19} weight={pageBookmark ? 'fill' : 'regular'} className={pageBookmark ? 'text-[var(--r-accent)]' : ''} />
          </IconButton>
          <IconButton label="閱讀設定" onClick={() => setPanel(panel === 'settings' ? null : 'settings')} active={panel === 'settings'}>
            <TextAa size={19} />
          </IconButton>
          <IconButton label="朗讀" onClick={() => (listening ? closeListen() : openListen())} active={listening} disabled={!ready}>
            <Headphones size={19} weight={listening ? 'fill' : 'regular'} />
          </IconButton>
          <span className="hidden md:block">
            <IconButton label={fullscreen ? '離開全螢幕' : '全螢幕'} onClick={toggleFullscreen}>
              {fullscreen ? <CornersIn size={19} /> : <CornersOut size={19} />}
            </IconButton>
          </span>
        </div>
      </header>

      {/* The book */}
      <main className="relative min-h-0 flex-1">
        <div
          ref={viewerRef}
          className={`reader-viewer absolute inset-y-0 left-1/2 w-full -translate-x-1/2 ${
            settings.flow === 'scrolled' ? 'max-w-[760px] px-5 md:px-10' : 'max-w-[1240px] px-5 md:px-14'
          } ${ready ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
        />
        {settings.flow === 'paginated' && ready && (
          <>
            <EdgeButton side="left" label={rtl ? '下一頁' : '上一頁'} onClick={goLeft} />
            <EdgeButton side="right" label={rtl ? '上一頁' : '下一頁'} onClick={goRight} />
          </>
        )}
        {!ready && (
          <LoadingState
            phase={view}
            title={info.title}
            onRetry={() => {
              setPhase({ kind: 'downloading', progress: null })
              setAttempt((a) => a + 1)
            }}
          />
        )}
      </main>

      {/* Bottom bar */}
      <footer
        className={`reader-bar reader-bar-bottom relative z-20 flex h-12 shrink-0 items-center gap-3 px-4 pb-[env(safe-area-inset-bottom)] md:gap-5 md:px-6 ${
          barsVisible ? '' : 'is-hidden'
        }`}
      >
        <span className="hidden w-28 truncate font-mono text-[11px] text-[var(--r-muted)] tabular-nums sm:block">
          {page && settings.flow === 'paginated' ? `本章 ${page.page} / ${page.total}` : ' '}
        </span>
        <div className="relative flex-1">
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={Math.round(shown * 1000)}
            disabled={!locationsReady}
            aria-label="閱讀進度"
            aria-valuetext={percentOf(shown)}
            onChange={(e) => setScrub(Number(e.target.value) / 1000)}
            onPointerUp={() => commitScrub()}
            onKeyUp={() => commitScrub()}
            className="reader-range w-full"
            style={{ '--fill': `${shown * 100}%` } as CSSProperties}
          />
          {scrub !== null && (
            <span className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded-md bg-[var(--r-ink)] px-2 py-0.5 font-mono text-[11px] text-[var(--r-surface)]" style={{ left: `${scrub * 100}%` }}>
              {percentOf(scrub)}
            </span>
          )}
        </div>
        <span className="w-12 text-right font-mono text-[11px] text-[var(--r-muted)] tabular-nums" title={locationsReady ? undefined : '正在計算頁數'}>
          {locationsReady ? percentOf(shown) : '···'}
        </span>
      </footer>

      {listening && (
        <ListenBar
          state={ttsState}
          voiceLabel={voiceLabel}
          voicePicker={(close) => (
            <VoicePicker
              lang={effectiveLang}
              status={ttsStatus}
              source={source}
              browserVoices={voices}
              browserVoice={browserVoice}
              azureVoice={azureVoice}
              geminiVoice={geminiVoice}
              prefs={ttsPrefs}
              onPrefs={updateTts}
              onClose={close}
            />
          )}
          rate={ttsPrefs.rate}
          onPlay={() => play()}
          onPause={() => ttsRef.current?.pause()}
          onSkip={(d) => ttsRef.current?.skip(d)}
          onRate={(rate) => updateTts({ rate })}
          sleep={sleep}
          onSleep={setSleep}
          onClose={closeListen}
        />
      )}

      {target && (
        <SelectionToolbar
          key={target.kind === 'existing' ? target.highlight.id : target.cfi}
          target={target}
          onColor={(color) => (target.kind === 'new' ? addHighlight(color) : changeHighlight(target.highlight.id, { color }))}
          onNote={(note) => (target.kind === 'new' ? addHighlight('yellow', note) : changeHighlight(target.highlight.id, { note }))}
          onCopy={() => {
            copy(target.kind === 'new' ? target.text : target.highlight.text)
            setTarget(null)
          }}
          onListen={target.kind === 'new' ? () => openListen(target.cfi) : undefined}
          onDelete={target.kind === 'existing' ? () => removeHighlight(target.highlight.id) : undefined}
        />
      )}

      {panel === 'settings' && <SettingsPanel settings={settings} onChange={changeSettings} onClose={() => setPanel(null)} />}
      {panel === 'search' && book && (
        <SearchPanel
          book={book}
          chapterLabel={(index) => chapterOf(toc, index)?.item.label.trim() || `第 ${index + 1} 部分`}
          onGo={goToHit}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'toc' && (
        <ContentsPanel
          title={info.title}
          author={info.author}
          toc={toc}
          activeHref={chapter?.item.href ?? null}
          bookmarks={bookmarks}
          highlights={highlights}
          initialTab={contentsTab}
          onGo={go}
          onRemoveBookmark={(cfi) => persistBookmarks(bookmarks.filter((b) => b.cfi !== cfi))}
          onRemoveHighlight={removeHighlight}
          onCopyHighlights={copyHighlights}
          onClose={() => setPanel(null)}
        />
      )}

      {toast && <Toast key={toast.text} {...toast} />}
    </div>
  )

  function commitScrub() {
    if (scrub === null || !book || !locationsReady) return
    const target = book.locations.cfiFromPercentage(scrub)
    setScrub(null)
    if (target) void rendition?.display(target)
  }
}

function IconButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      className={`grid size-9 place-items-center rounded-lg transition-[background-color,color,transform] duration-200 active:scale-95 disabled:opacity-35 ${
        active ? 'bg-[var(--r-sunken)] text-[var(--r-ink)]' : 'text-[var(--r-muted)] hover:bg-[var(--r-sunken)] hover:text-[var(--r-ink)]'
      }`}
    >
      {children}
    </button>
  )
}

function EdgeButton({ side, label, onClick }: { side: 'left' | 'right'; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`reader-edge absolute top-1/2 z-10 hidden h-24 w-10 -translate-y-1/2 place-items-center rounded-lg text-[var(--r-muted)] md:grid ${
        side === 'left' ? 'left-2' : 'right-2'
      }`}
    >
      {side === 'left' ? <CaretLeft size={22} /> : <CaretRight size={22} />}
    </button>
  )
}

function LoadingState({ phase, title, onRetry }: { phase: Phase; title: string; onRetry: () => void }) {
  if (phase.kind === 'error') {
    return (
      <div className="absolute inset-0 grid place-items-center px-6">
        <div className="max-w-sm text-center">
          <WarningCircle size={32} className="mx-auto text-[var(--r-muted)]" />
          <p className="mt-4 font-serif text-lg">{title}</p>
          <p className="mt-1 text-sm text-[var(--r-muted)]">{phase.message}</p>
          <div className="mt-6 flex justify-center gap-2">
            <button type="button" onClick={onRetry} className="btn border border-[var(--r-line)] bg-[var(--r-surface)] text-[var(--r-ink)]">
              再試一次
            </button>
            <Link href="/books" className="btn text-[var(--r-muted)]">
              回書庫
            </Link>
          </div>
        </div>
      </div>
    )
  }
  const progress = phase.kind === 'downloading' ? phase.progress : null
  return (
    <div className="absolute inset-0 flex justify-center overflow-hidden px-6 pt-[8vh]" aria-live="polite">
      <div className="w-full max-w-[560px]">
        <p className="font-mono text-[11px] tracking-wide text-[var(--r-muted)]">
          {phase.kind === 'downloading' ? (progress !== null ? `下載中 ${Math.round(progress * 100)}%` : '下載中') : '排版中'}
        </p>
        <div className="mt-2 h-px w-full bg-[var(--r-line)]">
          <div
            className={`h-px bg-[var(--r-accent)] transition-[width] duration-300 ${progress === null ? 'reader-indeterminate w-1/3' : ''}`}
            style={progress !== null ? { width: `${progress * 100}%` } : undefined}
          />
        </div>
        <p className="mt-10 font-serif text-2xl leading-snug">{title}</p>
        <div className="mt-8 grid gap-3" aria-hidden>
          {[92, 100, 96, 88, 100, 71, 0, 97, 100, 84, 93, 58].map((w, i) =>
            w ? (
              <span key={i} className="reader-skeleton h-3 rounded-full" style={{ width: `${w}%`, animationDelay: `${i * 60}ms` }} />
            ) : (
              <span key={i} className="h-3" />
            ),
          )}
        </div>
      </div>
    </div>
  )
}
