'use client'

// Splits a chapter's document into sentences for reading aloud, each with a
// DOM Range so it can be highlighted and located (CFI) in the book.

export type Segment = { range: Range; text: string }

const BLOCKS = new Set([
  'P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'TD', 'TH', 'DT', 'DD',
  'FIGCAPTION', 'PRE', 'SECTION', 'ARTICLE', 'ASIDE', 'HEADER', 'FOOTER', 'BODY', 'TR', 'CAPTION',
])
// Ruby annotations (注音) would be read twice; scripts and styles aren't text.
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'RT', 'RP', 'TITLE', 'SVG', 'MATH'])

/** Longer pieces are cut at a comma: some voices stop or drift on long utterances. */
const MAX_CHARS = 180
const SPEAKABLE = /[\p{L}\p{N}]/u
const SOFT_BREAK = /[，、,；;：:　 ]/

type Piece = { start: number; end: number }

function sentencePieces(text: string, lang: string | null): Piece[] {
  const pieces: Piece[] = []
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(lang ?? undefined, { granularity: 'sentence' })
    for (const s of segmenter.segment(text)) pieces.push({ start: s.index, end: s.index + s.segment.length })
  } else {
    const re = /[^。！？!?…]+(?:[。！？!?…]+[」』”’）)]*|$)|[。！？!?…]+/g
    for (const m of text.matchAll(re)) if (m[0]) pieces.push({ start: m.index!, end: m.index! + m[0].length })
  }
  // Cut long sentences at the last soft break before the limit.
  const out: Piece[] = []
  for (const piece of pieces) {
    let { start } = piece
    while (piece.end - start > MAX_CHARS) {
      let cut = -1
      for (let i = start + MAX_CHARS; i > start + MAX_CHARS / 3; i--) {
        if (SOFT_BREAK.test(text[i - 1])) {
          cut = i
          break
        }
      }
      if (cut === -1) cut = start + MAX_CHARS
      out.push({ start, end: cut })
      start = cut
    }
    out.push({ start, end: piece.end })
  }
  return out
}

function blockOf(node: Node): Element | null {
  for (let el = node.parentElement; el; el = el.parentElement) if (BLOCKS.has(el.tagName.toUpperCase())) return el
  return null
}

/** Every speakable sentence of the document, in reading order. */
export function segmentDocument(doc: Document, lang: string | null): Segment[] {
  const body = doc.body
  if (!body) return []
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.nodeType === Node.ELEMENT_NODE
        ? SKIP.has((node as Element).tagName.toUpperCase())
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_SKIP
        : NodeFilter.FILTER_ACCEPT,
  })

  // Runs of text nodes that share a block element read as one paragraph.
  const groups: Text[][] = []
  let block: Element | null = null
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text
    if (!text.data) continue
    const b = blockOf(text)
    if (b !== block || groups.length === 0) {
      groups.push([])
      block = b
    }
    groups[groups.length - 1].push(text)
  }

  const segments: Segment[] = []
  for (const nodes of groups) {
    const starts: number[] = []
    let full = ''
    for (const n of nodes) {
      starts.push(full.length)
      full += n.data
    }
    if (!SPEAKABLE.test(full)) continue

    // Offset in the paragraph -> position in one of its text nodes.
    const at = (offset: number, isEnd: boolean): [Text, number] => {
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (isEnd ? starts[i] < offset : starts[i] <= offset) return [nodes[i], Math.min(offset - starts[i], nodes[i].data.length)]
      }
      return [nodes[0], 0]
    }

    for (const { start, end } of sentencePieces(full, lang)) {
      const raw = full.slice(start, end)
      if (!SPEAKABLE.test(raw)) continue
      const lead = raw.length - raw.trimStart().length
      const trail = raw.length - raw.trimEnd().length
      const range = doc.createRange()
      range.setStart(...at(start + lead, false))
      range.setEnd(...at(end - trail, true))
      segments.push({ range, text: raw.trim().replace(/\s+/g, ' ') })
    }
  }
  return segments
}

/** zh / ja / en from the text itself, for books that don't declare a language. */
export function guessLanguage(text: string): string {
  const sample = text.slice(0, 2000)
  const han = (sample.match(/[一-鿿]/g) ?? []).length
  const kana = (sample.match(/[぀-ヿ]/g) ?? []).length
  const latin = (sample.match(/[A-Za-z]/g) ?? []).length
  if (kana > 20 && kana > han / 4) return 'ja'
  if (han > latin / 3) return 'zh-TW'
  return 'en'
}
