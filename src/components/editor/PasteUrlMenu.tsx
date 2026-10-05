'use client'

import { BookmarkSimple, FrameCorners, LinkSimple } from '@phosphor-icons/react'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { isKnownEmbed, toEmbed } from '@/lib/embeds'
import type { NoteEditor } from './schema'

export type PastedUrl = { url: string; blockId: string; from: number; to: number }
export type PasteUrlMenuHandle = { open: (pasted: PastedUrl) => void }

type Choice = 'url' | 'bookmark' | 'embed'
type Loose = { id: string; type: string; content?: unknown }

function plainText(block: Loose): string {
  if (!Array.isArray(block.content)) return ''
  return block.content
    .map((c: { type?: string; text?: string; content?: { text?: string }[] }) =>
      c.type === 'link' ? (c.content ?? []).map((t) => t.text ?? '').join('') : (c.text ?? ''),
    )
    .join('')
}

/**
 * Notion's question after pasting a web address: keep it as a link, turn it
 * into a bookmark card, or embed it. The link is already in the text, so
 * ignoring the menu (typing on, clicking away, Esc) simply keeps the link.
 */
export const PasteUrlMenu = forwardRef<PasteUrlMenuHandle, { editor: NoteEditor }>(
  function PasteUrlMenu({ editor }, ref) {
    const [pasted, setPasted] = useState<(PastedUrl & { top: number; left: number }) | null>(null)
    const [active, setActive] = useState(0)
    const panel = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      open: (next) => {
        // The pasted link is already drawn: sit just under its end.
        let rect: { left: number; bottom: number }
        try {
          rect = editor.prosemirrorView.coordsAtPos(next.to)
        } catch {
          return
        }
        const width = 232
        setActive(0)
        setPasted({
          ...next,
          top: Math.min(rect.bottom + 6, window.innerHeight - 150),
          left: Math.min(Math.max(8, rect.left - 8), window.innerWidth - width - 8),
        })
      },
    }))

    const choices = useMemo<{ key: Choice; label: string; hint?: string; icon: ReactNode }[]>(
      () =>
        pasted
          ? [
              { key: 'url', label: '保留網址', icon: <LinkSimple size={16} /> },
              {
                key: 'bookmark',
                label: '網頁書籤',
                hint: '標題、摘要和縮圖',
                icon: <BookmarkSimple size={16} />,
              },
              ...(toEmbed(pasted.url)
                ? [
                    {
                      key: 'embed' as const,
                      label: isKnownEmbed(pasted.url)
                        ? `嵌入 ${toEmbed(pasted.url)!.provider}`
                        : '嵌入網頁',
                      icon: <FrameCorners size={16} />,
                    },
                  ]
                : []),
            ]
          : [],
      [pasted],
    )

    const choose = (key: Choice) => {
      const current = pasted
      setPasted(null)
      if (!current || key === 'url') return
      const block = editor.getBlock(current.blockId) as Loose | undefined
      if (!block) return
      const made = { type: key, props: { url: current.url } }
      if (block.type === 'paragraph' && plainText(block).trim() === current.url) {
        editor.replaceBlocks([block.id], [made])
      } else {
        // The link sits inside other text: take it out and put the card below.
        editor.transact((tr) => tr.delete(current.from, current.to))
        editor.insertBlocks([made], block.id, 'after')
      }
      editor.focus()
    }
    const chooseRef = useRef(choose)
    useEffect(() => {
      chooseRef.current = choose
    })

    useEffect(() => {
      if (!pasted) return
      const close = () => setPasted(null)
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          e.stopPropagation()
          setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          chooseRef.current(choices[active].key)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          close()
        } else if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
          close()
        }
      }
      const onDown = (e: MouseEvent) => {
        if (!panel.current?.contains(e.target as Node)) close()
      }
      // Capture: answer before the editor sees the arrow or Enter.
      document.addEventListener('keydown', onKey, true)
      document.addEventListener('mousedown', onDown)
      // The user scrolling away (not the editor bringing the paste into view).
      window.addEventListener('wheel', close, { passive: true })
      window.addEventListener('touchmove', close, { passive: true })
      window.addEventListener('resize', close)
      return () => {
        document.removeEventListener('keydown', onKey, true)
        document.removeEventListener('mousedown', onDown)
        window.removeEventListener('wheel', close)
        window.removeEventListener('touchmove', close)
        window.removeEventListener('resize', close)
      }
    }, [pasted, active, choices])

    if (!pasted) return null
    // In a portal: a transformed ancestor would otherwise be what `fixed` positions against.
    return createPortal(
      <div
        ref={panel}
        role="menu"
        aria-label="貼上的網址要怎麼顯示"
        data-own-escape
        className="pop-in pop-in-left fixed z-[60] w-[232px] rounded-xl border border-line bg-surface p-1 text-sm shadow-[0_16px_40px_-16px_rgba(17,17,17,0.3)]"
        style={{ top: pasted.top, left: pasted.left }}
      >
        <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.06em] text-faint">
          貼上網址
        </p>
        {choices.map((c, i) => (
          <button
            key={c.key}
            type="button"
            role="menuitem"
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(c.key)}
            className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors ${i === active ? 'bg-sunken' : ''}`}
          >
            <span className="text-muted">{c.icon}</span>
            <span className="flex min-w-0 flex-col">
              <span className="text-ink">{c.label}</span>
              {c.hint && <span className="text-xs text-faint">{c.hint}</span>}
            </span>
          </button>
        ))}
      </div>,
      document.body,
    )
  },
)
