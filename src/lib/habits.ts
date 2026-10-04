// Daily habits: a short, editable list (at most four active) of things to
// tick off every day, e.g. morning listening, gym, 2000 ml of water.

export const MAX_ACTIVE_HABITS = 4

/** Icon keys stored on a habit; mapped to Phosphor icons in HabitIcon. */
export const HABIT_ICONS = [
  { label: '耳機', value: 'headphones' },
  { label: '啞鈴', value: 'barbell' },
  { label: '水滴', value: 'drop' },
  { label: '書本', value: 'book' },
  { label: '跑步', value: 'run' },
  { label: '月亮', value: 'moon' },
  { label: '冥想', value: 'leaf' },
  { label: '藥丸', value: 'pill' },
  { label: '筆', value: 'pencil' },
  { label: '打勾', value: 'check' },
] as const
export type HabitIconKey = (typeof HABIT_ICONS)[number]['value']

/** What the UI needs to show a habit. */
export type HabitItem = {
  id: number
  name: string
  icon: HabitIconKey
  weeklyTarget: number
  active: boolean
}
