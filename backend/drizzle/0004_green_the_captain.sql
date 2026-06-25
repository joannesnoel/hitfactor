CREATE TABLE "shooting_ranges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" RENAME COLUMN "date" TO "start_date";--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "stage_count";