import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'
import { cleanCoverUrl } from '@/lib/books'

// EPUB e-books (/books). Private like media: the file is served through
// /api/books/file/<name>, which checks the login (and in production redirects
// to a short-lived signed Supabase Storage URL). Title, author and cover are
// read from the EPUB in the browser when it is added (components/reader/importEpub).
export const Books: CollectionConfig = {
  slug: 'books',
  labels: { singular: '電子書', plural: '電子書' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'author', 'progress', 'lastReadAt'] },
  defaultSort: '-createdAt',
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  upload: {
    staticDir: 'books',
    mimeTypes: ['application/epub+zip'],
  },
  fields: [
    { name: 'title', label: '書名', type: 'text', required: true },
    { name: 'author', label: '作者', type: 'text' },
    { name: 'language', label: '語言', type: 'text', admin: { description: 'EPUB 標示的語言，例如 zh-TW、en' } },
    // A /api/media/file/<name> URL (not a relationship): the daily cleanup keeps
    // media that some document mentions by URL (lib/dailyJobs.ts).
    {
      name: 'coverUrl',
      label: '封面',
      type: 'text',
      validate: (value: string | null | undefined) => !value || cleanCoverUrl(value) !== null || '封面必須是上傳的圖片（/api/media/file/…）',
    },
    { name: 'cfi', label: '讀到的位置', type: 'text', admin: { readOnly: true, description: 'EPUB CFI' } },
    { name: 'progress', label: '進度', type: 'number', min: 0, max: 1, defaultValue: 0, admin: { readOnly: true } },
    { name: 'lastReadAt', label: '最後閱讀', type: 'date', index: true, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    // [{ cfi, label, createdAt }], see lib/books.ts
    { name: 'bookmarks', label: '書籤', type: 'json', admin: { readOnly: true } },
  ],
}
