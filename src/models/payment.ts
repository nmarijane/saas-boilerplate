import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const processedStripeEvent = pgTable("processed_stripe_event", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at").notNull().defaultNow(),
});
