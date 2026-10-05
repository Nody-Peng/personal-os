import { describe, expect, it } from 'vitest'
import { parseLinkMeta } from '@/lib/linkMeta'
import { isPrivateAddress } from '@/lib/privateAddress'

describe('parseLinkMeta', () => {
  it('prefers Open Graph tags and makes addresses absolute', () => {
    const html = `<html><head>
      <title>Fallback &amp; title</title>
      <meta content="EPSG:3826 &#8211; TWD97" property="og:title">
      <meta property='og:description' content='Taiwan TM2 zone 121'>
      <meta property="og:image" content="/img/card.png">
      <meta property="og:site_name" content="epsg.io">
      <link rel="apple-touch-icon" href="/touch.png">
      <link rel="icon" href="/favicon.svg">
    </head></html>`
    expect(parseLinkMeta(html, 'https://epsg.io/3826')).toEqual({
      url: 'https://epsg.io/3826',
      title: 'EPSG:3826 – TWD97',
      description: 'Taiwan TM2 zone 121',
      image: 'https://epsg.io/img/card.png',
      siteName: 'epsg.io',
      icon: 'https://epsg.io/favicon.svg',
    })
  })

  it('falls back to <title>, the host name and /favicon.ico', () => {
    const meta = parseLinkMeta('<title> 小站 </title><meta property="og:image" content="javascript:alert(1)">', 'https://www.example.tw/a')
    expect(meta.title).toBe('小站')
    expect(meta.siteName).toBe('example.tw')
    expect(meta.image).toBe('')
    expect(meta.icon).toBe('https://www.example.tw/favicon.ico')
    expect(parseLinkMeta('', 'https://example.com/x').title).toBe('example.com')
  })
})

describe('isPrivateAddress', () => {
  it('blocks loopback, private, link-local and mapped addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
  })

  it('allows public addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111']) {
      expect(isPrivateAddress(ip), ip).toBe(false)
    }
  })
})
