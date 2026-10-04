import { notFound } from 'next/navigation'
import { NotebookShell } from '@/components/notebooks/NotebookShell'
import { getNotebook, getPageTree, toNotebookItem } from '@/lib/notebookQueries'
import { renderStamp } from '@/lib/notes'
import { requireSession } from '@/lib/session'

type Props = { params: Promise<{ id: string }>; children: React.ReactNode }

export default async function NotebookLayout({ params, children }: Props) {
  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const session = await requireSession(`/notebooks/${id}`)
  const [notebook, pages] = await Promise.all([getNotebook(session, id), getPageTree(session, id)])
  if (!notebook) notFound()

  return (
    <NotebookShell notebook={toNotebookItem(notebook, pages.length)} pages={pages} renderedAt={renderStamp()}>
      {children}
    </NotebookShell>
  )
}
