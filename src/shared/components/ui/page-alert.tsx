import {
  CircleCheckIcon,
  CircleXIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/utils/cn";

// Each tone has an icon of its own, so that it is never told by color alone.
// Info, success and warning sit on their tint tokens. There is no danger
// background token: danger mixes its color into the surface, as `--brand-tint`
// does with the brand.
const tones = {
  info: {
    icon: InfoIcon,
    classes: "bg-brand-tint text-brand-tint-ink",
  },
  success: {
    icon: CircleCheckIcon,
    classes: "bg-success-bg text-success-text",
  },
  warning: {
    icon: TriangleAlertIcon,
    classes: "bg-warning-bg text-warning-text",
  },
  danger: {
    icon: CircleXIcon,
    classes:
      "bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))] text-danger-text",
  },
} as const;

interface PageAlertProps {
  tone: keyof typeof tones;
  title?: string;
  children: React.ReactNode;
  /** A button or a link: at the end of the alert, below the message when it is narrow. */
  action?: React.ReactNode;
  className?: string;
}

// A message about the page, in the flow of the page. A warning or a danger
// interrupts assistive technology (`alert`); the others wait their turn (`status`).
// The layout follows the width of the alert, not the screen: a container query
// puts the action beside the message, or under it in a narrow column. The alert
// takes the width its parent gives it (a block, not a shrink-to-fit box).
function PageAlert({
  tone,
  title,
  children,
  action,
  className,
}: PageAlertProps) {
  const { icon: Icon, classes } = tones[tone];

  return (
    <div
      data-slot="page-alert"
      role={tone === "warning" || tone === "danger" ? "alert" : "status"}
      className={cn(
        "@container rounded-lg border border-current/25 p-4 text-body",
        classes,
        className,
      )}
    >
      <div className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-3 @md:grid-cols-[auto_1fr_auto]">
        <Icon aria-hidden="true" className="size-5 shrink-0" />
        <div className="min-w-0">
          {title ? <p className="font-semibold">{title}</p> : null}
          <div className={title ? "mt-0.5" : undefined}>{children}</div>
        </div>
        {action ? (
          <div className="col-start-2 @md:col-start-3 @md:row-start-1 @md:self-center">
            {action}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { PageAlert };
export type { PageAlertProps };
