import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { DayView } from '@/components/day/DayView'
import { formatDayLong, isDay, logicalDay } from '@/lib/day'
import { requireSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ date: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { date } = await params
  return { title: isDay(date) ? formatDayLong(date) : '日記' }
}

export default async function JournalDayPage({ params }: Params) {
  const { date } = await params
  if (!isDay(date)) notFound()
  const session = await requireSession(`/journal/day/${date}`)
  const today = logicalDay()
  if (date === today) redirect('/')
  return <DayView session={session} day={date} today={today} />
}
