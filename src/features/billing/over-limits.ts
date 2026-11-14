import type { PlanConfig } from "./plans";

/**
 * What a workspace holds above the limits of a plan: the limits it would be over
 * if it moved to it (a limit of -1 is unlimited and is never over). Nothing is
 * deleted by a change of plan: what is over stays, and nothing can be added to it
 * until the workspace is under again.
 */
export function overLimits(plan: PlanConfig, usage: Record<string, number>): { key: string; used: number; limit: number }[] {
  return Object.entries(plan.limits)
    .filter(([key, limit]) => limit >= 0 && key in usage && (usage[key] ?? 0) > limit)
    .map(([key, limit]) => ({ key, used: usage[key] ?? 0, limit }));
}
