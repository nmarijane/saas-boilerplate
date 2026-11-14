CREATE TABLE "stripe_event" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_credit_ledger" ADD COLUMN "bucket" text DEFAULT 'pack' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_credit_ledger" ADD COLUMN "period" text;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "billing_interval" text;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "trial_end" timestamp;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "locale" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "trial_used_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_credit_ledger_allocation_idx" ON "ai_credit_ledger" USING btree ("organization_id","period") WHERE "ai_credit_ledger"."reason" = 'plan_allocation';--> statement-breakpoint
CREATE UNIQUE INDEX "ai_credit_ledger_pack_idx" ON "ai_credit_ledger" USING btree ("reference_id") WHERE "ai_credit_ledger"."reason" = 'credit_pack';