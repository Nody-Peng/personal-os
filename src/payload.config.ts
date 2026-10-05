import { postgresAdapter, sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { s3Storage } from '@payloadcms/storage-s3'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { en } from '@payloadcms/translations/languages/en'
import { zhTw } from '@payloadcms/translations/languages/zhTw'
import path from 'path'
import { buildConfig, type Payload } from 'payload'
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

/** "example.com" or "https://example.com/" -> "https://example.com"; undefined when empty or invalid. */
function toOrigin(value: string | undefined): string | undefined {
  const v = value?.trim()
  if (!v) return undefined
  try {
    return new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`).origin
  } catch {
    return undefined
  }
}

// Origins whose requests may use the login cookie (Payload's CSRF allowlist:
// a request whose Origin isn't listed is treated as logged out). It is opt-in:
// only once NEXT_PUBLIC_SERVER_URL names the site's address(es), plus the
// Vercel host names (given without a scheme) and localhost in development.
// Without it the list stays empty, Payload's default: the explicit SameSite=Lax
// cookie and Next's own Origin check on server actions already stop
// cross-site writes, and a guessed list would make saves from an unlisted
// domain (a www variant, a second alias) silently look logged out.
// serverURL stays unset on purpose: it would turn media URLs into absolute
// ones, and the app relies on relative /api/media/file/... URLs.
const configuredOrigins = (process.env.NEXT_PUBLIC_SERVER_URL ?? '').split(',').map(toOrigin)
const allowedOrigins = configuredOrigins.some(Boolean)
  ? [
      ...configuredOrigins,
      ...[process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL].map(toOrigin),
      ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000']),
    ].filter((origin): origin is string => Boolean(origin))
  : []

/**
 * Supabase's Data API (PostgREST) exposes the public schema to anyone holding
 * the anon key. Row level security with no policies shuts that out, while
 * Payload connects as the table owner and bypasses RLS. Runs at every
 * production boot after the migrations, so tables added later are covered too.
 */
async function enableRowLevelSecurity(payload: Payload): Promise<void> {
  const { drizzle } = payload.db as unknown as PostgresAdapter
  try {
    await drizzle.execute(sql`
      DO $$
      DECLARE t record;
      BEGIN
        FOR t IN
          SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
        LOOP
          BEGIN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
          EXCEPTION WHEN insufficient_privilege THEN
            RAISE WARNING 'Could not enable RLS on public.%: %', t.relname, SQLERRM;
          END;
        END LOOP;
      END $$;
    `)
    const { rows } = await drizzle.execute(sql`
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
    `)
    if (rows.length) {
      payload.logger.warn(`Row level security is still off for: ${rows.map((r) => r.relname).join(', ')}`)
    }
  } catch (err) {
    // Don't take the site down over this; the Data API can also be turned off in Supabase.
    payload.logger.error({ err, msg: 'Could not enable row level security' })
  }
}

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
  csrf: [...new Set(allowedOrigins)],
  // Development uses schema push, which must not be disturbed.
  onInit: async (payload) => {
    if (process.env.NODE_ENV === 'production') await enableRowLevelSecurity(payload)
  },
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
