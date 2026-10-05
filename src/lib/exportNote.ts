'use client'

// Page export (••• → 匯出): Markdown or a standalone HTML file. Our own blocks
// become standard ones first (page links → links with their titles, callouts →
// quotes, columns → one after another, bookmarks and embeds → links), then
// BlockNote's converters run on a headless editor with the default schema.

import { BlockNoteEditor } from '@blocknote/core'
import { getPageLinks } from '@/app/(frontend)/notebook-actions'
import { parseNoteIcon } from './noteIcons'
import { UNTITLED } from './notes'

type Loose = { id?: string; type?: string; props?: Record<string, unknown>; content?: unknown; children?: unknown[] }

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
const absolute = (url: string) => (url.startsWith('/') ? `${window.location.origin}${url}` : url)

function collectIds(blocks: Loose[], out = new Set<number>()): Set<number> {
  for (const b of blocks) {
    if (b.type === 'pageLink') out.add(Number(b.props?.pageId))
    if (b.type === 'board') out.add(Number(b.props?.boardId))
    if (Array.isArray(b.children)) collectIds(b.children as Loose[], out)
  }
  return out
}

function toStandard(blocks: Loose[], titles: Map<number, { title: string; notebookId: number }>): Loose[] {
  const out: Loose[] = []
  for (const b of blocks) {
    const children = Array.isArray(b.children) ? toStandard(b.children as Loose[], titles) : []
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

let headless: BlockNoteEditor | null = null
const editor = () => (headless ??= BlockNoteEditor.create())

function download(filename: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const safeName = (title: string) => (title.trim() || UNTITLED).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)

const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export async function exportPage(format: 'markdown' | 'html', title: string, blocks: unknown[] | null): Promise<void> {
  const doc = (Array.isArray(blocks) ? blocks : []) as Loose[]
  const ids = [...collectIds(doc)].filter((n) => n > 0)
  const titles = new Map<number, { title: string; notebookId: number }>()
  if (ids.length) {
    const result = await getPageLinks(ids)
    if (result.ok) for (const p of result.data ?? []) titles.set(p.id, p)
  }
  const standard = toStandard(doc, titles) as Parameters<BlockNoteEditor['blocksToMarkdownLossy']>[0]
  const heading = title.trim() || UNTITLED

  if (format === 'markdown') {
    const body = await editor().blocksToMarkdownLossy(standard)
    download(`${safeName(title)}.md`, `# ${heading}\n\n${body}`, 'text/markdown;charset=utf-8')
    return
  }
  const body = await editor().blocksToHTMLLossy(standard)
  const html = `<!doctype html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(heading)}</title>
<style>
  body { max-width: 720px; margin: 48px auto; padding: 0 20px; font: 17px/1.7 system-ui, -apple-system, 'PingFang TC', 'Microsoft JhengHei', sans-serif; color: #2f3437; }
  h1, h2, h3, h4 { color: #111; line-height: 1.3; }
  pre { background: #f7f6f3; border: 1px solid #eaeaea; border-radius: 8px; padding: 14px 16px; overflow-x: auto; }
  code { font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-size: 0.9em; }
  blockquote { margin: 0; padding: 4px 16px; border-left: 3px solid #dcdbd6; color: #555; }
  table { border-collapse: collapse; } td, th { border: 1px solid #eaeaea; padding: 6px 10px; }
  img, video { max-width: 100%; border-radius: 8px; }
  a { color: #2563a6; }
</style>
</head>
<body>
<h1>${escapeHtml(heading)}</h1>
${body}
</body>
</html>
`
  download(`${safeName(title)}.html`, html, 'text/html;charset=utf-8')
}

/** Import (sidebar → 匯入): Markdown or HTML text as editor blocks. */
export async function parseImport(file: File): Promise<{ title: string; blocks: unknown[] }> {
  const raw = await file.text()
  const isHtml = /\.html?$/i.test(file.name) || file.type === 'text/html'
  let source = raw
  let title = file.name.replace(/\.[^.]+$/, '')
  // A leading "# Title" becomes the page title, as Notion does.
  if (!isHtml) {
    const match = raw.match(/^\s*#\s+(.+)\s*\n/)
    if (match) {
      title = match[1].trim()
      source = raw.slice(match[0].length)
    }
  } else {
    const match = raw.match(/<title>([^<]*)<\/title>/i)
    if (match?.[1].trim()) title = match[1].trim()
  }
  const blocks: unknown[] = isHtml ? await editor().tryParseHTMLToBlocks(source) : await editor().tryParseMarkdownToBlocks(source)
  // Our own HTML export repeats the title as the first heading.
  const first = blocks[0] as Loose | undefined
  const firstText = Array.isArray(first?.content) ? first.content.map((c) => (c as { text?: string }).text ?? '').join('') : ''
  if (first?.type === 'heading' && firstText.trim() === title) blocks.shift()
  return { title, blocks }
}
