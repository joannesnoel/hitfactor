ALTER TABLE "match_officers" ADD COLUMN "role" varchar(10) DEFAULT 'MO' NOT NULL;--> statement-breakpoint
ALTER TABLE "stage_officers" ADD COLUMN "role" varchar(10) DEFAULT 'MO' NOT NULL;