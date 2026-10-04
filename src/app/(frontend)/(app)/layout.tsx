import React from 'react'
import { AppNav } from '@/components/AppNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-4xl px-4 pt-6 pb-28 md:px-6 md:pt-10 md:pb-16">{children}</main>
    </>
  )
}
