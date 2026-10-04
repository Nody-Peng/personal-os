// TOEFL iBT scoring since 21 January 2026: each section is scored 1–6 in
// half-band steps; the overall score is the average of the four sections,
// rounded to the nearest half band (5.125 → 5, 5.25 → 5.5).
// Source: https://www.ets.org/toefl/institutions/ibt/score-scale-update.html

export const SECTIONS = [
  { label: '閱讀', value: 'reading' },
  { label: '聽力', value: 'listening' },
  { label: '口說', value: 'speaking' },
  { label: '寫作', value: 'writing' },
] as const
export type Section = (typeof SECTIONS)[number]['value']

export const BAND_MIN = 1
export const BAND_MAX = 6

/** 1, 1.5, … 6 */
export const BANDS = Array.from({ length: (BAND_MAX - BAND_MIN) * 2 + 1 }, (_, i) => BAND_MIN + i / 2)

export function isBand(value: unknown): value is number {
  return typeof value === 'number' && value >= BAND_MIN && value <= BAND_MAX && Number.isInteger(value * 2)
}

export function roundToHalfBand(value: number): number {
  return Math.round(value * 2) / 2
}

/** Overall band, or null unless all four sections are present. */
export function overallBand(sections: Partial<Record<Section, number | null | undefined>>): number | null {
  const values = SECTIONS.map(({ value }) => sections[value])
  if (!values.every(isBand)) return null
  return roundToHalfBand((values as number[]).reduce((a, b) => a + b, 0) / values.length)
}

// ETS concordance: CEFR level and the old 0–120 range for each overall band.
const CONCORDANCE: Record<string, { cefr: string; legacy: string }> = {
  '6': { cefr: 'C2', legacy: '114–120' },
  '5.5': { cefr: 'C1', legacy: '107–113' },
  '5': { cefr: 'C1', legacy: '95–106' },
  '4.5': { cefr: 'B2', legacy: '86–94' },
  '4': { cefr: 'B2', legacy: '72–85' },
  '3.5': { cefr: 'B1', legacy: '58–71' },
  '3': { cefr: 'B1', legacy: '44–57' },
  '2.5': { cefr: 'A2', legacy: '34–43' },
  '2': { cefr: 'A2', legacy: '24–33' },
  '1.5': { cefr: 'A1', legacy: '12–23' },
  '1': { cefr: 'A1', legacy: '0–11' },
}

export function cefrOf(band: number): string {
  return CONCORDANCE[String(band)]?.cefr ?? ''
}

/** Old 0–120 total range for an overall band, e.g. "95–106". */
export function legacyRangeOf(band: number): string {
  return CONCORDANCE[String(band)]?.legacy ?? ''
}

/** "5.0" — bands always show one decimal so 5 and 5.5 line up. */
export function formatBand(band: number | null | undefined): string {
  return band == null ? '—' : band.toFixed(1)
}
