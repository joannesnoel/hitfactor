CREATE TABLE "match_recompute_state" (
	"match_id" uuid PRIMARY KEY NOT NULL,
	"scores_changed_at" timestamp DEFAULT now() NOT NULL,
	"results_computed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "match_recompute_state" ADD CONSTRAINT "match_recompute_state_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;