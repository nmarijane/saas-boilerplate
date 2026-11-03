import { cn } from "@/shared/utils/cn";

// Each dot is 3:1 against a card and against the page, in light and in dark.
const dots = {
  success: "bg-success",
  neutral: "bg-ink-muted",
  warning: "bg-warning-bar",
  danger: "bg-danger",
  brand: "bg-brand",
} as const;

interface StatusDotProps {
  tone: keyof typeof dots;
  /** The state in words: the dot only echoes it. */
  label: string;
  /** For a place where the words already stand next to it: screen readers still get the label. */
  hideLabel?: boolean;
}

// The label takes the text style around it.
function StatusDot({ tone, label, hideLabel = false }: StatusDotProps) {
  return (
    <span data-slot="status-dot" className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", dots[tone])}
      />
      <span className={hideLabel ? "sr-only" : undefined}>{label}</span>
    </span>
  );
}

export { StatusDot };
export type { StatusDotProps };
