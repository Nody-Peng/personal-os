import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_journals_pattern" AS ENUM('cloth', 'plaid', 'pinstripe', 'dots', 'marble', 'diamond');
  CREATE TYPE "public"."enum_notebooks_cover_color" AS ENUM('navy', 'forest', 'burgundy', 'charcoal', 'umber', 'slate');
  CREATE TYPE "public"."enum_notebooks_pattern" AS ENUM('cloth', 'plaid', 'pinstripe', 'dots', 'marble', 'diamond');
  ALTER TYPE "public"."enum_journals_cover_color" ADD VALUE 'umber';
  ALTER TYPE "public"."enum_journals_cover_color" ADD VALUE 'slate';
  CREATE TABLE "notebooks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"cover_color" "enum_notebooks_cover_color" DEFAULT 'navy' NOT NULL,
  	"pattern" "enum_notebooks_pattern" DEFAULT 'cloth' NOT NULL,
  	"position" numeric DEFAULT 0,
  	"archived" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "note_pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"icon" varchar,
  	"title" varchar,
  	"notebook_id" integer NOT NULL,
  	"parent_id" integer,
  	"position" numeric DEFAULT 0,
  	"content" jsonb,
  	"plain_text" varchar,
  	"edited_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "journals" ADD COLUMN "pattern" "enum_journals_pattern" DEFAULT 'cloth' NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "notebooks_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "note_pages_id" integer;
  ALTER TABLE "note_pages" ADD CONSTRAINT "note_pages_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "note_pages" ADD CONSTRAINT "note_pages_parent_id_note_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."note_pages"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "notebooks_archived_idx" ON "notebooks" USING btree ("archived");
  CREATE INDEX "notebooks_updated_at_idx" ON "notebooks" USING btree ("updated_at");
  CREATE INDEX "notebooks_created_at_idx" ON "notebooks" USING btree ("created_at");
  CREATE INDEX "note_pages_notebook_idx" ON "note_pages" USING btree ("notebook_id");
  CREATE INDEX "note_pages_parent_idx" ON "note_pages" USING btree ("parent_id");
  CREATE INDEX "note_pages_edited_at_idx" ON "note_pages" USING btree ("edited_at");
  CREATE INDEX "note_pages_updated_at_idx" ON "note_pages" USING btree ("updated_at");
  CREATE INDEX "note_pages_created_at_idx" ON "note_pages" USING btree ("created_at");
  CREATE INDEX "note_pages_deleted_at_idx" ON "note_pages" USING btree ("deleted_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notebooks_fk" FOREIGN KEY ("notebooks_id") REFERENCES "public"."notebooks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_note_pages_fk" FOREIGN KEY ("note_pages_id") REFERENCES "public"."note_pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_notebooks_id_idx" ON "payload_locked_documents_rels" USING btree ("notebooks_id");
  CREATE INDEX "payload_locked_documents_rels_note_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("note_pages_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "notebooks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "note_pages" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "notebooks" CASCADE;
  DROP TABLE "note_pages" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_notebooks_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_note_pages_fk";
  
  ALTER TABLE "journals" ALTER COLUMN "cover_color" SET DATA TYPE text;
  ALTER TABLE "journals" ALTER COLUMN "cover_color" SET DEFAULT 'navy'::text;
  DROP TYPE "public"."enum_journals_cover_color";
  CREATE TYPE "public"."enum_journals_cover_color" AS ENUM('navy', 'forest', 'burgundy', 'charcoal');
  ALTER TABLE "journals" ALTER COLUMN "cover_color" SET DEFAULT 'navy'::"public"."enum_journals_cover_color";
  ALTER TABLE "journals" ALTER COLUMN "cover_color" SET DATA TYPE "public"."enum_journals_cover_color" USING "cover_color"::"public"."enum_journals_cover_color";
  DROP INDEX "payload_locked_documents_rels_notebooks_id_idx";
  DROP INDEX "payload_locked_documents_rels_note_pages_id_idx";
  ALTER TABLE "journals" DROP COLUMN "pattern";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "notebooks_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "note_pages_id";
  DROP TYPE "public"."enum_journals_pattern";
  DROP TYPE "public"."enum_notebooks_cover_color";
  DROP TYPE "public"."enum_notebooks_pattern";`)
}
