'use client'

// Page export (••• → 匯出): Markdown or a standalone HTML file. Our own blocks
// become standard ones first (page links → links with their titles, callouts →
// quotes, columns → one after another, bookmarks and embeds → links), then
// BlockNote's converters run on a headless editor with the default schema.

import { BlockNoteEditor } from '@blocknote/core'
import { getPageLinks } from '@/app/(frontend)/notebook-actions'
import { linkedPageIds, toStandardBlocks, type LinkedPage, type LooseBlock } from './noteStandard'
import { UNTITLED } from './notes'

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
  const doc = (Array.isArray(blocks) ? blocks : []) as LooseBlock[]
  const ids = [...linkedPageIds(doc)]
  const titles = new Map<number, LinkedPage>()
  if (ids.length) {
    const result = await getPageLinks(ids)
    if (result.ok) for (const p of result.data ?? []) titles.set(p.id, p)
  }
  const standard = toStandardBlocks(doc, titles, window.location.origin) as Parameters<BlockNoteEditor['blocksToMarkdownLossy']>[0]
  const heading = title.trim() || UNTITLED

  if (format === 'markdown') {
    const body = await editor().blocksToMarkdownLossy(standard)
    download(`${safeName(title)}.md`, `# ${heading}\n\n${body}`, 'text/markdown;charset=utf-8')
    return
  }
  // BlockNote writes an empty paragraph as U+FFFC (shown as a box in a browser).
  const body = (await editor().blocksToHTMLLossy(standard)).replace(/￼/g, '')
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
    const match = raw.match(/^\s*#\s+(.+?)\s*(?:\n|$)/)
    if (match) {
      title = match[1].trim()
      source = raw.slice(match[0].length)
    }
  } else {
    // The title is HTML text (our export writes `&amp;` for &).
    const named = new DOMParser().parseFromString(raw, 'text/html').title.trim()
    if (named) title = named
  }
  const blocks: unknown[] = isHtml ? await editor().tryParseHTMLToBlocks(source) : await editor().tryParseMarkdownToBlocks(source)
  // Our own HTML export repeats the title as the first heading.
  const first = blocks[0] as LooseBlock | undefined
  const firstText = Array.isArray(first?.content) ? first.content.map((c) => (c as { text?: string }).text ?? '').join('') : ''
  if (first?.type === 'heading' && firstText.trim() === title) blocks.shift()
  return { title, blocks }
}
