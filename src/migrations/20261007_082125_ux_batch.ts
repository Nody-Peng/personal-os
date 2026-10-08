import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
import type { CollectionSlug } from 'payload'
import { dayLogText, monthText, taskText, weekText } from '@/lib/searchText'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_note_pages_template_for" AS ENUM('page', 'day', 'week');
  CREATE TABLE "page_snapshots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"page_id" integer,
  	"title" varchar,
  	"content" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "daily_logs" ADD COLUMN "plain_text" varchar;
  ALTER TABLE "tasks" ADD COLUMN "plain_text" varchar;
  ALTER TABLE "weekly_reviews" ADD COLUMN "plain_text" varchar;
  ALTER TABLE "monthly_notes" ADD COLUMN "plain_text" varchar;
  ALTER TABLE "note_pages" ADD COLUMN "template_for" "enum_note_pages_template_for";
  ALTER TABLE "media" ADD COLUMN "unused_since" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "page_snapshots_id" integer;
  ALTER TABLE "page_snapshots" ADD CONSTRAINT "page_snapshots_page_id_note_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."note_pages"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "page_snapshots_page_idx" ON "page_snapshots" USING btree ("page_id");
  CREATE INDEX "page_snapshots_updated_at_idx" ON "page_snapshots" USING btree ("updated_at");
  CREATE INDEX "page_snapshots_created_at_idx" ON "page_snapshots" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_page_snapshots_fk" FOREIGN KEY ("page_snapshots_id") REFERENCES "public"."page_snapshots"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "note_pages_template_for_idx" ON "note_pages" USING btree ("template_for");
  CREATE INDEX "media_unused_since_idx" ON "media" USING btree ("unused_since");
  CREATE INDEX "payload_locked_documents_rels_page_snapshots_id_idx" ON "payload_locked_documents_rels" USING btree ("page_snapshots_id");`)

  // Search text for everything written before (saves keep it current from now
  // on). Written straight to the column so `updatedAt` stays as it was.
  const backfill = async (collection: CollectionSlug, table: string, toText: (doc: Record<string, unknown>) => string) => {
    const { docs } = await payload.find({ collection, pagination: false, depth: 0, req })
    for (const doc of docs) {
      const text = toText(doc as unknown as Record<string, unknown>)
      if (text) await db.execute(sql`UPDATE ${sql.identifier(table)} SET "plain_text" = ${text} WHERE "id" = ${doc.id}`)
    }
  }
  await backfill('daily-logs', 'daily_logs', dayLogText)
  await backfill('tasks', 'tasks', taskText)
  await backfill('weekly-reviews', 'weekly_reviews', weekText)
  await backfill('monthly-notes', 'monthly_notes', monthText)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "page_snapshots" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "page_snapshots" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_page_snapshots_fk";
  
  DROP INDEX "note_pages_template_for_idx";
  DROP INDEX "media_unused_since_idx";
  DROP INDEX "payload_locked_documents_rels_page_snapshots_id_idx";
  ALTER TABLE "daily_logs" DROP COLUMN "plain_text";
  ALTER TABLE "tasks" DROP COLUMN "plain_text";
  ALTER TABLE "weekly_reviews" DROP COLUMN "plain_text";
  ALTER TABLE "monthly_notes" DROP COLUMN "plain_text";
  ALTER TABLE "note_pages" DROP COLUMN "template_for";
  ALTER TABLE "media" DROP COLUMN "unused_since";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "page_snapshots_id";
  DROP TYPE "public"."enum_note_pages_template_for";`)
}
