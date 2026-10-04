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
  fields: [{ name: 'alt', label: '說明', type: 'text' }],
}
