import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const changelogEntry = pgTable("changelog_entry", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  version: text("version"),
  publishedAt: timestamp("published_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
