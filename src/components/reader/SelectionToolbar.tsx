'use client'

import { Check, Copy, NotePencil, SpeakerHigh, Trash } from '@phosphor-icons/react'
import { useState } from 'react'
import { HIGHLIGHT_COLORS, type Highlight, type HighlightColor } from '@/lib/books'

/** What the toolbar acts on: fresh selected text, or a highlight that was tapped. */
export type SelectionTarget =
  | { kind: 'new'; cfi: string; text: string; x: number; top: number; bottom: number }
  | { kind: 'existing'; highlight: Highlight; x: number; top: number; bottom: number }

type Props = {
  target: SelectionTarget
  onColor: (color: HighlightColor) => void
  onNote: (note: string) => void
  onCopy: () => void
  onListen?: () => void
  onDelete?: () => void
}

const MARGIN = 10
/** Half the widest toolbar (the note form), to keep it on screen without measuring. */
const HALF_WIDTH = 170

/** Floats above the selection (below it near the top of the screen). */
export function SelectionToolbar({ target, onColor, onNote, onCopy, onListen, onDelete }: Props) {
  const existing = target.kind === 'existing' ? target.highlight : null
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(existing?.note ?? '')
  // Above the selection, unless that would run into the top bar.
  const above = target.top > (editing ? 190 : 120)
  const left = Math.min(Math.max(target.x, HALF_WIDTH + MARGIN), window.innerWidth - HALF_WIDTH - MARGIN)

  return (
    <div
      role="toolbar"
      aria-label={existing ? '劃線' : '選取的文字'}
      className="reader-pop fixed z-40 rounded-xl border border-[var(--r-line)] bg-[var(--r-surface)] p-1.5 text-[var(--r-ink)] shadow-[0_16px_40px_-16px_rgba(0,0,0,0.4)]"
      style={{
        left,
        top: above ? target.top - MARGIN : target.bottom + MARGIN,
        translate: above ? '-50% -100%' : '-50% 0',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {editing ? (
        <form
          className="grid w-[min(20rem,calc(100vw-2rem))] gap-2 p-1"
          onSubmit={(e) => {
            e.preventDefault()
            onNote(draft.trim())
          }}
        >
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onNote(draft.trim())
            }}
            rows={3}
            maxLength={2000}
            placeholder="寫下想法…"
            className="w-full resize-none rounded-lg border border-[var(--r-line)] bg-transparent p-2.5 text-sm leading-relaxed outline-none focus:border-[var(--r-accent)]"
          />
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => setEditing(false)} className="h-8 rounded-lg px-3 text-[13px] text-[var(--r-muted)] hover:bg-[var(--r-sunken)]">
              取消
            </button>
            <button type="submit" className="h-8 rounded-lg bg-[var(--r-ink)] px-3 text-[13px] font-medium text-[var(--r-surface)] active:scale-[0.98]">
              儲存筆記
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-0.5">
          {HIGHLIGHT_COLORS.map((c) => {
            const active = existing?.color === c.value
            return (
              <button
                key={c.value}
                type="button"
                aria-label={`${c.label}色劃線`}
                aria-pressed={active}
                onClick={() => onColor(c.value)}
                className="grid size-9 place-items-center rounded-lg hover:bg-[var(--r-sunken)]"
              >
                <span
                  className="grid size-[18px] place-items-center rounded-full ring-1 ring-black/10 transition-transform duration-150 hover:scale-110"
                  style={{ background: c.hex }}
                >
                  {active && <Check size={11} weight="bold" className="text-black/70" />}
                </span>
              </button>
            )
          })}
          <span className="mx-1 h-5 w-px bg-[var(--r-line)]" aria-hidden />
          <ToolButton label={existing?.note ? '編輯筆記' : '加筆記'} onClick={() => setEditing(true)}>
            <NotePencil size={17} weight={existing?.note ? 'fill' : 'regular'} />
          </ToolButton>
          {onListen && (
            <ToolButton label="從這裡朗讀" onClick={onListen}>
              <SpeakerHigh size={17} />
            </ToolButton>
          )}
          <ToolButton label="複製" onClick={onCopy}>
            <Copy size={17} />
          </ToolButton>
          {onDelete && (
            <ToolButton label="刪除劃線" onClick={onDelete}>
              <Trash size={17} />
            </ToolButton>
          )}
        </div>
      )}
    </div>
  )
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-lg text-[var(--r-muted)] transition-colors hover:bg-[var(--r-sunken)] hover:text-[var(--r-ink)] active:scale-95"
    >
      {children}
    </button>
  )
}
