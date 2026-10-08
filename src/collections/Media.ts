import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'

/** Largest upload (Supabase Storage's free plan caps a file at 50 MB). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

// Images, video, audio and files in notes. Private: files are served through
// /api/media/file/<name>, which checks the login (and in production redirects
// to a short-lived signed Supabase Storage URL).
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: '檔案', plural: '檔案' },
  admin: { useAsTitle: 'filename', defaultColumns: ['filename', 'mimeType', 'filesize', 'createdAt'] },
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  upload: {
    staticDir: 'media',
    mimeTypes: [
      'image/*',
      'video/*',
      'audio/*',
      'application/pdf',
      'text/plain',
      'text/csv',
      'text/markdown',
      'application/zip',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.*',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint',
    ],
  },
  fields: [
    { name: 'alt', label: '說明', type: 'text' },
    // Set by the daily cleanup (lib/dailyJobs.ts) while nothing uses the file; it is
    // deleted once it has stayed unused for a while, cleared if it is used again.
    {
      name: 'unusedSince',
      label: '沒被使用的起始時間',
      type: 'date',
      index: true,
      admin: { readOnly: true, position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } },
    },
  ],
}
