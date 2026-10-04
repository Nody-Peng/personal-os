// Option lists shared by the Payload schema and the frontend.

export const TOEFL_SKILLS = [
  { label: '口說', value: 'speaking' },
  { label: '寫作', value: 'writing' },
  { label: '閱讀', value: 'reading' },
  { label: '聽力', value: 'listening' },
  { label: '單字', value: 'vocab' },
] as const
export type ToeflSkill = (typeof TOEFL_SKILLS)[number]['value']

export const SCORE_TYPES = [
  { label: '單科小測驗', value: 'mini' },
  { label: '單科模考', value: 'section' },
  { label: '完整模考', value: 'full' },
  { label: '正式考試', value: 'official' },
] as const
export type ScoreType = (typeof SCORE_TYPES)[number]['value']

export const SCORE_SOURCES = [
  { label: 'ETS 官方', value: 'ets' },
  { label: '第三方', value: 'third-party' },
  { label: 'AI 估計', value: 'ai' },
] as const

export const IDEA_STATUSES = [
  { label: '收件匣', value: 'inbox' },
  { label: '本週主題', value: 'selected' },
  { label: '完成', value: 'done' },
  { label: '放棄', value: 'dropped' },
] as const
export type IdeaStatus = (typeof IDEA_STATUSES)[number]['value']

/** What each weekday's 22:00 TOEFL block is for. */
export const PLAN_SLOTS = [
  ...TOEFL_SKILLS,
  { label: '刻意練習', value: 'practice' },
  { label: '休息', value: 'rest' },
] as const
export type PlanSlot = (typeof PLAN_SLOTS)[number]['value']

export function labelOf<T extends { label: string; value: string }>(
  options: readonly T[],
  value: string | null | undefined,
): string {
  return options.find((o) => o.value === value)?.label ?? ''
}

/** Book covers on the bookshelf (journals and notebooks). Dark cloth so gold foil reads. */
export const COVER_COLORS = [
  { label: '深藍', value: 'navy', hex: '#1d2840' },
  { label: '墨綠', value: 'forest', hex: '#1f3a30' },
  { label: '酒紅', value: 'burgundy', hex: '#4b1d26' },
  { label: '炭灰', value: 'charcoal', hex: '#2a2a2d' },
  { label: '赭褐', value: 'umber', hex: '#4a3524' },
  { label: '灰藍', value: 'slate', hex: '#2c3b48' },
] as const
export type CoverColor = (typeof COVER_COLORS)[number]['value']

/** Cover patterns, all drawn in CSS (styles.css, `.book-cover[data-pattern]`). */
export const COVER_PATTERNS = [
  { label: '素面布紋', value: 'cloth' },
  { label: '格紋', value: 'plaid' },
  { label: '細條紋', value: 'pinstripe' },
  { label: '點點', value: 'dots' },
  { label: '大理石紋', value: 'marble' },
  { label: '菱格', value: 'diamond' },
] as const
export type CoverPattern = (typeof COVER_PATTERNS)[number]['value']

/** Payload select options (without the extra keys). */
export const selectOptions = (list: readonly { label: string; value: string }[]) =>
  list.map(({ label, value }) => ({ label, value }))
