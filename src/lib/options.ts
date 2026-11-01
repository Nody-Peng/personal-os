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

/** What a notebook page is a template for (set from its ••• menu): new pages, each day's note, each week's review. */
export const TEMPLATE_KINDS = [
  { label: '頁面範本', short: '頁面', value: 'page' },
  { label: '每日日記範本', short: '日記', value: 'day' },
  { label: '週回顧範本', short: '週回顧', value: 'week' },
] as const
export type TemplateKind = (typeof TEMPLATE_KINDS)[number]['value']

/** Kinds of notebook pages: a plain page, a board (todo database) and its items. */
export const PAGE_KINDS = [
  { label: '頁面', value: 'page' },
  { label: '看板', value: 'board' },
  { label: '看板項目', value: 'item' },
] as const
export type PageKind = (typeof PAGE_KINDS)[number]['value']

/** A notebook page's typeface (Notion's ••• → 預設 / 襯線 / 等寬). */
export const PAGE_FONTS = [
  { label: '預設', value: 'default' },
  { label: '襯線', value: 'serif' },
  { label: '等寬', value: 'mono' },
] as const
export type PageFont = (typeof PAGE_FONTS)[number]['value']

/** Board columns, in order. `tone` picks the pastel pair for the tag. */
export const ITEM_STATUSES = [
  { label: '未開始', value: 'todo', tone: 'gray' },
  { label: '進行中', value: 'doing', tone: 'blue' },
  { label: '完成', value: 'done', tone: 'green' },
  { label: '封存', value: 'archived', tone: 'gray' },
] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]['value']
