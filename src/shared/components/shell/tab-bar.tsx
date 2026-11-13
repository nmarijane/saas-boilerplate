"use client";

import type { MouseEvent } from "react";
import type { ShellLink } from "@/shared/shell/view";
import { EllipsisIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { splitTabBar } from "@/shared/shell/resolve";
import { cn } from "@/shared/utils/cn";
import { ShellAnchor } from "./nav-list";

// One to five columns, written out: Tailwind reads class names, and cannot build
// one from a number. The bar is full at five (four pages and More); with fewer
// pages the tabs share the width, instead of leaving a gap on the right.
const COLUMNS = [
  "grid-cols-1",
  "grid-cols-2",
  "grid-cols-3",
  "grid-cols-4",
  "grid-cols-5",
];

// A tab: a 22 px icon over a 12 px label, in a column of its own. The label is
// cut when it does not fit (French is longer). The current page is in ink and
// has a 2 px mark over it, in the color of the text: the mark does not rely on
// a color of its own. Forced-colors mode drops a background that is not a
// system color: the mark takes one there, as the tabs of a page do.
const tabStyles = [
  "relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-sm px-1 text-caption font-medium text-ink-muted",
  "transition-colors duration-150 ease-expo hover:text-ink",
  "[&_svg]:size-5.5 [&_svg]:shrink-0",
  "aria-[current=page]:font-semibold aria-[current=page]:text-ink",
  "aria-[current=page]:before:absolute aria-[current=page]:before:top-0 aria-[current=page]:before:left-1/2 aria-[current=page]:before:h-0.5 aria-[current=page]:before:w-7 aria-[current=page]:before:-translate-x-1/2 aria-[current=page]:before:rounded-full aria-[current=page]:before:bg-current",
  "forced-colors:aria-[current=page]:before:bg-[color:Highlight]",
].join(" ");

interface TabBarProps {
  /** Every page of the main navigation: the bar keeps the first four, the drawer has the rest. */
  links: ShellLink[];
  /**
   * The id of the one link of the whole menu that stands for the page, or null:
   * the shell decides it once over every list, not over the tabs alone. A page
   * that is behind More, or in another list, marks no tab, rather than the tab
   * of the page it is under.
   */
  currentId: string | null;
  /** Whether the drawer that More opens is open. */
  moreOpen: boolean;
  /** It gets the click, to keep the button that opened the drawer and give the focus back to it. */
  onOpenMore: (event: MouseEvent<HTMLButtonElement>) => void;
}

// The navigation under 480 px: stuck to the bottom, over a hairline, above the
// safe area of a phone. Four pages at most, then More, which opens the drawer
// from the bottom with everything else: the other pages, the admin pages,
// Settings and Help, the workspace and the account.
export function TabBar({
  links,
  currentId,
  moreOpen,
  onOpenMore,
}: TabBarProps) {
  const t = useTranslations("shell");
  const { tabs } = splitTabBar(links);

  return (
    <nav
      aria-label={t("mainNavigation")}
      className={cn(
        "sticky bottom-0 z-30 grid border-t border-sidebar-border bg-sidebar px-1 pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))] xs:hidden",
        COLUMNS[tabs.length],
      )}
    >
      {tabs.map((link) => (
        <ShellAnchor
          key={link.id}
          link={link}
          aria-current={link.id === currentId ? "page" : undefined}
          className={tabStyles}
        >
          {link.icon}
          <span className="max-w-full truncate">{link.label}</span>
        </ShellAnchor>
      ))}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={moreOpen}
        onClick={onOpenMore}
        className={tabStyles}
      >
        <EllipsisIcon aria-hidden="true" />
        <span className="max-w-full truncate">{t("more")}</span>
      </button>
    </nav>
  );
}
