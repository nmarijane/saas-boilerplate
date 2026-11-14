import { and, eq, lt } from "drizzle-orm";
import { stripeEvent } from "@/models";
import { db } from "@/shared/lib/DB";
import "server-only";

// A delivery of the payment provider is claimed before it is handled. The
// provider sends an event at least once, sometimes twice, sometimes at the same
// moment to two servers: the claim is one insert of its id, so only one of them
// handles it, and one that already ran changes nothing the second time.

/** How long a claim holds before another delivery may take it over: a handler that died leaves one behind. */
const LEASE_MS = 2 * 60_000;

type Claim = "claimed" | "done" | "busy";

/**
 * Claims an event: `claimed` when this delivery is the one that handles it,
 * `done` when it was handled before (answer 200 and do nothing), `busy` when
 * another delivery is handling it right now (answer an error: the provider tries
 * again, and finds it done).
 */
export async function claimEvent(id: string, type: string, now = new Date()): Promise<Claim> {
  const inserted = await db.insert(stripeEvent).values({ id, type }).onConflictDoNothing().returning();
  if (inserted.length > 0) {
    return "claimed";
  }

  const [existing] = await db.select().from(stripeEvent).where(eq(stripeEvent.id, id)).limit(1);
  if (!existing) {
    return claimEvent(id, type, now);
  }
  if (existing.status === "done") {
    return "done";
  }

  // The claim of a handler that is gone is taken over, by one delivery: the write is conditional on the lease
  const taken = await db
    .update(stripeEvent)
    .set({ updatedAt: now })
    .where(and(eq(stripeEvent.id, id), eq(stripeEvent.status, "processing"), lt(stripeEvent.updatedAt, new Date(now.getTime() - LEASE_MS))))
    .returning();

  return taken.length > 0 ? "claimed" : "busy";
}

/** The event was handled: the provider's next delivery of it is answered and left alone. */
export async function completeEvent(id: string): Promise<void> {
  await db.update(stripeEvent).set({ status: "done", updatedAt: new Date() }).where(eq(stripeEvent.id, id));
}

/** The handler failed: the claim is let go, so that the provider's next delivery is handled. */
export async function releaseEvent(id: string): Promise<void> {
  await db.delete(stripeEvent).where(and(eq(stripeEvent.id, id), eq(stripeEvent.status, "processing")));
}
