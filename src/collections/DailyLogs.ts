import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'
import { dayField } from '@/fields/dayField'
import { TOEFL_SKILLS } from '@/lib/options'

export const DailyLogs: CollectionConfig = {
  slug: 'daily-logs',
  labels: { singular: '每日紀錄', plural: '每日紀錄' },
  admin: {
    useAsTitle: 'date',
    defaultColumns: ['date', 'toeflMinutes', 'gym', 'morningListening', 'energy'],
  },
  defaultSort: '-date',
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    dayField({ name: 'date', label: '日期', unique: true }),
    { name: 'morningListening', label: '早上聽英文', type: 'checkbox', defaultValue: false },
    { name: 'gym', label: '健身', type: 'checkbox', defaultValue: false },
    { name: 'toeflMinutes', label: '托福分鐘數', type: 'number', min: 0, defaultValue: 0 },
    {
      name: 'toeflSkills',
      label: '托福科目',
      type: 'select',
      hasMany: true,
      options: [...TOEFL_SKILLS],
    },
    { name: 'themeMinutes', label: '本週主題分鐘數', type: 'number', min: 0, defaultValue: 0 },
    { name: 'energy', label: '精力（1–5）', type: 'number', min: 1, max: 5 },
    { name: 'notes', label: '三行筆記', type: 'textarea' },
    { name: 'tomorrowTop1', label: '明天最重要的一件事', type: 'text' },
  ],
}
