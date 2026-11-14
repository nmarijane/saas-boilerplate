"use server";

import { z } from "zod";
import { requireAuth, requireRole } from "@/features/auth/guards";
import { safeAction } from "@/shared/lib/safe-action";
import { getLimitStatus } from "./plan-limits";

const statusSchema = z.object({
  orgId: z.string().min(1),
  limitKey: z.enum(["members", "projects", "storage"]),
});

/**
 * Where a workspace stands against a limit of its plan, for a member of it: what
 * a button needs to be locked before it is pressed ("Included in the Pro plan").
 * It decides nothing: the action that creates the thing checks the limit again.
 */
export async function getLimitStatusAction(input: z.infer<typeof statusSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = statusSchema.parse(input);
    await requireRole(parsed.orgId, "member");

    return getLimitStatus(parsed.orgId, parsed.limitKey);
  }, "Failed to read the limit");
}
