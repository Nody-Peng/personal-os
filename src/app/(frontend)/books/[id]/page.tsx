import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ReaderLoader } from '@/components/reader/ReaderLoader'
import { getBook, toSummary } from '@/lib/bookQueries'
import { bookmarksOf } from '@/lib/books'
import { getSession, requireSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

const idOf = async (params: Props['params']) => {
  const id = Number((await params).id)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = await idOf(params)
  const session = id ? await getSession() : null
  const book = session && id ? await getBook(session, id) : null
  return { title: book?.title ?? '閱讀' }
}

/** The reader: full screen, without the app's navigation. */
export default async function ReadBook({ params }: Props) {
  const id = await idOf(params)
  if (!id) notFound()
  const session = await requireSession(`/books/${id}`)
  const book = await getBook(session, id)
  if (!book) notFound()
  return <ReaderLoader book={toSummary(book)} bookmarks={bookmarksOf(book.bookmarks)} />
}
