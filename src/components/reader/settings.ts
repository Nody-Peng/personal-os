'use client'

// Reader preferences (per device, kept in localStorage) and the CSS they put
// into the book's iframe.

export type ReaderTheme = 'auto' | 'paper' | 'sepia' | 'night'
export type ReaderFont = 'book' | 'serif' | 'sans'
export type ReaderFlow = 'paginated' | 'scrolled'

export type ReaderSettings = {
  theme: ReaderTheme
  /** Percent of the book's own size. */
  fontSize: number
  lineHeight: number
  font: ReaderFont
  flow: ReaderFlow
  /** Turn vertical (直排) books horizontal; epub.js lays vertical text out unreliably. */
  horizontal: boolean
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'auto',
  fontSize: 100,
  lineHeight: 1.8,
  font: 'book',
  flow: 'paginated',
  horizontal: true,
}

export const FONT_SIZES = { min: 80, max: 170, step: 10 }
export const LINE_HEIGHTS = [1.5, 1.8, 2.1] as const

export const THEME_OPTIONS: { value: ReaderTheme; label: string }[] = [
  { value: 'auto', label: '跟隨' },
  { value: 'paper', label: '紙白' },
  { value: 'sepia', label: '米黃' },
  { value: 'night', label: '夜間' },
]

export const FONT_OPTIONS: { value: ReaderFont; label: string }[] = [
  { value: 'book', label: '原書' },
  { value: 'serif', label: '明體' },
  { value: 'sans', label: '黑體' },
]

/** Colours of a reading surface. `surface` is for panels over it; `hl` marks the sentence being read aloud. */
export type Palette = {
  bg: string
  surface: string
  ink: string
  muted: string
  line: string
  link: string
  hl: string
  scheme: 'light' | 'dark'
}

export const PALETTES: Record<Exclude<ReaderTheme, 'auto'>, Palette> = {
  paper: { bg: '#faf9f6', surface: '#ffffff', ink: '#2b2a28', muted: '#8a8883', line: '#e8e6e1', link: '#2563a6', hl: 'rgba(37, 99, 166, 0.14)', scheme: 'light' },
  sepia: { bg: '#f4ecdc', surface: '#faf4e8', ink: '#4a3b2a', muted: '#8f7c64', line: '#e4d8c2', link: '#8a5a1f', hl: 'rgba(160, 108, 40, 0.18)', scheme: 'light' },
  night: { bg: '#1b1b1a', surface: '#242423', ink: '#cfcac1', muted: '#85827c', line: '#2f2f2d', link: '#6ea6e6', hl: 'rgba(110, 166, 230, 0.22)', scheme: 'dark' },
}

export function paletteOf(theme: ReaderTheme, appTheme: 'light' | 'dark'): Palette {
  return PALETTES[theme === 'auto' ? (appTheme === 'dark' ? 'night' : 'paper') : theme]
}

const SERIF = "'Iowan Old Style', 'Palatino Linotype', Georgia, 'Songti TC', 'Noto Serif TC', 'PMingLiU', serif"
const SANS = "-apple-system, 'Segoe UI', 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', sans-serif"

export const TTS_HIGHLIGHT = 'pos-tts'

/** Styles for the book's own document (replaced whenever a setting changes). */
export function bookCss(s: ReaderSettings, p: Palette): string {
  const family = s.font === 'serif' ? SERIF : s.font === 'sans' ? SANS : null
  return `
html { color-scheme: ${p.scheme}; }
html, body { background: transparent !important; color: ${p.ink} !important; }
body { font-size: ${s.fontSize}% !important; line-height: ${s.lineHeight} !important; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
body * { color: inherit !important; ${p.scheme === 'dark' ? 'background-color: transparent !important;' : ''} }
p, li, blockquote, dd, dt, div { line-height: ${s.lineHeight} !important; }
${family ? `body, body p, body div, body span, body li, body h1, body h2, body h3, body h4, body h5, body h6 { font-family: ${family} !important; }` : ''}
a, a * { color: ${p.link} !important; }
hr { border-color: ${p.line} !important; }
img, svg, video { max-width: 100%; }
${p.scheme === 'dark' ? 'img { filter: brightness(0.88); }' : ''}
::selection { background: ${p.hl}; }
::highlight(${TTS_HIGHLIGHT}) { background-color: ${p.hl}; color: inherit; }
`
}

/** Put into every chapter before layout, so epub.js lays it out horizontally. */
export const HORIZONTAL_CSS = `html, body { writing-mode: horizontal-tb !important; -webkit-writing-mode: horizontal-tb !important; -epub-writing-mode: horizontal-tb !important; }`

const KEY = 'reader-settings'

export function loadSettings(): ReaderSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<ReaderSettings> | null
    if (!saved || typeof saved !== 'object') return DEFAULT_SETTINGS
    const s = { ...DEFAULT_SETTINGS, ...saved }
    return {
      theme: THEME_OPTIONS.some((o) => o.value === s.theme) ? s.theme : DEFAULT_SETTINGS.theme,
      fontSize: Math.min(FONT_SIZES.max, Math.max(FONT_SIZES.min, Number(s.fontSize) || DEFAULT_SETTINGS.fontSize)),
      lineHeight: LINE_HEIGHTS.includes(s.lineHeight as (typeof LINE_HEIGHTS)[number]) ? s.lineHeight : DEFAULT_SETTINGS.lineHeight,
      font: FONT_OPTIONS.some((o) => o.value === s.font) ? s.font : DEFAULT_SETTINGS.font,
      flow: s.flow === 'scrolled' ? 'scrolled' : 'paginated',
      horizontal: s.horizontal !== false,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: ReaderSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Private mode: settings last for this visit only.
  }
}
