import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ancestorsOf, applyMove, childrenOf, flattenTree, snippetAround, subtreeIds, type PageNode } from '@/lib/notes'

const node = (id: number, parent: number | null, position: number): PageNode => ({ id, parent, position, title: `p${id}`, icon: '' })

// 1
// ├─ 2
// │  └─ 4
// └─ 3
// 5
const tree = [node(1, null, 0), node(2, 1, 0), node(3, 1, 1), node(4, 2, 0), node(5, null, 1)]

describe('page tree helpers', () => {
  it('walks subtrees, ancestors and display order', () => {
    expect(subtreeIds(tree, 1).sort()).toEqual([1, 2, 3, 4])
    expect(ancestorsOf(tree, 4).map((p) => p.id)).toEqual([1, 2])
    expect(flattenTree(tree).map(({ page, depth }) => `${page.id}:${depth}`)).toEqual(['1:0', '2:1', '4:2', '3:1', '5:0'])
  })

  it('moves a page and renumbers both sibling lists', () => {
    const moved = applyMove(tree, 2, null, 1)
    expect(childrenOf(moved, null).map((p) => [p.id, p.position])).toEqual([
      [1, 0],
      [2, 1],
      [5, 2],
    ])
    expect(childrenOf(moved, 1).map((p) => [p.id, p.position])).toEqual([[3, 0]])
    // The subtree travels with it.
    expect(moved.find((p) => p.id === 4)?.parent).toBe(2)
  })

  it('reorders within the same parent', () => {
    const moved = applyMove(tree, 3, 1, 0)
    expect(childrenOf(moved, 1).map((p) => p.id)).toEqual([3, 2])
  })

  it('refuses to put a page inside itself', () => {
    expect(() => applyMove(tree, 1, 4, 0)).toThrow(/自己/)
    expect(() => applyMove(tree, 1, 1, 0)).toThrow(/自己/)
  })

  it('cuts a snippet around the first hit', () => {
    const text = `${'前言'.repeat(40)}關鍵字在這裡${'結尾'.repeat(40)}`
    const snippet = snippetAround(text, '關鍵字', 10)
    expect(snippet.startsWith('…')).toBe(true)
    expect(snippet).toContain('關鍵字在這裡')
    expect(snippetAround('short text', 'missing')).toBe('short text')
  })
})

// Runs against the database in DATABASE_URL (npm run db:local for development).
describe('notebooks and note pages', () => {
  let payload: Payload
  const notebooks: number[] = []

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    for (const id of notebooks) await payload.delete({ collection: 'notebooks', id })
  })

  const makeNotebook = async (title: string) => {
    const doc = await payload.create({ collection: 'notebooks', data: { title, coverColor: 'navy', pattern: 'marble' } })
    notebooks.push(doc.id)
    return doc.id
  }

  it('keeps a plain-text copy of the content for search', async () => {
    const notebook = await makeNotebook('test: plain text')
    const page = await payload.create({
      collection: 'note-pages',
      data: {
        notebook,
        title: 'A',
        content: [
          { type: 'heading', content: [{ type: 'text', text: '投影', styles: {} }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'EPSG:3826', styles: {} }], children: [] },
        ],
      },
    })
    expect(page.plainText).toBe('投影\nEPSG:3826')

    const { docs } = await payload.find({ collection: 'note-pages', where: { plainText: { contains: '3826' } } })
    expect(docs.map((d) => d.id)).toContain(page.id)
  })

  it('rejects a parent in another notebook, or inside the page itself', async () => {
    const a = await makeNotebook('test: parents A')
    const b = await makeNotebook('test: parents B')
    const root = await payload.create({ collection: 'note-pages', data: { notebook: a, title: 'root' } })
    const child = await payload.create({ collection: 'note-pages', data: { notebook: a, parent: root.id, title: 'child' } })
    const other = await payload.create({ collection: 'note-pages', data: { notebook: b, title: 'other' } })

    await expect(payload.create({ collection: 'note-pages', data: { notebook: a, parent: other.id, title: 'x' } })).rejects.toThrow(
      /同一本筆記本/,
    )
    await expect(payload.update({ collection: 'note-pages', id: root.id, data: { parent: child.id } })).rejects.toThrow(/自己/)
    await expect(payload.update({ collection: 'note-pages', id: root.id, data: { parent: root.id } })).rejects.toThrow(/自己/)
  })

  it('hides trashed pages until they are restored', async () => {
    const notebook = await makeNotebook('test: trash')
    const page = await payload.create({ collection: 'note-pages', data: { notebook, title: 'gone' } })
    await payload.update({ collection: 'note-pages', id: page.id, data: { deletedAt: new Date().toISOString() } })

    const live = await payload.find({ collection: 'note-pages', where: { notebook: { equals: notebook } } })
    expect(live.docs).toHaveLength(0)
    const all = await payload.find({ collection: 'note-pages', where: { notebook: { equals: notebook } }, trash: true })
    expect(all.docs).toHaveLength(1)

    await payload.update({ collection: 'note-pages', id: page.id, data: { deletedAt: null }, trash: true })
    const back = await payload.find({ collection: 'note-pages', where: { notebook: { equals: notebook } } })
    expect(back.docs.map((d) => d.id)).toEqual([page.id])
  })

  it('deletes a notebook together with its pages, trashed ones included', async () => {
    const notebook = await payload.create({ collection: 'notebooks', data: { title: 'test: delete', coverColor: 'slate', pattern: 'dots' } })
    const page = await payload.create({ collection: 'note-pages', data: { notebook: notebook.id, title: 'p' } })
    const trashed = await payload.create({ collection: 'note-pages', data: { notebook: notebook.id, title: 't', deletedAt: new Date().toISOString() } })

    await payload.delete({ collection: 'notebooks', id: notebook.id })
    const left = await payload.find({ collection: 'note-pages', where: { id: { in: [page.id, trashed.id] } }, trash: true })
    expect(left.docs).toHaveLength(0)
  })
})
