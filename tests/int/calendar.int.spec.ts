import { describe, expect, it } from 'vitest'
import { layoutWeekBars } from '@/lib/calendar'
import { addMonths, daysInMonth, isoWeek, monthWeeks } from '@/lib/day'

describe('month helpers', () => {
  it('moves across years', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })

  it('knows month lengths', () => {
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
    expect(daysInMonth('2026-10')).toBe(31)
  })

  it('lists the Monday of every week touching the month', () => {
    // October 2026 starts on a Thursday and ends on a Saturday.
    expect(monthWeeks('2026-10')).toEqual(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'])
  })

  it('numbers ISO weeks', () => {
    expect(isoWeek('2026-10-05')).toBe(41)
    expect(isoWeek('2027-01-01')).toBe(53) // still week 53 of 2026
  })
})

describe('layoutWeekBars', () => {
  const monday = '2026-10-05'

  it('clips bars to the week and marks continuations', () => {
    const [bar] = layoutWeekBars(monday, [{ id: 1, startDate: '2026-10-01', endDate: '2026-10-07' }])
    expect(bar).toMatchObject({ startCol: 0, endCol: 2, lane: 0, continuesBefore: true, continuesAfter: false })
  })

  it('stacks overlapping bars and reuses free lanes', () => {
    const bars = layoutWeekBars(monday, [
      { id: 1, startDate: '2026-10-05', endDate: '2026-10-08' },
      { id: 2, startDate: '2026-10-07', endDate: '2026-10-09' },
      { id: 3, startDate: '2026-10-09', endDate: '2026-10-11' },
    ])
    const lane = (id: number) => bars.find((b) => b.item.id === id)?.lane
    expect(lane(1)).toBe(0)
    expect(lane(2)).toBe(1)
    expect(lane(3)).toBe(0)
  })

  it('ignores items outside the week', () => {
    expect(layoutWeekBars(monday, [{ id: 1, startDate: '2026-10-12', endDate: '2026-10-13' }])).toEqual([])
  })
})
