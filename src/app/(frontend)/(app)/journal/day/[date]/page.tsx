import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { DayView } from '@/components/day/DayView'
import { DAY_PATTERN, formatDayLong, logicalDay } from '@/lib/day'
import { requireSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ date: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { date } = await params
  return { title: DAY_PATTERN.test(date) ? formatDayLong(date) : '日記' }
}

export default async function JournalDayPage({ params }: Params) {
  const { date } = await params
  if (!DAY_PATTERN.test(date) || Number.isNaN(Date.parse(date))) notFound()
  const session = await requireSession(`/journal/day/${date}`)
  const today = logicalDay()
  if (date === today) redirect('/')
  return <DayView session={session} day={date} today={today} />
}
