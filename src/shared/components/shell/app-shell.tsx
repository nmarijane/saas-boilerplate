"use client";

import type { MouseEvent, ReactNode } from "react";
import type { DrawerSide } from "./drawer";
import type { DrawerState } from "./drawer-state";
import type { ShellView } from "@/shared/shell/view";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "@/shared/lib/i18n-navigation";
import { ShellDrawer } from "./drawer";
import { syncDrawer } from "./drawer-state";
import { returnFocus } from "./focus-return";
import { MobileHeader } from "./mobile-header";
import { currentLinkId } from "./nav-row";
import { refreshWhenVisible } from "./refresh-on-visible";
import { ShellProvider } from "./shell-context";
import { Sidebar } from "./sidebar";
import { SkipLink } from "./skip-link";
import { TabBar } from "./tab-bar";

interface AppShellProps {
  /** What the layout read for the person: their workspace, the links of the features. */
  view: ShellView;
  /** The workspace switcher, a feature's (it is drawn in the sidebar and in the drawer). */
  workspaceSwitcher: ReactNode;
  /** The account menu, a feature's (the sidebar and the drawer). */
  accountMenu: ReactNode;
  /** The bell, when a feature gives one (the sidebar and the header). */
  notifications?: ReactNode;
  /** Rows under the secondary navigation, when features give some. */
  sidebarActions?: ReactNode;
  children: ReactNode;
}

// The frame of the connected space. It is presentational: the layout reads the
// data (src/features/app-shell.ts) and hands it over, with the slots that
// features fill (workspace switcher, account menu, bell, actions), and this
// file draws them, never importing a feature.
//
// One frame, three layouts, switched by the width of the screen in CSS (so the
// server draws the same page for every device):
//   - from 1024 px, a sidebar of 248 px;
//   - from 480 to 1024 px, a header with a Menu button that opens a drawer on
//     the left, and no sidebar;
//   - under 480 px, the same header without the button, and a tab bar at the
//     bottom whose last tab, More, opens the drawer from the bottom.
// `data-shell` on the root is what global.css reads to pad the scroll under the
// two sticky bars and to size the pages that fill the screen.
function AppShell({
  view,
  workspaceSwitcher,
  accountMenu,
  notifications,
  sidebarActions,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const page = { pathname, workspaceId: view.workspace?.id ?? null };

  // The shell catches up with the session when the person comes back to the tab
  // (refresh-on-visible.ts): a switch, a role or a removal made elsewhere shows.
  useEffect(() => refreshWhenVisible(() => router.refresh()), [router]);
  const [drawer, setDrawer] = useState<DrawerState>({
    open: false,
    side: "left",
    ...page,
  });

  // The drawer belongs to the page and the workspace it was opened over. A link
  // in it, the account menu or the back button change the route; switching
  // workspace changes the workspace, and not always the route (it pushes the
  // home, which is where the person may already be): either closes it. The
  // state is adjusted while rendering, as React advises, and not in an effect,
  // which would draw the drawer once more over the new page. drawer-state.ts
  // holds the rule.
  const synced = syncDrawer(drawer, page);
  if (synced !== drawer) {
    setDrawer(synced);
  }

  // Where the focus goes back to when the drawer closes (focus-return.ts): the
  // control that opened it, kept from its click (`currentTarget`: Safari does not
  // focus a button that is clicked, so the active element would be the body), and
  // the page it was opened on, to tell a close that changed the page, whose focus
  // is not ours to undo. `route` holds the page as the last commit left it: Radix
  // asks for the focus a tick after the sheet unmounts, and the closure of an
  // older render would still hold the page the drawer was opened on.
  const opener = useRef<HTMLElement | null>(null);
  const openedAt = useRef(pathname);
  const route = useRef(pathname);
  useLayoutEffect(() => {
    route.current = pathname;
  }, [pathname]);

  const openDrawer =
    (side: DrawerSide) => (event: MouseEvent<HTMLButtonElement>) => {
      opener.current = event.currentTarget;
      openedAt.current = route.current;
      setDrawer({ open: true, side, ...page });
    };

  const restoreFocus = (event: Event) => {
    returnFocus(event, opener.current, route.current !== openedAt.current, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
  };

  // One link of the whole menu is current at most, decided once over the three
  // lists in the order the sidebar draws them (a main page at /settings/team
  // beats Settings, which stands for every page under /settings), and told to
  // the sidebar, the drawer and the tab bar alike.
  const { main, admin, secondary } = view.nav;
  const currentId =
    currentLinkId([...main, ...admin, ...secondary], pathname) ?? null;

  const menu = {
    view,
    workspaceSwitcher,
    accountMenu,
    sidebarActions,
    currentId,
  };

  return (
    <ShellProvider view={view}>
      <div data-shell className="flex min-h-dvh">
        <SkipLink />
        <Sidebar {...menu} notifications={notifications} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileHeader
            productName={view.productName}
            menuOpen={drawer.open && drawer.side === "left"}
            onOpenMenu={openDrawer("left")}
            notifications={notifications}
          />
          <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-hidden">
            <div className="mx-auto w-full max-w-280 px-4 py-6 xs:px-6 xs:py-8 lg:px-10 lg:py-10">
              {children}
            </div>
          </main>
          <TabBar
            links={main}
            currentId={currentId}
            moreOpen={drawer.open && drawer.side === "bottom"}
            onOpenMore={openDrawer("bottom")}
          />
        </div>
        <ShellDrawer
          {...menu}
          open={drawer.open}
          side={drawer.side}
          onOpenChange={(open) => setDrawer((current) => ({ ...current, open }))}
          onCloseAutoFocus={restoreFocus}
        />
      </div>
    </ShellProvider>
  );
}

export { AppShell };
export type { AppShellProps };
