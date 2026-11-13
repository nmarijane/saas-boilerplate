"use client";

import type { ReactNode } from "react";
import type { ShellView } from "@/shared/shell/view";
import { useTranslations } from "next-intl";
import { ShellLogo } from "./logo";
import { NavList } from "./nav-list";

interface ShellMenuProps {
  view: ShellView;
  /** The workspace switcher, a feature's. */
  workspaceSwitcher: ReactNode;
  /** The account menu, a feature's. */
  accountMenu: ReactNode;
  /** Rows the features add under the secondary navigation, drawn like its rows. */
  sidebarActions?: ReactNode;
  /**
   * The id of the one link of the whole menu that stands for the page, or null
   * when none does. The shell decides it once over the three lists (main, admin,
   * secondary), so that the sidebar and the drawer agree and one link at most
   * is current: each list marks a link only if it is this one.
   */
  currentId: string | null;
  /** Called when a link is clicked: the drawer closes on it. */
  onNavigate?: () => void;
}

// What the sidebar and the drawer both hold, from the top: the workspace, the
// main navigation, the admin pages under a title of their own (when the person
// may see any), then Settings and Help with the actions of the features, and
// the account under a hairline. The empty space between the pages and Settings
// is the margin of that group, which pushes it to the bottom of a tall column.
// It is a fragment: the column that holds it (the sidebar, the drawer) sets the
// gap between the blocks.
function ShellMenu({
  view,
  workspaceSwitcher,
  accountMenu,
  sidebarActions,
  currentId,
  onNavigate,
}: ShellMenuProps) {
  const t = useTranslations("shell");
  const { main, admin, secondary } = view.nav;

  return (
    <>
      {workspaceSwitcher}
      <NavList
        items={main}
        label={t("mainNavigation")}
        currentId={currentId}
        onNavigate={onNavigate}
      />
      {admin.length > 0 && (
        <div className="flex flex-col gap-1">
          {/* The navigation is named by the same words: the title is not read twice. */}
          <p
            aria-hidden="true"
            className="px-2.5 text-caption font-semibold text-ink-muted"
          >
            {t("adminSection")}
          </p>
          <NavList
            items={admin}
            label={t("adminSection")}
            currentId={currentId}
            onNavigate={onNavigate}
          />
        </div>
      )}
      <div className="mt-auto flex flex-col gap-0.5">
        <NavList
          items={secondary}
          label={t("secondaryNavigation")}
          currentId={currentId}
          onNavigate={onNavigate}
        />
        {sidebarActions}
      </div>
      <div className="border-t border-sidebar-border pt-3">{accountMenu}</div>
    </>
  );
}

interface SidebarProps extends Omit<ShellMenuProps, "onNavigate"> {
  /** The bell, a feature's, next to the logo. */
  notifications?: ReactNode;
}

// The sidebar, from 1024 px: 248 px wide, as tall as the screen, and it scrolls
// inside when its content is taller. Under that width the header and the
// drawer take its place.
function Sidebar({ view, notifications, ...menu }: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-62 shrink-0 flex-col gap-5 overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-4 lg:flex">
      <div className="flex items-center justify-between gap-2 pl-1">
        <ShellLogo productName={view.productName} />
        {notifications ? <div className="shrink-0">{notifications}</div> : null}
      </div>
      <ShellMenu view={view} {...menu} />
    </aside>
  );
}

export { ShellMenu, Sidebar };
export type { ShellMenuProps };
