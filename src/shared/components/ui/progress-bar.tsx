import type { CSSProperties } from "react";

import { cn } from "@/shared/utils/cn";

type QuotaState = "ok" | "warning" | "limit";

/** A value inside 0..max: negative and NaN count as nothing used, infinity as all of it. */
function clampToRange(value: number, max: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), max);
}

// 2.4 of 3 is 80 %, though 2.4 / 3 is 0.7999999999999999: the thresholds leave
// room for the rounding of a division.
const ROUNDING = 1e-9;

/**
 * How full a quota is: `warning` from 80 %, `limit` once it is reached. A
 * maximum that is negative (unlimited), NaN or infinite has no limit to reach,
 * and a maximum of nothing is already reached.
 */
function quotaState(value: number, max: number): QuotaState {
  if (Number.isNaN(max) || max < 0 || max === Infinity) {
    return "ok";
  }
  if (max === 0) {
    return "limit";
  }

  const share = clampToRange(value, max) / max;
  if (share >= 1 - ROUNDING) {
    return "limit";
  }
  return share >= 0.8 - ROUNDING ? "warning" : "ok";
}

// One background class per fill: tailwind-merge reads `bg-signature` (a
// gradient) as a color, so the class is picked here and never merged with
// another.
const quotaFills = {
  ok: "bg-bar",
  warning: "bg-warning-bar",
  limit: "bg-danger",
} as const;

interface ProgressBarProps {
  value: number;
  /** A negative maximum is unlimited, and NaN or Infinity is not a size: nothing is drawn, and the text beside the bar says so. */
  max: number;
  /** What the bar counts ("AI credits this month"): its accessible name, and where its unit is named. */
  label: string;
  /** `quota` (the default) turns warning, then danger, as it fills; `signature` stays on the brand gradient. */
  tone?: "signature" | "quota";
  className?: string;
}

function ProgressBar({
  value,
  max,
  label,
  tone = "quota",
  className,
}: ProgressBarProps) {
  if (!Number.isFinite(max) || max < 0) {
    return null;
  }

  // The range a progress bar announces is 0 to its maximum, whatever the value.
  const used = clampToRange(value, max);
  // A maximum of nothing is already reached: the bar is full.
  const share = max === 0 ? 1 : Math.round((used / max) * 10_000) / 10_000;
  const fill =
    tone === "signature" ? "bg-signature" : quotaFills[quotaState(used, max)];

  return (
    <div
      data-slot="progress-bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={used}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-track forced-colors:border",
        className,
      )}
    >
      {/*
        The fill is full width, scaled from its start: it arrives (and moves on
        a new value) by transition, with no layout. The track clips its start;
        scaling a rounded end would squash it, so its end is square.
      */}
      <div
        data-slot="progress-bar-fill"
        style={{ "--fill": share } as CSSProperties}
        className={cn(
          "h-full origin-left scale-x-(--fill) transition-transform duration-320 ease-expo starting:scale-x-0 motion-reduce:transition-none forced-colors:bg-[color:Highlight]",
          fill,
        )}
      />
    </div>
  );
}

export { ProgressBar, quotaState };
export type { ProgressBarProps, QuotaState };
