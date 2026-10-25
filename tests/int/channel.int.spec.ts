import { describe, expect, it } from 'vitest'
import { channelText, cleanChannel, doneCount } from '@/lib/channel'
import { weekText } from '@/lib/searchText'

describe('cleanChannel', () => {
  it('keeps known slots with a tick and a short single-line note', () => {
    const week = cleanChannel({
      'article-mon': { done: true, note: '  Gemini 3\n實測  ' },
      'short-2': { done: 'yes', note: 'x'.repeat(500) },
      'video-tutorial': { done: false, note: '' },
      hacked: { done: true, note: 'nope' },
      'article-tue': 'not an object',
    })
    expect(week['article-mon']).toEqual({ done: true, note: 'Gemini 3 實測' })
    expect(week['short-2']).toEqual({ done: false, note: 'x'.repeat(200) })
    expect(week).not.toHaveProperty('video-tutorial')
    expect(week).not.toHaveProperty('hacked')
    expect(week).not.toHaveProperty('article-tue')
    expect(doneCount(week)).toBe(1)
  })

  it('treats anything that is not an object as an empty week', () => {
    for (const value of [null, undefined, 'x', 3, ['article-mon']]) expect(cleanChannel(value)).toEqual({})
  })

  it('makes the notes searchable on the week note', () => {
    const channel = { 'video-knowledge': { done: true, note: '魔術方塊 20 步' } }
    expect(channelText(channel)).toBe('知識型影片：魔術方塊 20 步')
    expect(weekText({ themeReason: '主題', channel })).toBe('主題\n知識型影片：魔術方塊 20 步')
  })
})
