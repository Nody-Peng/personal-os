// Helpers for BlockNote documents stored as JSON (arrays of blocks).
// Inline content is either a plain string (from data migrations) or an array
// of runs: { type: 'text', text } or { type: 'link', content: [runs] }. Tables
// hold { type: 'tableContent', rows: [{ cells }] }; blocks may nest via `children`.

type LooseBlock = { type?: unknown; props?: Record<string, unknown>; content?: unknown; children?: unknown }

function inlineText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map(inlineText).join('')
  if (!content || typeof content !== 'object') return ''
  const node = content as { text?: unknown; content?: unknown; rows?: unknown }
  if (typeof node.text === 'string') return node.text
  if (Array.isArray(node.rows)) return tableText(node.rows)
  return inlineText(node.content)
}

/** One line per row, cells separated by spaces. */
function tableText(rows: unknown[]): string {
  return rows
    .map((row) => {
      const cells = row && typeof row === 'object' ? (row as { cells?: unknown }).cells : null
      return Array.isArray(cells) ? cells.map((cell) => inlineText(cell).trim()).filter(Boolean).join(' ') : ''
    })
    .filter(Boolean)
    .join('\n')
}

/** Plain text of a document, one line per block. */
export function blocksToText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return ''
  const lines: string[] = []
  const walk = (list: unknown[]) => {
    for (const b of list) {
      if (!b || typeof b !== 'object') continue
      const block = b as LooseBlock
      const text = inlineText(block.content).trim()
      if (text) lines.push(text)
      // A bookmark card is found by its page title and address.
      if (block.type === 'bookmark') {
        for (const key of ['title', 'url']) {
          const value = block.props?.[key]
          if (typeof value === 'string' && value.trim()) lines.push(value.trim())
        }
      }
      if (Array.isArray(block.children)) walk(block.children)
    }
  }
  walk(blocks)
  return lines.join('\n')
}

export function blocksHaveText(blocks: unknown): boolean {
  return blocksToText(blocks).length > 0
}

/** Nothing written: no blocks, or only empty paragraphs (a fresh editor holds one). */
export function isBlankDocument(blocks: unknown): boolean {
  if (!Array.isArray(blocks)) return true
  return blocks.every((b) => {
    const block = (b ?? {}) as LooseBlock
    const empty = !block.content || (Array.isArray(block.content) && block.content.length === 0) || block.content === ''
    return block.type === 'paragraph' && empty && (!Array.isArray(block.children) || block.children.length === 0)
  })
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu

/** Word count the way people expect it: each CJK character is a word, plus Latin/number words. */
export function countWords(text: string): { words: number; characters: number } {
  const cjk = text.match(CJK)?.length ?? 0
  const latin = text.replace(CJK, ' ').match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu)?.length ?? 0
  return { words: cjk + latin, characters: [...text.replace(/\s/g, '')].length }
}
