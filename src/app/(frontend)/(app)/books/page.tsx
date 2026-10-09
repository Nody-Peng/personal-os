import type { Metadata } from 'next'
import { Library } from '@/components/reader/Library'
import { getBooks, getShelves } from '@/lib/bookQueries'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: '閱讀' }
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ shelf?: string }> }

export default async function BooksPage({ searchParams }: Props) {
  const session = await requireSession('/books')
  const [books, shelves, { shelf }] = await Promise.all([getBooks(session), getShelves(session), searchParams])
  const shelfId = Number(shelf)
  return <Library books={books} shelves={shelves} initialShelf={Number.isInteger(shelfId) && shelfId > 0 ? shelfId : null} />
}
