"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuth, requireRole } from "@/features/auth/guards";
import { aiConversation } from "@/models/ai";
import { db } from "@/shared/lib/DB";
import { safeAction } from "@/shared/lib/safe-action";
import { ensureMonthlyAllocation } from "./service";

// addCredits lives in ./service: it is an internal operation. A conversation is
// started by the chat route, with its first message, in the active workspace.

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

export async function getCreditBalanceAction(orgId: string) {
  await requireRole(orgId, "member");
  // Looking at the balance is a use of the month: the allocation of the plan is granted now if it was not, so that a
  // workspace is never shown none before its first message
  return (await ensureMonthlyAllocation(orgId)).total;
}
