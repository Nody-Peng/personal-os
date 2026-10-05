import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // A task is copied forward at most once. If a race ever made two copies,
  // keep the first as the copy; the later one stays as an ordinary task.
  await db.execute(sql`
   UPDATE "tasks" SET "migrated_from_id" = NULL
   WHERE "migrated_from_id" IS NOT NULL
     AND "id" NOT IN (SELECT MIN("id") FROM "tasks" WHERE "migrated_from_id" IS NOT NULL GROUP BY "migrated_from_id");
   DROP INDEX "tasks_migrated_from_idx";
  CREATE UNIQUE INDEX "tasks_migrated_from_idx" ON "tasks" USING btree ("migrated_from_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "tasks_migrated_from_idx";
  CREATE INDEX "tasks_migrated_from_idx" ON "tasks" USING btree ("migrated_from_id");`)
}
