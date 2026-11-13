import { Badge } from "@/shared/components/ui/badge";
import { capitalize } from "@/shared/utils/helpers";
import { getPlanById } from "../plans";

// The free plan stays quiet, a paid plan wears the brand, the top one a success
// tone. A plan a project adds falls back to the quiet one.
const planTones: Partial<Record<string, "neutral" | "brand" | "success">> = {
  free: "neutral",
  pro: "brand",
  enterprise: "success",
};

export function PlanBadge({ planId }: { planId: string }) {
  return (
    <Badge variant={planTones[planId] ?? "neutral"}>{getPlanById(planId)?.name ?? capitalize(planId)}</Badge>
  );
}
