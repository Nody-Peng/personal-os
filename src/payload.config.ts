import { postgresAdapter } from '@payloadcms/db-postgres'
import { s3Storage } from '@payloadcms/storage-s3'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { en } from '@payloadcms/translations/languages/en'
import { zhTw } from '@payloadcms/translations/languages/zhTw'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { DailyLogs } from './collections/DailyLogs'
import { Habits } from './collections/Habits'
import { Ideas } from './collections/Ideas'
import { Journals } from './collections/Journals'
import { MAX_UPLOAD_BYTES, Media } from './collections/Media'
import { MonthlyNotes } from './collections/MonthlyNotes'
import { NotePages } from './collections/NotePages'
import { Notebooks } from './collections/Notebooks'
import { Tasks } from './collections/Tasks'
import { ToeflScores } from './collections/ToeflScores'
import { Users } from './collections/Users'
import { WeeklyReviews } from './collections/WeeklyReviews'
import { Settings } from './globals/Settings'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' · Personal OS',
    },
  },
  i18n: {
    fallbackLanguage: 'zh-TW',
    supportedLanguages: { 'zh-TW': zhTw, en },
  },
  collections: [DailyLogs, Tasks, Habits, WeeklyReviews, MonthlyNotes, Journals, Notebooks, NotePages, Media, ToeflScores, Ideas, Users],
  globals: [Settings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // Development pushes schema changes directly; production (Supabase) only
    // changes through migrations, applied automatically on startup.
    // After a schema change: npm run payload migrate:create <name>
    prodMigrations: migrations,
  }),
  sharp,
  upload: { limits: { fileSize: MAX_UPLOAD_BYTES } },
  plugins: [
    // Production stores media in a private Supabase Storage bucket (S3 API).
    // Without S3_BUCKET (local development) files go to ./media. The plugin is
    // always registered so the database schema is the same either way.
    s3Storage({
      enabled: Boolean(process.env.S3_BUCKET),
      alwaysInsertFields: true,
      collections: { media: { signedDownloads: { shouldUseSignedURL: () => true } } },
      bucket: process.env.S3_BUCKET ?? '',
      // Browsers upload straight to the bucket, so files can exceed Vercel's 4.5 MB body limit.
      clientUploads: true,
      config: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION,
        forcePathStyle: true,
        // S3-compatible services (Supabase) don't all accept the SDK's default checksum headers.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
        },
      },
    }),
  ],
})
