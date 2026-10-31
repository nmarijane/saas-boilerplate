import { aiCreditLedger } from "@/models/ai";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import "server-only";

// Internal operations, called by billing webhooks and jobs.
// Never a server action: anyone could otherwise credit any organization.

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
