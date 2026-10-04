'use client'

import { useDayLog } from './DayLogProvider'
import { WeekStrip, type WeekDay } from './WeekStrip'

/** The week summary, with the open day's taps reflected immediately. */
export function LiveWeekStrip({ days, targets }: { days: WeekDay[]; targets: { toeflHours: number; gym: number } }) {
  const { day, log } = useDayLog()
  const live = days.map((d) =>
    d.date === day ? { ...d, listening: log.morningListening, gym: log.gym, toeflMinutes: log.toeflMinutes } : d,
  )
  return <WeekStrip days={live} today={day} targets={targets} />
}
