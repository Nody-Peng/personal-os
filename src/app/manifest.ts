import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Personal OS',
    short_name: 'Personal OS',
    description: '每日打卡、托福進度與想學清單',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f6f3',
    theme_color: '#f7f6f3',
    lang: 'zh-Hant-TW',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: '記下想學的東西', short_name: '想學', url: '/ideas' },
      { name: '托福進度', short_name: '托福', url: '/toefl' },
    ],
  }
}
