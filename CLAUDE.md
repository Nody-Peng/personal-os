# Personal OS

Single-owner personal platform (daily check-ins, TOEFL progress, learning backlog). Product spec: `docs/SPEC.md` (Traditional Chinese). UI copy is Traditional Chinese.

## Stack & commands

- Next.js 16 App Router + Payload 3 embedded + Postgres (`@payloadcms/db-postgres`), Tailwind v4, Phosphor icons. Deploy: Vercel + Supabase.
- Local DB: `npm run db:local` (embedded Postgres on 54322). Dev: `npm run dev`. Tests: `npm run test:int` (needs local DB). Also `npm run lint`, `npx tsc --noEmit`.
- Payload reference: `.claude/skills/payload/SKILL.md`.

## Conventions

- **Days** are Taiwan-local `YYYY-MM-DD` strings with a **04:00 day boundary** (`src/lib/day.ts`, `logicalDay()`); never use `Date` objects or Payload `date` fields for days.
- **Access**: every private collection uses `authenticated`. Frontend pages call `requireSession(path)`; server actions call `requireActionSession()` and pass `user` + `overrideAccess: false` to the Local API.
- Server actions live in `src/app/(frontend)/actions.ts`, whitelist and clamp every input, and return `ActionResult`.
- Option lists shared by schema and UI are in `src/lib/options.ts`.
- **Journal**: daily IMPORTANT items (max 3/day) and weekly to-dos are one `tasks` collection (`src/lib/tasks.ts`); unfinished IMPORTANT items are migrated with `moveTaskToNextDay` (original keeps status `migrated`). Journal server actions live in `src/app/(frontend)/journal-actions.ts`.
- **Rich text** (task bodies, daily note, week/month reviews) is BlockNote JSON stored in Payload `json` fields, edited with `components/editor/BlockEditor` (client-only, autosaves). Use `lib/blocks.ts` to read plain text.
- The task side panel is URL-driven (`?task=<id>`, `lib/useTaskPeek.ts`); the month calendar opens week notes with `?week=<monday>`.
- **TOEFL scores use the new (Jan 2026) scale only**: sections 1–6 in 0.5 steps, overall = average of four sections rounded to nearest 0.5, computed in the `toefl-scores` hook. All scoring logic and the ETS concordance (CEFR, old 0–120 range) live in `src/lib/toefl.ts`; never store 0–120 scores.
- **Schema changes**: run `npm run generate:types`, then `npm run payload migrate:create <name>` and commit `src/migrations/*` (production applies them via `prodMigrations`).
- **Design**: follow `.claude/skills/minimalist-ui` (warm monochrome, 1px `#EAEAEA`-style borders, radius 8/12, one accent `--color-accent` for interaction and chart marks, pastel pairs only for small semantic tags). Tokens are in `src/app/(frontend)/styles.css`. Charts follow the dataviz rules: hand-rolled SVG at real pixel width (`useElementWidth`), hover tooltips, text never in series color.
