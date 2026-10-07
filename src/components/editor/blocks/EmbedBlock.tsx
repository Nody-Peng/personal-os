'use client'

import { createReactBlockSpec } from '@blocknote/react'
import { ArrowSquareOut, BookmarkSimple, FrameCorners } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { getFramePolicy } from '@/app/(frontend)/link-actions'
import { isKnownEmbed, toEmbed } from '@/lib/embeds'
import type { NoteEditor } from '../schema'
import { UrlPrompt } from './UrlPrompt'

const MIN_HEIGHT = 120
const MAX_HEIGHT = 1200

// Most sites refuse to be framed and the browser then draws an empty box, so
// any page that isn't a known service is asked first (once per address).
const framePolicies = new Map<string, Promise<boolean | null>>()
function framePolicy(url: string): Promise<boolean | null> {
  let request = framePolicies.get(url)
  if (!request) {
    request = getFramePolicy(url).then((r) => (r.ok ? (r.data ?? null) : null))
    framePolicies.set(url, request)
  }
  return request
}

/**
 * Notion's embed: a YouTube video, a Google map or doc, a Figma file… in a
 * frame. `height` 0 = the service's default size; drag the bottom edge to change it.
 */
export const EmbedBlock = createReactBlockSpec(
  { type: 'embed', propSchema: { url: { default: '' }, height: { default: 0 } }, content: 'none' },
  {
    render: function EmbedView({ block, editor }) {
      const { url, height } = block.props
      if (!url) {
        if (!editor.isEditable) return <div className="note-pagelink text-muted">（空的嵌入）</div>
        return (
          <UrlPrompt
            icon={FrameCorners}
            placeholder="貼上 YouTube、Google 地圖、Google 文件、Figma… 的網址"
            action="嵌入"
            hint="其他網站也能試試看，有些網站不允許被嵌入。"
            onSubmit={(next) => editor.updateBlock(block, { props: { url: next } })}
            onCancel={() => editor.removeBlocks([block])}
          />
        )
      }
      return (
        <EmbedFrame
          url={url}
          height={height}
          editable={editor.isEditable}
          onResize={(h) => editor.updateBlock(block, { props: { height: h } })}
          // A sibling block type: this block's own editor type only knows `embed`.
          onBookmark={() => (editor as unknown as NoteEditor).updateBlock(block.id, { type: 'bookmark', props: { url } })}
        />
      )
    },
    toExternalHTML: function EmbedHTML({ block }) {
      return (
        <p>
          <a href={block.props.url}>{block.props.url}</a>
        </p>
      )
    },
  },
)

function EmbedFrame({
  url,
  height,
  editable,
  onResize,
  onBookmark,
}: {
  url: string
  height: number
  editable: boolean
  onResize: (height: number) => void
  onBookmark: () => void
}) {
  const embed = toEmbed(url)
  const known = isKnownEmbed(url)
  const box = useRef<HTMLDivElement>(null)
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  // undefined while asking; null when the site won't say (then try the frame anyway).
  const [allowed, setAllowed] = useState<boolean | null | undefined>(known ? true : undefined)
  useEffect(() => {
    if (known) return
    let alive = true
    void framePolicy(url).then((policy) => alive && setAllowed(policy))
    return () => {
      alive = false
    }
  }, [url, known])
  if (!embed) return <div className="note-pagelink text-muted">這個網址不能嵌入</div>

  const fixed = dragHeight ?? (height || null)
  const style = fixed ? { height: fixed } : embed.ratio ? { aspectRatio: `${1 / embed.ratio}` } : { height: embed.height }

  if (allowed === undefined) {
    return <div className="note-embed h-24 w-full animate-pulse rounded-lg border border-line bg-sunken" contentEditable={false} />
  }
  if (allowed === false) {
    return (
      <div className="note-embed flex w-full flex-col items-start gap-2 rounded-lg border border-line px-4 py-3 text-sm" contentEditable={false}>
        <span className="text-ink">{embed.provider} 不允許被嵌入到其他網頁</span>
        <span className="flex flex-wrap gap-1">
          {editable && (
            <button type="button" onClick={onBookmark} className="flex items-center gap-1 rounded-md px-2 py-1 text-accent transition-colors hover:bg-accent-soft">
              <BookmarkSimple size={14} />
              改成網頁書籤
            </button>
          )}
          <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-md px-2 py-1 text-muted transition-colors hover:bg-sunken hover:text-ink-strong">
            開啟原網頁
            <ArrowSquareOut size={14} />
          </a>
        </span>
      </div>
    )
  }

  return (
    <figure className="note-embed w-full" contentEditable={false}>
      <div ref={box} className="relative overflow-hidden rounded-lg border border-line bg-sunken" style={style}>
        <iframe
          src={embed.src}
          title={embed.provider}
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation allow-forms"
          className="absolute inset-0 size-full border-0"
        />
        {/* While resizing, the frame must not swallow the pointer. */}
        {dragHeight != null && <div className="absolute inset-0 cursor-ns-resize" />}
      </div>
      {editable && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="拖曳調整高度"
          title="拖曳調整高度"
          className="note-embed-handle"
          onPointerDown={(e) => {
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            setDragHeight(box.current?.getBoundingClientRect().height ?? embed.height)
          }}
          onPointerMove={(e) => {
            if (dragHeight == null || !box.current) return
            const top = box.current.getBoundingClientRect().top
            setDragHeight(Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, e.clientY - top))))
          }}
          onPointerUp={() => {
            if (dragHeight != null) onResize(dragHeight)
            setDragHeight(null)
          }}
        />
      )}
      <figcaption className="mt-1 flex items-center gap-1 text-xs text-faint">
        {embed.provider}
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 rounded px-1 hover:bg-sunken hover:text-ink-strong">
          開啟原網頁
          <ArrowSquareOut size={12} />
        </a>
      </figcaption>
    </figure>
  )
}
