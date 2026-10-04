import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'
import { MAX_NOTEBOOK_TITLE } from '@/lib/notes'
import { COVER_COLORS, COVER_PATTERNS, selectOptions } from '@/lib/options'

// Notebooks on the bookshelf; each holds a tree of note-pages.
export const Notebooks: CollectionConfig = {
  slug: 'notebooks',
  labels: { singular: '筆記本', plural: '筆記本' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'coverColor', 'pattern', 'archived'],
  },
  defaultSort: 'position',
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    { name: 'title', label: '名稱', type: 'text', required: true, maxLength: MAX_NOTEBOOK_TITLE },
    {
      type: 'row',
      fields: [
        { name: 'coverColor', label: '封面顏色', type: 'select', required: true, defaultValue: 'navy', options: selectOptions(COVER_COLORS) },
        { name: 'pattern', label: '花紋', type: 'select', required: true, defaultValue: 'cloth', options: selectOptions(COVER_PATTERNS) },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'position', label: '排序', type: 'number', defaultValue: 0 },
        { name: 'archived', label: '已封存', type: 'checkbox', defaultValue: false, index: true },
      ],
    },
  ],
  hooks: {
    // Pages can't outlive their notebook (trashed ones included).
    beforeDelete: [
      async ({ id, req }) => {
        await req.payload.delete({ collection: 'note-pages', where: { notebook: { equals: id } }, trash: true, req })
      },
    ],
  },
}
