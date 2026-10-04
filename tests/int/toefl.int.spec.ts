import { describe, expect, it } from 'vitest'
import { BANDS, cefrOf, isBand, legacyRangeOf, overallBand, roundToHalfBand } from '@/lib/toefl'

describe('TOEFL 1–6 scoring', () => {
  it('lists every half band from 1 to 6', () => {
    expect(BANDS).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6])
  })

  it('accepts only half-band values', () => {
    expect(isBand(4.5)).toBe(true)
    expect(isBand(4.25)).toBe(false)
    expect(isBand(0.5)).toBe(false)
    expect(isBand(6.5)).toBe(false)
  })

  it('rounds to the nearest half band like ETS (5.125 → 5, 5.25 → 5.5)', () => {
    expect(roundToHalfBand(5.125)).toBe(5)
    expect(roundToHalfBand(5.25)).toBe(5.5)
    expect(roundToHalfBand(4.75)).toBe(5)
  })

  it('averages all four sections into the overall band', () => {
    expect(overallBand({ reading: 5, listening: 5.5, speaking: 4.5, writing: 4.5 })).toBe(5) // 4.875
    expect(overallBand({ reading: 4, listening: 4.5, speaking: 3.5, writing: 3.5 })).toBe(4) // 3.875
    expect(overallBand({ reading: 4, listening: 4, speaking: 4, writing: 5 })).toBe(4.5) // 4.25
  })

  it('has no overall band until every section is scored', () => {
    expect(overallBand({ reading: 5, listening: 5, speaking: 5 })).toBeNull()
    expect(overallBand({ reading: 5, listening: 5, speaking: 5, writing: null })).toBeNull()
  })

  it('maps bands to CEFR and the old 0–120 range', () => {
    expect(cefrOf(5)).toBe('C1')
    expect(legacyRangeOf(5)).toBe('95–106')
    expect(cefrOf(3.5)).toBe('B1')
    expect(legacyRangeOf(3.5)).toBe('58–71')
  })
})
