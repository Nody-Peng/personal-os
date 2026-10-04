import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'
import { COVER_COLORS, COVER_PATTERNS, selectOptions } from '@/lib/options'

// One hardcover book per year on the bookshelf.
export const Journals: CollectionConfig = {
  slug: 'journals',
  labels: { singular: '日記本', plural: '日記本' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['year', 'title', 'coverColor', 'pattern'],
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
    {
      type: 'row',
      fields: [
        { name: 'coverColor', label: '封面顏色', type: 'select', required: true, defaultValue: 'navy', options: selectOptions(COVER_COLORS) },
        { name: 'pattern', label: '花紋', type: 'select', required: true, defaultValue: 'cloth', options: selectOptions(COVER_PATTERNS) },
      ],
    },
  ],
}
