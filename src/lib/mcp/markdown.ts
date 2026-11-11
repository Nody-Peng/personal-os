import 'server-only'
import { randomUUID } from 'node:crypto'
import type { Nodes, PhrasingContent, RootContent, Table } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import { codeLanguageFor } from '@/components/editor/codeLanguages'
import { linkedPageIds, type LinkedPage, type LooseBlock } from '../noteStandard'
import { UNTITLED } from '../notes'
import type { Session } from '../session'

// Editor documents as Markdown and back, for Claude (api/mcp), in plain code:
// no DOM (BlockNote's own converters need one, and a DOM emulator doesn't
// belong in a serverless function). Reading writes our own blocks directly
// (page links with their titles, callouts as quotes…). Writing parses GitHub
// Markdown (task lists, tables, strikethrough); a line holding just a link to
// one of our pages becomes a page-link block, so backlinks see it.

// ------------------------------------------------------------- reading

type Styles = { bold?: boolean; italic?: boolean; strike?: boolean; code?: boolean }
type InlineText = { type: 'text'; text: string; styles?: Styles }
type InlineLink = { type: 'link'; href: string; content: InlineText[] | string }
type Inline = InlineText | InlineLink

/** Characters that would otherwise read as Markdown syntax. */
const escapeText = (text: string) => text.replace(/([\\`*_[\]<~])/g, '\\$1')

function textRun(run: InlineText): string {
  const { styles = {} } = run
  if (!run.text) return ''
  if (styles.code) {
    const fence = run.text.includes('`') ? '``' : '`'
    return `${fence}${run.text}${fence}`
  }
  // Markers can't sit against spaces: keep those outside.
  const [, lead, core, trail] = run.text.match(/^(\s*)([\s\S]*?)(\s*)$/)!
  if (!core) return run.text
  let out = escapeText(core)
  if (styles.strike) out = `~~${out}~~`
  if (styles.italic) out = `*${out}*`
  if (styles.bold) out = `**${out}**`
  return `${lead}${out}${trail}`
}

function inlineMarkdown(content: unknown): string {
  if (typeof content === 'string') return escapeText(content)
  if (!Array.isArray(content)) return ''
  return (content as Inline[])
    .map((c) => {
      if (c?.type === 'link') return `[${inlineMarkdown(c.content) || c.href}](${c.href})`
      if (c?.type === 'text') return textRun(c)
      return ''
    })
    .join('')
    .replace(/\n/g, '  \n')
}

/** Escapes what would turn a paragraph's start into a heading, list or quote. */
const guardLineStart = (line: string) => line.replace(/^(\s*)([#>+-]|\d+[.)])(?=\s|$)/, '$1\\$2')

function tableMarkdown(content: unknown): string {
  const rows = (content as { rows?: { cells?: unknown[] }[] } | undefined)?.rows ?? []
  const cell = (c: unknown) => {
    const inline = Array.isArray(c) ? c : (c as { content?: unknown })?.content
    return inlineMarkdown(inline).replace(/\|/g, '\\|').replace(/ {2}\n/g, ' ') || ' '
  }
  const grid = rows.map((r) => (r.cells ?? []).map(cell))
  if (!grid.length) return ''
  const width = Math.max(...grid.map((r) => r.length))
  const line = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => r[i] ?? ' ').join(' | ')} |`
  return [line(grid[0]), `| ${Array.from({ length: width }, () => '---').join(' | ')} |`, ...grid.slice(1).map(line)].join('\n')
}

type Writer = { titles: Map<number, LinkedPage>; origin: string }

function blocksMarkdown(blocks: LooseBlock[], w: Writer, indent = '', nested = false): string[] {
  const out: string[] = []
  let number = 0
  const absolute = (url: string) => (url.startsWith('/') ? `${w.origin}${url}` : url)
  const pageLink = (id: number) => {
    const info = w.titles.get(id)
    return info ? `[${escapeText(info.title || UNTITLED)}](${w.origin}/notebooks/${info.notebookId}/${id})` : '（找不到的頁面）'
  }
  for (const block of blocks) {
    const children = Array.isArray(block.children) ? (block.children as LooseBlock[]) : []
    const props = block.props ?? {}
    const text = inlineMarkdown(block.content)
    number = block.type === 'numberedListItem' ? number + 1 : 0
    const item = (marker: string) => {
      out.push(`${indent}${marker} ${text}`)
      out.push(...blocksMarkdown(children, w, `${indent}${' '.repeat(marker.length + 1)}`, true))
    }
    switch (block.type) {
      case 'bulletListItem':
      case 'toggleListItem':
        item('-')
        continue
      case 'numberedListItem':
        item(`${number}.`)
        continue
      case 'checkListItem':
        item(`- [${props.checked ? 'x' : ' '}]`)
        continue
      case 'columnList':
      case 'column':
        out.push(...blocksMarkdown(children, w, indent, nested))
        continue
      case 'toc':
        continue
    }
    // Block-level: a blank line before each one inside a list item's children.
    const lines: string[] = []
    switch (block.type) {
      case 'heading':
        lines.push(`${'#'.repeat(Math.min(6, Math.max(1, Number(props.level) || 1)))} ${text}`)
        break
      case 'quote':
        lines.push(...(text || ' ').split('\n').map((l) => `> ${l}`))
        break
      case 'callout': {
        const emoji = typeof props.emoji === 'string' && !props.emoji.startsWith('ph:') && !props.emoji.startsWith('/') ? `${props.emoji} ` : ''
        lines.push(...`${emoji}${text}`.split('\n').map((l) => `> ${l}`))
        break
      }
      case 'codeBlock': {
        const code = Array.isArray(block.content) ? (block.content as InlineText[]).map((c) => c.text ?? '').join('') : ''
        const fence = code.includes('```') ? '````' : '```'
        lines.push(`${fence}${props.language && props.language !== 'text' ? props.language : ''}`, ...code.split('\n'), fence)
        if (props.caption) lines.push(`*${escapeText(String(props.caption))}*`)
        break
      }
      case 'divider':
        lines.push('---')
        break
      case 'table':
        lines.push(tableMarkdown(block.content))
        break
      case 'image':
        if (props.url) lines.push(`![${escapeText(String(props.caption || props.name || ''))}](${absolute(String(props.url))})`)
        break
      case 'video':
      case 'audio':
      case 'file':
        if (props.url) lines.push(`[${escapeText(String(props.name || props.caption || block.type))}](${absolute(String(props.url))})`)
        break
      case 'pageLink':
        lines.push(pageLink(Number(props.pageId)))
        break
      case 'board':
        lines.push(`看板：${pageLink(Number(props.boardId))}`)
        break
      case 'bookmark':
      case 'embed':
        if (props.url) lines.push(`[${escapeText(String(props.title || props.url))}](${absolute(String(props.url))})`)
        break
      default:
        // Paragraphs, and anything else with text.
        if (text) lines.push(guardLineStart(text))
        else if (block.type === 'paragraph') lines.push('')
    }
    // Under a list item, anything but another item needs a blank line first, or it joins the item's text.
    if (nested && lines.some((l) => l)) out.push('')
    out.push(...lines.join('\n').split('\n').map((l) => (l ? `${indent}${l}` : l)))
    out.push(...blocksMarkdown(children, w, `${indent}  `, true))
  }
  return out
}

/** Joins block lines: a blank line between blocks, list items of one list kept together. */
function joinBlocks(blocks: LooseBlock[], w: Writer): string {
  const parts: string[] = []
  let previousList: string | null = null
  let number = 0
  for (const block of blocks) {
    const list = ['bulletListItem', 'toggleListItem', 'numberedListItem', 'checkListItem'].includes(String(block.type)) ? String(block.type) : null
    const lines = blocksMarkdown([block], w)
    // Numbered items count within their own run.
    number = list === 'numberedListItem' ? (previousList === list ? number + 1 : 1) : 0
    if (number > 1) lines[0] = lines[0].replace(/^1\./, `${number}.`)
    const chunk = lines.join('\n')
    if (list && list === previousList) parts[parts.length - 1] += `\n${chunk}`
    else parts.push(chunk)
    previousList = list
  }
  return parts
    .filter((p) => p.trim() !== '')
    .join('\n\n')
}

async function writerFor({ payload, user }: Session, doc: LooseBlock[], origin: string): Promise<Writer> {
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
  return { titles, origin }
}

/** A page's (or a journal note's) blocks as Markdown; page links use their current titles. */
export async function blocksToMarkdown(session: Session, blocks: unknown, origin: string): Promise<string> {
  const doc = (Array.isArray(blocks) ? blocks : []) as LooseBlock[]
  if (!doc.length) return ''
  return joinBlocks(doc, await writerFor(session, doc, origin)).trim()
}

// ---------------------------------------------- what Markdown can't carry

// Markdown can't hold every block the editor makes (boards, columns, toggles,
// callouts, bookmarks, colours…). A top-level block whose Markdown doesn't read
// back into the very same block is "lossy": pageMarkdown wraps it in
//   <!-- keep:<block id> 看板 -->  …readable text…  <!-- /keep -->
// and markdownToBlocks turns such a pair back into the original block,
// untouched, so rewriting a page can't flatten what Claude can't see.

const KEEP_OPEN = /^(\s*)<!--\s*keep:([A-Za-z0-9_-]{1,64})\b[^>]*-->\s*$/
const KEEP_CLOSE = /^\s*<!--\s*\/keep\s*-->\s*$/
const BLOCK_MARK = /^\s*<!--\s*block:[A-Za-z0-9_-]{1,64}\b[^>]*-->\s*$/
const KEEP_REF = /^<!--\s*keepref:([A-Za-z0-9_-]{1,64})\s*-->$/

const BLOCK_LABELS: Record<string, string> = {
  board: '看板',
  columnList: '多欄',
  toggleListItem: '摺疊清單',
  callout: '提示框',
  bookmark: '書籤',
  embed: '嵌入',
  toc: '目錄',
  image: '圖片',
  video: '影片',
  audio: '音訊',
  file: '檔案',
  table: '表格',
  pageLink: '子頁面',
  codeBlock: '程式碼',
  heading: '標題（含格式）',
  quote: '引言（含格式）',
}
export const blockLabel = (block: LooseBlock) => BLOCK_LABELS[String(block.type)] ?? '含顏色或排版的段落'

/** Comparable form of a block: no ids, no props left at the editor's defaults, text runs merged. */
function normal(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(normal)
    const merged: unknown[] = []
    for (const item of items) {
      const last = merged[merged.length - 1] as Record<string, unknown> | undefined
      const run = item as Record<string, unknown>
      if (last?.type === 'text' && run?.type === 'text' && JSON.stringify(last.styles ?? {}) === JSON.stringify(run.styles ?? {})) {
        merged[merged.length - 1] = { ...last, text: String(last.text ?? '') + String(run.text ?? '') }
      } else merged.push(item)
    }
    return merged
  }
  if (!value || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort()) {
    if (key === 'id') continue
    const v = normal((value as Record<string, unknown>)[key])
    if (v == null || v === false || v === '' || v === 'default' || v === 'left') continue
    if (Array.isArray(v) && !v.length) continue
    if (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v as object).length) continue
    out[key] = v
  }
  // Spaces at either end of a block's text don't survive Markdown, and don't matter.
  if (typeof out.type === 'string' && Array.isArray(out.content)) {
    const runs = out.content as Record<string, unknown>[]
    const first = runs[0]
    const last = runs[runs.length - 1]
    if (first?.type === 'text') runs[0] = { ...first, text: String(first.text ?? '').trimStart() }
    if (last?.type === 'text') runs[runs.length - 1] = { ...runs[runs.length - 1], text: String(runs[runs.length - 1].text ?? '').trimEnd() }
    out.content = runs.filter((r) => !(r.type === 'text' && !r.text))
    if (!(out.content as unknown[]).length) delete out.content
  }
  return out
}

const isBlankParagraph = (block: LooseBlock) =>
  block.type === 'paragraph' && !(Array.isArray(block.children) && block.children.length) && JSON.stringify(normal({ type: 'paragraph', props: block.props, content: block.content })) === '{"type":"paragraph"}'

/** Whether a block comes back unchanged from its own Markdown. */
function readsBack(block: LooseBlock, w: Writer): boolean {
  if (isBlankParagraph(block)) return true
  const markdown = joinBlocks([block], w).trim()
  if (!markdown) return false
  const back = blocksFrom(parse(markdown).children, { origin: w.origin, used: new Set() })
  return back.length === 1 && JSON.stringify(normal(back[0])) === JSON.stringify(normal(block))
}

/**
 * A page as Markdown for Claude, with Markdown-proof blocks wrapped in keep
 * markers (`lossy`: their ids and labels). `blockIds` also marks every other
 * top-level block with `<!-- block:<id> -->`, for the block-editing tools.
 */
export async function pageMarkdown(
  session: Session,
  blocks: unknown,
  origin: string,
  opts: { blockIds?: boolean } = {},
): Promise<{ markdown: string; lossy: Map<string, string> }> {
  const doc = (Array.isArray(blocks) ? blocks : []) as LooseBlock[]
  const lossy = new Map<string, string>()
  if (!doc.length) return { markdown: '', lossy }
  const w = await writerFor(session, doc, origin)
  const parts: string[] = []
  let run: LooseBlock[] = []
  const flush = () => {
    const text = joinBlocks(run, w).trim()
    if (text) parts.push(text)
    run = []
  }
  for (const block of doc) {
    const id = typeof block.id === 'string' ? block.id : ''
    if (id && !readsBack(block, w)) {
      flush()
      const label = blockLabel(block)
      lossy.set(id, label)
      const inner = joinBlocks([block], w).trim() || `（${label}）`
      parts.push(`<!-- keep:${id} ${label} -->\n\n${inner}\n\n<!-- /keep -->`)
    } else if (opts.blockIds && id && !isBlankParagraph(block)) {
      flush()
      parts.push(`<!-- block:${id} -->\n${joinBlocks([block], w).trim()}`)
    } else run.push(block)
  }
  flush()
  return { markdown: parts.join('\n\n'), lossy }
}

/** Every block id in a document, nested ones included. */
export function blockIds(blocks: unknown, out = new Set<string>()): Set<string> {
  for (const b of (Array.isArray(blocks) ? blocks : []) as LooseBlock[]) {
    if (typeof b.id === 'string') out.add(b.id)
    if (Array.isArray(b.children)) blockIds(b.children, out)
  }
  return out
}

// ------------------------------------------------------------- writing

/** `/notebooks/<notebook>/<page>` on this site (absolute or not): the page id. */
export function pageIdFromUrl(href: string, origin: string): number | null {
  const path = href.startsWith(origin) ? href.slice(origin.length) : href
  const match = path.match(/^\/notebooks\/\d+\/(\d+)\/?(?:[?#].*)?$/)
  return match ? Number(match[1]) : null
}

type Block = { id: string; type: string; props?: Record<string, unknown>; content?: unknown; children: Block[] }

const block = (type: string, extra: Partial<Omit<Block, 'id' | 'type'>> = {}): Block => ({ id: randomUUID(), type, children: [], ...extra })

function inlineFrom(nodes: PhrasingContent[], styles: Styles = {}): Inline[] {
  const out: Inline[] = []
  const push = (text: string, s: Styles) => {
    if (!text) return
    const last = out[out.length - 1]
    // Neighbouring runs with the same styles become one.
    if (last?.type === 'text' && JSON.stringify(last.styles ?? {}) === JSON.stringify(s)) last.text += text
    else out.push({ type: 'text', text, styles: { ...s } })
  }
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        push(node.value, styles)
        break
      case 'inlineCode':
        push(node.value, { ...styles, code: true })
        break
      case 'strong':
        out.push(...inlineFrom(node.children, { ...styles, bold: true }))
        break
      case 'emphasis':
        out.push(...inlineFrom(node.children, { ...styles, italic: true }))
        break
      case 'delete':
        out.push(...inlineFrom(node.children, { ...styles, strike: true }))
        break
      case 'break':
        push('\n', styles)
        break
      case 'link': {
        const content = inlineFrom(node.children, styles).filter((c): c is InlineText => c.type === 'text')
        out.push({ type: 'link', href: node.url, content: content.length ? content : [{ type: 'text', text: node.url, styles: {} }] })
        break
      }
      case 'image':
        out.push({ type: 'link', href: node.url, content: [{ type: 'text', text: node.alt || node.url, styles: {} }] })
        break
      case 'html':
        push(node.value, styles)
        break
      default:
        if ('children' in node) out.push(...inlineFrom(node.children as PhrasingContent[], styles))
        else if ('value' in node) push(String(node.value), styles)
    }
  }
  return out
}

/** A list item's own line: its first paragraph; everything after it nests under it. */
function itemParts(nodes: RootContent[], cx: ParseContext): { content: Inline[]; children: Block[] } {
  const [first, ...rest] = nodes
  if (first?.type === 'paragraph') return { content: inlineFrom(first.children), children: blocksFrom(rest, cx) }
  return { content: [], children: blocksFrom(nodes, cx) }
}

function tableFrom(node: Table): Block {
  return block('table', {
    content: {
      type: 'tableContent',
      rows: node.children.map((row) => ({ cells: row.children.map((cell) => inlineFrom(cell.children)) })),
    },
  })
}

/** `keep`: blocks of the page being rewritten, by id, for keep markers. */
type ParseContext = { origin: string; keep?: Map<string, LooseBlock>; used: Set<string> }

/** A copy of a block with fresh ids throughout (a kept block used twice). */
const withFreshIds = (b: LooseBlock): LooseBlock => ({
  ...b,
  id: randomUUID(),
  children: Array.isArray(b.children) ? (b.children as LooseBlock[]).map(withFreshIds) : [],
})

function blocksFrom(nodes: RootContent[], cx: ParseContext): Block[] {
  const { origin } = cx
  const out: Block[] = []
  for (const node of nodes) {
    switch (node.type) {
      case 'heading':
        out.push(block('heading', { props: { level: Math.min(6, node.depth) }, content: inlineFrom(node.children) }))
        break
      case 'paragraph': {
        const parts = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()))
        const only = parts.length === 1 ? parts[0] : null
        if (only?.type === 'image') {
          out.push(block('image', { props: { url: only.url, caption: only.alt ?? '' } }))
          break
        }
        const pageId = only?.type === 'link' ? pageIdFromUrl(only.url, origin) : null
        if (pageId) out.push(block('pageLink', { props: { pageId, mode: 'link' } }))
        else out.push(block('paragraph', { content: inlineFrom(node.children) }))
        break
      }
      case 'list':
        for (const item of node.children) {
          const { content, children } = itemParts(item.children, cx)
          if (typeof item.checked === 'boolean') out.push(block('checkListItem', { props: { checked: item.checked }, content, children }))
          else out.push(block(node.ordered ? 'numberedListItem' : 'bulletListItem', { content, children }))
        }
        break
      case 'blockquote': {
        const paragraphs = node.children.filter((c) => c.type === 'paragraph')
        const content: Inline[] = []
        paragraphs.forEach((p, i) => {
          if (i) content.push({ type: 'text', text: '\n', styles: {} })
          content.push(...inlineFrom(p.children))
        })
        out.push(block('quote', { content, children: blocksFrom(node.children.filter((c) => c.type !== 'paragraph'), cx) }))
        break
      }
      case 'code':
        out.push(block('codeBlock', { props: { language: codeLanguageFor(node.lang ?? 'text') }, content: [{ type: 'text', text: node.value, styles: {} }] }))
        break
      case 'thematicBreak':
        out.push(block('divider'))
        break
      case 'table':
        out.push(tableFrom(node))
        break
      case 'html': {
        const ref = node.value.trim().match(KEEP_REF)?.[1]
        if (ref) {
          const kept = cx.keep?.get(ref)
          if (!kept) throw new Error(`找不到 keep:${ref} 這個區塊：保留記號只能用在讀出它的那一頁，而且要原樣保留`)
          out.push((cx.used.has(ref) ? withFreshIds(kept) : kept) as Block)
          cx.used.add(ref)
        } else out.push(block('paragraph', { content: [{ type: 'text', text: node.value, styles: {} }] }))
        break
      }
      default:
        if ('children' in node) out.push(...blocksFrom((node as { children: RootContent[] }).children, cx))
    }
  }
  return out
}

const parse = (text: string) => fromMarkdown(text, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] }) as Nodes & { children: RootContent[] }

/**
 * Replaces each keep-marker pair with a one-line reference (its text between
 * the markers is only for reading) and drops block markers.
 */
function resolveMarkers(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(KEEP_OPEN)
    if (open) {
      const end = lines.findIndex((l, j) => j > i && KEEP_CLOSE.test(l))
      if (end < 0) throw new Error(`keep:${open[2]} 少了結尾的 <!-- /keep -->`)
      out.push('', `${open[1]}<!-- keepref:${open[2]} -->`, '')
      i = end
    } else if (KEEP_CLOSE.test(lines[i])) {
      throw new Error('多了一行 <!-- /keep -->，前面沒有對應的 <!-- keep:… -->')
    } else if (!BLOCK_MARK.test(lines[i])) out.push(lines[i])
  }
  return out.join('\n')
}

/**
 * Markdown as editor blocks (every block with a fresh id, as the editor's own
 * have). With `keep` (the page's current top-level blocks by id), keep markers
 * bring those blocks back as they are.
 */
export async function markdownToBlocks(markdown: string, origin: string, keep?: Map<string, LooseBlock>): Promise<unknown[]> {
  const text = resolveMarkers(markdown.replace(/\r\n?/g, '\n')).trim()
  if (!text) return []
  return blocksFrom(parse(text).children, { origin, keep, used: new Set() })
}

/** A document's top-level blocks by id, for markdownToBlocks' keep markers. */
export function keepMap(blocks: unknown): Map<string, LooseBlock> {
  const map = new Map<string, LooseBlock>()
  for (const b of (Array.isArray(blocks) ? blocks : []) as LooseBlock[]) if (typeof b.id === 'string') map.set(b.id, b)
  return map
}
