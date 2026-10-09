import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "books_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"book_shelves_id" integer
  );
  
  CREATE TABLE "book_shelves" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"position" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "books" ADD COLUMN "finished_at" timestamp(3) with time zone;
  ALTER TABLE "books" ADD COLUMN "highlights" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "book_shelves_id" integer;
  ALTER TABLE "books_rels" ADD CONSTRAINT "books_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "books_rels" ADD CONSTRAINT "books_rels_book_shelves_fk" FOREIGN KEY ("book_shelves_id") REFERENCES "public"."book_shelves"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "books_rels_order_idx" ON "books_rels" USING btree ("order");
  CREATE INDEX "books_rels_parent_idx" ON "books_rels" USING btree ("parent_id");
  CREATE INDEX "books_rels_path_idx" ON "books_rels" USING btree ("path");
  CREATE INDEX "books_rels_book_shelves_id_idx" ON "books_rels" USING btree ("book_shelves_id");
  CREATE INDEX "book_shelves_position_idx" ON "book_shelves" USING btree ("position");
  CREATE INDEX "book_shelves_updated_at_idx" ON "book_shelves" USING btree ("updated_at");
  CREATE INDEX "book_shelves_created_at_idx" ON "book_shelves" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_book_shelves_fk" FOREIGN KEY ("book_shelves_id") REFERENCES "public"."book_shelves"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_book_shelves_id_idx" ON "payload_locked_documents_rels" USING btree ("book_shelves_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "books_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "book_shelves" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "books_rels" CASCADE;
  DROP TABLE "book_shelves" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_book_shelves_fk";
  
  DROP INDEX "payload_locked_documents_rels_book_shelves_id_idx";
  ALTER TABLE "books" DROP COLUMN "finished_at";
  ALTER TABLE "books" DROP COLUMN "highlights";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "book_shelves_id";`)
}
