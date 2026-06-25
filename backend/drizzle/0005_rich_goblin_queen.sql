ALTER TABLE "stages" ADD COLUMN "number_of_steel" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stages" ADD COLUMN "paper_target_rounds" jsonb;--> statement-breakpoint
ALTER TABLE "stages" DROP COLUMN "number_of_poppers";--> statement-breakpoint
ALTER TABLE "stages" DROP COLUMN "number_of_plates";