ALTER TABLE "matches" ADD COLUMN "join_token" varchar(32);--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_join_token_unique" UNIQUE("join_token");