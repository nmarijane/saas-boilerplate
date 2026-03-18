"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { feedback } from "@/models/feedback";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";

interface SubmitFeedbackInput {
  userId: string;
  orgId?: string;
  type: string;
  message: string;
  screenshotId?: string;
}

export async function submitFeedback(input: SubmitFeedbackInput) {
  const id = generateId();

  await db.insert(feedback).values({
    id,
    userId: input.userId,
    organizationId: input.orgId ?? null,
    type: input.type,
    message: input.screenshotId
      ? `${input.message}\n\n[Screenshot: /api/upload/${input.screenshotId}]`
      : input.message,
    status: "new",
  });

  revalidatePath("/");
  return { id };
}

export async function updateFeedbackStatus(
  feedbackId: string,
  status: "new" | "reviewed" | "done",
) {
  await db
    .update(feedback)
    .set({ status })
    .where(eq(feedback.id, feedbackId));
  revalidatePath("/");
}
