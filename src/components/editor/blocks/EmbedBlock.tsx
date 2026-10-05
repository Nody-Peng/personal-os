'use client'

import { createReactBlockSpec } from '@blocknote/react'
import { ArrowSquareOut, FrameCorners } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { toEmbed } from '@/lib/embeds'
import { UrlPrompt } from './UrlPrompt'

const MIN_HEIGHT = 120
const MAX_HEIGHT = 1200

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
      return <EmbedFrame url={url} height={height} editable={editor.isEditable} onResize={(h) => editor.updateBlock(block, { props: { height: h } })} />
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

function EmbedFrame({ url, height, editable, onResize }: { url: string; height: number; editable: boolean; onResize: (height: number) => void }) {
  const embed = toEmbed(url)
  const box = useRef<HTMLDivElement>(null)
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  if (!embed) return <div className="note-pagelink text-muted">這個網址不能嵌入</div>

  const fixed = dragHeight ?? (height || null)
  const style = fixed ? { height: fixed } : embed.ratio ? { aspectRatio: `${1 / embed.ratio}` } : { height: embed.height }

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
