CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "metadata" text;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "active_organization_id" text;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitation_org_id_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "two_factor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "two_factor_user_id_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
-- The twoFactor plugin reads the secret and backup codes from two_factor: carry over what was stored on the user before dropping those columns.
-- A secret that was never confirmed (two_factor_enabled is not true) stays unverified, and backup_codes cannot be NULL.
INSERT INTO "two_factor" ("id", "secret", "backup_codes", "user_id", "verified")
SELECT gen_random_uuid()::text, "two_factor_secret", COALESCE("two_factor_backup_codes", ''), "id", COALESCE("two_factor_enabled", false)
FROM "user"
WHERE "two_factor_secret" IS NOT NULL;--> statement-breakpoint
-- A flag left without a secret would lock sign-in behind a factor that does not exist.
UPDATE "user" SET "two_factor_enabled" = false WHERE "two_factor_enabled" AND "two_factor_secret" IS NULL;--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "two_factor_secret";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "two_factor_backup_codes";