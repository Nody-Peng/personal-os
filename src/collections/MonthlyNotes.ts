import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'

export const MonthlyNotes: CollectionConfig = {
  slug: 'monthly-notes',
  labels: { singular: '月統整', plural: '月統整' },
  admin: {
    useAsTitle: 'month',
    defaultColumns: ['month', 'updatedAt'],
  },
  defaultSort: '-month',
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: 'month',
      label: '月份',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'YYYY-MM' },
      validate: (value: string | null | undefined) =>
        (typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)) || '請用 YYYY-MM 格式',
    },
    {
      name: 'review',
      label: '月統整',
      type: 'json',
      admin: { description: 'Notion 式編輯器的區塊資料（在前台編輯）' },
    },
  ],
}
