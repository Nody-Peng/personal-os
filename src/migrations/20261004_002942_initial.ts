import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_daily_logs_toefl_skills" AS ENUM('speaking', 'writing', 'reading', 'listening', 'vocab');
  CREATE TYPE "public"."enum_toefl_scores_type" AS ENUM('mini', 'section', 'full', 'official');
  CREATE TYPE "public"."enum_toefl_scores_source" AS ENUM('ets', 'third-party', 'ai');
  CREATE TYPE "public"."enum_ideas_status" AS ENUM('inbox', 'selected', 'done', 'dropped');
  CREATE TYPE "public"."enum_settings_week_plan_mon" AS ENUM('speaking', 'writing', 'reading', 'listening', 'vocab', 'practice', 'rest');
  CREATE TYPE "public"."enum_settings_week_plan_tue" AS ENUM('speaking', 'writing', 'reading', 'listening', 'vocab', 'practice', 'rest');
  CREATE TYPE "public"."enum_settings_week_plan_wed" AS ENUM('speaking', 'writing', 'reading', 'listening', 'vocab', 'practice', 'rest');
  CREATE TYPE "public"."enum_settings_week_plan_thu" AS ENUM('speaking', 'writing', 'reading', 'listening', 'vocab', 'practice', 'rest');
  CREATE TYPE "public"."enum_settings_week_plan_fri" AS ENUM('speaking', 'writing', 'reading', 'listening', 'vocab', 'practice', 'rest');
  CREATE TYPE "public"."enum_settings_week_plan_sat" AS ENUM('speaking', 'writing', 'reading', 'listening', 'vocab', 'practice', 'rest');
  CREATE TYPE "public"."enum_settings_week_plan_sun" AS ENUM('speaking', 'writing', 'reading', 'listening', 'vocab', 'practice', 'rest');
  CREATE TABLE "daily_logs_toefl_skills" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_daily_logs_toefl_skills",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "daily_logs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"date" varchar NOT NULL,
  	"morning_listening" boolean DEFAULT false,
  	"gym" boolean DEFAULT false,
  	"toefl_minutes" numeric DEFAULT 0,
  	"theme_minutes" numeric DEFAULT 0,
  	"energy" numeric,
  	"notes" varchar,
  	"tomorrow_top1" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "toefl_scores" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"date" varchar NOT NULL,
  	"type" "enum_toefl_scores_type" NOT NULL,
  	"source" "enum_toefl_scores_source" DEFAULT 'ets',
  	"reading" numeric,
  	"listening" numeric,
  	"speaking" numeric,
  	"writing" numeric,
  	"overall" numeric,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ideas" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"why" varchar,
  	"score_goal" numeric DEFAULT 0,
  	"score_urgency" numeric DEFAULT 0,
  	"score_passion" numeric DEFAULT 0,
  	"total" numeric,
  	"status" "enum_ideas_status" DEFAULT 'inbox' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "weekly_reviews_key_results" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL,
  	"done" boolean DEFAULT false
  );
  
  CREATE TABLE "weekly_reviews" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"week_start" varchar NOT NULL,
  	"reflection" varchar,
  	"next_theme_id" integer,
  	"theme_reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"daily_logs_id" integer,
  	"toefl_scores_id" integer,
  	"ideas_id" integer,
  	"weekly_reviews_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "settings_checkpoints" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"week" numeric NOT NULL,
  	"target" numeric DEFAULT 4 NOT NULL
  );
  
  CREATE TABLE "settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"plan_start" varchar DEFAULT '2026-10-05' NOT NULL,
  	"exam_date" varchar,
  	"baseline_band" numeric DEFAULT 3.5,
  	"target_band" numeric DEFAULT 5,
  	"weekly_targets_toefl_hours" numeric DEFAULT 8,
  	"weekly_targets_gym_sessions" numeric DEFAULT 3,
  	"week_plan_mon" "enum_settings_week_plan_mon" DEFAULT 'speaking' NOT NULL,
  	"week_plan_tue" "enum_settings_week_plan_tue" DEFAULT 'writing' NOT NULL,
  	"week_plan_wed" "enum_settings_week_plan_wed" DEFAULT 'reading' NOT NULL,
  	"week_plan_thu" "enum_settings_week_plan_thu" DEFAULT 'speaking' NOT NULL,
  	"week_plan_fri" "enum_settings_week_plan_fri" DEFAULT 'writing' NOT NULL,
  	"week_plan_sat" "enum_settings_week_plan_sat" DEFAULT 'practice' NOT NULL,
  	"week_plan_sun" "enum_settings_week_plan_sun" DEFAULT 'rest' NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "daily_logs_toefl_skills" ADD CONSTRAINT "daily_logs_toefl_skills_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."daily_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "weekly_reviews_key_results" ADD CONSTRAINT "weekly_reviews_key_results_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."weekly_reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_next_theme_id_ideas_id_fk" FOREIGN KEY ("next_theme_id") REFERENCES "public"."ideas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_daily_logs_fk" FOREIGN KEY ("daily_logs_id") REFERENCES "public"."daily_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_toefl_scores_fk" FOREIGN KEY ("toefl_scores_id") REFERENCES "public"."toefl_scores"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ideas_fk" FOREIGN KEY ("ideas_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_weekly_reviews_fk" FOREIGN KEY ("weekly_reviews_id") REFERENCES "public"."weekly_reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_checkpoints" ADD CONSTRAINT "settings_checkpoints_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "daily_logs_toefl_skills_order_idx" ON "daily_logs_toefl_skills" USING btree ("order");
  CREATE INDEX "daily_logs_toefl_skills_parent_idx" ON "daily_logs_toefl_skills" USING btree ("parent_id");
  CREATE UNIQUE INDEX "daily_logs_date_idx" ON "daily_logs" USING btree ("date");
  CREATE INDEX "daily_logs_updated_at_idx" ON "daily_logs" USING btree ("updated_at");
  CREATE INDEX "daily_logs_created_at_idx" ON "daily_logs" USING btree ("created_at");
  CREATE INDEX "toefl_scores_date_idx" ON "toefl_scores" USING btree ("date");
  CREATE INDEX "toefl_scores_overall_idx" ON "toefl_scores" USING btree ("overall");
  CREATE INDEX "toefl_scores_updated_at_idx" ON "toefl_scores" USING btree ("updated_at");
  CREATE INDEX "toefl_scores_created_at_idx" ON "toefl_scores" USING btree ("created_at");
  CREATE INDEX "ideas_total_idx" ON "ideas" USING btree ("total");
  CREATE INDEX "ideas_status_idx" ON "ideas" USING btree ("status");
  CREATE INDEX "ideas_updated_at_idx" ON "ideas" USING btree ("updated_at");
  CREATE INDEX "ideas_created_at_idx" ON "ideas" USING btree ("created_at");
  CREATE INDEX "weekly_reviews_key_results_order_idx" ON "weekly_reviews_key_results" USING btree ("_order");
  CREATE INDEX "weekly_reviews_key_results_parent_id_idx" ON "weekly_reviews_key_results" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "weekly_reviews_week_start_idx" ON "weekly_reviews" USING btree ("week_start");
  CREATE INDEX "weekly_reviews_next_theme_idx" ON "weekly_reviews" USING btree ("next_theme_id");
  CREATE INDEX "weekly_reviews_updated_at_idx" ON "weekly_reviews" USING btree ("updated_at");
  CREATE INDEX "weekly_reviews_created_at_idx" ON "weekly_reviews" USING btree ("created_at");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_daily_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("daily_logs_id");
  CREATE INDEX "payload_locked_documents_rels_toefl_scores_id_idx" ON "payload_locked_documents_rels" USING btree ("toefl_scores_id");
  CREATE INDEX "payload_locked_documents_rels_ideas_id_idx" ON "payload_locked_documents_rels" USING btree ("ideas_id");
  CREATE INDEX "payload_locked_documents_rels_weekly_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("weekly_reviews_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "settings_checkpoints_order_idx" ON "settings_checkpoints" USING btree ("_order");
  CREATE INDEX "settings_checkpoints_parent_id_idx" ON "settings_checkpoints" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "daily_logs_toefl_skills" CASCADE;
  DROP TABLE "daily_logs" CASCADE;
  DROP TABLE "toefl_scores" CASCADE;
  DROP TABLE "ideas" CASCADE;
  DROP TABLE "weekly_reviews_key_results" CASCADE;
  DROP TABLE "weekly_reviews" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "settings_checkpoints" CASCADE;
  DROP TABLE "settings" CASCADE;
  DROP TYPE "public"."enum_daily_logs_toefl_skills";
  DROP TYPE "public"."enum_toefl_scores_type";
  DROP TYPE "public"."enum_toefl_scores_source";
  DROP TYPE "public"."enum_ideas_status";
  DROP TYPE "public"."enum_settings_week_plan_mon";
  DROP TYPE "public"."enum_settings_week_plan_tue";
  DROP TYPE "public"."enum_settings_week_plan_wed";
  DROP TYPE "public"."enum_settings_week_plan_thu";
  DROP TYPE "public"."enum_settings_week_plan_fri";
  DROP TYPE "public"."enum_settings_week_plan_sat";
  DROP TYPE "public"."enum_settings_week_plan_sun";`)
}
