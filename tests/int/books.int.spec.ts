import { describe, expect, it } from 'vitest'
import { bookmarksOf, cleanBookmarks, cleanCfi, cleanCoverUrl } from '@/lib/books'
import { guessLanguage, segmentDocument } from '@/components/reader/sentences'

describe('book input cleaning', () => {
  it('accepts EPUB CFIs and rejects anything else', () => {
    expect(cleanCfi('epubcfi(/6/4!/4/2/1:0)')).toBe('epubcfi(/6/4!/4/2/1:0)')
    expect(() => cleanCfi('javascript:alert(1)')).toThrow()
    expect(() => cleanCfi('epubcfi(/6/4!/4/2/1:0)) + x')).toThrow()
    expect(() => cleanCfi(`epubcfi(${'/2'.repeat(1200)})`)).toThrow()
  })

  it('keeps bookmarks well formed and drops bad ones as a whole', () => {
    const list = cleanBookmarks([{ cfi: 'epubcfi(/6/2!/4/1:0)', label: 'x'.repeat(500), createdAt: 'nope' }])
    expect(list[0].label).toHaveLength(200)
    expect(Number.isNaN(Date.parse(list[0].createdAt))).toBe(false)
    expect(() => cleanBookmarks('[]')).toThrow()
    expect(bookmarksOf([{ cfi: 'bad' }])).toEqual([])
    expect(bookmarksOf(null)).toEqual([])
  })

  it('only takes uploaded media as a cover', () => {
    expect(cleanCoverUrl('/api/media/file/a%20b.jpg')).toBe('/api/media/file/a%20b.jpg')
    expect(cleanCoverUrl('https://example.com/x.jpg')).toBeNull()
    expect(cleanCoverUrl('/api/media/file/x.jpg" onerror="')).toBeNull()
  })
})

describe('segmentDocument', () => {
  const doc = (body: string) => new DOMParser().parseFromString(`<html><body>${body}</body></html>`, 'text/html')

  it('splits Chinese paragraphs into sentences with ranges over the right text', () => {
    const d = doc('<h1>第一章</h1><p>天空很藍。貓在屋頂上<em>散步</em>！牠要去哪裡？</p>')
    const segments = segmentDocument(d, 'zh-TW')
    expect(segments.map((s) => s.text)).toEqual(['第一章', '天空很藍。', '貓在屋頂上散步！', '牠要去哪裡？'])
    // The range crosses the <em>: start and end sit in different text nodes.
    expect(segments[2].range.toString()).toBe('貓在屋頂上散步！')
  })

  it('skips ruby annotations, scripts and empty paragraphs', () => {
    const d = doc('<p><ruby>漢<rt>ㄏㄢˋ</rt></ruby>字。</p><p>   </p><script>var x = 1</script>')
    expect(segmentDocument(d, 'zh-TW').map((s) => s.text)).toEqual(['漢字。'])
  })

  it('cuts very long sentences at a comma', () => {
    const long = `${'很長的句子，'.repeat(60)}結束。`
    const segments = segmentDocument(doc(`<p>${long}</p>`), 'zh-TW')
    expect(segments.length).toBeGreaterThan(1)
    expect(segments.every((s) => s.text.length <= 180)).toBe(true)
    expect(segments.map((s) => s.text).join('')).toBe(long)
  })
})

describe('guessLanguage', () => {
  it('tells Chinese, Japanese and English apart', () => {
    expect(guessLanguage('天空籠罩著一片深藍色的迷霧，月光透過雲層。')).toBe('zh-TW')
    expect(guessLanguage('これはテストです。ひらがなとカタカナがたくさんあります。わたしはねこがすきです。')).toBe('ja')
    expect(guessLanguage('The quick brown fox jumps over the lazy dog.')).toBe('en')
  })
})
