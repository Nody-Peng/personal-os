import { describe, expect, it } from 'vitest'
import { blocksToText, countWords } from '@/lib/blocks'
import { isRecordedLog } from '@/lib/dailyLog'
import { isDay, isMonth, isoWeek, isoWeekYear } from '@/lib/day'
import { cleanNoteIcon, parseNoteIcon } from '@/lib/noteIcons'

describe('isDay / isMonth', () => {
  it('accepts real days and months only', () => {
    expect(isDay('2026-10-05')).toBe(true)
    expect(isDay('2028-02-29')).toBe(true)
    expect(isDay('2026-02-29')).toBe(false)
    expect(isDay('2026-02-30')).toBe(false)
    expect(isDay('2026-13-01')).toBe(false)
    expect(isDay('2026-10-5')).toBe(false)
    expect(isDay(20261005)).toBe(false)
    expect(isMonth('2026-12')).toBe(true)
    expect(isMonth('2026-13')).toBe(false)
    expect(isMonth('2026-00')).toBe(false)
  })
})

describe('isoWeekYear', () => {
  it('pairs the week number with the year the week belongs to', () => {
    expect([isoWeekYear('2025-12-29'), isoWeek('2025-12-29')]).toEqual([2026, 1])
    expect([isoWeekYear('2027-01-01'), isoWeek('2027-01-01')]).toEqual([2026, 53])
    expect([isoWeekYear('2026-10-05'), isoWeek('2026-10-05')]).toEqual([2026, 41])
  })
})

describe('blocksToText', () => {
  it('keeps link text and table cells, so search finds them', () => {
    const doc = [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'see ', styles: {} },
          { type: 'link', href: 'https://epsg.io', content: [{ type: 'text', text: 'EPSG', styles: {} }] },
        ],
      },
      {
        type: 'table',
        content: {
          type: 'tableContent',
          rows: [
            { cells: [[{ type: 'text', text: '代號', styles: {} }], [{ type: 'text', text: '名稱', styles: {} }]] },
            { cells: [{ type: 'tableCell', content: [{ type: 'text', text: '3826', styles: {} }] }, { type: 'tableCell', content: [] }] },
          ],
        },
      },
    ]
    expect(blocksToText(doc)).toBe('see EPSG\n代號 名稱\n3826')
    expect(blocksToText([{ type: 'bookmark', props: { url: 'https://epsg.io/3826', title: 'TWD97' } }])).toBe('TWD97\nhttps://epsg.io/3826')
  })
})

describe('countWords', () => {
  it('counts each CJK character and each Latin word', () => {
    expect(countWords('今天讀了 EPSG 3826 的文件')).toEqual({ words: 9, characters: 15 })
    expect(countWords("it's a well-known fact.")).toEqual({ words: 4, characters: 20 })
    expect(countWords('')).toEqual({ words: 0, characters: 0 })
  })
})

describe('isRecordedLog', () => {
  it('ignores days that only have 早/午/晚 items', () => {
    expect(isRecordedLog({ habitsDone: [], toeflMinutes: 0, themeMinutes: 0, toeflSkills: [], energy: null, note: null })).toBe(false)
    expect(isRecordedLog({ note: [{ type: 'paragraph', content: [] }] })).toBe(false)
    expect(isRecordedLog({ habitsDone: [3] })).toBe(true)
    expect(isRecordedLog({ toeflMinutes: 30 })).toBe(true)
    expect(isRecordedLog({ energy: 3 })).toBe(true)
    expect(isRecordedLog({ note: [{ type: 'paragraph', content: 'tired' }] })).toBe(true)
  })
})

describe('page icons', () => {
  it('keeps emoji and known coloured icons, drops anything else', () => {
    expect(cleanNoteIcon(' 📝 ')).toBe('📝')
    expect(cleanNoteIcon('ph:book-open:blue')).toBe('ph:book-open:blue')
    expect(cleanNoteIcon('ph:book-open:neon')).toBe('ph:book-open:default')
    expect(cleanNoteIcon('ph:not-an-icon:blue')).toBe('')
    expect(cleanNoteIcon('/api/media/file/icon.png')).toBe('/api/media/file/icon.png')
    expect(cleanNoteIcon('/api/media/file/../../etc')).toBe('')
    expect(cleanNoteIcon('/api/media/file/a.png" onerror="x')).toBe('')
    expect(parseNoteIcon('/api/media/file/icon.png')).toEqual({ kind: 'image', url: '/api/media/file/icon.png' })
    expect(parseNoteIcon('ph:lightbulb:green')).toEqual({ kind: 'phosphor', name: 'lightbulb', color: 'green' })
    expect(parseNoteIcon('')).toBeNull()
  })
})
