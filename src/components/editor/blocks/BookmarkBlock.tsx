'use client'

import { createReactBlockSpec } from '@blocknote/react'
import { ArrowClockwise, BookmarkSimple, Globe } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { getLinkPreview } from '@/app/(frontend)/link-actions'
import type { LinkMeta } from '@/lib/linkMeta'
import { UrlPrompt } from './UrlPrompt'

// One request per address even when the same link is on screen twice.
const inFlight = new Map<string, Promise<LinkMeta | string>>()
function preview(url: string): Promise<LinkMeta | string> {
  let request = inFlight.get(url)
  if (!request) {
    request = getLinkPreview(url).then((r) => (r.ok && r.data ? r.data : r.ok ? '讀不到這個網頁' : r.error))
    inFlight.set(url, request)
    void request.finally(() => setTimeout(() => inFlight.delete(url), 30_000))
  }
  return request
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Notion's web bookmark: a card with the page's title, description, picture
 * and icon. The details are read once (server-side) and kept in the block, so
 * the card shows instantly afterwards and survives the site changing or vanishing.
 */
export const BookmarkBlock = createReactBlockSpec(
  {
    type: 'bookmark',
    propSchema: {
      url: { default: '' },
      title: { default: '' },
      description: { default: '' },
      image: { default: '' },
      siteName: { default: '' },
      icon: { default: '' },
    },
    content: 'none',
  },
  {
    render: function BookmarkView({ block, editor }) {
      const { url, title } = block.props
      const [error, setError] = useState<string | null>(null)
      const [attempt, setAttempt] = useState(0)

      useEffect(() => {
        if (!url || title || !editor.isEditable) return
        let alive = true
        void preview(url).then((result) => {
          if (!alive) return
          if (typeof result === 'string') {
            setError(result)
            return
          }
          editor.updateBlock(block, {
            props: { title: result.title, description: result.description, image: result.image, siteName: result.siteName, icon: result.icon },
          })
        })
        return () => {
          alive = false
        }
        // The block object changes on every edit; the address and attempt are what matter.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [url, title, attempt])

      if (!url) {
        if (!editor.isEditable) return <div className="note-pagelink text-muted">（空的書籤）</div>
        return (
          <UrlPrompt
            icon={BookmarkSimple}
            placeholder="貼上網址，建立網頁書籤"
            action="建立書籤"
            onSubmit={(next) => editor.updateBlock(block, { props: { url: next } })}
            onCancel={() => editor.removeBlocks([block])}
          />
        )
      }
      return (
        <BookmarkCard
          {...block.props}
          loading={!title && !error && editor.isEditable}
          error={error}
          onRetry={() => {
            setError(null)
            setAttempt((n) => n + 1)
          }}
        />
      )
    },
    toExternalHTML: function BookmarkHTML({ block }) {
      return (
        <p>
          <a href={block.props.url}>{block.props.title || block.props.url}</a>
        </p>
      )
    },
  },
)

function BookmarkCard({
  url,
  title,
  description,
  image,
  siteName,
  icon,
  loading,
  error,
  onRetry,
}: {
  url: string
  title: string
  description: string
  image: string
  siteName: string
  icon: string
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  const [showImage, setShowImage] = useState(true)
  const [showIcon, setShowIcon] = useState(true)
  return (
    <div className="note-bookmark w-full" contentEditable={false}>
      <a href={url} target="_blank" rel="noopener noreferrer" className="note-bookmark-card group">
        <span className="flex min-w-0 flex-1 flex-col justify-between gap-1.5 px-4 py-3">
          {loading ? (
            <>
              <span className="h-4 w-2/3 animate-pulse rounded bg-sunken" />
              <span className="h-3 w-full animate-pulse rounded bg-sunken" />
            </>
          ) : (
            <>
              <span className="truncate text-sm font-medium text-ink-strong">{title || hostOf(url)}</span>
              {description && <span className="line-clamp-2 text-xs leading-relaxed text-muted">{description}</span>}
            </>
          )}
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
            {icon && showIcon ? (
              // eslint-disable-next-line @next/next/no-img-element -- any site's favicon
              <img src={icon} alt="" width={14} height={14} referrerPolicy="no-referrer" onError={() => setShowIcon(false)} className="size-3.5 shrink-0 rounded-sm" />
            ) : (
              <Globe size={14} className="shrink-0" />
            )}
            <span className="truncate">{siteName && siteName !== hostOf(url) ? `${siteName} · ${url}` : url}</span>
          </span>
        </span>
        {image && showImage && !loading && (
          <span className="note-bookmark-image">
            {/* eslint-disable-next-line @next/next/no-img-element -- any site's preview picture */}
            <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setShowImage(false)} className="size-full object-cover" />
          </span>
        )}
      </a>
      {error && (
        <p className="mt-1 flex items-center gap-2 text-xs text-muted">
          讀不到預覽：{error}
          <button type="button" onClick={onRetry} className="flex items-center gap-0.5 rounded px-1 text-accent hover:bg-accent-soft">
            <ArrowClockwise size={12} />
            重試
          </button>
        </p>
      )}
    </div>
  )
}
