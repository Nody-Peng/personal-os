import { describe, expect, it } from 'vitest'
import { MAX_BOOK_DAYS, bookQuery, daysOf, parseBookOptions } from '@/lib/journalPrint'
import { countImages, formatMinutes, periodStats, type StatDay } from '@/lib/journalStats'

const day = (date: string, patch: Partial<StatDay> = {}): StatDay => ({
  day: date,
  recorded: false,
  energy: null,
  habits: [],
  toeflMinutes: 0,
  themeMinutes: 0,
  tasksDone: 0,
  tasksTotal: 0,
  words: 0,
  photos: 0,
  ...patch,
})

describe('parseBookOptions', () => {
  it('reads what bookQuery writes', () => {
    const options = {
      from: '2026-01-01',
      to: '2026-06-30',
      title: '我的 2026',
      subtitle: '上半年',
      paper: 'dots',
      tone: 'white',
      size: 'a4',
      font: 'wenkai',
      blankDays: false,
      weekPages: true,
    } as const
    expect(parseBookOptions(Object.fromEntries(new URLSearchParams(bookQuery(options))))).toEqual(options)
  })

  it('needs real dates in order', () => {
    expect(parseBookOptions({ from: '2026-02-30', to: '2026-03-01' })).toBeNull()
    expect(parseBookOptions({ from: '2026-03-02', to: '2026-03-01' })).toBeNull()
    expect(parseBookOptions({ to: '2026-03-01' })).toBeNull()
  })

  it('falls back to the defaults for unknown choices and trims the title', () => {
    const o = parseBookOptions({ from: '2026-01-01', to: '2026-01-31', paper: 'grid', size: 'b5', font: 'comic', title: `  ${'長'.repeat(80)}  ` })
    expect(o).toMatchObject({ paper: 'lined', tone: 'cream', size: 'a5', font: 'iansui', blankDays: true, weekPages: true })
    expect(o?.title).toHaveLength(40)
  })

  it('cuts a range longer than a year and a day', () => {
    const o = parseBookOptions({ from: '2026-01-01', to: '2028-01-01' })
    expect(daysOf(o!.from, o!.to)).toHaveLength(MAX_BOOK_DAYS)
  })
})

describe('periodStats', () => {
  it('adds up a period and finds the longest run of recorded days', () => {
    const s = periodStats([
      day('2026-03-01', { recorded: true, energy: 4, habits: [1, 2], toeflMinutes: 30, tasksDone: 1, tasksTotal: 2, words: 10, photos: 1 }),
      day('2026-03-02', { recorded: true, energy: 2, habits: [1] }),
      day('2026-03-03'),
      day('2026-03-04', { recorded: true, themeMinutes: 20, tasksDone: 1, tasksTotal: 1 }),
    ])
    expect(s).toMatchObject({
      days: 4,
      recorded: 3,
      longestStreak: 2,
      importantDone: 2,
      importantTotal: 3,
      toeflMinutes: 30,
      themeMinutes: 20,
      energyAvg: 3,
      energyDays: 2,
      habitTicks: { 1: 2, 2: 1 },
      words: 10,
      photos: 1,
    })
  })

  it('has no average energy without scores', () => {
    expect(periodStats([day('2026-03-01')]).energyAvg).toBeNull()
  })
})

describe('helpers', () => {
  it('formats minutes and hours', () => {
    expect(formatMinutes(45)).toBe('45 分鐘')
    expect(formatMinutes(750)).toBe('12.5 小時')
  })

  it('counts pictures in nested blocks', () => {
    expect(countImages([{ type: 'image' }, { type: 'paragraph', children: [{ type: 'image' }, { type: 'image' }] }])).toBe(3)
    expect(countImages(null)).toBe(0)
  })
})
