import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'

// Categories for e-books (/books). A book can sit on several shelves
// (books.shelves); deleting a shelf leaves its books in the library.
export const BookShelves: CollectionConfig = {
  slug: 'book-shelves',
  labels: { singular: '書櫃分類', plural: '書櫃分類' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'position'] },
  defaultSort: 'position',
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    { name: 'name', label: '名稱', type: 'text', required: true, maxLength: 40 },
    { name: 'position', label: '順序', type: 'number', defaultValue: 0, index: true },
  ],
}
