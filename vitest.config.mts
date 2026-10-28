import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  // Server modules (lib/notebookOps, lib/mcp…) import 'server-only'; tests run them directly.
  resolve: { alias: { 'server-only': fileURLToPath(new URL('./tests/helpers/serverOnly.ts', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    // The files share one database. Run them one at a time so two files don't
    // both push the schema into an empty database (CREATE TYPE ... already exists).
    fileParallelism: false,
  },
})
