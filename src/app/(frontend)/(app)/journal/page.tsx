import type { Metadata } from 'next'
import Link from 'next/link'
import type { CoverColor } from '@/collections/Journals'
import { BookCover } from '@/components/journal/BookCover'
import { logicalDay } from '@/lib/day'
import { countLoggedDays, getJournals } from '@/lib/queries'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: '書架' }
export const dynamic = 'force-dynamic'

export default async function BookshelfPage() {
  const session = await requireSession('/journal')
  const today = logicalDay()
  const journals = await getJournals(session, Number(today.slice(0, 4)))
  const counts = await Promise.all(journals.map((j) => countLoggedDays(session, j.year)))

  return (
    <>
      <header className="mb-8 md:mb-12">
        <p className="font-mono text-xs text-muted">每一年一本</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-strong md:text-4xl">書架</h1>
      </header>

      <div className="relative">
        <ul className="grid grid-cols-2 items-end gap-x-6 gap-y-14 sm:grid-cols-3 md:grid-cols-4 md:gap-x-10">
          {journals.map((j, i) => (
            <li key={j.id} className="rise" style={{ '--i': i } as React.CSSProperties}>
              <Link href={`/journal/${j.year}`} className="book-link block outline-none" aria-label={`打開 ${j.title}`}>
                <BookCover
                  year={j.year}
                  title={j.title}
                  subtitle={j.subtitle}
                  coverColor={j.coverColor as CoverColor}
                  loggedDays={counts[i]}
                />
              </Link>
              <div className="mt-4 h-2 rounded-sm bg-line-strong shadow-[0_6px_10px_-6px_rgba(17,17,17,0.35)]" aria-hidden />
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-10 text-sm text-muted">
        每年第一次打開時會自動放上新的一本。書名、副標和封面顏色可以在
        <Link href="/admin/collections/journals" className="text-accent hover:underline">
          後台
        </Link>
        修改。
      </p>
    </>
  )
}
