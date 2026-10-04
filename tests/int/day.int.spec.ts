import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, formatDayLong, logicalDay, weekStart, weekdayOf } from '@/lib/day'

// Taiwan is UTC+8 with no daylight saving, so a UTC instant pins the local time.
const taipei = (local: string) => new Date(`${local}+08:00`)

describe('logicalDay', () => {
  it('uses the Taiwan calendar day during the day', () => {
    expect(logicalDay(taipei('2026-10-05T09:00:00'))).toBe('2026-10-05')
    expect(logicalDay(taipei('2026-10-05T23:59:00'))).toBe('2026-10-05')
  })

  it('counts the hours after midnight as the previous evening', () => {
    expect(logicalDay(taipei('2026-10-06T00:30:00'))).toBe('2026-10-05')
    expect(logicalDay(taipei('2026-10-06T03:59:00'))).toBe('2026-10-05')
  })

  it('starts the new day at 04:00', () => {
    expect(logicalDay(taipei('2026-10-06T04:00:00'))).toBe('2026-10-06')
  })

  it('handles month and year boundaries', () => {
    expect(logicalDay(taipei('2027-01-01T01:00:00'))).toBe('2026-12-31')
  })
})

describe('day arithmetic', () => {
  it('adds days across months', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31')
  })

  it('counts days between', () => {
    expect(daysBetween('2026-10-05', '2027-01-04')).toBe(91)
  })

  it('finds the Monday of a week', () => {
    expect(weekStart('2026-10-04')).toBe('2026-09-28') // Sunday
    expect(weekStart('2026-10-05')).toBe('2026-10-05') // Monday
    expect(weekStart('2026-10-10')).toBe('2026-10-05') // Saturday
  })

  it('names weekdays', () => {
    expect(weekdayOf('2026-10-05')).toBe('mon')
    expect(formatDayLong('2026-10-04')).toBe('10月4日 週日')
  })
})
