import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Toaster } from "@/shared/components/ui/sonner";
import { MarkAllReadButton } from "./mark-all-read-button";
import { NotificationsProvider } from "./notifications-provider";

// The one button of the Notifications page, under the provider the shell mounts.
// A story has no server: the server action that marks everything read is a stub
// (Storybook replaces every server action) that always works, and `fetch`
// answers what the API of the notifications would (the count), so that the
// provider reads it as it does in the app. The button is in a main region, as it
// is on the page, which can take the focus.

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

const meta = {
  title: "Features/MarkAllReadButton",
  component: MarkAllReadButton,
  tags: ["autodocs"],
  beforeEach: serve,
  parameters: {
    layout: "centered",
    // The page is read again once everything is marked, through the router of the
    // app: Storybook has none, and mounts a stand-in for the stories that say they
    // use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/settings/notifications" } },
  },
  decorators: [
    (Story) => (
      <NotificationsProvider pollMs={600_000}>
        <main id="main-content" tabIndex={-1} className="p-6 focus:outline-hidden">
          <Story />
        </main>
        <Toaster />
      </NotificationsProvider>
    ),
  ],
} satisfies Meta<typeof MarkAllReadButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The one primary button of the header: it says what it does, and it is a button, not a link. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Mark all as read" });

    await expect(button).toBeEnabled();
    await expect(button).toHaveAttribute("type", "button");
  },
};

/**
 * Pressing it marks everything read (the stub answers that it is done), says so,
 * and reads the page again. The button is about to go, as the page draws it only
 * while something is unread: the focus is on the main region by then, and not
 * lost to the body.
 */
export const Marks: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const router = getRouter();

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Mark all as read" }));

    const toast = await page.findByText("All notifications marked as read.");
    // A toast fades in: it is in the page before it can be seen
    await waitFor(() => expect(toast).toBeVisible());
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    await expect(canvasElement.querySelector("main")).toHaveFocus();
  },
};

export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "Tout marquer comme lu" })).toBeVisible();
  },
};
