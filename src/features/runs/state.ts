import type { aiRuns } from "@/models";

export type RunStatus = (typeof aiRuns.$inferSelect)["status"];

const TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  queued: ["running", "cancelled", "failed"],
  running: ["succeeded", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: RunStatus, to: RunStatus) {
  return TRANSITIONS[from].includes(to);
}
