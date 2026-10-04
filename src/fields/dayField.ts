import type { TextField } from 'payload'
import { DAY_PATTERN } from '@/lib/day'

/** A Taiwan-local calendar day stored as YYYY-MM-DD text (see lib/day.ts). */
export function dayField(overrides: Partial<TextField> & Pick<TextField, 'name'>): TextField {
  return {
    type: 'text',
    required: true,
    index: true,
    admin: { description: 'YYYY-MM-DD（台灣時間）' },
    validate: (value: string | null | undefined) =>
      (typeof value === 'string' && DAY_PATTERN.test(value)) || '請用 YYYY-MM-DD 格式',
    ...overrides,
  } as TextField
}
