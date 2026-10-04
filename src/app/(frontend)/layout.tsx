import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import React from 'react'
import './styles.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: { default: 'Personal OS', template: '%s · Personal OS' },
  description: '每日打卡、托福進度與想學清單',
  appleWebApp: { capable: true, title: 'Personal OS', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  themeColor: '#f7f6f3',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-[100dvh]">{children}</body>
    </html>
  )
}
