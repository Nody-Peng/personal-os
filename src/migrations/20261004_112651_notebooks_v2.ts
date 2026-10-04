import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_note_pages_kind" AS ENUM('page', 'board', 'item');
  CREATE TYPE "public"."enum_note_pages_status" AS ENUM('todo', 'doing', 'done', 'archived');
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"prefix" varchar DEFAULT '',
  	"_objectkey" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  ALTER TABLE "daily_logs" ADD COLUMN "morning_items" jsonb;
  ALTER TABLE "daily_logs" ADD COLUMN "noon_items" jsonb;
  ALTER TABLE "daily_logs" ADD COLUMN "evening_items" jsonb;
  ALTER TABLE "note_pages" ADD COLUMN "kind" "enum_note_pages_kind" DEFAULT 'page';
  ALTER TABLE "note_pages" ADD COLUMN "status" "enum_note_pages_status";
  ALTER TABLE "note_pages" ADD COLUMN "parent_item_id" integer;
  ALTER TABLE "note_pages" ADD COLUMN "start_date" varchar;
  ALTER TABLE "note_pages" ADD COLUMN "end_date" varchar;
  ALTER TABLE "note_pages" ADD COLUMN "cover" varchar;
  ALTER TABLE "note_pages" ADD COLUMN "cover_position" numeric DEFAULT 50;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "media_id" integer;
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  ALTER TABLE "note_pages" ADD CONSTRAINT "note_pages_parent_item_id_note_pages_id_fk" FOREIGN KEY ("parent_item_id") REFERENCES "public"."note_pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "note_pages_kind_idx" ON "note_pages" USING btree ("kind");
  CREATE INDEX "note_pages_parent_item_idx" ON "note_pages" USING btree ("parent_item_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");`)
  // 早 / 午 / 晚 move from free text to checklists: each non-empty line
  // becomes an unticked item (the old columns are dropped in the next migration).
  for (const [from, to] of [
    ['morning_plan', 'morning_items'],
    ['noon_plan', 'noon_items'],
    ['evening_plan', 'evening_items'],
  ]) {
    await db.execute(
      sql.raw(`
  UPDATE "daily_logs" d SET "${to}" = (
    SELECT jsonb_agg(
      jsonb_build_object('id', substr(md5(d."id"::text || '-${to}-' || t.ord::text), 1, 10), 'text', left(btrim(t.line), 200), 'done', false)
      ORDER BY t.ord
    )
    FROM unnest(string_to_array(replace(d."${from}", E'\\r', ''), E'\\n')) WITH ORDINALITY AS t(line, ord)
    WHERE btrim(t.line) <> ''
  )
  WHERE d."${from}" IS NOT NULL AND btrim(d."${from}") <> '' AND d."${to}" IS NULL;`),
    )
  }
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "media" CASCADE;
  ALTER TABLE "note_pages" DROP CONSTRAINT "note_pages_parent_item_id_note_pages_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_media_fk";
  
  DROP INDEX "note_pages_kind_idx";
  DROP INDEX "note_pages_parent_item_idx";
  DROP INDEX "payload_locked_documents_rels_media_id_idx";
  ALTER TABLE "daily_logs" DROP COLUMN "morning_items";
  ALTER TABLE "daily_logs" DROP COLUMN "noon_items";
  ALTER TABLE "daily_logs" DROP COLUMN "evening_items";
  ALTER TABLE "note_pages" DROP COLUMN "kind";
  ALTER TABLE "note_pages" DROP COLUMN "status";
  ALTER TABLE "note_pages" DROP COLUMN "parent_item_id";
  ALTER TABLE "note_pages" DROP COLUMN "start_date";
  ALTER TABLE "note_pages" DROP COLUMN "end_date";
  ALTER TABLE "note_pages" DROP COLUMN "cover";
  ALTER TABLE "note_pages" DROP COLUMN "cover_position";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "media_id";
  DROP TYPE "public"."enum_note_pages_kind";
  DROP TYPE "public"."enum_note_pages_status";`)
}
