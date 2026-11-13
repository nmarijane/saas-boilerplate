import type { PlanConfig } from "../plans";

/** The lines of what a plan includes: its limits first, then the features that are on. A plain module, so that a Server Component and a client one both read it. */
export function includedLines(plan: PlanConfig): { kind: "limit" | "feature"; key: string; count?: number }[] {
  return [
    ...Object.entries(plan.limits).map(([key, count]) => ({ kind: "limit" as const, key, count })),
    ...Object.entries(plan.features)
      .filter(([, enabled]) => enabled)
      .map(([key]) => ({ kind: "feature" as const, key })),
  ];
}
