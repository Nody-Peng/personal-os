// Starts a local Postgres for development (no Docker needed).
// Data lives in ./.local-db and survives restarts. Stop with Ctrl+C.
// Matching DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/personal_os
import EmbeddedPostgres from 'embedded-postgres'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const databaseDir = fileURLToPath(new URL('../.local-db', import.meta.url))
const port = Number(process.env.LOCAL_DB_PORT ?? 54322)

const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: true,
})

if (!existsSync(databaseDir)) await pg.initialise()
await pg.start()

try {
  await pg.createDatabase('personal_os')
} catch {
  // Already exists from an earlier run.
}

console.log(`Local Postgres ready on 127.0.0.1:${port} (database: personal_os)`)

const shutdown = async () => {
  await pg.stop()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
