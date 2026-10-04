import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'

export const COVER_COLORS = [
  { label: '深藍', value: 'navy' },
  { label: '墨綠', value: 'forest' },
  { label: '酒紅', value: 'burgundy' },
  { label: '炭灰', value: 'charcoal' },
] as const
export type CoverColor = (typeof COVER_COLORS)[number]['value']

// One hardcover book per year on the bookshelf.
export const Journals: CollectionConfig = {
  slug: 'journals',
  labels: { singular: '日記本', plural: '日記本' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['year', 'title', 'coverColor'],
  },
  defaultSort: '-year',
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    { name: 'year', label: '年份', type: 'number', required: true, unique: true, index: true, min: 2000, max: 2100 },
    { name: 'title', label: '書名', type: 'text', required: true },
    { name: 'subtitle', label: '副標', type: 'text' },
    { name: 'coverColor', label: '封面顏色', type: 'select', required: true, defaultValue: 'navy', options: [...COVER_COLORS] },
  ],
}
