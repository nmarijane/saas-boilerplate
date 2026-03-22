"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuth } from "@/features/auth/guards";
import { aiConversation, aiCreditLedger } from "@/models/ai";
import { db } from "@/shared/lib/DB";
import { safeAction } from "@/shared/lib/safe-action";
import { generateId } from "@/shared/utils/helpers";

const createConversationSchema = z.object({
  orgId: z.string().min(1),
  model: z.string().min(1).default("gpt-4o-mini"),
  title: z.string().min(1).max(200).optional(),
});

export async function createConversation(
  input: z.infer<typeof createConversationSchema>,
) {
  return safeAction(async () => {
    const session = await requireAuth();
    const parsed = createConversationSchema.parse(input);
    const id = generateId();

    await db.insert(aiConversation).values({
      id,
      organizationId: parsed.orgId,
      userId: session.user.id,
      title: parsed.title ?? "New conversation",
      model: parsed.model,
    });

    revalidatePath("/ai");
    return { id };
  }, "Failed to create conversation");
}

const deleteConversationSchema = z.object({
  conversationId: z.string().min(1),
});

export async function deleteConversation(
  input: z.infer<typeof deleteConversationSchema>,
) {
  return safeAction(async () => {
    const session = await requireAuth();
    const parsed = deleteConversationSchema.parse(input);

    await db
      .delete(aiConversation)
      .where(
        and(
          eq(aiConversation.id, parsed.conversationId),
          eq(aiConversation.userId, session.user.id),
        ),
      );

    revalidatePath("/ai");
  }, "Failed to delete conversation");
}

const updateTitleSchema = z.object({
  conversationId: z.string().min(1),
  title: z.string().min(1).max(200),
});

export async function updateConversationTitle(
  input: z.infer<typeof updateTitleSchema>,
) {
  return safeAction(async () => {
    const session = await requireAuth();
    const parsed = updateTitleSchema.parse(input);

    await db
      .update(aiConversation)
      .set({ title: parsed.title, updatedAt: new Date() })
      .where(
        and(
          eq(aiConversation.id, parsed.conversationId),
          eq(aiConversation.userId, session.user.id),
        ),
      );

    revalidatePath("/ai");
  }, "Failed to update conversation title");
}

export async function addCredits(orgId: string, amount: number, reason: string, referenceId?: string) {
  const id = generateId();
  await db.insert(aiCreditLedger).values({
    id,
    organizationId: orgId,
    amount,
    reason,
    referenceId: referenceId ?? null,
  });
}