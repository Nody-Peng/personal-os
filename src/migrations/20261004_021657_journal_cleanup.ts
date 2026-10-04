import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "weekly_reviews_key_results" CASCADE;
  ALTER TABLE "daily_logs" DROP COLUMN "notes";
  ALTER TABLE "daily_logs" DROP COLUMN "tomorrow_top1";
  ALTER TABLE "weekly_reviews" DROP COLUMN "reflection";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "weekly_reviews_key_results" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL,
  	"done" boolean
  );
  
  ALTER TABLE "daily_logs" ADD COLUMN "notes" varchar;
  ALTER TABLE "daily_logs" ADD COLUMN "tomorrow_top1" varchar;
  ALTER TABLE "weekly_reviews" ADD COLUMN "reflection" varchar;
  ALTER TABLE "weekly_reviews_key_results" ADD CONSTRAINT "weekly_reviews_key_results_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."weekly_reviews"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "weekly_reviews_key_results_order_idx" ON "weekly_reviews_key_results" USING btree ("_order");
  CREATE INDEX "weekly_reviews_key_results_parent_id_idx" ON "weekly_reviews_key_results" USING btree ("_parent_id");`)
}
