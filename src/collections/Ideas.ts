import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'
import { IDEA_STATUSES } from '@/lib/options'

const scoreField = (name: string, label: string, description: string) => ({
  name,
  label,
  type: 'number' as const,
  min: 0,
  max: 3,
  defaultValue: 0,
  admin: { description },
})

export const Ideas: CollectionConfig = {
  slug: 'ideas',
  labels: { singular: '想學清單', plural: '想學清單' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'total', 'status', 'createdAt'],
  },
  defaultSort: '-total',
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    { name: 'title', label: '想學什麼', type: 'text', required: true },
    { name: 'why', label: '為什麼想學', type: 'text' },
    scoreField('scoreGoal', '目標', '對托福、工作或長期目標的幫助（0–3）'),
    scoreField('scoreUrgency', '急迫', '有沒有時間壓力（0–3）'),
    scoreField('scorePassion', '熱情', '現在有多想學（0–3）'),
    {
      name: 'total',
      label: '總分',
      type: 'number',
      index: true,
      admin: { readOnly: true, description: '自動計算' },
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      required: true,
      defaultValue: 'inbox',
      index: true,
      options: [...IDEA_STATUSES],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        const pick = (key: 'scoreGoal' | 'scoreUrgency' | 'scorePassion') =>
          Number(data[key] ?? originalDoc?.[key] ?? 0)
        data.total = pick('scoreGoal') + pick('scoreUrgency') + pick('scorePassion')
        return data
      },
    ],
    afterChange: [
      // Only one idea can be "this week's theme" at a time.
      async ({ doc, previousDoc, req, context }) => {
        if (context.skipThemeSync) return doc
        if (doc.status !== 'selected' || previousDoc?.status === 'selected') return doc
        await req.payload.update({
          collection: 'ideas',
          where: { and: [{ status: { equals: 'selected' } }, { id: { not_equals: doc.id } }] },
          data: { status: 'inbox' },
          context: { skipThemeSync: true },
          req,
        })
        return doc
      },
    ],
  },
}
