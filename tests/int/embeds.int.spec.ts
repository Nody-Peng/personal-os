import { describe, expect, it } from 'vitest'
import { isKnownEmbed, isUrl, toEmbed } from '@/lib/embeds'

describe('toEmbed', () => {
  it('turns video links into players', () => {
    expect(toEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s')?.src).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90')
    expect(toEmbed('https://youtu.be/dQw4w9WgXcQ')?.src).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(toEmbed('https://youtube.com/shorts/abcdefghijk')?.height).toBe(560)
    expect(toEmbed('https://vimeo.com/76979871')?.src).toBe('https://player.vimeo.com/video/76979871')
    expect(toEmbed('https://www.bilibili.com/video/BV1xx411c7mD')?.src).toContain('bvid=BV1xx411c7mD')
  })

  it('knows Google Maps, Docs and Figma', () => {
    expect(toEmbed('https://www.google.com/maps/place/%E5%8F%B0%E5%8C%97101/@25.03,121.56,17z')?.src).toBe(
      `https://www.google.com/maps?q=${encodeURIComponent('台北101')}&output=embed`,
    )
    expect(toEmbed('https://docs.google.com/document/d/abc123/edit?usp=sharing')?.src).toBe('https://docs.google.com/document/d/abc123/preview')
    expect(toEmbed('https://docs.google.com/presentation/d/abc123/edit')?.src).toBe('https://docs.google.com/presentation/d/abc123/embed')
    expect(toEmbed('https://www.figma.com/design/KEY/Name')?.src).toContain('figma.com/embed?embed_host=share')
  })

  it('frames other https pages as they are, but nothing else', () => {
    expect(toEmbed('https://example.com/page')).toEqual({ src: 'https://example.com/page', provider: 'example.com', height: 480 })
    expect(isKnownEmbed('https://example.com/page')).toBe(false)
    expect(isKnownEmbed('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
    expect(toEmbed('javascript:alert(1)')).toBeNull()
    expect(toEmbed('not a url')).toBeNull()
  })
})

describe('isUrl', () => {
  it('accepts one web address and nothing more', () => {
    expect(isUrl(' https://epsg.io/3826 ')).toBe(true)
    expect(isUrl('see https://epsg.io')).toBe(false)
    expect(isUrl('ftp://example.com')).toBe(false)
  })
})
