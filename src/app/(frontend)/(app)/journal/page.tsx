import type { Metadata } from 'next'
import Link from 'next/link'
import { JournalCover } from '@/components/books/BookCover'
import { BookLink } from '@/components/books/BookOpener'
import { NotebookShelf } from '@/components/notebooks/NotebookShelf'
import { logicalDay } from '@/lib/day'
import { getNotebooks } from '@/lib/notebookQueries'
import { countLoggedDays, getJournals } from '@/lib/queries'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: '書架' }
export const dynamic = 'force-dynamic'

export default async function BookshelfPage() {
  const session = await requireSession('/journal')
  const today = logicalDay()
  const [journals, notebooks] = await Promise.all([getJournals(session, Number(today.slice(0, 4))), getNotebooks(session)])
  const counts = await Promise.all(journals.map((j) => countLoggedDays(session, j.year)))

  return (
    <>
      <header className="mb-8 md:mb-12">
        <p className="font-mono text-xs text-muted">日記本每年一本，筆記本自己新增</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-strong md:text-4xl">書架</h1>
      </header>

      <section aria-labelledby="journals-heading">
        <h2 id="journals-heading" className="mb-8 text-xl font-semibold tracking-tight text-ink-strong">
          日記本
        </h2>
        <ul className="grid grid-cols-2 items-end gap-x-6 gap-y-14 sm:grid-cols-3 md:grid-cols-4 md:gap-x-10">
          {journals.map((j, i) => (
            <li key={j.id} className="rise" style={{ '--i': i } as React.CSSProperties}>
              <BookLink href={`/journal/${j.year}`} label={`打開 ${j.title}`}>
                <JournalCover
                  year={j.year}
                  title={j.title}
                  subtitle={j.subtitle}
                  coverColor={j.coverColor}
                  pattern={j.pattern}
                  loggedDays={counts[i]}
                />
              </BookLink>
              <div className="mt-4 h-2 rounded-sm bg-line-strong shadow-[0_6px_10px_-6px_rgba(17,17,17,0.35)]" aria-hidden />
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-muted">
          每年第一次打開時會自動放上新的一本。書名、副標、封面顏色和花紋可以在
          <Link href="/admin/collections/journals" className="text-accent hover:underline">
            後台
          </Link>
          修改。
        </p>
      </section>

      <NotebookShelf notebooks={notebooks} offset={journals.length} />
    </>
  )
}
