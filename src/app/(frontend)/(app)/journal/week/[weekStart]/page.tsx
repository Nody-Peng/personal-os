import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { WeekNote } from '@/components/week/WeekNote'
import { DAY_PATTERN, isoWeek, logicalDay, weekStart } from '@/lib/day'
import { requireSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ weekStart: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { weekStart: day } = await params
  return { title: DAY_PATTERN.test(day) ? `第 ${isoWeek(day)} 週` : '週筆記' }
}

export default async function WeekPage({ params }: Params) {
  const { weekStart: day } = await params
  if (!DAY_PATTERN.test(day) || Number.isNaN(Date.parse(day))) notFound()
  const monday = weekStart(day)
  if (monday !== day) redirect(`/journal/week/${monday}`)
  const session = await requireSession(`/journal/week/${monday}`)
  return <WeekNote session={session} monday={monday} today={logicalDay()} />
}
