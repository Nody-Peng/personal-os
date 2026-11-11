import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_mcp_keys_level" AS ENUM('read', 'add', 'edit', 'full');
  CREATE TABLE "mcp_activity" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key_id" integer,
  	"key_name" varchar NOT NULL,
  	"tool" varchar NOT NULL,
  	"page_id" numeric,
  	"notebook_id" numeric,
  	"page_title" varchar,
  	"summary" varchar,
  	"snapshot_id" numeric,
  	"empty_before" boolean DEFAULT false,
  	"undone_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "mcp_keys" ADD COLUMN "level" "enum_mcp_keys_level" DEFAULT 'add' NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "mcp_activity_id" integer;
  ALTER TABLE "mcp_activity" ADD CONSTRAINT "mcp_activity_key_id_mcp_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."mcp_keys"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "mcp_activity_key_idx" ON "mcp_activity" USING btree ("key_id");
  CREATE INDEX "mcp_activity_tool_idx" ON "mcp_activity" USING btree ("tool");
  CREATE INDEX "mcp_activity_page_id_idx" ON "mcp_activity" USING btree ("page_id");
  CREATE INDEX "mcp_activity_updated_at_idx" ON "mcp_activity" USING btree ("updated_at");
  CREATE INDEX "mcp_activity_created_at_idx" ON "mcp_activity" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mcp_activity_fk" FOREIGN KEY ("mcp_activity_id") REFERENCES "public"."mcp_activity"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_mcp_activity_id_idx" ON "payload_locked_documents_rels" USING btree ("mcp_activity_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "mcp_activity" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "mcp_activity" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_mcp_activity_fk";
  
  DROP INDEX "payload_locked_documents_rels_mcp_activity_id_idx";
  ALTER TABLE "mcp_keys" DROP COLUMN "level";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "mcp_activity_id";
  DROP TYPE "public"."enum_mcp_keys_level";`)
}
