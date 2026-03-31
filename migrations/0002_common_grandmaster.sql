CREATE TYPE "public"."presence_status" AS ENUM('online', 'idle', 'offline');--> statement-breakpoint
CREATE TABLE "user_presence" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"current_page" text DEFAULT '/dashboard' NOT NULL,
	"status" "presence_status" DEFAULT 'online' NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "presence_org_status_idx" ON "user_presence" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "presence_user_org_idx" ON "user_presence" USING btree ("user_id","organization_id");