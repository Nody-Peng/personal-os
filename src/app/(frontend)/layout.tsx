import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Noto_Color_Emoji } from 'next/font/google'
import React from 'react'
import { BookOpenProvider } from '@/components/books/BookOpener'
import { ThemeSync } from '@/lib/theme'
import { THEME_SCRIPT } from '@/lib/themeScript'
import './styles.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
// Page icons use one emoji design everywhere (Windows' own set has no flags).
// Split by unicode-range, so a browser only fetches the parts it shows.
const notoEmoji = Noto_Color_Emoji({ weight: '400', preload: false, variable: '--font-noto-emoji' })

export const metadata: Metadata = {
  title: { default: 'Personal OS', template: '%s · Personal OS' },
  description: '每日打卡、托福進度與想學清單',
  appleWebApp: { capable: true, title: 'Personal OS', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f6f3' },
    { media: '(prefers-color-scheme: dark)', color: '#191918' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme is set by THEME_SCRIPT before React runs.
    <html lang="zh-Hant-TW" className={`${geistSans.variable} ${geistMono.variable} ${notoEmoji.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-[100dvh]">
        <ThemeSync />
        <BookOpenProvider>{children}</BookOpenProvider>
      </body>
    </html>
  )
}
