import type { Metadata } from 'next'
import { DayView } from '@/components/day/DayView'
import { logicalDay } from '@/lib/day'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: '今天' }
export const dynamic = 'force-dynamic'

export default async function TodayPage() {
  const session = await requireSession('/')
  const today = logicalDay()
  return <DayView session={session} day={today} today={today} />
}
