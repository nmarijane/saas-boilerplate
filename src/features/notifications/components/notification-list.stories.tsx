import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { NotificationItem } from "../list-state";
import type { ShellView } from "@/shared/shell/view";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ShellProvider } from "@/shared/components/shell/shell-context";
import { Toaster } from "@/shared/components/ui/sonner";
import { NotificationList } from "./notification-list";
import { NotificationsProvider } from "./notifications-provider";

// The latest notifications of the person, as the Notifications page draws them,
// under the provider the shell mounts. A story has no server: the server action
// that marks a notification read is a stub (Storybook replaces every server
// action) that always works, and `fetch` answers what the API of the
// notifications would (the count), so that the provider reads it as it does in
// the app.

const MINUTE = 60_000;

/** An ISO date, as the page gives it, this long ago: "2 hours ago" stays "2 hours ago" whenever the story is opened. */
function ago(milliseconds: number): string {
  return new Date(Date.now() - milliseconds).toISOString();
}

/** Four notifications, two of them unread: a page of the app, none, a web address and an address that is no page. */
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

/** `beforeEach` of a story: the API answers the count with nothing unread, and everything is put back when the story ends. */
function serve() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith("/api/notifications")) {
      return originalFetch(input, init);
    }

    return Response.json({ count: 0 });
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
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
  title: "Features/NotificationList",
  component: NotificationList,
  tags: ["autodocs"],
  args: { notifications: ITEMS },
  argTypes: { notifications: { control: "object" } },
  beforeEach: serve,
  parameters: {
    // A notification is followed, or the page read again, through the router of the
    // app: Storybook has none, and mounts a stand-in for the stories that say they
    // use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/settings/notifications" } },
  },
  decorators: [
    (Story) => (
      <ShellProvider view={SHELL_VIEW}>
        <NotificationsProvider pollMs={600_000}>
          <div className="max-w-2xl">
            <Story />
          </div>
          <Toaster />
        </NotificationsProvider>
      </ShellProvider>
    ),
  ],
} satisfies Meta<typeof NotificationList>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A card titled by a level-two heading, which names the list; each notification
 * is a row, the unread ones with a dot and the word "Unread" for assistive
 * technology, as the rows of the bell's panel are.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole("list", { name: "Latest notifications" });

    await expect(canvas.getByRole("heading", { level: 2, name: "Latest notifications" })).toBeVisible();
    await expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    await expect(within(list).getAllByText("Unread")).toHaveLength(2);
  },
};

/**
 * A notification that points to a page of the app: it is marked read, and the
 * router goes there (it puts the language in front of the page).
 */
export const OpensAPage: Story = {
  play: async ({ canvasElement }) => {
    const router = getRouter();

    await userEvent.click(within(canvasElement).getByRole("button", { name: /Payment failed/ }));

    await waitFor(() => expect(router.push).toHaveBeenCalledOnce());
    await expect(router.push.mock.calls[0]?.[0]).toBe("/en/settings/billing");
  },
};

/** A notification with no link is only marked read, and the page is read again to say so. */
export const MarksWithoutALink: Story = {
  play: async ({ canvasElement }) => {
    const router = getRouter();

    await userEvent.click(within(canvasElement).getByRole("button", { name: /Camille joined/ }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    await expect(router.push).not.toHaveBeenCalled();
  },
};

/** The same list in French: the time reads in the language of the page. */
export const French: Story = {
  globals: { locale: "fr" },
  args: {
    notifications: [{ ...ITEMS[0] as NotificationItem, title: "Paiement refusé", body: "Nous n'avons pas pu débiter la carte se terminant par 4242." }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("heading", { level: 2, name: "Dernières notifications" })).toBeVisible();
    await expect(canvas.getByText("Non lue")).toBeInTheDocument();
    await expect(canvas.getByText("il y a 35 minutes")).toBeInTheDocument();
  },
};
