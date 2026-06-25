CREATE TABLE "match_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "match_admins_match_user_unique" UNIQUE("match_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "match_officers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "match_officers_match_user_unique" UNIQUE("match_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "match_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"division" varchar(50) NOT NULL,
	"results" jsonb DEFAULT '[]' NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "match_results_match_division_unique" UNIQUE("match_id","division")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"date" date NOT NULL,
	"location" varchar(200) NOT NULL,
	"description" text,
	"level" varchar(5) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"stage_count" integer DEFAULT 0 NOT NULL,
	"max_shooters" integer,
	"registration_open" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"shooter_name" varchar(100) NOT NULL,
	"uspsa_number" varchar(20),
	"division" varchar(50) NOT NULL,
	"power_factor" varchar(10) NOT NULL,
	"classification" varchar(5),
	"squad_id" uuid,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "registrations_match_user_unique" UNIQUE("match_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"registration_id" uuid NOT NULL,
	"shooter_name" varchar(100) NOT NULL,
	"division" varchar(50) NOT NULL,
	"power_factor" varchar(10) NOT NULL,
	"alpha_count" integer DEFAULT 0 NOT NULL,
	"charlie_count" integer DEFAULT 0 NOT NULL,
	"delta_count" integer DEFAULT 0 NOT NULL,
	"miss_count" integer DEFAULT 0 NOT NULL,
	"no_shoot_count" integer DEFAULT 0 NOT NULL,
	"procedural_count" integer DEFAULT 0 NOT NULL,
	"steel_hits" integer DEFAULT 0 NOT NULL,
	"steel_misses" integer DEFAULT 0 NOT NULL,
	"time" numeric(6, 2) NOT NULL,
	"raw_points" integer DEFAULT 0 NOT NULL,
	"penalty_points" integer DEFAULT 0 NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"hit_factor" numeric(10, 4) DEFAULT '0' NOT NULL,
	"scored_by" uuid NOT NULL,
	"scored_at" timestamp DEFAULT now() NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"verified_by" uuid,
	"dqed" boolean DEFAULT false NOT NULL,
	"dnf" boolean DEFAULT false NOT NULL,
	"modified_at" timestamp,
	"modified_by" uuid,
	CONSTRAINT "scores_stage_registration_unique" UNIQUE("stage_id","registration_id")
);
--> statement-breakpoint
CREATE TABLE "squads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"squad_number" integer NOT NULL,
	"name" varchar(100),
	"max_size" integer DEFAULT 10 NOT NULL,
	CONSTRAINT "squads_match_number_unique" UNIQUE("match_id","squad_number")
);
--> statement-breakpoint
CREATE TABLE "stage_officers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "stage_officers_stage_user_unique" UNIQUE("stage_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "stage_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"division" varchar(50) NOT NULL,
	"stage_winner_hit_factor" numeric(10, 4) DEFAULT '0' NOT NULL,
	"results" jsonb DEFAULT '[]' NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stage_results_stage_division_unique" UNIQUE("stage_id","division")
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"stage_number" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"scoring_type" varchar(20) NOT NULL,
	"min_rounds" integer NOT NULL,
	"max_points" integer NOT NULL,
	"number_of_targets" integer DEFAULT 0 NOT NULL,
	"number_of_poppers" integer DEFAULT 0 NOT NULL,
	"number_of_plates" integer DEFAULT 0 NOT NULL,
	"number_of_no_shoots" integer DEFAULT 0 NOT NULL,
	"fixed_time" numeric(6, 2),
	"is_classifier" boolean DEFAULT false NOT NULL,
	"classifier_number" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stages_match_stage_unique" UNIQUE("match_id","stage_number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"uspsa_number" varchar(20),
	"roles" text[] NOT NULL,
	"classification" varchar(5),
	"default_division" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "match_admins" ADD CONSTRAINT "match_admins_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_admins" ADD CONSTRAINT "match_admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_officers" ADD CONSTRAINT "match_officers_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_officers" ADD CONSTRAINT "match_officers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_squad_id_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_scored_by_users_id_fk" FOREIGN KEY ("scored_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "squads" ADD CONSTRAINT "squads_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_officers" ADD CONSTRAINT "stage_officers_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_officers" ADD CONSTRAINT "stage_officers_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_officers" ADD CONSTRAINT "stage_officers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_results" ADD CONSTRAINT "stage_results_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_results" ADD CONSTRAINT "stage_results_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;