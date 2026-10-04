'use client'

import { createReactBlockSpec, useEditorChange } from '@blocknote/react'
import { useState } from 'react'

type Heading = { id: string; level: number; text: string }

type LooseBlock = { id: string; type: string; props?: { level?: number }; content?: unknown; children?: LooseBlock[] }

const textOf = (content: unknown) =>
  Array.isArray(content)
    ? content.map((c) => (c && typeof c === 'object' && 'text' in c ? String((c as { text: unknown }).text) : '')).join('')
    : ''

/** H1–H3 anywhere in the document (inside toggles and columns too), in order. */
function headingsOf(blocks: LooseBlock[]): Heading[] {
  const out: Heading[] = []
  const walk = (list: LooseBlock[]) => {
    for (const b of list) {
      if (b.type === 'heading' && (b.props?.level ?? 1) <= 3) {
        const text = textOf(b.content).trim()
        if (text) out.push({ id: b.id, level: b.props?.level ?? 1, text })
      }
      if (b.children?.length) walk(b.children)
    }
  }
  walk(blocks)
  return out
}

export function scrollToBlock(id: string) {
  const el = document.querySelector<HTMLElement>(`.bn-block-outer[data-id="${CSS.escape(id)}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  el.classList.remove('note-flash')
  void el.offsetWidth
  el.classList.add('note-flash')
}

/** A live table of contents: click a heading to jump to it. */
export const TableOfContents = createReactBlockSpec(
  { type: 'toc', propSchema: {}, content: 'none' },
  {
    render: function TocView({ editor }) {
      const [headings, setHeadings] = useState(() => headingsOf(editor.document as unknown as LooseBlock[]))
      useEditorChange(() => setHeadings(headingsOf(editor.document as unknown as LooseBlock[])), editor)
      const top = Math.min(...headings.map((h) => h.level), 3)
      return (
        <nav aria-label="目錄" className="note-toc" contentEditable={false}>
          {headings.length === 0 ? (
            <p className="text-sm text-faint">加入標題（H1–H3）後，目錄會出現在這裡</p>
          ) : (
            <ul>
              {headings.map((h) => (
                <li key={h.id} style={{ paddingLeft: (h.level - top) * 16 }}>
                  <button type="button" onClick={() => scrollToBlock(h.id)} className="note-toc-link">
                    {h.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>
      )
    },
  },
)
