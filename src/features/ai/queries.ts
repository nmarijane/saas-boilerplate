import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { aiConversation, aiCreditLedger, aiMessage } from "@/models/ai";
import { db } from "@/shared/lib/DB";
import "server-only";

export async function getConversations(userId: string, orgId: string) {
  return db
    .select({
      id: aiConversation.id,
      title: aiConversation.title,
      model: aiConversation.model,
      updatedAt: aiConversation.updatedAt,
    })
    .from(aiConversation)
    .where(
      and(
        eq(aiConversation.userId, userId),
        eq(aiConversation.organizationId, orgId),
      ),
    )
    .orderBy(desc(aiConversation.updatedAt))
    .limit(50);
}

export async function getMessages(conversationId: string) {
  return db
    .select({
      id: aiMessage.id,
      role: aiMessage.role,
      content: aiMessage.content,
      createdAt: aiMessage.createdAt,
    })
    .from(aiMessage)
    .where(eq(aiMessage.conversationId, conversationId))
    .orderBy(aiMessage.createdAt);
}

/** The latest `limit` messages of a conversation, oldest first: the history the model is given. */
export async function getLatestMessages(conversationId: string, limit: number) {
  const latest = await db
    .select({
      role: aiMessage.role,
      content: aiMessage.content,
    })
    .from(aiMessage)
    .where(eq(aiMessage.conversationId, conversationId))
    .orderBy(desc(aiMessage.createdAt), desc(aiMessage.id))
    .limit(limit);

  return latest.reverse();
}

/**
 * The credits a workspace has left. A debit reads it through the transaction
 * that holds the row of the workspace (`reader`), so that no other debit of the
 * workspace reads it before the first is written (the chat route).
 */
export async function getCreditBalance(orgId: string, reader: Pick<typeof db, "select"> = db): Promise<number> {
  const result = await reader
    // The SUM of an integer is a bigint: PostgreSQL sends it as a string, so it is read as a number here
    .select({ total: sql<number>`COALESCE(SUM(${aiCreditLedger.amount}), 0)`.mapWith(Number) })
    .from(aiCreditLedger)
    .where(eq(aiCreditLedger.organizationId, orgId));
  return result[0]?.total ?? 0;
}

/**
 * The credits a workspace has used since the first day of the month, in UTC
 * (the month `now` is in): what its ledger took out, as a positive number. What
 * was added to it (an allocation, an adjustment) is not use. The span has no
 * end: a row that a clock a little ahead stamped past midnight, on the last day
 * of the month, still counts.
 */
export async function getCreditsUsedThisMonth(
  orgId: string,
  now = new Date(),
): Promise<number> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [row] = await db
    .select({
      used: sql<number>`COALESCE(SUM(-${aiCreditLedger.amount}), 0)`.mapWith(Number),
    })
    .from(aiCreditLedger)
    .where(
      and(
        eq(aiCreditLedger.organizationId, orgId),
        lt(aiCreditLedger.amount, 0),
        gte(aiCreditLedger.createdAt, monthStart),
      ),
    );

  return row?.used ?? 0;
}

export async function getUsageStats(orgId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return db
    .select({
      date: sql<string>`DATE(${aiMessage.createdAt})`.as("date"),
      messages: sql<number>`COUNT(*)`.mapWith(Number).as("messages"),
      credits: sql<number>`COALESCE(SUM(${aiMessage.creditsUsed}), 0)`.mapWith(Number).as("credits"),
    })
    .from(aiMessage)
    .innerJoin(aiConversation, eq(aiMessage.conversationId, aiConversation.id))
    .where(
      and(
        eq(aiConversation.organizationId, orgId),
        sql`${aiMessage.createdAt} >= ${since}`,
      ),
    )
    .groupBy(sql`DATE(${aiMessage.createdAt})`)
    .orderBy(sql`DATE(${aiMessage.createdAt})`);
}