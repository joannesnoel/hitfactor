ALTER TABLE "registrations" ADD COLUMN "member_number" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "member_number" varchar(20);--> statement-breakpoint
ALTER TABLE "registrations" DROP COLUMN "uspsa_number";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "uspsa_number";