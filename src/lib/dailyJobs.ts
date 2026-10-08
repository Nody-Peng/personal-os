import 'server-only'
import type { CollectionSlug, Payload } from 'payload'
import { TRASH_DAYS } from './notes'

// Housekeeping run once a day by Vercel Cron (api/cron/daily). Its queries
// also count as database activity, which keeps a free Supabase project from
// being paused after a quiet week.
//   1. Pages in the trash longer than TRASH_DAYS are deleted for good
//      (opening a notebook's trash did this only for that notebook).
//   2. Page snapshots left without their page are removed.
//   3. Uploaded files nothing refers to any more are marked, and deleted
//      (from Supabase Storage too) once they've stayed unused for a week, so
//      an image cut and pasted back days later still works.

const DAY = 86_400_000
const UNUSED_DAYS = 7
const PAGE_SIZE = 200
const MEDIA_URL = /\/api\/media\/file\/([^"'\s?#)\\]+)/g
// Never read for references: the files themselves and Payload's own records.
const SKIP = new Set<string>(['media', 'users', 'payload-locked-documents', 'payload-preferences', 'payload-migrations'])

export type DailyReport = { pagesPurged: number; snapshotsRemoved: number; mediaMarked: number; mediaKept: number; mediaDeleted: number }

/** Every uploaded file name mentioned anywhere (trashed pages and snapshots included). */
async function usedFiles(payload: Payload): Promise<Set<string>> {
  const used = new Set<string>()
  const scan = (value: unknown) => {
    for (const [, name] of JSON.stringify(value).matchAll(MEDIA_URL)) {
      used.add(name)
      try {
        used.add(decodeURIComponent(name))
      } catch {
        // Not URL-encoded after all.
      }
    }
  }
  for (const { slug } of payload.config.collections) {
    if (SKIP.has(slug)) continue
    for (let page = 1; ; page++) {
      const result = await payload.find({ collection: slug as CollectionSlug, depth: 0, limit: PAGE_SIZE, page, trash: true })
      scan(result.docs)
      if (!result.hasNextPage) break
    }
  }
  for (const { slug } of payload.config.globals) scan(await payload.findGlobal({ slug: slug as never, depth: 0 }))
  return used
}

export async function runDailyJobs(payload: Payload, now = new Date()): Promise<DailyReport> {
  const report: DailyReport = { pagesPurged: 0, snapshotsRemoved: 0, mediaMarked: 0, mediaKept: 0, mediaDeleted: 0 }

  const trashCutoff = new Date(now.getTime() - TRASH_DAYS * DAY).toISOString()
  const purged = await payload.delete({ collection: 'note-pages', where: { deletedAt: { less_than: trashCutoff } }, trash: true, depth: 0 })
  report.pagesPurged = purged.docs.length

  const orphans = await payload.delete({ collection: 'page-snapshots', where: { page: { exists: false } }, depth: 0 })
  report.snapshotsRemoved = orphans.docs.length

  const used = await usedFiles(payload)
  const unusedCutoff = now.getTime() - UNUSED_DAYS * DAY
  const media = await payload.find({ collection: 'media', pagination: false, depth: 0, select: { filename: true, unusedSince: true } })
  for (const file of media.docs) {
    const inUse = file.filename != null && used.has(file.filename)
    if (inUse) {
      if (file.unusedSince) {
        await payload.update({ collection: 'media', id: file.id, data: { unusedSince: null }, depth: 0 })
        report.mediaKept++
      }
    } else if (!file.unusedSince) {
      await payload.update({ collection: 'media', id: file.id, data: { unusedSince: now.toISOString() }, depth: 0 })
      report.mediaMarked++
    } else if (Date.parse(file.unusedSince) < unusedCutoff) {
      await payload.delete({ collection: 'media', id: file.id, depth: 0 })
      report.mediaDeleted++
    }
  }
  return report
}
