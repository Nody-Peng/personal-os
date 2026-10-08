import React, { Suspense } from 'react'
import { AppNav } from '@/components/AppNav'
import { GlobalSearch } from '@/components/search/GlobalSearch'
import { TaskPeek } from '@/components/tasks/TaskPeek'
import { EditorToasts } from '@/components/Toast'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-28 md:px-6 md:pt-10 md:pb-16">{children}</main>
      <Suspense>
        <TaskPeek />
      </Suspense>
      <GlobalSearch />
      <EditorToasts />
    </>
  )
}
