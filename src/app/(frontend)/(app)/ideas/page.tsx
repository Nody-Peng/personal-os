import type { Metadata } from 'next'
import { IdeasBoard, type IdeaItem } from '@/components/ideas/IdeasBoard'
import type { IdeaStatus } from '@/lib/options'
import { getIdeas } from '@/lib/queries'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: '想學清單' }
export const dynamic = 'force-dynamic'

export default async function IdeasPage() {
  const session = await requireSession('/ideas')
  const ideas = await getIdeas(session)

  const items: IdeaItem[] = ideas.map((i) => ({
    id: i.id,
    title: i.title,
    why: i.why ?? null,
    scoreGoal: i.scoreGoal ?? 0,
    scoreUrgency: i.scoreUrgency ?? 0,
    scorePassion: i.scorePassion ?? 0,
    status: i.status as IdeaStatus,
    createdAt: i.createdAt,
  }))

  return (
    <>
      <header className="mb-6 md:mb-8">
        <p className="font-mono text-xs text-muted">先記下，週日再決定</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-strong md:text-4xl">想學清單</h1>
      </header>
      <IdeasBoard initial={items} />
    </>
  )
}
