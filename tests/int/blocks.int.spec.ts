import { describe, expect, it } from 'vitest'
import { blocksHaveText, blocksToText } from '@/lib/blocks'

describe('blocksToText', () => {
  it('reads migrated string content and editor text runs, including nested blocks', () => {
    const doc = [
      { type: 'paragraph', content: 'line one' },
      {
        type: 'bulletListItem',
        content: [
          { type: 'text', text: 'Speaking ', styles: {} },
          { type: 'text', text: 'Q2', styles: { bold: true } },
        ],
        children: [{ type: 'paragraph', content: [{ type: 'text', text: 'nested', styles: {} }] }],
      },
      { type: 'paragraph', content: [] },
    ]
    expect(blocksToText(doc)).toBe('line one\nSpeaking Q2\nnested')
  })

  it('treats empty documents as empty', () => {
    expect(blocksHaveText(null)).toBe(false)
    expect(blocksHaveText([{ type: 'paragraph', content: [] }])).toBe(false)
    expect(blocksHaveText([{ type: 'paragraph', content: 'x' }])).toBe(true)
  })
})
