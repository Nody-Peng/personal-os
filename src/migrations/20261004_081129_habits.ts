import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_habits_icon" AS ENUM('headphones', 'barbell', 'drop', 'book', 'run', 'moon', 'leaf', 'pill', 'pencil', 'check');
  CREATE TABLE "daily_logs_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"habits_id" integer
  );
  
  CREATE TABLE "habits" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"icon" "enum_habits_icon" DEFAULT 'check' NOT NULL,
  	"weekly_target" numeric DEFAULT 7 NOT NULL,
  	"position" numeric DEFAULT 0,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "habits_id" integer;
  ALTER TABLE "daily_logs_rels" ADD CONSTRAINT "daily_logs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."daily_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "daily_logs_rels" ADD CONSTRAINT "daily_logs_rels_habits_fk" FOREIGN KEY ("habits_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "daily_logs_rels_order_idx" ON "daily_logs_rels" USING btree ("order");
  CREATE INDEX "daily_logs_rels_parent_idx" ON "daily_logs_rels" USING btree ("parent_id");
  CREATE INDEX "daily_logs_rels_path_idx" ON "daily_logs_rels" USING btree ("path");
  CREATE INDEX "daily_logs_rels_habits_id_idx" ON "daily_logs_rels" USING btree ("habits_id");
  CREATE INDEX "habits_active_idx" ON "habits" USING btree ("active");
  CREATE INDEX "habits_updated_at_idx" ON "habits" USING btree ("updated_at");
  CREATE INDEX "habits_created_at_idx" ON "habits" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_habits_fk" FOREIGN KEY ("habits_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_habits_id_idx" ON "payload_locked_documents_rels" USING btree ("habits_id");`)

  // The two habits that used to be fixed fields become the default list,
  // and every day's old ticks move into habitsDone.
  await db.execute(sql`
  INSERT INTO "habits" ("name", "icon", "weekly_target", "position", "active") VALUES
    ('早上聽英文', 'headphones', 5, 0, true),
    ('健身', 'barbell', COALESCE((SELECT "weekly_targets_gym_sessions" FROM "settings" LIMIT 1), 3), 1, true);

  INSERT INTO "daily_logs_rels" ("order", "parent_id", "path", "habits_id")
  SELECT 1, d."id", 'habitsDone', (SELECT "id" FROM "habits" WHERE "position" = 0 ORDER BY "id" LIMIT 1)
  FROM "daily_logs" d WHERE d."morning_listening" = true;

  INSERT INTO "daily_logs_rels" ("order", "parent_id", "path", "habits_id")
  SELECT 2, d."id", 'habitsDone', (SELECT "id" FROM "habits" WHERE "position" = 1 ORDER BY "id" LIMIT 1)
  FROM "daily_logs" d WHERE d."gym" = true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "daily_logs_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "habits" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "daily_logs_rels" CASCADE;
  DROP TABLE "habits" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_habits_fk";
  
  DROP INDEX "payload_locked_documents_rels_habits_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "habits_id";
  DROP TYPE "public"."enum_habits_icon";`)
}
