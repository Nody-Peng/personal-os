import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "notebooks" ADD COLUMN "last_page_id" integer;
  ALTER TABLE "notebooks" ADD CONSTRAINT "notebooks_last_page_id_note_pages_id_fk" FOREIGN KEY ("last_page_id") REFERENCES "public"."note_pages"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "notebooks_last_page_idx" ON "notebooks" USING btree ("last_page_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "notebooks" DROP CONSTRAINT "notebooks_last_page_id_note_pages_id_fk";
  
  DROP INDEX "notebooks_last_page_idx";
  ALTER TABLE "notebooks" DROP COLUMN "last_page_id";`)
}
