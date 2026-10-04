import type { ReactNode } from 'react'
import { COVER_COLORS } from '@/lib/options'

const hexOf = (color: string) => (COVER_COLORS.find((c) => c.value === color) ?? COVER_COLORS[0]).hex

type ShellProps = {
  coverColor: string
  pattern?: string | null
  size?: 'lg' | 'sm'
  top?: ReactNode
  bottom?: ReactNode
  children: ReactNode
}

/** A cloth-bound hardcover with a CSS pattern and a gold-foil frame. */
export function BookCover({ coverColor, pattern, size = 'lg', top, bottom, children }: ShellProps) {
  const small = size === 'sm'
  return (
    <div
      className="book-cover cover-cloth relative aspect-[3/4] w-full overflow-hidden rounded-r-md rounded-l-[3px]"
      data-pattern={pattern ?? 'cloth'}
      style={{ '--cover': hexOf(coverColor) } as React.CSSProperties}
    >
      <div className="book-spine absolute inset-y-0 left-0 w-[7%]" aria-hidden />
      <div className="absolute inset-y-0 left-[7%] w-px bg-black/30" aria-hidden />
      <div
        className={`book-foil absolute flex flex-col items-center justify-between border border-[color:var(--gold)]/40 text-center ${
          small ? 'inset-y-2 right-2 left-[calc(7%+6px)] py-3' : 'inset-y-4 right-4 left-[calc(7%+12px)] py-6 md:py-8'
        }`}
      >
        <span className={`font-mono tracking-[0.3em] opacity-80 ${small ? 'invisible text-[6px]' : 'text-[10px] md:text-xs'}`}>
          {top ?? 'PERSONAL OS'}
        </span>
        <span className="flex w-full flex-col items-center">{children}</span>
        <span className={`tabular-nums opacity-80 ${small ? 'text-[8px]' : 'text-[11px] md:text-xs'}`}>{bottom ?? ' '}</span>
      </div>
    </div>
  )
}

type JournalProps = {
  year: number
  title: string
  subtitle?: string | null
  coverColor: string
  pattern?: string | null
  loggedDays?: number
  size?: 'lg' | 'sm'
}

/** The yearly journal: the year in large type. */
export function JournalCover({ year, title, subtitle, coverColor, pattern, loggedDays, size = 'lg' }: JournalProps) {
  const small = size === 'sm'
  return (
    <BookCover
      coverColor={coverColor}
      pattern={pattern}
      size={size}
      bottom={loggedDays !== undefined ? `${loggedDays} 天紀錄` : undefined}
    >
      <span className={`font-semibold tracking-[0.12em] ${small ? 'text-sm tracking-[0.05em]' : 'text-4xl md:text-5xl'}`}>{year}</span>
      <span className={`my-2 h-px bg-[color:var(--gold)]/60 ${small ? 'w-8' : 'w-16'}`} aria-hidden />
      <span className={`tracking-[0.5em] ${small ? 'text-[10px]' : 'text-sm md:text-base'}`}>
        {title.replace(String(year), '').trim() || '日記本'}
      </span>
      {subtitle && !small && <span className="mt-2 text-xs opacity-80">{subtitle}</span>}
    </BookCover>
  )
}

type NotebookProps = {
  title: string
  coverColor: string
  pattern?: string | null
  pageCount?: number
  size?: 'lg' | 'sm'
}

/** A notebook: its name set like a book title. */
export function NotebookCover({ title, coverColor, pattern, pageCount, size = 'lg' }: NotebookProps) {
  const small = size === 'sm'
  return (
    <BookCover
      coverColor={coverColor}
      pattern={pattern}
      size={size}
      top="NOTEBOOK"
      bottom={pageCount !== undefined && !small ? `${pageCount} 頁` : undefined}
    >
      {/* Thumbnails are too small for type: just the foil rule. */}
      {!small && (
        <span className="line-clamp-3 px-2 text-lg leading-snug font-semibold tracking-[0.08em] break-words text-balance md:text-xl">{title}</span>
      )}
      <span className={`h-px bg-[color:var(--gold)]/60 ${small ? 'w-1/2' : 'mt-3 w-12'}`} aria-hidden />
    </BookCover>
  )
}
