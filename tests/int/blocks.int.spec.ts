import { describe, expect, it } from 'vitest'
import { blocksHaveText, blocksToText, isBlankDocument } from '@/lib/blocks'
import { dayLogText, weekText } from '@/lib/searchText'

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

describe('isBlankDocument', () => {
  it('is blank for nothing or empty paragraphs only', () => {
    expect(isBlankDocument(null)).toBe(true)
    expect(isBlankDocument([])).toBe(true)
    expect(isBlankDocument([{ type: 'paragraph', content: [], children: [] }])).toBe(true)
  })

  it('is not blank with text, a picture, or nested blocks', () => {
    expect(isBlankDocument([{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }])).toBe(false)
    expect(isBlankDocument([{ type: 'image', props: { url: '/api/media/file/a.png' }, content: undefined }])).toBe(false)
    expect(isBlankDocument([{ type: 'paragraph', content: [], children: [{ type: 'paragraph', content: 'kid' }] }])).toBe(false)
  })
})

describe('search text', () => {
  it('reads a day from its note and its 早/午/晚 checklists', () => {
    const log = {
      note: [{ type: 'paragraph', content: [{ type: 'text', text: '讀了原始碼' }] }],
      morningItems: [{ id: 'a', text: '晨跑', done: true }],
      eveningItems: [{ id: 'b', text: '背單字', done: false }],
    }
    expect(dayLogText(log)).toBe('讀了原始碼\n晨跑\n背單字')
  })

  it('reads a week from its review and the reason for its theme', () => {
    expect(weekText({ review: [{ type: 'paragraph', content: '口說練習' }], themeReason: '最弱的一科' })).toBe('口說練習\n最弱的一科')
    expect(weekText({})).toBe('')
  })
})
