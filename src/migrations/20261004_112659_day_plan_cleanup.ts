import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "daily_logs" DROP COLUMN "morning_plan";
  ALTER TABLE "daily_logs" DROP COLUMN "noon_plan";
  ALTER TABLE "daily_logs" DROP COLUMN "evening_plan";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "daily_logs" ADD COLUMN "morning_plan" varchar;
  ALTER TABLE "daily_logs" ADD COLUMN "noon_plan" varchar;
  ALTER TABLE "daily_logs" ADD COLUMN "evening_plan" varchar;`)
}
