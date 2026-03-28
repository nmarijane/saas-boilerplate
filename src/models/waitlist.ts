import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const waitlistEntry = pgTable("waitlist_entry", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  referralCode: text("referral_code").notNull().unique(),
  referredBy: text("referred_by"),
  referralCount: integer("referral_count").notNull().default(0),
  status: text("status").notNull().default("waiting"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("waitlist_email_idx").on(t.email),
  index("waitlist_referral_code_idx").on(t.referralCode),
  index("waitlist_referred_by_idx").on(t.referredBy),
  index("waitlist_status_idx").on(t.status),
]);
