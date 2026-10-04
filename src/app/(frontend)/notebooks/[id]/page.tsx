import { notFound, redirect } from 'next/navigation'
import { getLandingPageId, getNotebook } from '@/lib/notebookQueries'
import { requireSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

/** Opening a notebook goes back to the page edited last (a blank one if it's empty). */
export default async function OpenNotebook({ params }: Props) {
  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const session = await requireSession(`/notebooks/${id}`)
  const notebook = await getNotebook(session, id)
  if (!notebook) notFound()

  let pageId = await getLandingPageId(session, id)
  if (pageId == null) {
    const page = await session.payload.create({
      collection: 'note-pages',
      data: { notebook: id, title: '', position: 0 },
      user: session.user,
      overrideAccess: false,
    })
    pageId = page.id
  }
  redirect(`/notebooks/${id}/${pageId}`)
}
