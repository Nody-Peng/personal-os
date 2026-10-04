import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'
import { HABIT_ICONS, MAX_ACTIVE_HABITS } from '@/lib/habits'

// Archived habits (active=false) disappear from the day page but keep their
// history, so changing your habits never rewrites past weeks.
export const Habits: CollectionConfig = {
  slug: 'habits',
  labels: { singular: '每日習慣', plural: '每日習慣' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'weeklyTarget', 'active', 'position'],
  },
  defaultSort: 'position',
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    { name: 'name', label: '名稱', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'icon', label: '圖示', type: 'select', required: true, defaultValue: 'check', options: [...HABIT_ICONS] },
        { name: 'weeklyTarget', label: '每週目標（天）', type: 'number', required: true, min: 1, max: 7, defaultValue: 7 },
        { name: 'position', label: '排序', type: 'number', defaultValue: 0 },
      ],
    },
    { name: 'active', label: '使用中', type: 'checkbox', defaultValue: true, index: true },
  ],
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        // Only a new active habit, or re-activating an archived one, takes a slot.
        const becomingActive = (data.active ?? originalDoc?.active ?? true) && !originalDoc?.active
        if (!becomingActive) return data
        const { totalDocs } = await req.payload.count({
          collection: 'habits',
          where: { active: { equals: true } },
          req,
        })
        if (totalDocs >= MAX_ACTIVE_HABITS) throw new Error(`每日習慣最多 ${MAX_ACTIVE_HABITS} 項，請先封存一項`)
        return data
      },
    ],
  },
}
