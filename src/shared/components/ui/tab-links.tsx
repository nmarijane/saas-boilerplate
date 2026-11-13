"use client";

import * as React from "react";

import {
  activeLink,
  tabStripStyles,
  tabStyles,
  watchActiveTab,
} from "@/shared/components/ui/tab-strip";
import { Link, usePathname } from "@/shared/lib/i18n-navigation";
import { cn } from "@/shared/utils/cn";
import { activeHref } from "@/shared/utils/paths";

interface TabLinkItem {
  /** The page the tab goes to, without the language: the Link adds it. */
  href: string;
  label: string;
  /** The tab is the current one on this page only, not on the pages under it: the overview of an entity, whose other tabs live below it. */
  exact?: boolean;
}

interface TabLinksProps {
  items: TabLinkItem[];
  /** What the navigation is, for assistive technology ("Project"): it is a landmark among others. */
  label: string;
  className?: string;
}

// The tabs of a page that switches by route (the sections of a project, the
// settings): a navigation of links, not a tab list, as each tab is a page of
// its own. It looks as Tabs does (tab-strip.ts), and the current link says
// `aria-current="page"`. The strip scrolls sideways when the links do not fit,
// and brings the current one into view when it mounts and when the route
// changes: the mark moves, and the watcher follows it.
function TabLinks({ items, label, className }: TabLinksProps) {
  const pathname = usePathname();
  const strip = React.useRef<HTMLUListElement>(null);

  React.useLayoutEffect(
    () =>
      strip.current ? watchActiveTab(strip.current, activeLink) : undefined,
    [],
  );

  const current = activeHref(items, pathname);

  return (
    <nav aria-label={label} data-slot="tab-links" className={className}>
      <ul ref={strip} role="list" className={tabStripStyles}>
        {items.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={item.href === current ? "page" : undefined}
              className={cn(
                tabStyles,
                "aria-[current=page]:text-ink aria-[current=page]:after:opacity-100",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { TabLinks };
export type { TabLinkItem, TabLinksProps };
