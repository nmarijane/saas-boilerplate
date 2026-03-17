import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/utils/cn";

const planColors: Record<string, string> = {
  free: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
  pro: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300",
  enterprise:
    "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900 dark:text-purple-300",
};

export function PlanBadge({ planId }: { planId: string }) {
  const label = planId.charAt(0).toUpperCase() + planId.slice(1);

  return (
    <Badge variant="outline" className={cn(planColors[planId])}>
      {label}
    </Badge>
  );
}
