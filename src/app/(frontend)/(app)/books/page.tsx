import type { Metadata } from 'next'
import { Library } from '@/components/reader/Library'
import { getBooks } from '@/lib/bookQueries'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: '閱讀' }
export const dynamic = 'force-dynamic'

export default async function BooksPage() {
  const session = await requireSession('/books')
  const books = await getBooks(session)
  return <Library books={books} />
}
