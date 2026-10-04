import 'server-only'
import type { Notebook, NotePage } from '@/payload-types'
import { toPageNode, type NotebookItem, type PageNode } from './notes'
import type { Session } from './session'

const idOf = (value: unknown): number => (typeof value === 'number' ? value : (value as { id: number }).id)

export function toNotebookItem(doc: Notebook, pageCount = 0): NotebookItem {
  return {
    id: doc.id,
    title: doc.title,
    coverColor: doc.coverColor,
    pattern: doc.pattern,
    archived: doc.archived ?? false,
    pageCount,
  }
}

/** Every notebook (archived ones too) with its number of live pages. */
export async function getNotebooks({ payload, user }: Session): Promise<NotebookItem[]> {
  const [notebooks, pages] = await Promise.all([
    payload.find({ collection: 'notebooks', sort: ['position', 'id'], pagination: false, user, overrideAccess: false }),
    payload.find({
      collection: 'note-pages',
      select: { notebook: true },
      depth: 0,
      pagination: false,
      user,
      overrideAccess: false,
    }),
  ])
  const counts = new Map<number, number>()
  for (const p of pages.docs) counts.set(idOf(p.notebook), (counts.get(idOf(p.notebook)) ?? 0) + 1)
  return notebooks.docs.map((n) => toNotebookItem(n, counts.get(n.id) ?? 0))
}

export async function getNotebook({ payload, user }: Session, id: number): Promise<Notebook | null> {
  return payload.findByID({ collection: 'notebooks', id, user, overrideAccess: false, disableErrors: true })
}

/** The sidebar tree: every live page of a notebook, without content. */
export async function getPageTree({ payload, user }: Session, notebookId: number): Promise<PageNode[]> {
  const { docs } = await payload.find({
    collection: 'note-pages',
    where: { notebook: { equals: notebookId } },
    select: { title: true, icon: true, parent: true, position: true },
    sort: ['position', 'id'],
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })
  return docs.map(toPageNode)
}

/** A live page (null when missing or in the trash). */
export async function getPage({ payload, user }: Session, id: number): Promise<NotePage | null> {
  return payload.findByID({ collection: 'note-pages', id, depth: 0, user, overrideAccess: false, disableErrors: true })
}

/** Where opening a notebook lands: the last edited page, else the first one. */
export async function getLandingPageId({ payload, user }: Session, notebookId: number): Promise<number | null> {
  const find = (sort: string[], editedOnly: boolean) =>
    payload.find({
      collection: 'note-pages',
      where: editedOnly
        ? { and: [{ notebook: { equals: notebookId } }, { editedAt: { exists: true } }] }
        : { notebook: { equals: notebookId } },
      select: { position: true },
      sort,
      limit: 1,
      depth: 0,
      user,
      overrideAccess: false,
    })
  const edited = await find(['-editedAt', '-id'], true)
  const page = edited.docs[0] ?? (await find(['position', 'id'], false)).docs[0]
  return page?.id ?? null
}
