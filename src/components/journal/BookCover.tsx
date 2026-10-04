import type { CoverColor } from '@/collections/Journals'

const COVERS: Record<CoverColor, string> = {
  navy: '#1d2840',
  forest: '#1f3a30',
  burgundy: '#4b1d26',
  charcoal: '#2a2a2d',
}

type Props = {
  year: number
  title: string
  subtitle?: string | null
  coverColor: CoverColor
  loggedDays?: number
  size?: 'lg' | 'sm'
}

/** A cloth-bound hardcover with gold-foil lettering. */
export function BookCover({ year, title, subtitle, coverColor, loggedDays, size = 'lg' }: Props) {
  const small = size === 'sm'
  return (
    <div
      className="book-cover relative aspect-[3/4] w-full overflow-hidden rounded-r-md rounded-l-[3px]"
      style={{ '--cover': COVERS[coverColor] ?? COVERS.navy } as React.CSSProperties}
    >
      <div className="book-spine absolute inset-y-0 left-0 w-[7%]" aria-hidden />
      <div className="absolute inset-y-0 left-[7%] w-px bg-black/30" aria-hidden />
      <div
        className={`book-foil absolute flex flex-col items-center justify-between border border-[color:var(--gold)]/40 text-center ${
          small ? 'inset-y-2 right-2 left-[calc(7%+6px)] py-3' : 'inset-y-4 right-4 left-[calc(7%+12px)] py-6 md:py-8'
        }`}
      >
        <span className={`font-mono tracking-[0.3em] opacity-80 ${small ? 'invisible text-[6px]' : 'text-[10px] md:text-xs'}`}>PERSONAL OS</span>
        <span className="flex flex-col items-center">
          <span className={`font-semibold tracking-[0.12em] ${small ? 'text-sm tracking-[0.05em]' : 'text-4xl md:text-5xl'}`}>{year}</span>
          <span className={`my-2 h-px bg-[color:var(--gold)]/60 ${small ? 'w-8' : 'w-16'}`} aria-hidden />
          <span className={`tracking-[0.5em] ${small ? 'text-[10px]' : 'text-sm md:text-base'}`}>
            {title.replace(String(year), '').trim() || '日記本'}
          </span>
          {subtitle && !small && <span className="mt-2 text-xs opacity-80">{subtitle}</span>}
        </span>
        <span className={`tabular-nums opacity-80 ${small ? 'text-[8px]' : 'text-[11px] md:text-xs'}`}>
          {loggedDays !== undefined ? `${loggedDays} 天紀錄` : ' '}
        </span>
      </div>
    </div>
  )
}
