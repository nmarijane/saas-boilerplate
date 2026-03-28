CREATE TABLE "waitlist_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"referral_code" text NOT NULL,
	"referred_by" text,
	"referral_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_entry_email_unique" UNIQUE("email"),
	CONSTRAINT "waitlist_entry_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE INDEX "waitlist_email_idx" ON "waitlist_entry" USING btree ("email");--> statement-breakpoint
CREATE INDEX "waitlist_referral_code_idx" ON "waitlist_entry" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "waitlist_referred_by_idx" ON "waitlist_entry" USING btree ("referred_by");--> statement-breakpoint
CREATE INDEX "waitlist_status_idx" ON "waitlist_entry" USING btree ("status");