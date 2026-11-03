import type {LucideIcon} from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { cn } from "@/shared/utils/cn";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    /** The change, which carries the sign: 5 reads "+5%", -5 reads "−5%". */
    value: number;
    /** Whether the change is good. It sets the color, not the sign: more churn is `{ value: 5, positive: false }`. */
    positive: boolean;
  };
  className?: string;
}

// A true minus sign, as a fall reads among the figures around it.
const MINUS = "\u2212";

/** The sign a trend carries: it comes from the figure, not from its color. */
function signOf(value: number) {
  if (value > 0) {
    return "+";
  }
  return value < 0 ? MINUS : "";
}

// One figure, set in a monospace face with tabular figures so that a row of
// cards lines up. The tile sits at the top, whether or not there is a trend
// under the figure. The trend takes its sign from its value and its color from
// `positive`, which says whether the change is good: a rise in churn reads
// "+5%" in the danger color, and the color never stands alone.
export function StatCard({
  title,
  value,
  icon,
  trend,
  className,
}: StatCardProps) {
  return (
    <Card className={className}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-meta text-ink-muted">{title}</p>
          <p className="font-mono text-panel font-medium tabular-nums wrap-break-word text-ink">
            {value}
          </p>
          {trend && (
            <p
              className={cn(
                "text-meta font-medium tabular-nums",
                trend.positive ? "text-success-text" : "text-danger-text"
              )}
            >
              {signOf(trend.value)}
              {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <IconTile icon={icon} />
      </CardContent>
    </Card>
  );
}
