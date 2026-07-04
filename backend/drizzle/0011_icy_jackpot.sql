ALTER TABLE "matches" ADD COLUMN "source_match_id" varchar(64);--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_source_match_id_unique" UNIQUE("source_match_id");