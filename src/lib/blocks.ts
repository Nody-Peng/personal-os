// Helpers for BlockNote documents stored as JSON (arrays of blocks).
// Inline content is either a plain string (from data migrations) or an
// array of { type: 'text', text } runs; blocks may nest via `children`.

type LooseBlock = { content?: unknown; children?: unknown }

function inlineText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((c) => (c && typeof c === 'object' && 'text' in c ? String((c as { text: unknown }).text ?? '') : ''))
    .join('')
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
      if (Array.isArray(block.children)) walk(block.children)
    }
  }
  walk(blocks)
  return lines.join('\n')
}

export function blocksHaveText(blocks: unknown): boolean {
  return blocksToText(blocks).length > 0
}
