import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "mcp_keys" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"prefix" varchar NOT NULL,
  	"hash" varchar NOT NULL,
  	"user_id" integer NOT NULL,
  	"expires_at" timestamp(3) with time zone,
  	"last_used_at" timestamp(3) with time zone,
  	"revoked_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "mcp_keys_id" integer;
  ALTER TABLE "mcp_keys" ADD CONSTRAINT "mcp_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "mcp_keys_hash_idx" ON "mcp_keys" USING btree ("hash");
  CREATE INDEX "mcp_keys_user_idx" ON "mcp_keys" USING btree ("user_id");
  CREATE INDEX "mcp_keys_revoked_at_idx" ON "mcp_keys" USING btree ("revoked_at");
  CREATE INDEX "mcp_keys_updated_at_idx" ON "mcp_keys" USING btree ("updated_at");
  CREATE INDEX "mcp_keys_created_at_idx" ON "mcp_keys" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mcp_keys_fk" FOREIGN KEY ("mcp_keys_id") REFERENCES "public"."mcp_keys"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_mcp_keys_id_idx" ON "payload_locked_documents_rels" USING btree ("mcp_keys_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "mcp_keys" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "mcp_keys" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_mcp_keys_fk";
  
  DROP INDEX "payload_locked_documents_rels_mcp_keys_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "mcp_keys_id";`)
}
