// 早 / 午 / 晚: a small checklist for each part of the day. Day-only notes,
// so they are not counted anywhere.

export type PlanItem = { id: string; text: string; done: boolean }

export const DAY_PARTS = [
  { key: 'morningItems', label: '早' },
  { key: 'noonItems', label: '午' },
  { key: 'eveningItems', label: '晚' },
] as const
export type DayPartKey = (typeof DAY_PARTS)[number]['key']

export const MAX_PLAN_ITEMS = 30
export const MAX_PLAN_TEXT = 200

const ID = /^[A-Za-z0-9_-]{1,24}$/

export const newPlanItemId = () => Math.random().toString(36).slice(2, 10)

/** Whitelists a checklist from the client (or from stored JSON). */
export function cleanPlanItems(value: unknown): PlanItem[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === 'object')
    .map((v) => ({
      id: typeof v.id === 'string' && ID.test(v.id) ? v.id : newPlanItemId(),
      text: String(v.text ?? '').replace(/\s+/g, ' ').slice(0, MAX_PLAN_TEXT),
      done: v.done === true,
    }))
    .slice(0, MAX_PLAN_ITEMS)
}
