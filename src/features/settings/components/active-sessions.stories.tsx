import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";
import type { SessionsClient } from "../account-flows";
import { useTranslations } from "next-intl";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Toaster } from "@/shared/components/ui/sonner";
import { ActiveSessions, ActiveSessionsView } from "./active-sessions";

// The sessions of the person, in the last card of the account page. Most of the
// stories are of the view, as it is told what to draw. The last ones are of the
// card itself, which asks the auth client: the app's has no server here, so the
// card is given a client that answers what it is told to, and the story presses
// the buttons and says what the card did (the calls it made, where the focus went).

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const EDGE_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";

const NOW = { id: "s1", token: "tok-now", userAgent: CHROME_MAC, ipAddress: "203.0.113.7", createdAt: "2026-11-03T12:00:00.000Z" };
const PHONE = { id: "s2", token: "tok-phone", userAgent: SAFARI_IPHONE, ipAddress: null, createdAt: "2026-11-01T12:00:00.000Z" };
const OLD = { id: "s3", token: "tok-old", userAgent: EDGE_WINDOWS, ipAddress: "198.51.100.2", createdAt: "2026-10-20T12:00:00.000Z" };

/** The id of the title of the card, which names the list: the page gives the same two. */
const TITLE_ID = "active-sessions-title";

/** The card of the page: a level-two title, in the language of the story, and the list in the body of the card. */
function SessionsCard({ children }: { children: ReactNode }) {
  const t = useTranslations("settings");

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" id={TITLE_ID}>
          {t("activeSessions")}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const meta = {
  title: "Features/ActiveSessions",
  component: ActiveSessionsView,
  tags: ["autodocs"],
  args: {
    status: "ready",
    sessions: [NOW, PHONE, OLD],
    currentToken: "tok-now",
    revoking: null,
    revokingAll: false,
    onRevoke: fn(),
    onRevokeAll: fn(),
    onRetry: fn(),
    labelledBy: TITLE_ID,
  },
  argTypes: { sessions: { control: "object" } },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <SessionsCard>
          <Story />
        </SessionsCard>
        <Toaster />
      </div>
    ),
  ],
} satisfies Meta<typeof ActiveSessionsView>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Each session is a row: a tile for the kind of device, what it is, the address
 * and the date. The one in use has a quiet badge and no button; the others each
 * have one that says which session it ends, and "Revoke all other sessions" is
 * above the list.
 */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // The list is named by the title of its card
    await expect(canvas.getByRole("list", { name: "Sessions" })).toBeVisible();
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3);
    await expect(canvas.getByText("Chrome on macOS")).toBeVisible();
    await expect(canvas.getByText("Current session")).toBeVisible();
    await expect(canvas.getAllByRole("button", { name: /^Revoke the session on/ })).toHaveLength(2);

    await userEvent.click(canvas.getByRole("button", { name: "Revoke the session on Safari on iOS" }));
    await expect(args.onRevoke).toHaveBeenCalledOnce();
    await expect(args.onRevoke).toHaveBeenCalledWith("tok-phone");
    await userEvent.click(canvas.getByRole("button", { name: "Revoke all other sessions" }));
    await expect(args.onRevokeAll).toHaveBeenCalledOnce();
    // Called with nothing: the click event is not its business
    await expect(args.onRevokeAll).toHaveBeenCalledWith();
  },
};

/** Only the session in use: nothing to revoke, so no button at all. */
export const Alone: Story = {
  args: { sessions: [NOW] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole("listitem")).toHaveLength(1);
    await expect(within(canvasElement).queryAllByRole("button")).toEqual([]);
  },
};

/** One session is being ended: its button shows that it works and keeps the focus, and the others wait. */
export const Revoking: Story = {
  args: { revoking: "tok-phone" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const phone = canvas.getByRole("button", { name: /Revoke the session on Safari on iOS/ });

    await expect(phone).toHaveAttribute("aria-disabled", "true");
    await expect(phone).not.toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Revoke the session on Edge on Windows" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Revoke all other sessions" })).toBeDisabled();
  },
};

/** Every other session is being ended: the button above the list loads, and the rows wait. */
export const RevokingAll: Story = {
  args: { revokingAll: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const all = canvas.getByRole("button", { name: /Revoke all other sessions/ });

    await expect(all).toHaveAttribute("aria-disabled", "true");
    await expect(all).not.toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Revoke the session on Safari on iOS" })).toBeDisabled();
  },
};

/** A device that cannot be read from its user agent is told in a word. */
export const UnknownDevice: Story = {
  args: { sessions: [NOW, { ...PHONE, userAgent: null }] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Unknown device")).toBeVisible();
  },
};

/** While the sessions are read: a skeleton of the rows, announced once. */
export const Loading: Story = {
  args: { status: "loading", sessions: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Loading…")).toBeInTheDocument();
  },
};

/** The sessions could not be read: an alert says so, with a way to try again. */
export const Failed: Story = {
  args: { status: "failed", sessions: [] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("alert")).toHaveTextContent("We couldn't load your sessions.");
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
    await expect(args.onRetry).toHaveBeenCalledWith();
  },
};

/** The same card in French, the dates included. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("list", { name: "Sessions" })).toBeVisible();
    await expect(canvas.getByText("Chrome sur macOS")).toBeVisible();
    await expect(canvas.getByText("Session actuelle")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Révoquer la session sur Safari sur iOS" })).toBeVisible();
  },
};

// The card itself, with a client that answers what it is told to. The client is
// made before the story renders (a loader), so that the card and the `play`
// function hold the same one, and says what it was asked.

/**
 * The part of the auth client the card uses, as fakes that answer that it works.
 * `revokeSessions` is there to be seen never called: it ends every session of the
 * person, the one in use too, which is not what "Revoke all other sessions" says.
 */
function fakeClient() {
  return {
    listSessions: fn<SessionsClient["listSessions"]>(async () => ({
      data: [NOW, PHONE, OLD],
      error: null,
    })),
    getSession: fn<SessionsClient["getSession"]>(async () => ({
      data: { session: { token: NOW.token } },
      error: null,
    })),
    revokeSession: fn<SessionsClient["revokeSession"]>(async () => ({ error: null })),
    revokeOtherSessions: fn<SessionsClient["revokeOtherSessions"]>(async () => ({ error: null })),
    revokeSessions: fn(async () => ({ error: null })),
  };
}

type FakeClient = ReturnType<typeof fakeClient>;

/** The client the loader made, as the story holds it. */
function clientOf(loaded: Record<string, unknown>): FakeClient {
  return loaded.client as FakeClient;
}

const REFUSED = { error: { message: "Forbidden", status: 403 } };

/**
 * Revoking a session ends that one and no other, removes its row and puts the
 * focus on the box of the list: the button that had it went with the row, and a
 * focus that is not put somewhere falls to the page. "Revoke all other sessions"
 * asks for the others (never for all of them, which would end this one too), and
 * the focus stays where it was put when that button, which has nothing left to
 * revoke, goes as well.
 */
export const RevokingKeepsTheFocus: Story = {
  loaders: [() => ({ client: fakeClient() })],
  render: (_args, { loaded }) => <ActiveSessions labelledBy={TITLE_ID} client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);
    const list = await canvas.findByRole("list", { name: "Sessions" });
    const region = list.parentElement;

    await expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    await userEvent.click(canvas.getByRole("button", { name: "Revoke the session on Safari on iOS" }));
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(2));
    await expect(client.revokeSession).toHaveBeenCalledOnce();
    await expect(client.revokeSession).toHaveBeenCalledWith({ token: "tok-phone" });
    await waitFor(() => expect(region).toHaveFocus());

    await userEvent.click(canvas.getByRole("button", { name: "Revoke all other sessions" }));
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(1));
    await expect(client.revokeOtherSessions).toHaveBeenCalledOnce();
    // Called with nothing: the other sessions are asked for, not named
    await expect(client.revokeOtherSessions).toHaveBeenCalledWith();
    await expect(client.revokeSessions).not.toHaveBeenCalled();
    await expect(canvas.queryByRole("button", { name: "Revoke all other sessions" })).not.toBeInTheDocument();
    await expect(within(list).getByText("Current session")).toBeVisible();
    await waitFor(() => expect(region).toHaveFocus());
  },
};

/** The server refuses: a toast says so, the row stays, and so does the focus, on the button that was pressed. */
export const RevokeRefused: Story = {
  loaders: [
    () => {
      const client = fakeClient();
      client.revokeSession.mockResolvedValue(REFUSED);

      return { client };
    },
  ],
  render: (_args, { loaded }) => <ActiveSessions labelledBy={TITLE_ID} client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const page = within(canvasElement.ownerDocument.body);
    const canvas = within(canvasElement);
    const list = await canvas.findByRole("list", { name: "Sessions" });
    const phone = await canvas.findByRole("button", { name: "Revoke the session on Safari on iOS" });

    await userEvent.click(phone);
    const toast = await page.findByText("An error occurred");
    // A toast fades in: it is in the page before it can be seen
    await waitFor(() => expect(toast).toBeVisible());
    await expect(client.revokeSession).toHaveBeenCalledOnce();
    await expect(client.revokeSession).toHaveBeenCalledWith({ token: "tok-phone" });
    // The toasts are rows of a list too: the sessions are counted in theirs
    await expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    await waitFor(() => expect(phone).toBeEnabled());
    await expect(phone).toHaveFocus();
  },
};
