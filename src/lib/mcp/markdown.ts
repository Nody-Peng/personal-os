import 'server-only'
import { ServerBlockNoteEditor } from '@blocknote/server-util'
import { linkedPageIds, toStandardBlocks, type LinkedPage, type LooseBlock } from '../noteStandard'
import type { Session } from '../session'

// Editor documents as Markdown and back, for Claude (api/mcp). Reading turns
// our own blocks into standard ones first (noteStandard), like the page export.
// Writing parses Markdown with BlockNote's own converter; a line holding just
// a link to one of our pages becomes a page-link block, so backlinks see it.

let headless: ServerBlockNoteEditor | null = null
const editor = () => (headless ??= ServerBlockNoteEditor.create())

type MarkdownInput = Parameters<ServerBlockNoteEditor['blocksToMarkdownLossy']>[0]

/** A page's (or a journal note's) blocks as Markdown; page links use their current titles. */
export async function blocksToMarkdown({ payload, user }: Session, blocks: unknown, origin: string): Promise<string> {
  const doc = (Array.isArray(blocks) ? blocks : []) as LooseBlock[]
  if (!doc.length) return ''
  const ids = [...linkedPageIds(doc)]
  const titles = new Map<number, LinkedPage>()
  if (ids.length) {
    const { docs } = await payload.find({
      collection: 'note-pages',
      where: { id: { in: ids } },
      select: { title: true, notebook: true },
      depth: 0,
      pagination: false,
      user,
      overrideAccess: false,
    })
    for (const p of docs) {
      titles.set(p.id, { title: p.title ?? '', notebookId: typeof p.notebook === 'number' ? p.notebook : p.notebook.id })
    }
  }
  const markdown = await editor().blocksToMarkdownLossy(toStandardBlocks(doc, titles, origin) as MarkdownInput)
  // BlockNote marks an empty paragraph with U+FFFC.
  return markdown.replace(/￼/g, '').trim()
}

/** `/notebooks/<notebook>/<page>` on this site (absolute or not): the page id. */
export function pageIdFromUrl(href: string, origin: string): number | null {
  const path = href.startsWith(origin) ? href.slice(origin.length) : href
  const match = path.match(/^\/notebooks\/\d+\/(\d+)\/?(?:[?#].*)?$/)
  return match ? Number(match[1]) : null
}

type Inline = { type?: string; text?: string; href?: string }

/** Markdown as editor blocks. */
export async function markdownToBlocks(markdown: string, origin: string): Promise<unknown[]> {
  const text = markdown.replace(/\r\n?/g, '\n').trim()
  if (!text) return []
  const blocks = (await editor().tryParseMarkdownToBlocks(text)) as LooseBlock[]
  return blocks.map((block) => {
    if (block.type !== 'paragraph' || !Array.isArray(block.content)) return block
    const parts = (block.content as Inline[]).filter((c) => !(c.type === 'text' && !c.text?.trim()))
    const only = parts.length === 1 && parts[0].type === 'link' ? parts[0] : null
    const pageId = only?.href ? pageIdFromUrl(only.href, origin) : null
    return pageId ? { id: block.id, type: 'pageLink', props: { pageId, mode: 'link' }, children: [] } : block
  })
}
