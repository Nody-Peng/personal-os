import 'server-only'
import type { Book } from '@/payload-types'
import type { BookSummary } from './books'
import type { Session } from './session'

export function toSummary(book: Book): BookSummary {
  return {
    id: book.id,
    title: book.title,
    author: book.author ?? null,
    language: book.language ?? null,
    coverUrl: book.coverUrl ?? null,
    url: book.url ?? '',
    filesize: book.filesize ?? null,
    cfi: book.cfi ?? null,
    progress: book.progress ?? 0,
    lastReadAt: book.lastReadAt ?? null,
    createdAt: book.createdAt,
  }
}

export async function getBooks({ payload, user }: Session): Promise<BookSummary[]> {
  const { docs } = await payload.find({
    collection: 'books',
    user,
    overrideAccess: false,
    pagination: false,
    depth: 0,
    sort: '-createdAt',
    select: { bookmarks: false },
  })
  return docs.map((b) => toSummary(b as Book))
}

export async function getBook({ payload, user }: Session, id: number): Promise<Book | null> {
  try {
    return await payload.findByID({ collection: 'books', id, user, overrideAccess: false, depth: 0 })
  } catch {
    return null
  }
}
