CREATE TABLE "ai_free_credit_grant" (
	"user_id" text NOT NULL,
	"period" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "trial_subscription_id" text;--> statement-breakpoint
ALTER TABLE "ai_free_credit_grant" ADD CONSTRAINT "ai_free_credit_grant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_free_credit_grant_owner_period_idx" ON "ai_free_credit_grant" USING btree ("user_id","period");