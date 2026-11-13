import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { NotificationItem } from "./notification-row";
import type { ShellView } from "@/shared/shell/view";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ShellProvider } from "@/shared/components/shell/shell-context";
import { NotificationCenter } from "./notification-center";
import { NotificationsProvider } from "./notifications-provider";

// The bell and its panel, in the column of the sidebar, under the provider the
// shell mounts. A story has no server: `fetch` answers what the API of the
// notifications would (the count, and the latest ten), and the server actions
// that mark a notification read are stubs (Storybook replaces every server
// action), so that what the server "holds" is what a story sets in `server`
// before it acts, as the real one would have changed by then. The panel is
// drawn in a portal under the body, so the `play` functions look for it there.

const COUNT_URL = "/api/notifications?countOnly=true";
const LIST_URL = "/api/notifications?limit=10";

const MINUTE = 60_000;

/** An ISO date, as the API gives it, this long ago. */
function ago(milliseconds: number): string {
  return new Date(Date.now() - milliseconds).toISOString();
}

/** Four notifications, two of them unread: a page of the app, none, a web address and the home. */
const ITEMS: NotificationItem[] = [
  {
    id: "n1",
    title: "Payment failed",
    body: "We could not charge the card ending in 4242. Update your payment method to keep your plan.",
    read: false,
    type: "warning",
    link: "/settings/billing",
    createdAt: ago(35 * MINUTE),
  },
  {
    id: "n2",
    title: "Camille joined Studio Nord",
    body: "Camille Laurent accepted your invitation.",
    read: false,
    type: "info",
    link: null,
    createdAt: ago(3 * 60 * MINUTE),
  },
  {
    id: "n3",
    title: "Your export is ready",
    body: "The file is available for 24 hours.",
    read: true,
    type: "success",
    link: "https://example.com/export",
    createdAt: ago(26 * 60 * MINUTE),
  },
  {
    id: "n4",
    title: "Welcome aboard",
    body: "Your workspace is ready. Invite your team to get started.",
    read: true,
    type: "info",
    link: "/dashboard",
    createdAt: ago(9 * 24 * 60 * MINUTE),
  },
];

/** What the stand-in API holds and what it was asked, which the stories read and change. */
const server = {
  unread: 0,
  list: async (): Promise<NotificationItem[]> => ITEMS,
  asked: [] as string[],
  /** Gives the answer to the first read of the count, which a story holds back. */
  releaseFirstCount: () => {},
  /** Gives the answers to the reads of the count that come after the first, which a story holds back. */
  releaseLaterCounts: () => {},
  /** Gives the answer to the first read of the list, for a story whose list holds it back. */
  releaseFirstList: () => {},
};

interface Setup {
  unread: number;
  /** How the API answers the list: it rejects for a failure, and never settles for an answer that does not come. */
  list?: () => Promise<NotificationItem[]>;
  /** Holds back the answer to the first read of the count, until `server.releaseFirstCount` is called. */
  holdFirstCount?: boolean;
  /** Holds back the answer to every read of the count after the first, until `server.releaseLaterCounts` is called. */
  holdLaterCounts?: boolean;
  /** Takes the errors the app reports (`reportError`) away from the page, for a story that fails on purpose. */
  catchReports?: boolean;
}

const reported = fn();

/** `beforeEach` of a story: the API answers as `setup` says, and everything is put back when the story ends. */
function serve({
  unread,
  list = async () => ITEMS,
  holdFirstCount = false,
  holdLaterCounts = false,
  catchReports = false,
}: Setup) {
  return () => {
    server.unread = unread;
    server.list = list;
    server.asked = [];
    server.releaseFirstCount = () => {};
    server.releaseFirstList = () => {};
    const laterCounts = new Promise<void>((resolve) => {
      server.releaseLaterCounts = resolve;
    });
    reported.mockClear();

    const originalFetch = globalThis.fetch;
    const originalReport = window.reportError;
    let counts = 0;

    globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.startsWith("/api/notifications")) {
        return originalFetch(input, init);
      }

      server.asked.push(url);
      if (url === COUNT_URL) {
        counts += 1;
        // The server answers what it holds when it is asked, however late the answer arrives.
        const count = server.unread;
        if (holdFirstCount && counts === 1) {
          await new Promise<void>((resolve) => {
            server.releaseFirstCount = resolve;
          });
        }
        if (holdLaterCounts && counts > 1) {
          await laterCounts;
        }
        return Response.json({ count });
      }

      try {
        return Response.json({ notifications: await server.list() });
      } catch {
        return Response.json({ error: "Failed to fetch notifications" }, { status: 500 });
      }
    };
    if (catchReports) {
      window.reportError = reported;
    }

    return () => {
      globalThis.fetch = originalFetch;
      window.reportError = originalReport;
    };
  };
}

/** Opens the panel from the bell, and hands back the page, the bell and the panel. */
async function openCenter(canvasElement: HTMLElement, name = "Notifications: 2 unread") {
  const page = within(canvasElement.ownerDocument.body);
  const bell = await within(canvasElement).findByRole("button", { name });

  await userEvent.click(bell);
  const dialog = await page.findByRole("dialog", { name: "Notifications" });
  // The panel fades in: it is in the page before it can be seen.
  await waitFor(() => expect(dialog).toBeVisible());

  return { page, bell, dialog };
}

// The bell and the list are drawn in the shell, which says the workspace the
// person works in: a notification of another one opens in its workspace.
const SHELL_VIEW: ShellView = {
  productName: "Example",
  user: { id: "user_1", name: "Camille Laurent", email: "camille@example.com", image: null, isPlatformAdmin: false },
  workspace: { id: "org_acme", name: "Acme", role: "owner", plan: "Pro" },
  workspaces: [{ id: "org_acme", name: "Acme", role: "owner", plan: "Pro" }],
  nav: { main: [], secondary: [], admin: [] },
  account: [],
  settings: [],
  quotas: [],
};

const meta = {
  title: "Features/NotificationCenter",
  component: NotificationCenter,
  parameters: {
    layout: "centered",
    nextjs: { appDirectory: true, navigation: { pathname: "/dashboard" } },
  },
  decorators: [
    (Story) => (
      <ShellProvider view={SHELL_VIEW}>
        <NotificationsProvider pollMs={600_000}>
          <div className="flex h-96 w-62 items-start justify-end bg-sidebar p-3">
            <Story />
          </div>
        </NotificationsProvider>
      </ShellProvider>
    ),
  ],
} satisfies Meta<typeof NotificationCenter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed, with something to read: the bell has its dot, and the provider read the count once. */
export const Default: Story = {
  beforeEach: serve({ unread: 2 }),
  play: async ({ canvasElement }) => {
    const bell = await within(canvasElement).findByRole("button", { name: "Notifications: 2 unread" });

    await expect(bell).toHaveAttribute("aria-haspopup", "dialog");
    await expect(bell).toHaveAttribute("aria-expanded", "false");
    await expect(canvasElement.querySelector('[data-slot="bell-dot"]')).toBeInTheDocument();
    await expect(server.asked).toEqual([COUNT_URL]);
  },
};

/** Nothing to read: no dot. */
export const NothingUnread: Story = {
  beforeEach: serve({ unread: 0, list: async () => ITEMS.map((item) => ({ ...item, read: true })) }),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(server.asked).toEqual([COUNT_URL]));

    await expect(within(canvasElement).getByRole("button", { name: "Notifications" })).toBeVisible();
    await expect(canvasElement.querySelector('[data-slot="bell-dot"]')).not.toBeInTheDocument();
  },
};

/**
 * Opened: the latest notifications, read when it opened, the unread ones with a
 * dot, "Mark all as read" in the header and the link to all of them at the foot.
 * The panel is named by its heading.
 */
export const Open: Story = {
  beforeEach: serve({ unread: 2 }),
  play: async ({ canvasElement }) => {
    const { bell, dialog } = await openCenter(canvasElement);
    const rows = await within(dialog).findAllByRole("listitem");

    await expect(bell).toHaveAttribute("aria-expanded", "true");
    await expect(within(dialog).getByRole("heading", { level: 2, name: "Notifications" })).toBeVisible();
    await expect(rows).toHaveLength(4);
    await expect(within(dialog).getAllByText("Unread")).toHaveLength(2);
    await expect(within(dialog).getByRole("button", { name: "Mark all as read" })).toBeVisible();
    // The Link of the app puts the language in front of the page.
    await expect(within(dialog).getByRole("link", { name: "View all notifications" })).toHaveAttribute(
      "href",
      "/en/settings/notifications",
    );
    await expect(server.asked).toEqual([COUNT_URL, LIST_URL]);
    // The focus rests on the panel, and not on the first button, which is the one that changes everything.
    await expect(dialog).toHaveFocus();
    await expect(within(dialog).getByRole("button", { name: "Mark all as read" })).not.toHaveFocus();
  },
};

/** While the list is read: three rows of skeleton, and a status that says so to assistive technology. The foot is there already. */
export const Loading: Story = {
  beforeEach: serve({ unread: 2, list: () => new Promise(() => {}) }),
  play: async ({ canvasElement }) => {
    const { dialog } = await openCenter(canvasElement);

    await expect(await within(dialog).findByRole("status")).toHaveTextContent("Loading…");
    await expect(dialog.querySelectorAll('[data-slot="notification-skeleton"]')).toHaveLength(3);
    await expect(within(dialog).getByRole("link", { name: "View all notifications" })).toBeVisible();
  },
};

/**
 * When the list cannot be read: the message, as an alert, and "Retry". The error
 * is reported, which the app hears, and told in the panel as well.
 */
export const LoadFailed: Story = {
  beforeEach: serve({
    unread: 2,
    catchReports: true,
    list: async () => {
      throw new Error("down");
    },
  }),
  play: async ({ canvasElement }) => {
    const { dialog } = await openCenter(canvasElement);

    await expect(await within(dialog).findByRole("alert")).toHaveTextContent("We couldn't load your notifications.");
    await expect(within(dialog).getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(within(dialog).queryByRole("listitem")).not.toBeInTheDocument();
    await expect(reported).toHaveBeenCalledOnce();
  },
};

/** Retrying reads the list again, and the focus does not fall on the page when the button goes. */
export const RetriesAfterAFailure: Story = {
  beforeEach: () => {
    let attempts = 0;

    return serve({
      unread: 2,
      catchReports: true,
      list: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("down");
        }
        return ITEMS;
      },
    })();
  },
  play: async ({ canvasElement }) => {
    const { dialog } = await openCenter(canvasElement);
    await within(dialog).findByRole("alert");

    await userEvent.click(within(dialog).getByRole("button", { name: "Retry" }));

    await expect(await within(dialog).findAllByRole("listitem")).toHaveLength(4);
    await expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    await expect(dialog.contains(dialog.ownerDocument.activeElement)).toBe(true);
  },
};

/** Nothing to list: a tile, what it is and what will come, and no way to mark anything. */
export const Empty: Story = {
  beforeEach: serve({ unread: 0, list: async () => [] }),
  play: async ({ canvasElement }) => {
    const { dialog } = await openCenter(canvasElement, "Notifications");

    await expect(await within(dialog).findByText("No notifications")).toBeVisible();
    await expect(within(dialog).getByText("New activity will show up here.")).toBeVisible();
    await expect(dialog.querySelector('[data-slot="icon-tile"]')).toBeInTheDocument();
    await expect(within(dialog).queryByRole("button", { name: "Mark all as read" })).not.toBeInTheDocument();
  },
};

/**
 * The count is read every half minute, and a notification that came since is in
 * the list before it is in the count: the bell has no dot yet, and the list
 * shows an unread row. "Mark all as read" is offered all the same.
 */
export const ListAheadOfTheCount: Story = {
  beforeEach: serve({ unread: 0 }),
  play: async ({ canvasElement }) => {
    const { dialog } = await openCenter(canvasElement, "Notifications");

    await within(dialog).findAllByRole("listitem");
    await expect(within(dialog).getAllByText("Unread")).toHaveLength(2);
    await expect(within(dialog).getByRole("button", { name: "Mark all as read" })).toBeVisible();
    await expect(canvasElement.querySelector('[data-slot="bell-dot"]')).not.toBeInTheDocument();
  },
};

/**
 * A notification that points to a page of the app: it is marked read, the count
 * is read again, the router goes there (it puts the language in front of the
 * page) and the panel closes.
 */
export const OpensAPage: Story = {
  beforeEach: serve({ unread: 2 }),
  play: async ({ canvasElement }) => {
    const { page, dialog } = await openCenter(canvasElement);
    const router = getRouter();

    // The server holds one unread notification once it has been told.
    server.unread = 1;
    await userEvent.click(await within(dialog).findByRole("button", { name: /Payment failed/ }));

    await waitFor(() => expect(router.push).toHaveBeenCalledOnce());
    await expect(router.push.mock.calls[0]?.[0]).toBe("/en/settings/billing");
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(
      await within(canvasElement).findByRole("button", { name: "Notifications: 1 unread" }),
    ).toBeVisible();
    await expect(server.asked).toEqual([COUNT_URL, LIST_URL, COUNT_URL]);
  },
};

/**
 * A notification with no link is only marked read: it loses its dot, the count
 * is read again, nothing is navigated to and the panel stays open for the next
 * one.
 */
export const OpensANotificationWithoutLink: Story = {
  beforeEach: serve({ unread: 2 }),
  play: async ({ canvasElement }) => {
    const { bell, dialog } = await openCenter(canvasElement);
    const router = getRouter();
    const row = await within(dialog).findByRole("button", { name: /Camille joined/ });

    await expect(within(row).getByText("Unread")).toBeInTheDocument();
    server.unread = 1;
    await userEvent.click(row);

    await waitFor(() => expect(within(row).queryByText("Unread")).not.toBeInTheDocument());
    await expect(
      await within(canvasElement).findByRole("button", { name: "Notifications: 1 unread" }),
    ).toBeVisible();
    await expect(router.push).not.toHaveBeenCalled();
    // Still open: a panel that closes is first "closed" for the bell, then gone, a moment later.
    await expect(bell).toHaveAttribute("aria-expanded", "true");
    await expect(dialog).toBeVisible();
    await expect(row).toHaveFocus();
  },
};

/**
 * Opening a notification settles on the call that tells the server: the count
 * goes down by one and the page opens while the count is still being read again
 * (that read never answers here), and when it does answer, it agrees.
 */
export const DoesNotWaitForTheCountToBeReadAgain: Story = {
  beforeEach: serve({ unread: 2, holdLaterCounts: true }),
  play: async ({ canvasElement }) => {
    const { dialog } = await openCenter(canvasElement);
    const router = getRouter();

    // What the server holds once it has been told.
    server.unread = 1;
    await userEvent.click(await within(dialog).findByRole("button", { name: /Payment failed/ }));

    await expect(
      await within(canvasElement).findByRole("button", { name: "Notifications: 1 unread" }),
    ).toBeVisible();
    await waitFor(() => expect(router.push).toHaveBeenCalledOnce());
    await expect(server.asked.filter((url) => url === COUNT_URL)).toHaveLength(2);

    server.releaseLaterCounts();
    await new Promise((resolve) => setTimeout(resolve, 100));

    await expect(within(canvasElement).getByRole("button", { name: "Notifications: 1 unread" })).toBeVisible();
  },
};

/**
 * "Mark all as read" does the same: the dots and the count go as soon as the
 * server has been told, before the count is read again.
 */
export const MarksAllWithoutWaitingForTheCount: Story = {
  beforeEach: serve({ unread: 2, holdLaterCounts: true }),
  play: async ({ canvasElement }) => {
    const { dialog } = await openCenter(canvasElement);
    await within(dialog).findAllByRole("listitem");

    server.unread = 0;
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark all as read" }));

    await waitFor(() => expect(within(dialog).queryAllByText("Unread")).toHaveLength(0));
    await expect(within(canvasElement).getByRole("button", { name: "Notifications" })).toBeVisible();
    await expect(canvasElement.querySelector('[data-slot="bell-dot"]')).not.toBeInTheDocument();
    // The count is being read again: the read was asked, and has not answered.
    await expect(server.asked.filter((url) => url === COUNT_URL)).toHaveLength(2);

    server.releaseLaterCounts();
  },
};

/**
 * A list that was asked for before "Mark all as read" is not shown: it would
 * bring the dots back. The first read of the list is slow here; "Mark all as
 * read" is pressed while it runs; the list is read again, now; and the slow
 * answer, when it comes at last, shows nothing.
 */
export const AListAskedBeforeMarkAllIsNotShown: Story = {
  beforeEach: () => {
    let reads = 0;

    return serve({
      unread: 2,
      list: () => {
        reads += 1;
        if (reads === 1) {
          return new Promise<NotificationItem[]>((resolve) => {
            server.releaseFirstList = () => resolve(ITEMS);
          });
        }
        return Promise.resolve(ITEMS.map((item) => ({ ...item, read: true })));
      },
    })();
  },
  play: async ({ canvasElement }) => {
    const { dialog } = await openCenter(canvasElement);
    await within(dialog).findByRole("status");

    // The server holds nothing unread once it has been told.
    server.unread = 0;
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark all as read" }));

    await expect(await within(dialog).findAllByRole("listitem")).toHaveLength(4);
    await expect(server.asked.filter((url) => url === LIST_URL)).toHaveLength(2);
    await expect(within(dialog).queryAllByText("Unread")).toHaveLength(0);

    server.releaseFirstList();
    await new Promise((resolve) => setTimeout(resolve, 150));

    await expect(within(dialog).queryAllByText("Unread")).toHaveLength(0);
    await expect(within(dialog).getAllByRole("listitem")).toHaveLength(4);
  },
};

/**
 * Mark all as read: every row loses its dot, the button goes with the count, the
 * dot of the bell goes, and the focus stays in the panel: the button that had
 * it is gone.
 */
export const MarksAllAsRead: Story = {
  beforeEach: serve({ unread: 2 }),
  play: async ({ canvasElement }) => {
    const { dialog } = await openCenter(canvasElement);
    await within(dialog).findAllByRole("listitem");

    // The server holds nothing unread once it has been told.
    server.unread = 0;
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark all as read" }));

    await waitFor(() => expect(within(dialog).queryAllByText("Unread")).toHaveLength(0));
    await waitFor(() =>
      expect(within(dialog).queryByRole("button", { name: "Mark all as read" })).not.toBeInTheDocument(),
    );
    await expect(within(canvasElement).getByRole("button", { name: "Notifications" })).toBeVisible();
    await expect(canvasElement.querySelector('[data-slot="bell-dot"]')).not.toBeInTheDocument();
    await expect(dialog).toHaveFocus();
  },
};

/** Escape closes the panel, and the focus is back on the bell. */
export const ClosesWithEscape: Story = {
  beforeEach: serve({ unread: 2 }),
  play: async ({ canvasElement }) => {
    const { page, bell } = await openCenter(canvasElement);

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(bell).toHaveFocus();
    await expect(bell).toHaveAttribute("aria-expanded", "false");
  },
};

/**
 * The panel reads its list again each time it opens, and the list it read the
 * time before stays in sight meanwhile, marked busy for assistive technology:
 * the skeleton is for the first opening, not a flash at each one. (The second
 * read never answers here, so that what is on screen is what was kept.)
 */
export const ReadsAgainEachTimeItOpens: Story = {
  beforeEach: () => {
    let reads = 0;

    return serve({
      unread: 2,
      list: () => {
        reads += 1;
        return reads === 1 ? Promise.resolve(ITEMS) : new Promise(() => {});
      },
    })();
  },
  play: async ({ canvasElement }) => {
    const { page, bell, dialog } = await openCenter(canvasElement);
    await within(dialog).findAllByRole("listitem");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());

    await userEvent.click(bell);
    const again = await page.findByRole("dialog", { name: "Notifications" });

    await expect(within(again).getAllByRole("listitem")).toHaveLength(4);
    await expect(again.querySelector('[data-slot="notification-skeleton"]')).not.toBeInTheDocument();
    await expect(within(again).getByRole("list")).toHaveAttribute("aria-busy", "true");
    await expect(server.asked.filter((url) => url === LIST_URL)).toHaveLength(2);
  },
};

/**
 * A read that refreshes the list and fails does not take the rows away: they
 * are old, not wrong. The list stops being busy, the error is reported, and
 * there is no message in their place.
 */
export const KeepsTheRowsWhenARefreshFails: Story = {
  beforeEach: () => {
    let reads = 0;

    return serve({
      unread: 2,
      catchReports: true,
      list: async () => {
        reads += 1;
        if (reads > 1) {
          throw new Error("down");
        }
        return ITEMS;
      },
    })();
  },
  play: async ({ canvasElement }) => {
    const { page, bell, dialog } = await openCenter(canvasElement);
    await within(dialog).findAllByRole("listitem");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());

    await userEvent.click(bell);
    const again = await page.findByRole("dialog", { name: "Notifications" });

    await waitFor(() => expect(reported).toHaveBeenCalledOnce());
    await waitFor(() => expect(within(again).getByRole("list")).not.toHaveAttribute("aria-busy"));
    await expect(within(again).getAllByRole("listitem")).toHaveLength(4);
    await expect(within(again).queryByRole("alert")).not.toBeInTheDocument();
  },
};

/** The text of the panel in French, and the plural of the name of the bell. */
export const French: Story = {
  globals: { locale: "fr" },
  beforeEach: serve({ unread: 2 }),
  play: async ({ canvasElement }) => {
    const { dialog } = await openCenter(canvasElement, "Notifications : 2 non lues");

    await expect(await within(dialog).findByRole("button", { name: "Tout marquer comme lu" })).toBeVisible();
    await expect(within(dialog).getByRole("link", { name: "Voir toutes les notifications" })).toBeVisible();
    await expect(within(dialog).getAllByText("Non lue")).toHaveLength(2);
  },
};

/**
 * The shell draws the bell twice, in the sidebar and in the header, and only
 * one is on screen at a time: both read their count from the one provider, and
 * the count is read once.
 */
export const TwoBellsOneTimer: Story = {
  beforeEach: serve({ unread: 2 }),
  render: () => (
    <div className="flex gap-3">
      <NotificationCenter />
      <NotificationCenter />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(within(canvasElement).getAllByRole("button", { name: "Notifications: 2 unread" })).toHaveLength(2),
    );

    await expect(server.asked).toEqual([COUNT_URL]);
  },
};

/**
 * Two reads of the count can come back out of order. The first is asked, and
 * its answer is late; the tab comes back into sight and a second read is asked,
 * and answered; then the first answer arrives, and it is not the count any more.
 */
export const AnOlderAnswerIsDropped: Story = {
  beforeEach: serve({ unread: 9, holdFirstCount: true }),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(server.asked).toEqual([COUNT_URL]));

    server.unread = 2;
    document.dispatchEvent(new Event("visibilitychange"));
    const bell = await within(canvasElement).findByRole("button", { name: "Notifications: 2 unread" });

    server.releaseFirstCount();
    await new Promise((resolve) => setTimeout(resolve, 150));

    await expect(server.asked).toEqual([COUNT_URL, COUNT_URL]);
    await expect(bell).toHaveAccessibleName("Notifications: 2 unread");
  },
};
