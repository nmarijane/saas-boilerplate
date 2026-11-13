"use client";

import type { ComponentProps } from "react";
import { BellIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { forwardRef } from "react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/cn";

type NotificationBellProps = { count: number } & Omit<
  ComponentProps<typeof Button>,
  "variant" | "size" | "children"
>;

// An icon button of 44 px. When something is unread it carries a dot of 8 px
// in the brand color, on the top right of the icon, ringed with the background
// of the sidebar and of the header (both are `--side-bg`) so that it reads as
// cut out of the bell. No number is drawn: the count is in the name of the
// button, which a dot cannot carry, and a figure on a 20 px icon would be
// 10 px text. Forced-colors mode drops every background but a system color, and
// the dot is what tells the eye that something is unread: it takes the
// highlight color there.
//
// The ref and the props go to the button: the popover that opens from the bell
// hands its trigger a ref, its `aria-expanded` and its click.
const NotificationBell = forwardRef<HTMLButtonElement, NotificationBellProps>(
  ({ count, className, ...props }, ref) => {
    const t = useTranslations("notifications");

    return (
      <Button
        ref={ref}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("bellLabel", { count })}
        className={cn("relative size-11", className)}
        {...props}
      >
        <BellIcon aria-hidden="true" className="size-5" />
        {count > 0 ? (
          <span
            data-slot="bell-dot"
            aria-hidden="true"
            className="absolute top-2.5 right-2.5 size-2 rounded-full bg-brand ring-2 ring-sidebar forced-colors:bg-[color:Highlight]"
          />
        ) : null}
      </Button>
    );
  },
);

NotificationBell.displayName = "NotificationBell";

export { NotificationBell };
