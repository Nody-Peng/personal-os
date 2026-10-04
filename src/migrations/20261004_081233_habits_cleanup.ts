import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "weekly_reviews" ADD COLUMN "theme_id" integer;
  ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_theme_id_ideas_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."ideas"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "weekly_reviews_theme_idx" ON "weekly_reviews" USING btree ("theme_id");
  ALTER TABLE "daily_logs" DROP COLUMN "morning_listening";
  ALTER TABLE "daily_logs" DROP COLUMN "gym";
  ALTER TABLE "settings" DROP COLUMN "weekly_targets_gym_sessions";`)

  // Themes are now stored on their own week: a "next week" choice made on
  // week W becomes week W+1's theme.
  await db.execute(sql`
  UPDATE "weekly_reviews" t SET "theme_id" = s."next_theme_id"
  FROM "weekly_reviews" s
  WHERE s."next_theme_id" IS NOT NULL
    AND t."week_start" = to_char(s."week_start"::date + 7, 'YYYY-MM-DD')
    AND t."theme_id" IS NULL;

  INSERT INTO "weekly_reviews" ("week_start", "theme_id")
  SELECT to_char(s."week_start"::date + 7, 'YYYY-MM-DD'), s."next_theme_id"
  FROM "weekly_reviews" s
  WHERE s."next_theme_id" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "weekly_reviews" t WHERE t."week_start" = to_char(s."week_start"::date + 7, 'YYYY-MM-DD')
    );`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "weekly_reviews" DROP CONSTRAINT "weekly_reviews_theme_id_ideas_id_fk";
  
  DROP INDEX "weekly_reviews_theme_idx";
  ALTER TABLE "daily_logs" ADD COLUMN "morning_listening" boolean DEFAULT false;
  ALTER TABLE "daily_logs" ADD COLUMN "gym" boolean DEFAULT false;
  ALTER TABLE "settings" ADD COLUMN "weekly_targets_gym_sessions" numeric DEFAULT 3;
  ALTER TABLE "weekly_reviews" DROP COLUMN "theme_id";`)
}
