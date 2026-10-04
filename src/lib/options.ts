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
