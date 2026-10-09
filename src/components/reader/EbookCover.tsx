'use client'

import { useState } from 'react'
import { COVER_COLORS, COVER_PATTERNS } from '@/lib/options'

/** Stable pick from a list by the book's title, for books without a cover image. */
function pick<T>(list: readonly T[], seed: string, salt: number): T {
  let h = salt
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return list[h % list.length]
}

type Props = { title: string; author: string | null; coverUrl: string | null; size?: 'lg' | 'sm' }

/**
 * An e-book on the shelf: its own cover image with a printed-spine shade, or a
 * cloth cover in the bookshelf's style when the EPUB has none. `.book-cover`
 * gives it the shelf's hover tilt and the open-the-book animation.
 */
export function EbookCover({ title, author, coverUrl, size = 'sm' }: Props) {
  const [failed, setFailed] = useState(false)
  const small = size === 'sm'

  if (coverUrl && !failed) {
    return (
      <div className="book-cover ebook-cover relative aspect-[2/3] w-full overflow-hidden rounded-r-[5px] rounded-l-[2px] bg-sunken">
        {/* Shimmer underneath until the picture paints over it (no onLoad state: a cached image can load before hydration). */}
        <span className="reader-skeleton absolute inset-0" aria-hidden />
        {/* Plain <img>: the file sits behind the login, which Next's image optimiser doesn't have. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverUrl}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span className="ebook-spine absolute inset-y-0 left-0 w-[9%]" aria-hidden />
      </div>
    )
  }

  const color = pick(COVER_COLORS, title, 7).value
  const pattern = pick(COVER_PATTERNS, title, 13).value
  const hex = COVER_COLORS.find((c) => c.value === color)!.hex
  return (
    <div
      className="book-cover cover-cloth relative aspect-[2/3] w-full overflow-hidden rounded-r-[5px] rounded-l-[2px]"
      data-pattern={pattern}
      style={{ '--cover': hex } as React.CSSProperties}
    >
      <div className="book-spine absolute inset-y-0 left-0 w-[7%]" aria-hidden />
      <div
        className={`book-foil absolute flex flex-col items-center justify-center gap-2 border border-[color:var(--gold)]/40 text-center ${
          small ? 'inset-y-2 right-2 left-[calc(7%+6px)] px-1.5' : 'inset-y-4 right-4 left-[calc(7%+12px)] px-4'
        }`}
      >
        <span className={`line-clamp-4 font-serif leading-snug ${small ? 'text-[11px] sm:text-[13px]' : 'text-xl'}`}>{title}</span>
        {author && <span className={`line-clamp-1 opacity-75 ${small ? 'text-[8px] sm:text-[9px]' : 'text-xs'}`}>{author}</span>}
      </div>
    </div>
  )
}
