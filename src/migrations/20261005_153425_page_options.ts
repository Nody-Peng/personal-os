import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_note_pages_font" AS ENUM('default', 'serif', 'mono');
  ALTER TABLE "note_pages" ADD COLUMN "font" "enum_note_pages_font" DEFAULT 'default';
  ALTER TABLE "note_pages" ADD COLUMN "small_text" boolean DEFAULT false;
  ALTER TABLE "note_pages" ADD COLUMN "full_width" boolean DEFAULT false;
  ALTER TABLE "note_pages" ADD COLUMN "locked" boolean DEFAULT false;
  ALTER TABLE "note_pages" ADD COLUMN "favorite" boolean DEFAULT false;
  CREATE INDEX "note_pages_favorite_idx" ON "note_pages" USING btree ("favorite");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "note_pages_favorite_idx";
  ALTER TABLE "note_pages" DROP COLUMN "font";
  ALTER TABLE "note_pages" DROP COLUMN "small_text";
  ALTER TABLE "note_pages" DROP COLUMN "full_width";
  ALTER TABLE "note_pages" DROP COLUMN "locked";
  ALTER TABLE "note_pages" DROP COLUMN "favorite";
  DROP TYPE "public"."enum_note_pages_font";`)
}
