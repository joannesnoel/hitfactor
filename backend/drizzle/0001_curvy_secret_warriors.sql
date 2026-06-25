CREATE TABLE "user_divisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"division" varchar(50) NOT NULL,
	"classification" varchar(5) DEFAULT 'U' NOT NULL,
	CONSTRAINT "user_divisions_user_division_unique" UNIQUE("user_id","division")
);
--> statement-breakpoint
ALTER TABLE "user_divisions" ADD CONSTRAINT "user_divisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "classification";