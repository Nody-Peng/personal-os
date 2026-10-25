import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "weekly_reviews" ADD COLUMN "channel" jsonb;
  ALTER TABLE "weekly_reviews" ADD COLUMN "channel_note" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "weekly_reviews" DROP COLUMN "channel";
  ALTER TABLE "weekly_reviews" DROP COLUMN "channel_note";`)
}
