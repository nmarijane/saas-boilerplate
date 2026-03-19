import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

interface FeatureFlagRule {
  type: "plan" | "org";
  value: string;
}

export const featureFlag = pgTable("feature_flag", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  description: text("description").notNull().default(""),
  enabled: boolean("enabled").notNull().default(false),
  rules: jsonb("rules").$type<FeatureFlagRule[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
