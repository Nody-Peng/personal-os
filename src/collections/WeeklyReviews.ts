import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'
import { dayField } from '@/fields/dayField'

// The Sunday half of a week note. The week's to-dos are `tasks` with
// kind=weekly and the same weekStart.
export const WeeklyReviews: CollectionConfig = {
  slug: 'weekly-reviews',
  labels: { singular: '週筆記', plural: '週筆記' },
  admin: {
    useAsTitle: 'weekStart',
    defaultColumns: ['weekStart', 'nextTheme', 'updatedAt'],
  },
  defaultSort: '-weekStart',
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    dayField({
      name: 'weekStart',
      label: '週一日期',
      unique: true,
      admin: { description: '該週的週一，YYYY-MM-DD' },
    }),
    {
      name: 'review',
      label: '週日統整',
      type: 'json',
      admin: { description: 'Notion 式編輯器的區塊資料（在前台編輯）' },
    },
    { name: 'nextTheme', label: '下週主題', type: 'relationship', relationTo: 'ideas' },
    { name: 'themeReason', label: '選擇原因', type: 'textarea' },
  ],
}
