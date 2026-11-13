"use client";

import type { MouseEvent, ReactNode } from "react";
import { MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import { ShellLogo } from "./logo";

interface MobileHeaderProps {
  productName: string;
  /** Whether the drawer this header opens is open. */
  menuOpen: boolean;
  /** It gets the click, to keep the button that opened the drawer and give the focus back to it. */
  onOpenMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  /** The bell, a feature's. */
  notifications?: ReactNode;
}

// The header under 1024 px, where the sidebar does not fit: stuck to the top,
// 56 px high. From 480 px it opens the drawer with a Menu button, then shows the
// logo, which takes the room left, and the bell. Under 480 px the tab bar
// navigates and Menu is hidden: the logo and the bell are what is left. The
// gap between its controls is 12 px, so that their 44 px targets do not
// overlap.
export function MobileHeader({
  productName,
  menuOpen,
  onOpenMenu,
  notifications,
}: MobileHeaderProps) {
  const t = useTranslations("shell");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-sidebar-border bg-sidebar py-1.5 pr-3 pl-4 lg:hidden">
      <Button
        type="button"
        variant="outline"
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        onClick={onOpenMenu}
        className="hidden xs:inline-flex"
      >
        <MenuIcon aria-hidden="true" />
        {t("menu")}
      </Button>
      <div className="flex min-w-0 flex-1">
        <ShellLogo productName={productName} />
      </div>
      {notifications ? <div className="shrink-0">{notifications}</div> : null}
    </header>
  );
}
