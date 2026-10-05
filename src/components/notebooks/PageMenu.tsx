'use client'

import {
  ArrowsDownUp,
  ArrowsInLineVertical,
  ArrowsOutLineVertical,
  Copy,
  DotsThree,
  FileHtml,
  FileMd,
  LinkSimple,
  Printer,
  Star,
  Trash,
  type Icon,
} from '@phosphor-icons/react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PAGE_FONTS, type PageFont } from '@/lib/options'

export type PageStyle = {
  font: PageFont
  smallText: boolean
  fullWidth: boolean
  locked: boolean
  favorite: boolean
}

type Action = { label: string; icon: Icon; onSelect: () => void; danger?: boolean; hint?: string }

type Props = {
  style: PageStyle
  canFavorite: boolean
  onStyle: (patch: Partial<PageStyle>) => void
  /** Shown as the footer; computed when the menu opens. */
  stats: () => { words: number; characters: number }
  onDuplicate: () => void
  onCopyLink: () => void
  onMove?: () => void
  onExport: (format: 'markdown' | 'html') => void
  onPrint: () => void
  /** Only for pages with an editor (not boards). */
  onToggles?: (open: boolean) => void
  onTrash: () => void
}

const WIDTH = 272
const FONT_SAMPLES: Record<PageFont, string> = {
  default: 'font-sans',
  serif: 'font-serif',
  mono: 'font-mono',
}

/** Notion's page ••• menu: typeface, page options, actions, export, word count. */
export function PageMenu(props: Props) {
  const { style, onStyle } = props
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null)
  const [stats, setStats] = useState<{ words: number; characters: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !button.current) return
    const r = button.current.getBoundingClientRect()
    setPos({
      top: r.bottom + 6,
      left: Math.min(Math.max(8, r.right - WIDTH), window.innerWidth - WIDTH - 8),
      maxHeight: window.innerHeight - r.bottom - 16,
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false)
    }
    const close = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const run = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  const actions: Action[] = [
    ...(props.canFavorite
      ? [
          {
            label: style.favorite ? '從我的最愛移除' : '加入我的最愛',
            icon: Star,
            onSelect: run(() => onStyle({ favorite: !style.favorite })),
          },
        ]
      : []),
    { label: '複製連結', icon: LinkSimple, onSelect: run(props.onCopyLink) },
    { label: '建立副本', icon: Copy, onSelect: run(props.onDuplicate) },
    ...(props.onMove
      ? [{ label: '移動到…', icon: ArrowsDownUp, onSelect: run(props.onMove) }]
      : []),
  ]
  const exports: Action[] = [
    { label: '匯出 Markdown', icon: FileMd, onSelect: run(() => props.onExport('markdown')) },
    { label: '匯出 HTML', icon: FileHtml, onSelect: run(() => props.onExport('html')) },
    { label: '列印／存成 PDF', icon: Printer, onSelect: run(props.onPrint) },
    ...(props.onToggles
      ? [
          {
            label: '全部展開',
            icon: ArrowsOutLineVertical,
            onSelect: run(() => props.onToggles!(true)),
          },
          {
            label: '全部收合',
            icon: ArrowsInLineVertical,
            onSelect: run(() => props.onToggles!(false)),
          },
        ]
      : []),
  ]

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label="頁面選項"
        title="頁面選項"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open) setStats(props.stats())
          setOpen((v) => !v)
        }}
        className="rounded-md p-1.5 text-muted transition-colors hover:bg-sunken hover:text-ink-strong"
      >
        <DotsThree size={20} weight="bold" />
      </button>
      {/* In a portal: the sticky header's backdrop blur would make it the box `fixed` positions against. */}
      {open &&
        pos &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label="頁面選項"
            data-own-escape
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return
              e.stopPropagation()
              setOpen(false)
              button.current?.focus()
            }}
            className="pop-in fixed z-[55] overflow-y-auto rounded-xl border border-line bg-surface p-1.5 text-sm shadow-[0_16px_40px_-16px_rgba(17,17,17,0.3)]"
            style={{ top: pos.top, left: pos.left, width: WIDTH, maxHeight: pos.maxHeight }}
          >
            <div role="radiogroup" aria-label="字型" className="grid grid-cols-3 gap-1 p-1">
              {PAGE_FONTS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={style.font === f.value}
                  onClick={() => onStyle({ font: f.value })}
                  className={`flex flex-col items-center gap-0.5 rounded-lg py-2 transition-colors hover:bg-sunken ${style.font === f.value ? 'text-accent' : 'text-ink'}`}
                >
                  <span className={`text-2xl leading-none ${FONT_SAMPLES[f.value]}`}>Ag</span>
                  <span className="text-xs">{f.label}</span>
                </button>
              ))}
            </div>
            <Divider />
            <Toggle
              label="小字"
              checked={style.smallText}
              onChange={(v) => onStyle({ smallText: v })}
            />
            <Toggle
              label="全寬"
              checked={style.fullWidth}
              onChange={(v) => onStyle({ fullWidth: v })}
            />
            <Toggle
              label="鎖定頁面"
              hint="防止不小心改到"
              checked={style.locked}
              onChange={(v) => onStyle({ locked: v })}
            />
            <Divider />
            {actions.map((a) => (
              <Row key={a.label} action={a} />
            ))}
            <Divider />
            {exports.map((a) => (
              <Row key={a.label} action={a} />
            ))}
            <Divider />
            <Row
              action={{
                label: '移到垃圾桶',
                icon: Trash,
                onSelect: run(props.onTrash),
                danger: true,
              }}
            />
            {stats && (
              <p className="px-2.5 pt-2 pb-1 text-xs text-faint">
                {stats.words.toLocaleString()} 字 · {stats.characters.toLocaleString()} 個字元
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}

function Divider() {
  return <div className="my-1 h-px bg-line" />
}

function Row({ action }: { action: Action }) {
  const { icon: Glyph } = action
  return (
    <button
      type="button"
      onClick={action.onSelect}
      className={`flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left outline-none transition-colors hover:bg-sunken focus-visible:bg-sunken ${action.danger ? 'text-red-ink' : 'text-ink'}`}
    >
      <Glyph size={16} className={action.danger ? '' : 'text-muted'} />
      {action.label}
    </button>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex h-8 w-full items-center justify-between gap-2 rounded-md px-2.5 text-left text-ink outline-none transition-colors hover:bg-sunken focus-visible:bg-sunken"
    >
      <span>
        {label}
        {hint && <span className="ml-1.5 text-xs text-faint">{hint}</span>}
      </span>
      <Switch on={checked} />
    </button>
  )
}

export function Switch({ on }: { on: boolean }): ReactNode {
  return (
    <span
      aria-hidden
      className={`relative inline-flex h-[18px] w-8 shrink-0 rounded-full transition-colors duration-200 ${on ? 'bg-accent' : 'bg-line-strong'}`}
    >
      <span
        className={`absolute top-[2px] size-[14px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-out-soft)] ${on ? 'translate-x-[16px]' : 'translate-x-[2px]'}`}
      />
    </span>
  )
}
