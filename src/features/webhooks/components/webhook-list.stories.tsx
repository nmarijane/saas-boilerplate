import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ComponentProps } from "react";
import type { WebhookItem } from "./webhook-list";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { useEffect, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Toaster } from "@/shared/components/ui/sonner";
import { WebhookList } from "./webhook-list";

// The webhook endpoints of a workspace, as the Developers page draws them in the
// second of its cards. The server actions the list calls are stubs (Storybook
// replaces every server action) that always work, and the router of a story never
// reads a page again, so two things are given to the list here: a `toggle` that
// refuses or waits (ToggleRefused), and a page that is read again, which
// `router.refresh()` makes hold what the story says the server now holds
// (ReadAgain: the last endpoint is deleted, the server turns one off). The tests
// of the list (tests/unit/webhooks/webhook-list.test.tsx), which have a server
// that answers no, cover a deletion that fails (the dialog stays open), a switch
// that the server does not take (the toast, and the error reporter hears it) and
// the box that holds the list or the empty state; the rules of the switch are in
// tests/unit/webhooks/endpoint-switch.test.ts. The menu of a row, its
// confirmation and the dialog that adds an endpoint are drawn in portals under the
// body, so the `play` functions look for them there.

const BILLING: WebhookItem = {
  id: "e1",
  url: "https://example.com/hooks/billing",
  active: true,
  eventCount: 3,
  createdAt: "2026-11-03T12:00:00.000Z",
};
const PAUSED: WebhookItem = {
  id: "e2",
  url: "https://example.org/events",
  active: false,
  eventCount: 1,
  createdAt: "2026-10-20T12:00:00.000Z",
};
const EVERYTHING: WebhookItem = {
  id: "e3",
  url: "https://hooks.example.net/in/9f2c61a0",
  active: true,
  eventCount: 21,
  createdAt: "2026-09-02T12:00:00.000Z",
};

const meta = {
  title: "Features/WebhookList",
  component: WebhookList,
  tags: ["autodocs"],
  args: {
    orgId: "org_1",
    endpoints: [BILLING, PAUSED, EVERYTHING],
  },
  argTypes: { endpoints: { control: "object" } },
  parameters: {
    // A deleted endpoint and an added one read the page again, through the
    // router of the app: Storybook has none, and mounts a stand-in for the
    // stories that say they use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/settings/developers" } },
    // While a menu or a dialog is open, Radix hides the page (the button
    // included) from assistive technology and traps the focus in it: the button
    // cannot be reached, which axe cannot tell.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
        <Toaster />
      </div>
    ),
  ],
} satisfies Meta<typeof WebhookList>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * What the server holds, and a page that reads it: the list is given the endpoints
 * of the page, and when the page is read again (`router.refresh()` is made to call
 * `server.read`) it is drawn again with what `server.endpoints` says, as the
 * Developers page gives it after an action. Nothing else is different from the
 * page: the list is the same component, in the same place.
 */
const server = { endpoints: [] as WebhookItem[], read: () => {} };

function ReadAgain({ initial, ...props }: { initial: WebhookItem[] } & Omit<ComponentProps<typeof WebhookList>, "endpoints">) {
  const [endpoints, setEndpoints] = useState(initial);

  useEffect(() => {
    server.read = () => setEndpoints([...server.endpoints]);

    return () => {
      server.read = () => {};
    };
  }, []);

  return <WebhookList {...props} endpoints={endpoints} />;
}

/** `beforeEach` of a story: the errors the app reports (`reportError`) are taken away from the page, for a story that fails on purpose. */
const reported = fn();
function catchReports() {
  reported.mockClear();
  const original = window.reportError;
  window.reportError = reported;

  return () => {
    window.reportError = original;
  };
}

/** Opens the menu of an endpoint, and hands back the page, the button and the menu. */
async function openMenu(canvasElement: HTMLElement, name: string) {
  const page = within(canvasElement.ownerDocument.body);
  const button = within(canvasElement).getByRole("button", { name });

  await userEvent.click(button);
  const menu = await page.findByRole("menu");
  // The menu fades in: it is in the page before it can be seen.
  await waitFor(() => expect(menu).toBeVisible());

  return { page, button, menu };
}

/**
 * Each endpoint is a row: a tile, its address over how many events it asks for and
 * the day it was added, and at the end the switch that turns its delivery on and
 * off, with the menu. The switch is the one indicator of the state: no badge
 * says it twice. The secondary button that adds an endpoint is beside the title.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("heading", { level: 2, name: "Webhooks" })).toBeVisible();
    await expect(canvas.getByRole("list", { name: "Webhooks" })).toBeVisible();
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3);
    await expect(canvas.getByText("https://example.com/hooks/billing")).toBeVisible();
    await expect(canvas.getByText(/^3 events/)).toBeVisible();
    await expect(canvas.getByText(/^1 event\b/)).toBeVisible();
    await expect(canvas.getByRole("switch", { name: "Send events to https://example.com/hooks/billing" })).toBeChecked();
    await expect(canvas.getByRole("switch", { name: "Send events to https://example.org/events" })).not.toBeChecked();
    await expect(canvas.getByRole("button", { name: "Add endpoint" })).toHaveAttribute("aria-haspopup", "dialog");
    await expect(canvasElement.querySelector('[data-slot="badge"]')).toBeNull();
  },
};

/**
 * The switch moves at once and keeps the focus (it is not disabled while the
 * server is asked: a disabled control drops the focus). The stub answers that it
 * is done, so the switch stays where it was put.
 */
export const Toggles: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const live = canvas.getByRole("switch", { name: "Send events to https://example.com/hooks/billing" });

    await userEvent.click(live);
    await expect(live).not.toBeChecked();
    await expect(live).toHaveFocus();
    await expect(live).not.toBeDisabled();

    await userEvent.click(live);
    await expect(live).toBeChecked();
  },
};

/** Deleting asks first, in the danger tone, naming the address: the signing secret goes with the endpoint. */
export const DeletesAnEndpoint: Story = {
  play: async ({ canvasElement }) => {
    const { page, button, menu } = await openMenu(canvasElement, "Actions for https://example.org/events");

    await expect(within(menu).getAllByRole("menuitem")).toHaveLength(1);
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Delete endpoint" }));
    const dialog = await page.findByRole("alertdialog", { name: "Delete this endpoint?" });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(dialog).toHaveAccessibleDescription(/https:\/\/example\.org\/events stops receiving events at once/);
    await expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    await expect(page.queryByRole("menu")).not.toBeInTheDocument();

    // Cancel gives the focus back to the button of the menu
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());

    const second = await openMenu(canvasElement, "Actions for https://example.org/events");
    await userEvent.click(within(second.menu).getByRole("menuitem", { name: "Delete endpoint" }));
    const again = await page.findByRole("alertdialog", { name: "Delete this endpoint?" });
    await waitFor(() => expect(again).toBeVisible());
    await userEvent.click(within(again).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    const toast = await page.findByText("Endpoint deleted.");
    // A toast fades in: it is in the page before it can be seen
    await waitFor(() => expect(toast).toBeVisible());
    // The row is going to lose its button: the focus is on the list, not on the body
    await waitFor(() => expect(canvasElement.querySelector('[tabindex="-1"]')).toHaveFocus());
  },
};

/**
 * The last endpoint is deleted, and the page, read again, has none: it swaps the
 * list for the empty state. The row it was deleted from takes the focus with it,
 * and the focus must stay on the page, on the box that holds the list and then
 * the empty state, and not drop on the body. (The box used to be drawn round the
 * list alone, and went with it.)
 */
export const DeletesTheLastEndpoint: Story = {
  render: (args) => <ReadAgain orgId={args.orgId} initial={[BILLING]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    server.endpoints = [];
    getRouter().refresh.mockImplementation(() => server.read());

    const { page, menu } = await openMenu(canvasElement, "Actions for https://example.com/hooks/billing");
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Delete endpoint" }));
    const dialog = await page.findByRole("alertdialog", { name: "Delete this endpoint?" });
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    // The page is read again: the list is gone, and the empty state is where it was
    const empty = await canvas.findByRole("heading", { level: 3, name: "No webhooks yet" });
    await expect(empty).toBeVisible();
    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    // (The toasts are a list too: it is the list of the endpoints that is gone)
    await expect(canvasElement.querySelector('[data-slot="list"]')).toBeNull();

    // The box that keeps the focus is found from what it holds: the empty state is in it, or there is no such box
    const box = empty.closest<HTMLElement>('[tabindex="-1"]');
    await expect(box).not.toBeNull();
    await waitFor(() => expect(box).toHaveFocus());
    await expect(canvasElement.ownerDocument.activeElement).not.toBe(canvasElement.ownerDocument.body);
  },
};

/**
 * The page is read again with another word for an endpoint (it was turned off
 * elsewhere): its switch follows, and it is the same switch, not another drawn in
 * its place. Then the person turns the other one on, and the page read again says
 * it, as the server holds it: the switch keeps both its place and the focus, as it
 * would not if the row were drawn anew.
 */
export const FollowsTheServer: Story = {
  render: (args) => <ReadAgain orgId={args.orgId} initial={[BILLING, PAUSED]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const live = canvas.getByRole("switch", { name: "Send events to https://example.com/hooks/billing" });
    const paused = canvas.getByRole("switch", { name: "Send events to https://example.org/events" });
    await expect(live).toBeChecked();
    await expect(paused).not.toBeChecked();

    server.endpoints = [{ ...BILLING, active: false }, PAUSED];
    server.read();

    await waitFor(() => expect(live).not.toBeChecked());
    await expect(canvas.getByRole("switch", { name: "Send events to https://example.com/hooks/billing" })).toBe(live);

    await userEvent.click(paused);
    await expect(paused).toBeChecked();
    await expect(paused).toHaveFocus();

    server.endpoints = [{ ...BILLING, active: false }, { ...PAUSED, active: true }];
    server.read();

    // The page says what the switch shows: nothing moves, and the focus stays where it is
    await waitFor(() => expect(canvas.getByRole("switch", { name: "Send events to https://example.org/events" })).toBeChecked());
    await expect(canvas.getByRole("switch", { name: "Send events to https://example.org/events" })).toBe(paused);
    await expect(paused).toHaveFocus();
  },
};

// A change that does not come back until the story says so.
const gate = { refuse: (_error: Error) => {} };

/**
 * The switch moves at once, before the server has answered; the server refuses,
 * and the switch goes back where it was, with a toast, the error reporter told,
 * and the focus still on it: it was not disabled while it waited.
 */
export const ToggleRefused: Story = {
  args: {
    toggle: fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          gate.refuse = reject;
        }),
    ),
  },
  beforeEach: catchReports,
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const live = within(canvasElement).getByRole("switch", { name: "Send events to https://example.com/hooks/billing" });
    await expect(live).toBeChecked();

    await userEvent.click(live);

    await waitFor(() => expect(live).not.toBeChecked());
    await expect(args.toggle).toHaveBeenCalledOnce();
    await expect(args.toggle).toHaveBeenCalledWith("e1", "org_1", false);
    await expect(live).not.toBeDisabled();

    gate.refuse(new Error("offline"));

    await waitFor(() => expect(live).toBeChecked());
    const toast = await page.findByText("We couldn't update this endpoint. Please try again.");
    // A toast fades in: it is in the page before it can be seen
    await waitFor(() => expect(toast).toBeVisible());
    await expect(reported).toHaveBeenCalledOnce();
    await expect(live).toHaveFocus();
  },
};

/** The button opens the dialog, on the address; Cancel closes it, and the button has the focus again. */
export const OpensTheDialog: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const button = within(canvasElement).getByRole("button", { name: "Add endpoint" });

    await userEvent.click(button);
    const dialog = await page.findByRole("dialog", { name: "Add endpoint" });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(within(dialog).getByLabelText(/Endpoint URL/)).toHaveFocus();
    await expect(button).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
    await expect(button).toHaveAttribute("aria-expanded", "false");
  },
};

/** With no endpoint, an empty state says so under the title, and says the button once: the one in the header of the card. */
export const Empty: Story = {
  args: { endpoints: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("heading", { level: 2, name: "Webhooks" })).toBeVisible();
    await expect(canvas.getByRole("heading", { level: 3, name: "No webhooks yet" })).toBeVisible();
    await expect(canvas.getByText("Add an endpoint to be told when something happens in your workspace.")).toBeVisible();
    await expect(canvas.getAllByRole("button")).toHaveLength(1);
    await expect(canvas.getByRole("button", { name: "Add endpoint" })).toBeVisible();
    await expect(canvas.queryByRole("list")).not.toBeInTheDocument();
  },
};

/** An address that is not ours to choose wraps in its row, and pushes nothing out of the card. */
export const LongAddresses: Story = {
  args: {
    endpoints: [
      {
        ...BILLING,
        url: "https://integrations.example-association-internationale.org/webhooks/accounting/northern-region/invoices?token=3f9a0c7e5b2d41a89e66f0d2c1b7a4e5",
      },
      EVERYTHING,
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const url = canvas.getByText(/^https:\/\/integrations\./);

    await expect(url.scrollWidth).toBeLessThanOrEqual(url.clientWidth);
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth);
  },
};

/** The same list in French, with the plural of French. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("list", { name: "Webhooks" })).toBeVisible();
    await expect(canvas.getByText(/^3 événements/)).toBeVisible();
    await expect(canvas.getByText(/^1 événement\b/)).toBeVisible();
    await expect(canvas.getByRole("switch", { name: "Envoyer les événements à https://example.com/hooks/billing" })).toBeVisible();

    const { page, menu } = await openMenu(canvasElement, "Actions pour https://example.org/events");
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Supprimer l'endpoint" }));
    const asking = await page.findByRole("alertdialog", { name: "Supprimer cet endpoint ?" });
    await waitFor(() => expect(asking).toBeVisible());
  },
};

/** The empty state, in French. */
export const EmptyInFrench: Story = {
  args: { endpoints: [] },
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("heading", { level: 3, name: "Aucun webhook pour le moment" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Ajouter un endpoint" })).toBeVisible();
  },
};
