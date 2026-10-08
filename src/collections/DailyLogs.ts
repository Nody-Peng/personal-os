import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'
import { dayField } from '@/fields/dayField'
import { searchTextField, searchTextHook } from '@/fields/searchText'
import { TOEFL_SKILLS } from '@/lib/options'
import { dayLogText } from '@/lib/searchText'

export const DailyLogs: CollectionConfig = {
  slug: 'daily-logs',
  labels: { singular: '每日紀錄', plural: '每日紀錄' },
  admin: {
    useAsTitle: 'date',
    defaultColumns: ['date', 'toeflMinutes', 'habitsDone', 'energy'],
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
    {
      name: 'habitsDone',
      label: '完成的每日習慣',
      type: 'relationship',
      relationTo: 'habits',
      hasMany: true,
    },
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
    // 早 / 午 / 晚 checklists: [{ id, text, done }] (lib/dayParts.ts).
    { name: 'morningItems', label: '早', type: 'json' },
    { name: 'noonItems', label: '午', type: 'json' },
    { name: 'eveningItems', label: '晚', type: 'json' },
    {
      name: 'note',
      label: 'Note（反思）',
      type: 'json',
      admin: { description: 'Notion 式編輯器的區塊資料（在前台編輯）' },
    },
    searchTextField,
  ],
  hooks: {
    beforeChange: [searchTextHook(['note', 'morningItems', 'noonItems', 'eveningItems'], dayLogText)],
  },
}
