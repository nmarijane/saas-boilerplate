import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./organization";
import { user } from "./user";

export const aiConversation = pgTable("ai_conversation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New conversation"),
  model: text("model").notNull().default("gpt-4o-mini"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("ai_conversation_org_idx").on(t.organizationId),
  index("ai_conversation_user_idx").on(t.userId),
]);

export const aiMessage = pgTable("ai_message", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => aiConversation.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "user" | "assistant" | "system"
  content: text("content").notNull(),
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  creditsUsed: integer("credits_used").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("ai_message_conversation_idx").on(t.conversationId),
]);

export const aiCreditLedger = pgTable("ai_credit_ledger", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // positive = add, negative = consume
  reason: text("reason").notNull(), // "plan_allocation", "usage", "admin_adjustment"
  referenceId: text("reference_id"), // message id, subscription id, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("ai_credit_ledger_org_idx").on(t.organizationId),
]);