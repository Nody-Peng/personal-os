'use client'

import type { HabitItem } from '@/lib/habits'
import { useDayLog } from './DayLogProvider'
import { WeekStrip, type WeekDay } from './WeekStrip'

/** The week summary, with the open day's taps reflected immediately. */
export function LiveWeekStrip({ days, habits }: { days: WeekDay[]; habits: HabitItem[] }) {
  const { day, log } = useDayLog()
  const live = days.map((d) => (d.date === day ? { ...d, habitsDone: log.habitsDone } : d))
  return <WeekStrip days={live} today={day} habits={habits} />
}
