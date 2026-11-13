"use client";

import type { ShellMenuProps } from "./sidebar";
import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetTitle } from "@/shared/components/ui/sheet";
import { cn } from "@/shared/utils/cn";
import { ShellMenu } from "./sidebar";

/** The edge the drawer comes from: the left for Menu, the bottom for More. */
type DrawerSide = "left" | "bottom";

interface ShellDrawerProps extends Omit<ShellMenuProps, "onNavigate"> {
  open: boolean;
  side: DrawerSide;
  onOpenChange: (open: boolean) => void;
  /**
   * Called when the sheet has closed, to say where the focus goes. This sheet
   * has no Radix `Trigger` to give it back to, so the shell does (focus-return.ts).
   */
  onCloseAutoFocus?: (event: Event) => void;
}

// From the left it is a 288 px column, which leaves a strip of the page to tap
// on a small tablet. From the bottom it is as tall as its content, up to 85 %
// of the screen, and its top corners are rounded.
const SIDE_STYLES = {
  left: "w-72 max-w-[85vw] sm:max-w-72",
  bottom: "max-h-[85dvh] rounded-t-lg",
} as const satisfies Record<DrawerSide, string>;

// What the sidebar holds, for the sizes of screen that have none: the same
// column, in a modal sheet. The title is for assistive technology only, and
// there is no description to give it. The corner of the sheet is the close
// button's, so the content starts below it (`pt-14`). The sheet closes when a
// link in it is clicked, and the shell closes it when the route changes.
export function ShellDrawer({
  open,
  side,
  onOpenChange,
  onCloseAutoFocus,
  ...menu
}: ShellDrawerProps) {
  const t = useTranslations("shell");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        aria-describedby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
        className={cn("gap-0 bg-sidebar p-0", SIDE_STYLES[side])}
      >
        <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pt-14 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <ShellMenu {...menu} onNavigate={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export type { DrawerSide };
