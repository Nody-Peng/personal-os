'use client'

import { BookmarkSimple, Copy, Highlighter, Minus, Plus, Trash, X } from '@phosphor-icons/react'
import type { NavItem } from 'epubjs'
import { useState } from 'react'
import { HIGHLIGHT_COLORS, type Bookmark, type Highlight } from '@/lib/books'
import {
  FONT_OPTIONS,
  FONT_SIZES,
  LINE_HEIGHTS,
  PALETTES,
  THEME_OPTIONS,
  type ReaderSettings,
  type ReaderTheme,
} from './settings'

// Panels over the book. Colours come from the reader's own palette (--r-*
// variables set by Reader), not the app theme: a sepia page gets sepia panels.

type Segment<T extends string | number> = { value: T; label: string }

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly Segment<T>[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-[var(--r-sunken)] p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`h-8 rounded-md text-[13px] transition-[background-color,color,box-shadow] duration-200 active:scale-[0.98] ${
            o.value === value
              ? 'bg-[var(--r-surface)] font-medium text-[var(--r-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_var(--r-line)]'
              : 'text-[var(--r-muted)] hover:text-[var(--r-ink)]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const SWATCH: Record<Exclude<ReaderTheme, 'auto'>, string> = { paper: PALETTES.paper.bg, sepia: PALETTES.sepia.bg, night: PALETTES.night.bg }

export function SettingsPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: ReaderSettings
  onChange: (patch: Partial<ReaderSettings>) => void
  onClose: () => void
}) {
  const size = settings.fontSize
  return (
    <section
      aria-label="閱讀設定"
      className="reader-pop fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 rounded-2xl border border-[var(--r-line)] bg-[var(--r-surface)] p-5 text-[var(--r-ink)] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.35)] md:absolute md:inset-x-auto md:top-14 md:right-4 md:bottom-auto md:w-[340px]"
    >
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">閱讀設定</h2>
        <button type="button" onClick={onClose} aria-label="關閉" className="rounded-md p-1 text-[var(--r-muted)] hover:bg-[var(--r-sunken)]">
          <X size={16} />
        </button>
      </header>

      <div className="grid gap-5">
        <div className="grid gap-2">
          <p className="text-xs text-[var(--r-muted)]">背景</p>
          <div role="radiogroup" aria-label="背景" className="grid grid-cols-4 gap-2">
            {THEME_OPTIONS.map((t) => {
              const active = settings.theme === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange({ theme: t.value })}
                  className="group grid justify-items-center gap-1.5 text-[11px] text-[var(--r-muted)]"
                >
                  <span
                    className={`grid size-11 place-items-center rounded-full border font-serif text-sm transition-transform duration-200 group-active:scale-95 ${
                      active ? 'border-[var(--r-accent)] ring-2 ring-[var(--r-accent)]/25' : 'border-[var(--r-line)]'
                    }`}
                    style={
                      t.value === 'auto'
                        ? { background: `linear-gradient(135deg, ${SWATCH.paper} 50%, ${SWATCH.night} 50%)` }
                        : { background: SWATCH[t.value], color: PALETTES[t.value].ink }
                    }
                  >
                    {t.value === 'auto' ? '' : '文'}
                  </span>
                  <span className={active ? 'text-[var(--r-ink)]' : ''}>{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid gap-2">
          <p className="text-xs text-[var(--r-muted)]">字級</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="字小一點"
              disabled={size <= FONT_SIZES.min}
              onClick={() => onChange({ fontSize: Math.max(FONT_SIZES.min, size - FONT_SIZES.step) })}
              className="grid size-9 place-items-center rounded-lg border border-[var(--r-line)] transition active:scale-95 disabled:opacity-40"
            >
              <Minus size={14} />
            </button>
            <div className="relative h-1 flex-1 rounded-full bg-[var(--r-sunken)]">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[var(--r-accent)] transition-[width] duration-300"
                style={{ width: `${((size - FONT_SIZES.min) / (FONT_SIZES.max - FONT_SIZES.min)) * 100}%` }}
              />
            </div>
            <span className="w-11 text-right font-mono text-xs tabular-nums text-[var(--r-muted)]">{size}%</span>
            <button
              type="button"
              aria-label="字大一點"
              disabled={size >= FONT_SIZES.max}
              onClick={() => onChange({ fontSize: Math.min(FONT_SIZES.max, size + FONT_SIZES.step) })}
              className="grid size-9 place-items-center rounded-lg border border-[var(--r-line)] transition active:scale-95 disabled:opacity-40"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="grid gap-2">
          <p className="text-xs text-[var(--r-muted)]">字型</p>
          <Segmented label="字型" options={FONT_OPTIONS} value={settings.font} onChange={(font) => onChange({ font })} />
        </div>

        <div className="grid gap-2">
          <p className="text-xs text-[var(--r-muted)]">行距</p>
          <Segmented
            label="行距"
            options={LINE_HEIGHTS.map((v, i) => ({ value: v, label: ['緊密', '適中', '寬鬆'][i] }))}
            value={settings.lineHeight as (typeof LINE_HEIGHTS)[number]}
            onChange={(lineHeight) => onChange({ lineHeight })}
          />
        </div>

        <div className="grid gap-2">
          <p className="text-xs text-[var(--r-muted)]">版面</p>
          <Segmented
            label="版面"
            options={[
              { value: 'paginated', label: '翻頁' },
              { value: 'scrolled', label: '捲動' },
            ]}
            value={settings.flow}
            onChange={(flow) => onChange({ flow })}
          />
        </div>

        <label className="flex items-center justify-between gap-3 text-[13px]">
          <span>
            直排書改成橫排
            <span className="block text-xs text-[var(--r-muted)]">直排版面在網頁上比較不穩定，建議開著</span>
          </span>
          <input
            type="checkbox"
            checked={settings.horizontal}
            onChange={(e) => onChange({ horizontal: e.target.checked })}
            className="reader-switch"
          />
        </label>
      </div>
    </section>
  )
}

export type TocEntry = { item: NavItem; depth: number; spineIndex: number }

export function ContentsPanel({
  title,
  author,
  toc,
  activeHref,
  bookmarks,
  highlights,
  initialTab = 'toc',
  onGo,
  onRemoveBookmark,
  onRemoveHighlight,
  onCopyHighlights,
  onClose,
}: {
  title: string
  author: string | null
  toc: TocEntry[]
  activeHref: string | null
  bookmarks: Bookmark[]
  highlights: Highlight[]
  initialTab?: 'toc' | 'bookmarks' | 'highlights'
  onGo: (target: string) => void
  onRemoveBookmark: (cfi: string) => void
  onRemoveHighlight: (id: string) => void
  onCopyHighlights: () => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'toc' | 'bookmarks' | 'highlights'>(initialTab)
  return (
    <>
      <button type="button" aria-label="關閉目錄" onClick={onClose} className="modal-scrim fixed inset-0 z-40 bg-black/25" />
      <aside
        aria-label="目錄"
        className="reader-drawer fixed inset-y-0 left-0 z-50 flex w-[min(360px,88vw)] flex-col border-r border-[var(--r-line)] bg-[var(--r-surface)] text-[var(--r-ink)] shadow-[24px_0_60px_-30px_rgba(0,0,0,0.35)]"
      >
        <header className="flex items-start justify-between gap-3 px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-4">
          <div className="min-w-0">
            <p className="line-clamp-2 font-serif text-[17px] leading-snug font-semibold">{title}</p>
            {author && <p className="mt-1 truncate text-xs text-[var(--r-muted)]">{author}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="關閉" className="rounded-md p-1 text-[var(--r-muted)] hover:bg-[var(--r-sunken)]">
            <X size={16} />
          </button>
        </header>
        <div className="px-5 pb-3">
          <Segmented
            label="目錄、書籤或劃線"
            options={[
              { value: 'toc', label: '目錄' },
              { value: 'bookmarks', label: bookmarks.length ? `書籤 ${bookmarks.length}` : '書籤' },
              { value: 'highlights', label: highlights.length ? `劃線 ${highlights.length}` : '劃線' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-[var(--r-line)] px-2 py-2 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          {tab === 'toc' ? (
            toc.length ? (
              <ol>
                {toc.map(({ item, depth }) => {
                  const active = item.href === activeHref
                  return (
                    <li key={`${item.id}-${item.href}`}>
                      <button
                        type="button"
                        onClick={() => onGo(item.href)}
                        aria-current={active ? 'location' : undefined}
                        className={`relative w-full rounded-md py-2 pr-3 text-left text-[14px] leading-snug transition-colors hover:bg-[var(--r-sunken)] ${
                          active ? 'font-medium text-[var(--r-ink)]' : 'text-[var(--r-ink)]/80'
                        }`}
                        style={{ paddingLeft: `${12 + depth * 14}px` }}
                      >
                        {active && <span className="absolute inset-y-2 left-0.5 w-0.5 rounded-full bg-[var(--r-accent)]" aria-hidden />}
                        {item.label.trim() || '（無標題）'}
                      </button>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <p className="px-3 py-8 text-center text-sm text-[var(--r-muted)]">這本書沒有目錄</p>
            )
          ) : tab === 'highlights' ? (
            <HighlightList highlights={highlights} onGo={onGo} onRemove={onRemoveHighlight} onCopy={onCopyHighlights} />
          ) : bookmarks.length ? (
            <ul>
              {bookmarks.map((b) => (
                <li key={b.cfi} className="group flex items-center gap-1 rounded-md hover:bg-[var(--r-sunken)]">
                  <button type="button" onClick={() => onGo(b.cfi)} className="flex min-w-0 flex-1 items-start gap-2.5 px-3 py-2.5 text-left">
                    <BookmarkSimple size={15} weight="fill" className="mt-0.5 shrink-0 text-[var(--r-accent)]" />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px]">{b.label || '書籤'}</span>
                      <span className="font-mono text-[11px] text-[var(--r-muted)]">
                        {new Date(b.createdAt).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveBookmark(b.cfi)}
                    aria-label="刪除書籤"
                    className="mr-1 rounded-md p-2 text-[var(--r-muted)] opacity-100 transition-opacity hover:text-[var(--r-ink)] md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  >
                    <Trash size={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-10 text-center">
              <BookmarkSimple size={28} className="mx-auto text-[var(--r-muted)]" />
              <p className="mt-3 text-sm">還沒有書籤</p>
              <p className="mt-1 text-xs text-[var(--r-muted)]">讀到想回來的地方，按上方的書籤圖示</p>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

const hexOf = (color: string) => HIGHLIGHT_COLORS.find((c) => c.value === color)?.hex ?? HIGHLIGHT_COLORS[0].hex

function HighlightList({
  highlights,
  onGo,
  onRemove,
  onCopy,
}: {
  highlights: Highlight[]
  onGo: (target: string) => void
  onRemove: (id: string) => void
  onCopy: () => void
}) {
  if (!highlights.length) {
    return (
      <div className="px-6 py-10 text-center">
        <Highlighter size={28} className="mx-auto text-[var(--r-muted)]" />
        <p className="mt-3 text-sm">還沒有劃線</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--r-muted)]">選取書裡的文字，挑一個顏色就能劃線，也可以加上筆記</p>
      </div>
    )
  }
  return (
    <>
      <div className="flex justify-end px-2 pb-1">
        <button type="button" onClick={onCopy} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--r-muted)] hover:bg-[var(--r-sunken)] hover:text-[var(--r-ink)]">
          <Copy size={13} />
          複製全部（Markdown）
        </button>
      </div>
      <ul className="grid gap-1">
        {highlights.map((h) => (
          <li key={h.id} className="group relative rounded-md hover:bg-[var(--r-sunken)]">
            <button type="button" onClick={() => onGo(h.cfi)} className="flex w-full gap-3 px-3 py-2.5 pr-10 text-left">
              <span className="w-[3px] shrink-0 self-stretch rounded-full" style={{ background: hexOf(h.color) }} aria-hidden />
              <span className="min-w-0">
                <span className="line-clamp-3 font-serif text-[14px] leading-relaxed">{h.text}</span>
                {h.note && <span className="mt-1.5 block text-[12.5px] leading-relaxed text-[var(--r-muted)]">{h.note}</span>}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(h.id)}
              aria-label="刪除劃線"
              className="absolute top-2 right-1 rounded-md p-2 text-[var(--r-muted)] opacity-100 transition-opacity hover:text-[var(--r-ink)] md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            >
              <Trash size={15} />
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
