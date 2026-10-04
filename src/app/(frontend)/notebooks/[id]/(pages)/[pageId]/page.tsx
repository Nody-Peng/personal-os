import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { PageView } from '@/components/notebooks/PageView'
import { getPage } from '@/lib/notebookQueries'
import { UNTITLED, renderStamp } from '@/lib/notes'
import { getSession, requireSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string; pageId: string }> }

const parse = (value: string) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pageId } = await params
  const session = await getSession()
  const id = parse(pageId)
  const page = session && id ? await getPage(session, id) : null
  return { title: page ? page.title || UNTITLED : '筆記' }
}

export default async function NotePage({ params }: Props) {
  const { id: idParam, pageId: pageParam } = await params
  const notebookId = parse(idParam)
  const pageId = parse(pageParam)
  if (!notebookId || !pageId) notFound()
  const session = await requireSession(`/notebooks/${notebookId}/${pageId}`)
  const page = await getPage(session, pageId)
  const owner = page && (typeof page.notebook === 'number' ? page.notebook : page.notebook.id)
  // Trashed or moved away: fall back to the notebook's landing page.
  if (!page || owner !== notebookId) redirect(`/notebooks/${notebookId}`)

  return (
    <PageView
      key={page.id}
      page={{
        id: page.id,
        title: page.title ?? '',
        icon: page.icon ?? '',
        content: Array.isArray(page.content) ? page.content : null,
      }}
      renderedAt={renderStamp()}
    />
  )
}
