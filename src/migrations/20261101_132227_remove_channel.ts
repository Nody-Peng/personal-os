import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
import { weekText } from '@/lib/searchText'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "weekly_reviews" DROP COLUMN "channel";
  ALTER TABLE "weekly_reviews" DROP COLUMN "channel_note";`)

  // Week notes' search text loses the channel's notes. Written straight to the
  // column so `updatedAt` stays as it was.
  const { docs } = await payload.find({ collection: 'weekly-reviews', pagination: false, depth: 0, req })
  for (const doc of docs) {
    const text = weekText(doc as unknown as Record<string, unknown>) || null
    if (text !== (doc.plainText || null)) await db.execute(sql`UPDATE "weekly_reviews" SET "plain_text" = ${text} WHERE "id" = ${doc.id}`)
  }
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "weekly_reviews" ADD COLUMN "channel" jsonb;
  ALTER TABLE "weekly_reviews" ADD COLUMN "channel_note" jsonb;`)
}
