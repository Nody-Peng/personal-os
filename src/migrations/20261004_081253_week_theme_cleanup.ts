import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "weekly_reviews" DROP CONSTRAINT "weekly_reviews_next_theme_id_ideas_id_fk";
  
  DROP INDEX "weekly_reviews_next_theme_idx";
  ALTER TABLE "weekly_reviews" DROP COLUMN "next_theme_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "weekly_reviews" ADD COLUMN "next_theme_id" integer;
  ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_next_theme_id_ideas_id_fk" FOREIGN KEY ("next_theme_id") REFERENCES "public"."ideas"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "weekly_reviews_next_theme_idx" ON "weekly_reviews" USING btree ("next_theme_id");`)
}
