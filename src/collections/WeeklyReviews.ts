import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'
import { dayField } from '@/fields/dayField'

// MVP keeps this editable in /admin only; the review page arrives in v2.
export const WeeklyReviews: CollectionConfig = {
  slug: 'weekly-reviews',
  labels: { singular: '週回顧', plural: '週回顧' },
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
    { name: 'reflection', label: '反思：哪一天斷掉、原因是什麼', type: 'textarea' },
    { name: 'nextTheme', label: '下週主題', type: 'relationship', relationTo: 'ideas' },
    { name: 'themeReason', label: '選擇原因', type: 'textarea' },
    {
      name: 'keyResults',
      label: '下週 3 個關鍵成果',
      type: 'array',
      maxRows: 3,
      fields: [
        { name: 'text', label: '成果', type: 'text', required: true },
        { name: 'done', label: '完成', type: 'checkbox', defaultValue: false },
      ],
    },
  ],
}
