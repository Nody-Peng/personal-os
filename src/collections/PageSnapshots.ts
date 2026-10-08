import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'

// Earlier versions of a notebook page (its ••• menu → 版本紀錄). Saving a page
// keeps the content it replaces when the last snapshot is old enough
// (notebook-actions.ts, SNAPSHOT_EVERY); restoring keeps the current one too.
export const PageSnapshots: CollectionConfig = {
  slug: 'page-snapshots',
  labels: { singular: '頁面版本', plural: '頁面版本' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'page', 'createdAt'] },
  defaultSort: '-createdAt',
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    // Not required: a page deleted for good leaves its snapshots without one, and the daily cleanup removes them.
    { name: 'page', label: '頁面', type: 'relationship', relationTo: 'note-pages', index: true },
    { name: 'title', label: '標題', type: 'text' },
    { name: 'content', label: '內容', type: 'json' },
  ],
}
