ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "normalized_name" varchar(120);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" varchar(30);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "claimed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "claimed_at" timestamp;--> statement-breakpoint
CREATE INDEX "users_normalized_name_idx" ON "users" USING btree ("normalized_name");