import type { RunStatus } from "./state";
import { and, eq } from "drizzle-orm";
import { requireOrgRole } from "@/features/auth/guards";
import { aiRuns, aiTools } from "@/models";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { canTransition } from "./state";

interface CreateRunInput {
  orgId: string;
  toolId: string;
  input: Record<string, unknown>;
  idempotencyKey: string;
}

// Creates a queued run. Repeating a call with the same key returns the same run.
export async function createRun({
  orgId,
  toolId,
  input,
  idempotencyKey,
}: CreateRunInput) {
  const { session } = await requireOrgRole(orgId, "member");

  const [existing] = await db
    .select()
    .from(aiRuns)
    .where(
      and(
        eq(aiRuns.organizationId, orgId),
        eq(aiRuns.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [tool] = await db
    .select()
    .from(aiTools)
    .where(and(eq(aiTools.id, toolId), eq(aiTools.status, "published")))
    .limit(1);
  if (!tool) throw new Error("Tool is not available");

  const [run] = await db
    .insert(aiRuns)
    .values({
      id: generateId(),
      organizationId: orgId,
      userId: session.user.id,
      toolId,
      input,
      idempotencyKey,
    })
    .returning();
  return run!;
}

// Internal (workers/webhooks): move a run to its next state, rejecting illegal jumps.
export async function transitionRun(
  runId: string,
  to: RunStatus,
  patch: { result?: Record<string, unknown>; error?: string } = {},
) {
  const [run] = await db.select().from(aiRuns).where(eq(aiRuns.id, runId));
  if (!run) throw new Error("Run not found");
  if (run.status === to) return run; // duplicate delivery
  if (!canTransition(run.status, to)) {
    throw new Error(`Invalid run transition: ${run.status} -> ${to}`);
  }

  const [updated] = await db
    .update(aiRuns)
    .set({ ...patch, status: to, updatedAt: new Date() })
    .where(and(eq(aiRuns.id, runId), eq(aiRuns.status, run.status)))
    .returning();
  if (!updated) throw new Error("Run changed concurrently");
  return updated;
}
