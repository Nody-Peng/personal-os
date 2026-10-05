'use client'

import {
  AirplaneTilt,
  ClockCounterClockwise,
  Flag,
  Hamburger,
  HandWaving,
  Heart,
  Lightbulb,
  MagnifyingGlass,
  PawPrint,
  Shuffle,
  Smiley,
  SoccerBall,
  UploadSimple,
  type Icon,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  NOTE_ICONS,
  NOTE_ICON_COLORS,
  NOTE_ICON_GROUPS,
  noteIconColor,
  parseNoteIcon,
  phosphorIcon,
  type NoteIconColor,
  type NoteIconName,
} from '@/lib/noteIcons'
import { loadEmoji, readTone, withTone, writeTone, type EmojiData, type EmojiEntry } from '@/lib/emoji'
import { uploadMedia } from '@/lib/uploadMedia'
import { NoteIcon } from './NoteIcon'
import { NOTE_ICON_COMPONENTS } from './noteIconSet'

type Props = {
  value: string
  onChange: (icon: string) => void
  onClose: () => void
}

// Per-device conveniences, like Notion's recent emoji and default skin tone.
const RECENT_KEY = 'personal-os:recent-icons'
const COLOR_KEY = 'personal-os:icon-color'
function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode or storage off: the picker still works, it just forgets.
  }
}

const COLUMNS = 9
const CELL = 36
const HEADING = 30
const TONES = ['✋', '✋🏻', '✋🏼', '✋🏽', '✋🏾', '✋🏿']
const GROUP_ICONS: Icon[] = [Smiley, HandWaving, PawPrint, Hamburger, AirplaneTilt, SoccerBall, Lightbulb, Heart, Flag]
const EMOJI_CHAR = /\p{Extended_Pictographic}/u

const iconLabel = (words: string) => words.split(' ')[0]

type Tab = 'emoji' | 'icon' | 'upload'
const TAB_KIND = { emoji: 'emoji', icon: 'phosphor', upload: 'image' } as const

/** Notion's Upload tab: any picture, shrunk to an icon (transparency kept). */
function UploadArea({ onUploaded }: { onUploaded: (url: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const upload = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('請選一張圖片')
    if (file.size > 10 * 1024 * 1024) return setError('圖片超過 10 MB')
    setBusy(true)
    setError(null)
    try {
      onUploaded(await uploadMedia(file, { maxSide: 512, keepAlpha: true }))
    } catch (e) {
      setError(e instanceof Error ? e.message : '上傳失敗')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="pt-2">
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files?.[0])} />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          void upload(e.dataTransfer.files[0])
        }}
        className={`flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-7 text-sm transition-colors ${
          over ? 'border-accent bg-accent-soft text-ink-strong' : 'border-line-strong text-muted hover:bg-sunken hover:text-ink-strong'
        }`}
      >
        <UploadSimple size={22} />
        {busy ? '上傳中…' : '選擇或拖進一張圖片'}
        <span className="text-xs text-faint">正方形最好看；會縮到 512 px，保留透明背景</span>
      </button>
      {error && <p className="mt-2 text-xs text-red-ink">{error}</p>}
    </div>
  )
}

/** Notion's icon picker: emoji (search, recent, skin tone) or a coloured icon. */
export function IconPicker({ value, onChange, onClose }: Props) {
  const current = parseNoteIcon(value)
  const [tab, setTab] = useState<Tab>(current?.kind === 'phosphor' ? 'icon' : current?.kind === 'image' ? 'upload' : 'emoji')
  const [query, setQuery] = useState('')
  const [tone, setTone] = useState(readTone)
  const [toneOpen, setToneOpen] = useState(false)
  const [color, setColor] = useState<NoteIconColor>(() => (current?.kind === 'phosphor' ? current.color : readStore(COLOR_KEY, 'default')))
  const [recent] = useState(() => readStore<string[]>(RECENT_KEY, []))
  const [data, setData] = useState<EmojiData | null>(null)
  const [activeGroup, setActiveGroup] = useState(-1)
  const panel = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    let live = true
    void loadEmoji().then((d) => live && setData(d))
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!panel.current?.contains(e.target as Node)) onCloseRef.current()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [])

  const pick = (icon: string) => {
    if (icon) writeStore(RECENT_KEY, [icon, ...recent.filter((r) => r !== icon)].slice(0, COLUMNS * 2))
    onChange(icon)
    onClose()
  }
  const toned = (e: EmojiEntry) => withTone(e, tone)
  const changeColor = (next: NoteIconColor) => {
    setColor(next)
    writeStore(COLOR_KEY, next)
  }

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (text: string) => words.every((w) => text.includes(w))
  const allEmoji = data?.groups.flatMap((g) => g.emoji) ?? []

  const random = () => {
    if (tab === 'icon') {
      const [name] = NOTE_ICONS[Math.floor(Math.random() * NOTE_ICONS.length)]
      pick(phosphorIcon(name, color))
    } else if (allEmoji.length) {
      pick(toned(allEmoji[Math.floor(Math.random() * allEmoji.length)]))
    }
  }

  const emojiCell = (e: EmojiEntry) => {
    const char = toned(e)
    return (
      <button
        key={e[0]}
        type="button"
        title={e[1]}
        aria-label={e[1]}
        onClick={() => pick(char)}
        className={`grid place-items-center rounded-md text-[22px] leading-none transition-colors hover:bg-sunken ${value === char ? 'bg-sunken ring-1 ring-line-strong' : ''}`}
        style={{ height: CELL }}
      >
        <span className="note-emoji">{char}</span>
      </button>
    )
  }
  const iconCell = (name: NoteIconName, label: string, cellColor = color) => {
    const Glyph = NOTE_ICON_COMPONENTS[name]
    const icon = phosphorIcon(name, cellColor)
    return (
      <button
        key={icon}
        type="button"
        title={label}
        aria-label={label}
        onClick={() => pick(icon)}
        className={`grid place-items-center rounded-md transition-colors hover:bg-sunken ${value === icon ? 'bg-sunken ring-1 ring-line-strong' : ''}`}
        style={{ height: CELL }}
      >
        <Glyph size={22} weight="fill" color={noteIconColor(cellColor)} />
      </button>
    )
  }
  const recentCell = (icon: string) => {
    const parsed = parseNoteIcon(icon)
    if (parsed?.kind === 'phosphor') return iconCell(parsed.name, '最近使用', parsed.color)
    const entry = allEmoji.find((e) => e[0] === icon || e[3]?.includes(icon))
    return (
      <button
        key={icon}
        type="button"
        title={entry?.[1]}
        aria-label={entry?.[1] ?? icon}
        onClick={() => pick(icon)}
        className="grid place-items-center rounded-md text-[22px] leading-none transition-colors hover:bg-sunken"
        style={{ height: CELL }}
      >
        <NoteIcon icon={icon} />
      </button>
    )
  }

  const section = (key: string, title: string, cells: ReactNode[], index?: number) => (
    <section
      key={key}
      data-group={index}
      className="note-picker-section"
      style={{ containIntrinsicSize: `auto ${HEADING + Math.ceil(cells.length / COLUMNS) * CELL}px` } as CSSProperties}
    >
      <h3 className="label sticky top-0 z-10 bg-surface px-1 pt-2 pb-1">{title}</h3>
      <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}>
        {cells}
      </div>
    </section>
  )

  const recentOfTab = recent.filter((r) => parseNoteIcon(r)?.kind === TAB_KIND[tab])
  let body: ReactNode
  if (tab === 'upload') {
    body = (
      <>
        <UploadArea onUploaded={pick} />
        {recentOfTab.length > 0 && section('recent', '最近上傳', recentOfTab.map(recentCell))}
      </>
    )
  } else if (tab === 'emoji') {
    if (words.length) {
      const typed = EMOJI_CHAR.test(query) ? Array.from(query.trim()).slice(0, 8).join('') : ''
      const found = allEmoji.filter((e) => matches(e[2]))
      const cells = found.slice(0, 270).map(emojiCell)
      if (typed && !found.some((e) => e[0] === typed)) cells.unshift(recentCell(typed))
      body = cells.length ? section('results', '搜尋結果', cells) : null
    } else {
      body = (
        <>
          {recentOfTab.length > 0 && section('recent', '最近使用', recentOfTab.map(recentCell), -1)}
          {data
            ? data.groups.map((g, i) => section(g.name, g.name, g.emoji.map(emojiCell), i))
            : <p className="px-1 py-6 text-center text-sm text-faint">載入表情符號…</p>}
        </>
      )
    }
  } else {
    const found = NOTE_ICONS.filter(([name, , w]) => !words.length || matches(`${name} ${w}`))
    body = words.length
      ? found.length
        ? section('results', '搜尋結果', found.map(([name, , w]) => iconCell(name, iconLabel(w))))
        : null
      : (
          <>
            {recentOfTab.length > 0 && section('recent', '最近使用', recentOfTab.map(recentCell))}
            {NOTE_ICON_GROUPS.map((g, i) =>
              section(g, g, NOTE_ICONS.filter(([, group]) => group === i).map(([name, , w]) => iconCell(name, iconLabel(w)))),
            )}
          </>
        )
  }

  const jumpTo = (index: number) => {
    const target = scroller.current?.querySelector<HTMLElement>(`[data-group="${index}"]`)
    if (target && scroller.current) scroller.current.scrollTo({ top: target.offsetTop })
  }
  const onScroll = () => {
    const box = scroller.current
    if (!box || tab !== 'emoji' || words.length) return
    let active = -1
    for (const el of box.querySelectorAll<HTMLElement>('[data-group]')) {
      if (el.offsetTop - 4 <= box.scrollTop) active = Number(el.dataset.group)
    }
    setActiveGroup(active)
  }

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label="選擇圖示"
      data-own-escape
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        // Close only the picker, not a side panel listening behind it.
        e.stopPropagation()
        if (toneOpen) setToneOpen(false)
        else onClose()
      }}
      className="pop-in pop-in-left absolute top-full left-0 z-30 mt-2 flex w-[min(360px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-line bg-surface text-left shadow-[0_16px_40px_-16px_rgba(17,17,17,0.3)]"
    >
      <div className="flex items-center gap-1 border-b border-line px-2" role="tablist" aria-label="圖示種類">
        {(
          [
            ['emoji', '表情符號'],
            ['icon', '圖示'],
            ['upload', '上傳'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              setTab(key)
              scroller.current?.scrollTo({ top: 0 })
            }}
            className={`-mb-px border-b-2 px-2 py-2 text-sm transition-colors ${tab === key ? 'border-ink-strong font-medium text-ink-strong' : 'border-transparent text-muted hover:text-ink-strong'}`}
          >
            {label}
          </button>
        ))}
        <span className="flex-1" />
        {value && (
          <button type="button" onClick={() => pick('')} className="rounded-md px-2 py-1 text-xs text-muted hover:bg-sunken hover:text-ink-strong">
            移除
          </button>
        )}
      </div>

      <div hidden={tab === 'upload'} className="relative flex items-center gap-1.5 px-2 pt-2">
        <label className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-line bg-canvas px-2 focus-within:border-line-strong">
          <MagnifyingGlass size={14} className="shrink-0 text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              scroller.current?.scrollTo({ top: 0 })
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
              e.preventDefault()
              scroller.current?.querySelector<HTMLButtonElement>('section button')?.click()
            }}
            placeholder={tab === 'emoji' ? '搜尋表情符號，例如：書、咖啡、cat' : '搜尋圖示，例如：書、程式、目標'}
            aria-label="搜尋"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink-strong outline-none placeholder:text-faint"
          />
        </label>
        <button type="button" onClick={random} title="隨機" aria-label="隨機挑一個" className="grid size-8 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink-strong">
          <Shuffle size={16} />
        </button>
        {tab === 'emoji' ? (
          <button
            type="button"
            onClick={() => setToneOpen((o) => !o)}
            title="膚色"
            aria-label="選擇膚色"
            aria-expanded={toneOpen}
            className="grid size-8 place-items-center rounded-md text-lg leading-none hover:bg-sunken"
          >
            <span className="note-emoji">{TONES[tone]}</span>
          </button>
        ) : null}
        {toneOpen && tab === 'emoji' && (
          <div className="absolute top-full right-2 z-20 mt-1 flex gap-0.5 rounded-lg border border-line bg-surface p-1 shadow-[0_8px_24px_-12px_rgba(17,17,17,0.3)]">
            {TONES.map((hand, i) => (
              <button
                key={hand}
                type="button"
                aria-label={i ? `膚色 ${i}` : '預設膚色'}
                onClick={() => {
                  setTone(i)
                  writeTone(i)
                  setToneOpen(false)
                }}
                className={`grid size-8 place-items-center rounded-md text-lg leading-none hover:bg-sunken ${tone === i ? 'bg-sunken' : ''}`}
              >
                <span className="note-emoji">{hand}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'icon' && (
        <div className="flex items-center gap-1 px-2 pt-2" role="radiogroup" aria-label="圖示顏色">
          {NOTE_ICON_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={color === c.value}
              aria-label={c.label}
              title={c.label}
              onClick={() => changeColor(c.value)}
              className={`grid size-6 place-items-center rounded-full ${color === c.value ? 'ring-2 ring-line-strong ring-offset-1' : ''}`}
            >
              <span className="size-3.5 rounded-full" style={{ background: noteIconColor(c.value) }} />
            </button>
          ))}
        </div>
      )}

      <div ref={scroller} onScroll={onScroll} className="relative h-[min(296px,45vh)] overflow-y-auto px-2 pb-2">
        {body ?? <p className="px-1 py-10 text-center text-sm text-faint">找不到符合的{tab === 'emoji' ? '表情符號' : '圖示'}</p>}
      </div>

      {tab === 'emoji' && !words.length && data && (
        <nav aria-label="表情符號分類" className="flex items-center justify-between border-t border-line px-2 py-1">
          {recentOfTab.length > 0 && (
            <GroupButton label="最近使用" Glyph={ClockCounterClockwise} active={activeGroup === -1} onClick={() => jumpTo(-1)} />
          )}
          {data.groups.map((g, i) => (
            <GroupButton key={g.name} label={g.name} Glyph={GROUP_ICONS[i] ?? Smiley} active={activeGroup === i} onClick={() => jumpTo(i)} />
          ))}
        </nav>
      )}
    </div>
  )
}

function GroupButton({ label, Glyph, active, onClick }: { label: string; Glyph: Icon; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`grid size-7 place-items-center rounded-md transition-colors hover:bg-sunken hover:text-ink-strong ${active ? 'text-ink-strong' : 'text-faint'}`}
    >
      <Glyph size={16} weight={active ? 'fill' : 'regular'} />
    </button>
  )
}
