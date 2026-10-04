'use client'

import type { HabitItem } from '@/lib/habits'
import { useDayLog } from './DayLogProvider'
import { WeekStrip, type WeekDay } from './WeekStrip'

/** The week summary, with the open day's taps reflected immediately. */
export function LiveWeekStrip({ days, habits, toeflHoursTarget }: { days: WeekDay[]; habits: HabitItem[]; toeflHoursTarget: number }) {
  const { day, log } = useDayLog()
  const live = days.map((d) => (d.date === day ? { ...d, habitsDone: log.habitsDone, toeflMinutes: log.toeflMinutes } : d))
  return <WeekStrip days={live} today={day} habits={habits} toeflHoursTarget={toeflHoursTarget} />
}
