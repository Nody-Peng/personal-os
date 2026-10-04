import { postgresAdapter } from '@payloadcms/db-postgres'
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
  collections: [DailyLogs, Tasks, Habits, WeeklyReviews, MonthlyNotes, Journals, Notebooks, NotePages, ToeflScores, Ideas, Users],
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
  plugins: [],
})
