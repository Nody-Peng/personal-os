import { notFound } from 'next/navigation'
import { NotebookShell } from '@/components/notebooks/NotebookShell'
import { getNotebook, getPageTree, toNotebookItem } from '@/lib/notebookQueries'
import { renderStamp } from '@/lib/notes'
import { getSession } from '@/lib/session'

type Props = { params: Promise<{ id: string }>; children: React.ReactNode }

export default async function NotebookLayout({ params, children }: Props) {
  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) notFound()
  // Signed out: the page sends the visitor to log in and back to that exact page
  // (this layout only knows the notebook).
  const session = await getSession()
  if (!session) return children
  const [notebook, pages] = await Promise.all([getNotebook(session, id), getPageTree(session, id)])
  if (!notebook) notFound()

  return (
    <NotebookShell notebook={toNotebookItem(notebook, pages.length)} pages={pages} renderedAt={renderStamp()}>
      {children}
    </NotebookShell>
  )
}
