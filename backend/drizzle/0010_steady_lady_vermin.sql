CREATE TABLE "shooter_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"normalized_name" varchar(120) NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shooter_aliases_normalized_name_unique" UNIQUE("normalized_name")
);
--> statement-breakpoint
ALTER TABLE "shooter_aliases" ADD CONSTRAINT "shooter_aliases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;