import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { JournalBook } from '@/components/journalPrint/JournalBook'
import { PagedBook } from '@/components/journalPrint/PagedBook'
import { bookCss } from '@/components/journalPrint/bookCss'
import { loadJournalBook } from '@/lib/journalBook'
import { BOOK_FONTS, bookQuery, parseBookOptions } from '@/lib/journalPrint'
import { requireSession } from '@/lib/session'

// The journal as a printable book (日記本 → 匯出 PDF). Outside the (app)
// layout: no navigation, just the pages and a print button.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: '日記本 PDF', robots: { index: false } }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function JournalPrintPage({ searchParams }: Props) {
  const options = parseBookOptions(await searchParams)
  const session = await requireSession(options ? `/print/journal?${bookQuery(options)}` : '/journal')
  if (!options) notFound()

  const data = await loadJournalBook(session, options)
  const font = BOOK_FONTS.find((f) => f.value === options.font) ?? BOOK_FONTS[0]
  const weights = font.value === 'wenkai' ? [400, 700] : [400]
  const family = font.family.replaceAll(' ', '+')
  const fontsHref = `https://fonts.googleapis.com/css2?family=${family}${font.value === 'wenkai' ? ':wght@400;700' : ''}&family=Caveat:wght@500;700&display=swap`

  return (
    <>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={fontsHref} precedence="default" />
      <PagedBook
        css={bookCss(options, data.cover.coverColor)}
        fonts={[...weights.map((w) => `${w} 16px "${font.family}"`), '500 16px "Caveat"']}
        backHref={`/journal/${options.from.slice(0, 4)}`}
      >
        <JournalBook data={data} />
      </PagedBook>
    </>
  )
}
