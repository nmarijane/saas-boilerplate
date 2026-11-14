import type { UsageReader } from "@/shared/shell/contract";
import { and, desc, eq, sql } from "drizzle-orm";
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
 * The credits a workspace has left to spend now: what is left of this month's
 * allocation and of the packs it bought. It writes nothing (the allocation is
 * granted by `ensureMonthlyAllocation`, at the first use in the month), and is
 * read through the transaction that holds the workspace when a debit decides.
 */
export async function getCreditBalance(orgId: string, reader: UsageReader = db): Promise<number> {
  const { allocation, packs } = await readCredits(orgId, periodOf(), reader);

  return Math.max(0, allocation) + Math.max(0, packs);
}

/** The calendar month (UTC) a date falls in, as the ledger writes it: "2026-11". */
export function periodOf(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * What a workspace has left: the allocation of the period and the packs. It
 * writes nothing: a debit reads it through the transaction that holds the row of
 * the workspace (`reader`), so that no other debit of the workspace reads it
 * before the first is written (the chat route).
 */
export async function readCredits(orgId: string, period = periodOf(), reader: UsageReader = db): Promise<{ allocation: number; packs: number; granted: number }> {
  const [row] = await reader
    .select({
      // The SUM of an integer is a bigint: PostgreSQL sends it as a string, so it is read as a number here
      allocation: sql<number>`COALESCE(SUM(${aiCreditLedger.amount}) FILTER (WHERE ${aiCreditLedger.bucket} = 'allocation' AND ${aiCreditLedger.period} = ${period}), 0)`.mapWith(Number),
      granted: sql<number>`COALESCE(SUM(${aiCreditLedger.amount}) FILTER (WHERE ${aiCreditLedger.bucket} = 'allocation' AND ${aiCreditLedger.period} = ${period} AND ${aiCreditLedger.amount} > 0), 0)`.mapWith(Number),
      packs: sql<number>`COALESCE(SUM(${aiCreditLedger.amount}) FILTER (WHERE ${aiCreditLedger.bucket} = 'pack'), 0)`.mapWith(Number),
    })
    .from(aiCreditLedger)
    .where(eq(aiCreditLedger.organizationId, orgId));

  return { allocation: row?.allocation ?? 0, packs: row?.packs ?? 0, granted: row?.granted ?? 0 };
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