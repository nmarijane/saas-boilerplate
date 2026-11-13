import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
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
  reason: text("reason").notNull(), // "plan_allocation", "plan_change", "credit_pack", "usage", "admin_adjustment"
  referenceId: text("reference_id"), // message id (conversation id for an answer with no text), checkout session id of a pack, etc.
  /**
   * Where the credits come from: `allocation` (the plan's monthly credits, which
   * do not carry over: they count in their `period` alone) or `pack` (bought,
   * never expire, spent after the allocation). A debit is written once per
   * bucket it takes from.
   */
  bucket: text("bucket").notNull().default("pack"),
  /** The calendar month (UTC, "2026-11") of an `allocation` row; null for a pack. */
  period: text("period"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("ai_credit_ledger_org_idx").on(t.organizationId),
  // One allocation per workspace and month: the lazy grant is idempotent by this
  uniqueIndex("ai_credit_ledger_allocation_idx").on(t.organizationId, t.period).where(sql`${t.reason} = 'plan_allocation'`),
  // One credit per pack bought: a webhook delivered twice adds nothing
  uniqueIndex("ai_credit_ledger_pack_idx").on(t.referenceId).where(sql`${t.reason} = 'credit_pack'`),
]);

/**
 * The free monthly credits are granted once per owner and month, not once per
 * workspace: this row outlives the workspace it was granted to (no foreign key
 * on `organization_id`), so that deleting a free workspace and making another
 * one gives nothing again.
 */
export const aiFreeCreditGrant = pgTable("ai_free_credit_grant", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  organizationId: text("organization_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("ai_free_credit_grant_owner_period_idx").on(t.userId, t.period),
]);
