"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireAuth, requireRole } from "@/features/auth/guards";
import { feedback } from "@/models/feedback";
import { db } from "@/shared/lib/DB";
import { enforceActionRateLimit } from "@/shared/lib/rate-limit/action";
import { generateId } from "@/shared/utils/helpers";

const submitFeedbackSchema = z.object({
  orgId: z.string().min(1).optional(),
  type: z.string().min(1).max(50),
  message: z.string().min(1).max(5000),
  screenshotId: z.string().min(1).max(100).optional(),
});

const updateStatusSchema = z.object({
  feedbackId: z.string().min(1).max(100),
  status: z.enum(["new", "reviewed", "done"]),
});

// The author is always the session user, never an id sent by the client.
export async function submitFeedback(input: z.infer<typeof submitFeedbackSchema>) {
  const session = await requireAuth();
  await enforceActionRateLimit(`feedback:${session.user.id}`, 10, 60);
  const parsed = submitFeedbackSchema.parse(input);

  if (parsed.orgId) {
    await requireRole(parsed.orgId, "member");
  }

  const id = generateId();

  await db.insert(feedback).values({
    id,
    userId: session.user.id,
    organizationId: parsed.orgId ?? null,
    type: parsed.type,
    message: parsed.screenshotId
      ? `${parsed.message}\n\n[Screenshot: /api/upload/${parsed.screenshotId}]`
      : parsed.message,
    status: "new",
  });

  revalidatePath("/");
  return { id };
}

export async function updateFeedbackStatus(
  feedbackId: string,
  status: "new" | "reviewed" | "done",
) {
  await requireAdmin();
  const parsed = updateStatusSchema.parse({ feedbackId, status });

  await db
    .update(feedback)
    .set({ status: parsed.status })
    .where(eq(feedback.id, parsed.feedbackId));
  revalidatePath("/");
}
