import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tasks_kind" AS ENUM('important', 'weekly');
  CREATE TYPE "public"."enum_tasks_status" AS ENUM('todo', 'done', 'migrated');
  CREATE TYPE "public"."enum_journals_cover_color" AS ENUM('navy', 'forest', 'burgundy', 'charcoal');
  CREATE TABLE "tasks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"kind" "enum_tasks_kind" NOT NULL,
  	"status" "enum_tasks_status" DEFAULT 'todo' NOT NULL,
  	"position" numeric DEFAULT 0,
  	"day" varchar,
  	"week_start" varchar,
  	"due_date" varchar,
  	"start_date" varchar,
  	"end_date" varchar,
  	"body" jsonb,
  	"migrated_from_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "monthly_notes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"month" varchar NOT NULL,
  	"review" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "journals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"year" numeric NOT NULL,
  	"title" varchar NOT NULL,
  	"subtitle" varchar,
  	"cover_color" "enum_journals_cover_color" DEFAULT 'navy' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "weekly_reviews_key_results" ALTER COLUMN "done" DROP DEFAULT;
  ALTER TABLE "daily_logs" ADD COLUMN "morning_plan" varchar;
  ALTER TABLE "daily_logs" ADD COLUMN "noon_plan" varchar;
  ALTER TABLE "daily_logs" ADD COLUMN "evening_plan" varchar;
  ALTER TABLE "daily_logs" ADD COLUMN "note" jsonb;
  ALTER TABLE "weekly_reviews" ADD COLUMN "review" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tasks_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "monthly_notes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "journals_id" integer;
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_migrated_from_id_tasks_id_fk" FOREIGN KEY ("migrated_from_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "tasks_kind_idx" ON "tasks" USING btree ("kind");
  CREATE INDEX "tasks_day_idx" ON "tasks" USING btree ("day");
  CREATE INDEX "tasks_week_start_idx" ON "tasks" USING btree ("week_start");
  CREATE INDEX "tasks_due_date_idx" ON "tasks" USING btree ("due_date");
  CREATE INDEX "tasks_start_date_idx" ON "tasks" USING btree ("start_date");
  CREATE INDEX "tasks_end_date_idx" ON "tasks" USING btree ("end_date");
  CREATE INDEX "tasks_migrated_from_idx" ON "tasks" USING btree ("migrated_from_id");
  CREATE INDEX "tasks_updated_at_idx" ON "tasks" USING btree ("updated_at");
  CREATE INDEX "tasks_created_at_idx" ON "tasks" USING btree ("created_at");
  CREATE UNIQUE INDEX "monthly_notes_month_idx" ON "monthly_notes" USING btree ("month");
  CREATE INDEX "monthly_notes_updated_at_idx" ON "monthly_notes" USING btree ("updated_at");
  CREATE INDEX "monthly_notes_created_at_idx" ON "monthly_notes" USING btree ("created_at");
  CREATE UNIQUE INDEX "journals_year_idx" ON "journals" USING btree ("year");
  CREATE INDEX "journals_updated_at_idx" ON "journals" USING btree ("updated_at");
  CREATE INDEX "journals_created_at_idx" ON "journals" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tasks_fk" FOREIGN KEY ("tasks_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_monthly_notes_fk" FOREIGN KEY ("monthly_notes_id") REFERENCES "public"."monthly_notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_journals_fk" FOREIGN KEY ("journals_id") REFERENCES "public"."journals"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_tasks_id_idx" ON "payload_locked_documents_rels" USING btree ("tasks_id");
  CREATE INDEX "payload_locked_documents_rels_monthly_notes_id_idx" ON "payload_locked_documents_rels" USING btree ("monthly_notes_id");
  CREATE INDEX "payload_locked_documents_rels_journals_id_idx" ON "payload_locked_documents_rels" USING btree ("journals_id");`)

  // Carry old content into the journal structure. The old columns are
  // dropped by the next migration, after this copy has run.
  await db.execute(sql`
  -- 三行筆記 -> Note: one BlockNote paragraph per line.
  UPDATE "daily_logs" SET "note" = (
    SELECT jsonb_agg(jsonb_build_object('type', 'paragraph', 'content', t.line) ORDER BY t.ord)
    FROM regexp_split_to_table("notes", E'\\n') WITH ORDINALITY AS t(line, ord)
  )
  WHERE "notes" IS NOT NULL AND btrim("notes") <> '' AND "note" IS NULL;

  -- 明天最重要的一件事 -> the next day's first IMPORTANT.
  INSERT INTO "tasks" ("title", "kind", "status", "position", "day")
  SELECT btrim("tomorrow_top1"), 'important'::"enum_tasks_kind", 'todo'::"enum_tasks_status", 0,
         to_char("date"::date + 1, 'YYYY-MM-DD')
  FROM "daily_logs"
  WHERE "tomorrow_top1" IS NOT NULL AND btrim("tomorrow_top1") <> '';

  -- Weekly reflection -> the new week summary.
  UPDATE "weekly_reviews" SET "review" = (
    SELECT jsonb_agg(jsonb_build_object('type', 'paragraph', 'content', t.line) ORDER BY t.ord)
    FROM regexp_split_to_table("reflection", E'\\n') WITH ORDINALITY AS t(line, ord)
  )
  WHERE "reflection" IS NOT NULL AND btrim("reflection") <> '' AND "review" IS NULL;

  -- Key results were set for the following week -> that week's to-dos.
  INSERT INTO "tasks" ("title", "kind", "status", "position", "week_start")
  SELECT k."text", 'weekly'::"enum_tasks_kind",
         (CASE WHEN k."done" THEN 'done' ELSE 'todo' END)::"enum_tasks_status",
         k."_order", to_char(w."week_start"::date + 7, 'YYYY-MM-DD')
  FROM "weekly_reviews_key_results" k
  JOIN "weekly_reviews" w ON w."id" = k."_parent_id"
  WHERE k."text" IS NOT NULL AND btrim(k."text") <> '';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tasks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "monthly_notes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "journals" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "tasks" CASCADE;
  DROP TABLE "monthly_notes" CASCADE;
  DROP TABLE "journals" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tasks_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_monthly_notes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_journals_fk";
  
  DROP INDEX "payload_locked_documents_rels_tasks_id_idx";
  DROP INDEX "payload_locked_documents_rels_monthly_notes_id_idx";
  DROP INDEX "payload_locked_documents_rels_journals_id_idx";
  ALTER TABLE "weekly_reviews_key_results" ALTER COLUMN "done" SET DEFAULT false;
  ALTER TABLE "daily_logs" DROP COLUMN "morning_plan";
  ALTER TABLE "daily_logs" DROP COLUMN "noon_plan";
  ALTER TABLE "daily_logs" DROP COLUMN "evening_plan";
  ALTER TABLE "daily_logs" DROP COLUMN "note";
  ALTER TABLE "weekly_reviews" DROP COLUMN "review";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tasks_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "monthly_notes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "journals_id";
  DROP TYPE "public"."enum_tasks_kind";
  DROP TYPE "public"."enum_tasks_status";
  DROP TYPE "public"."enum_journals_cover_color";`)
}
