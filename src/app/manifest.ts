import type { MetadataRoute } from 'next'
import { BRAND_NAVY } from '@/components/brand/mark'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Personal OS',
    short_name: 'Personal OS',
    description: '每天一頁的日記本：Important、習慣、托福進度與筆記本',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // Splash screen while the installed app starts: navy, like the journal cover.
    background_color: BRAND_NAVY,
    // Status bar matches the app's warm paper background.
    theme_color: '#f7f6f3',
    lang: 'zh-Hant-TW',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: '記下想學的東西', short_name: '想學', url: '/ideas' },
      { name: '托福進度', short_name: '托福', url: '/toefl' },
    ],
  }
}
