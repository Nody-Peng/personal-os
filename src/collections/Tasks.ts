import type { CollectionConfig, TextField } from 'payload'
import { authenticated } from '@/access/authenticated'
import { dayField } from '@/fields/dayField'
import { MAX_IMPORTANT_PER_DAY, TASK_KINDS, TASK_STATUSES } from '@/lib/tasks'

const optionalDay = (name: string, label: string): TextField =>
  dayField({
    name,
    label,
    required: false,
    validate: (value: string | null | undefined) =>
      !value || /^\d{4}-\d{2}-\d{2}$/.test(value) || '請用 YYYY-MM-DD 格式',
  })

// One collection for both daily IMPORTANT items (kind=important, tied to a
// day, at most three) and weekly to-dos (kind=weekly, tied to a week).
export const Tasks: CollectionConfig = {
  slug: 'tasks',
  labels: { singular: '任務', plural: '任務' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'day', 'weekStart', 'status', 'dueDate'],
  },
  defaultSort: 'position',
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    { name: 'title', label: '標題', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'kind', label: '類型', type: 'select', required: true, index: true, options: [...TASK_KINDS] },
        { name: 'status', label: '狀態', type: 'select', required: true, defaultValue: 'todo', options: [...TASK_STATUSES] },
        { name: 'position', label: '排序', type: 'number', defaultValue: 0 },
      ],
    },
    {
      type: 'row',
      fields: [
        optionalDay('day', 'Important 的日期'),
        optionalDay('weekStart', '週待辦的週一'),
      ],
    },
    {
      type: 'row',
      fields: [
        optionalDay('dueDate', '到期日'),
        optionalDay('startDate', '期間開始'),
        optionalDay('endDate', '期間結束'),
      ],
    },
    {
      name: 'body',
      label: '細項內容',
      type: 'json',
      admin: { description: 'Notion 式編輯器的區塊資料（在前台編輯）' },
    },
    {
      name: 'migratedFrom',
      label: '從哪一天移過來',
      type: 'relationship',
      relationTo: 'tasks',
      admin: { readOnly: true },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        if (!data) return data
        const merged = { ...originalDoc, ...data }
        if (merged.kind === 'important' && !merged.day) throw new Error('Important 一定要有日期')
        if (merged.kind === 'weekly' && !merged.weekStart) throw new Error('週待辦一定要屬於某一週')
        if (Boolean(merged.startDate) !== Boolean(merged.endDate)) throw new Error('期間要同時設定開始和結束')
        if (merged.startDate && merged.endDate && merged.startDate > merged.endDate) {
          throw new Error('期間的開始不能晚於結束')
        }
        return data
      },
    ],
    beforeChange: [
      // Keep the day's list to three IMPORTANT items.
      async ({ data, originalDoc, operation, req }) => {
        const merged = { ...originalDoc, ...data }
        if (merged.kind !== 'important') return data
        const movingIn = operation === 'create' || merged.day !== originalDoc?.day
        if (!movingIn) return data
        const { totalDocs } = await req.payload.count({
          collection: 'tasks',
          where: {
            and: [
              { kind: { equals: 'important' } },
              { day: { equals: merged.day } },
              { status: { not_equals: 'migrated' } },
            ],
          },
          req,
        })
        if (totalDocs >= MAX_IMPORTANT_PER_DAY) {
          throw new Error(`${merged.day} 已經有 ${MAX_IMPORTANT_PER_DAY} 件 Important`)
        }
        return data
      },
    ],
  },
}
