"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { aiConversation, aiCreditLedger, aiMessage } from "@/models/ai";
import { db } from "@/shared/lib/DB";

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

export async function getCreditBalance(orgId: string): Promise<number> {
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${aiCreditLedger.amount}), 0)` })
    .from(aiCreditLedger)
    .where(eq(aiCreditLedger.organizationId, orgId));
  return result[0]?.total ?? 0;
}

export async function getUsageStats(orgId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return db
    .select({
      date: sql<string>`DATE(${aiMessage.createdAt})`.as("date"),
      messages: sql<number>`COUNT(*)`.as("messages"),
      credits: sql<number>`COALESCE(SUM(${aiMessage.creditsUsed}), 0)`.as("credits"),
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