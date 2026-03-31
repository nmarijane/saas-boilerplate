import type { PresenceEntry } from "@/features/presence/helpers";
import { requireApiAuth } from "@/features/auth/api-auth";
import { getActiveOrgId } from "@/features/auth/organization/active-org";
import { diffPresence } from "@/features/presence/helpers";
import { cleanupStalePresence, getPresenceForOrg } from "@/features/presence/queries";

const POLL_INTERVAL_MS = 5_000;

export async function GET() {
  const auth = await requireApiAuth();
  if (!auth.authenticated) return auth.response;

  const orgId = await getActiveOrgId();
  if (!orgId) {
    return new Response("No active organization", { status: 400 });
  }

  const encoder = new TextEncoder();
  let previousEntries: PresenceEntry[] = [];
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Send initial full state
      const initial = await getPresenceForOrg(orgId);
      previousEntries = initial.map((e) => ({
        userId: e.userId,
        status: e.status,
        currentPage: e.currentPage,
      }));
      send({ type: "init", members: initial });

      // Poll loop
      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        try {
          await cleanupStalePresence();
          const current = await getPresenceForOrg(orgId);
          const currentEntries: PresenceEntry[] = current.map((e) => ({
            userId: e.userId,
            status: e.status,
            currentPage: e.currentPage,
          }));

          const diff = diffPresence(previousEntries, currentEntries);
          if (diff.changed.length > 0 || diff.removed.length > 0) {
            send({ type: "update", changed: diff.changed, removed: diff.removed, members: current });
            previousEntries = currentEntries;
          }
        } catch {
          // Silently skip poll errors — next poll will retry
        }
      }, POLL_INTERVAL_MS);

      // Cleanup when client disconnects
      void new Promise<void>((resolve) => {
        const checkClosed = setInterval(() => {
          if (closed) {
            clearInterval(checkClosed);
            clearInterval(interval);
            resolve();
          }
        }, 1_000);
      });
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
