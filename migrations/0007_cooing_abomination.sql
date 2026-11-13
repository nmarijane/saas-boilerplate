ALTER TABLE "audit_log" ALTER COLUMN "org_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "title" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "body" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "values" jsonb;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_org_id_idx" ON "notification" USING btree ("organization_id");