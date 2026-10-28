// Our own editor blocks as BlockNote's standard ones, for Markdown and HTML:
// page links → links with their titles, callouts → quotes, columns → one after
// another, bookmarks and embeds → links. Used by the page export (browser) and
// the MCP endpoint (server), so it takes the site's origin for absolute links.

import { parseNoteIcon } from './noteIcons'
import { UNTITLED } from './notes'

export type LooseBlock = { id?: string; type?: string; props?: Record<string, unknown>; content?: unknown; children?: unknown[] }

export type LinkedPage = { title: string; notebookId: number }

const DEFAULT_TYPES = new Set([
  'paragraph',
  'heading',
  'quote',
  'codeBlock',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
  'toggleListItem',
  'table',
  'image',
  'video',
  'audio',
  'file',
  'divider',
])

const text = (value: string) => ({ type: 'text', text: value, styles: {} })
const link = (href: string, label: string) => ({ type: 'link', href, content: [text(label)] })

/** Page and board ids that page-link and board blocks point at (their titles are needed). */
export function linkedPageIds(blocks: LooseBlock[], out = new Set<number>()): Set<number> {
  for (const b of blocks) {
    if (b.type === 'pageLink') out.add(Number(b.props?.pageId))
    if (b.type === 'board') out.add(Number(b.props?.boardId))
    if (Array.isArray(b.children)) linkedPageIds(b.children as LooseBlock[], out)
  }
  for (const id of out) if (!(id > 0)) out.delete(id)
  return out
}

export function toStandardBlocks(blocks: LooseBlock[], titles: Map<number, LinkedPage>, origin: string): LooseBlock[] {
  const absolute = (url: string) => (url.startsWith('/') ? `${origin}${url}` : url)
  const out: LooseBlock[] = []
  for (const b of blocks) {
    const children = Array.isArray(b.children) ? toStandardBlocks(b.children as LooseBlock[], titles, origin) : []
    const pageLink = (id: number, prefix = '') => {
      const info = titles.get(id)
      return { type: 'paragraph', content: [text(prefix), info ? link(absolute(`/notebooks/${info.notebookId}/${id}`), info.title || UNTITLED) : text('（找不到的頁面）')] }
    }
    switch (b.type) {
      case 'columnList':
      case 'column':
        out.push(...children)
        continue
      case 'toc':
        continue
      case 'pageLink':
        out.push(pageLink(Number(b.props?.pageId)))
        continue
      case 'board':
        out.push(pageLink(Number(b.props?.boardId), '看板：'))
        continue
      case 'callout': {
        const icon = parseNoteIcon(String(b.props?.emoji ?? ''))
        const lead = icon?.kind === 'emoji' ? `${icon.emoji} ` : ''
        out.push({ type: 'quote', content: [text(lead), ...(Array.isArray(b.content) ? b.content : [])], children })
        continue
      }
      case 'codeBlock':
        out.push({ ...b, props: { language: b.props?.language ?? 'text' }, children })
        if (b.props?.caption) out.push({ type: 'paragraph', content: [{ ...text(String(b.props.caption)), styles: { italic: true } }] })
        continue
    }
    if (DEFAULT_TYPES.has(String(b.type))) {
      const props = { ...b.props }
      if (typeof props.url === 'string') props.url = absolute(props.url)
      out.push({ ...b, props, children })
      continue
    }
    // Anything else with an address (bookmarks, embeds) becomes a link.
    const url = typeof b.props?.url === 'string' ? absolute(b.props.url) : ''
    if (url) out.push({ type: 'paragraph', content: [link(url, String(b.props?.title || url))] }, ...children)
    else out.push(...children)
  }
  return out
}
