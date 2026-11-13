import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";
import type { AccountsClient } from "../account-flows";
import { useTranslations } from "next-intl";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Toaster } from "@/shared/components/ui/sonner";
import { ConnectedAccounts, ConnectedAccountsView } from "./connected-accounts";

// The providers the person can sign in with, in the third card of the account
// page. Most of the stories are of the view, as it is told what to draw. The last
// ones are of the card itself, which asks the auth client: the app's has no server
// here, so the card is given a client that answers what it is told to, and the
// story presses the buttons and says what the card did (the calls it made, the
// button that keeps loading).

const PASSWORD = { id: "a1", providerId: "credential" };
const GOOGLE = { id: "a2", providerId: "google" };

/** The id of the title of the card, which names the list: the page gives the same one. */
const TITLE_ID = "connected-accounts-title";

/** The card of the page: a level-two title, in the language of the story, and the list in the body of the card. */
function AccountsCard({ children }: { children: ReactNode }) {
  const t = useTranslations("settings");

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" id={TITLE_ID}>
          {t("connectedAccounts")}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const meta = {
  title: "Features/ConnectedAccounts",
  component: ConnectedAccountsView,
  tags: ["autodocs"],
  args: {
    status: "ready",
    accounts: [PASSWORD, GOOGLE],
    busy: null,
    onConnect: fn(),
    onDisconnect: fn(),
    onRetry: fn(),
    labelledBy: TITLE_ID,
  },
  argTypes: { accounts: { control: "object" } },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <AccountsCard>
          <Story />
        </AccountsCard>
        <Toaster />
      </div>
    ),
  ],
} satisfies Meta<typeof ConnectedAccountsView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Google is linked, and told with a quiet badge: it can be unlinked, as the password is another way to sign in. GitHub can be linked. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // The list is named by the title of its card
    await expect(canvas.getByRole("list", { name: "Connected accounts" })).toBeVisible();
    await expect(canvas.getAllByRole("listitem")).toHaveLength(2);
    await expect(canvas.getByText("Connected")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Connect GitHub" }));
    await expect(args.onConnect).toHaveBeenCalledOnce();
    await expect(args.onConnect).toHaveBeenCalledWith("github");
    await userEvent.click(canvas.getByRole("button", { name: "Disconnect Google" }));
    await expect(args.onDisconnect).toHaveBeenCalledOnce();
    await expect(args.onDisconnect).toHaveBeenCalledWith("google");
  },
};

/** The last way to sign in cannot be unlinked: its button is disabled, and says why to those who hover or reach it. */
export const OnlyWayToSignIn: Story = {
  args: { accounts: [GOOGLE] },
  play: async ({ canvasElement }) => {
    const disconnect = within(canvasElement).getByRole("button", { name: "Disconnect Google" });

    await expect(disconnect).toBeDisabled();
    await expect(disconnect).toHaveAccessibleDescription("Cannot disconnect your only sign-in method.");
  },
};

/** A link is being made: its button shows that it works and keeps the focus, and the other waits. */
export const Linking: Story = {
  args: { busy: "github" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const connect = canvas.getByRole("button", { name: "Connect GitHub" });

    await expect(connect).toHaveAttribute("aria-disabled", "true");
    await expect(connect).not.toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Disconnect Google" })).toBeDisabled();
  },
};

/** While the accounts are read: a skeleton of the two rows, announced once. */
export const Loading: Story = {
  args: { status: "loading", accounts: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Loading…")).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll('[data-slot="list-skeleton-row"]')).toHaveLength(2);
  },
};

/** The accounts could not be read: an alert says so, with a way to try again. */
export const Failed: Story = {
  args: { status: "failed", accounts: [] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("alert")).toHaveTextContent("We couldn't load your connected accounts.");
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
    // Called with nothing: the click event is not its business
    await expect(args.onRetry).toHaveBeenCalledWith();
  },
};

/** The same card in French. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("list", { name: "Comptes liés" })).toBeVisible();
    await expect(canvas.getByText("Connecté")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Connecter GitHub" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Déconnecter Google" })).toBeVisible();
  },
};

// The card itself, with a client that answers what it is told to. The client is
// made before the story renders (a loader), so that the card and the `play`
// function hold the same one, and says what it was asked.

/** The part of the auth client the card uses, as fakes that answer that it works. */
function fakeClient() {
  return {
    listAccounts: fn<AccountsClient["listAccounts"]>(async () => ({
      data: [PASSWORD, GOOGLE],
      error: null,
    })),
    linkSocial: fn<AccountsClient["linkSocial"]>(async () => ({ error: null })),
    unlinkAccount: fn<AccountsClient["unlinkAccount"]>(async () => ({ error: null })),
  };
}

type FakeClient = ReturnType<typeof fakeClient>;

/** The client the loader made, as the story holds it. */
function clientOf(loaded: Record<string, unknown>): FakeClient {
  return loaded.client as FakeClient;
}

const REFUSED = { error: { message: "Forbidden", status: 403 } };

/** A button that loads says `aria-disabled` (it is not disabled: it keeps its focus). */
function isLoading(button: HTMLElement) {
  return button.getAttribute("aria-disabled") === "true";
}

/**
 * Linking asks for the provider, and for the account page to be where the person
 * comes back to. When the server takes it the browser is on its way to the
 * provider, and the button keeps loading until it has gone: let go at once, it
 * could be pressed again and start a second link. The other button waits as well.
 * When the browser brings the page back from its cache (the back button, from the
 * provider) the card is as it was left, and the button is let go.
 */
export const LinkingStaysBusy: Story = {
  loaders: [() => ({ client: fakeClient() })],
  render: (_args, { loaded }) => <ConnectedAccounts labelledBy={TITLE_ID} client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);
    const connect = await canvas.findByRole("button", { name: "Connect GitHub" });

    await userEvent.click(connect);
    await waitFor(() => expect(client.linkSocial).toHaveBeenCalledOnce());
    await expect(client.linkSocial).toHaveBeenCalledWith({ provider: "github", callbackURL: "/settings/account" });
    // Time for a button that is let go too early to show it
    await new Promise((resolve) => setTimeout(resolve, 150));
    await expect(isLoading(connect)).toBe(true);
    await expect(canvas.getByRole("button", { name: "Disconnect Google" })).toBeDisabled();
    await userEvent.click(connect);
    await expect(client.linkSocial).toHaveBeenCalledOnce();

    // A page shown for the first time is not a page brought back
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: false }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    await expect(isLoading(connect)).toBe(true);
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    await waitFor(() => expect(isLoading(connect)).toBe(false));
    await expect(canvas.getByRole("button", { name: "Disconnect Google" })).toBeEnabled();
  },
};

/** The server refuses: a toast says so, and the button is let go, since the browser is not leaving. */
export const LinkRefused: Story = {
  loaders: [
    () => {
      const client = fakeClient();
      client.linkSocial.mockResolvedValue(REFUSED);

      return { client };
    },
  ],
  render: (_args, { loaded }) => <ConnectedAccounts labelledBy={TITLE_ID} client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const page = within(canvasElement.ownerDocument.body);
    const canvas = within(canvasElement);
    const connect = await canvas.findByRole("button", { name: "Connect GitHub" });

    await userEvent.click(connect);
    const toast = await page.findByText("An error occurred");
    // A toast fades in: it is in the page before it can be seen
    await waitFor(() => expect(toast).toBeVisible());
    await waitFor(() => expect(isLoading(connect)).toBe(false));
    await expect(client.linkSocial).toHaveBeenCalledOnce();
  },
};

/** Unlinking asks for that account by its own id (not by the name of the provider), and the row offers to link it again. */
export const Unlinks: Story = {
  loaders: [() => ({ client: fakeClient() })],
  render: (_args, { loaded }) => <ConnectedAccounts labelledBy={TITLE_ID} client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole("button", { name: "Disconnect Google" }));
    await canvas.findByRole("button", { name: "Connect Google" });
    await expect(client.unlinkAccount).toHaveBeenCalledOnce();
    await expect(client.unlinkAccount).toHaveBeenCalledWith({ accountId: "a2" });
    await expect(canvas.queryByText("Connected")).not.toBeInTheDocument();
  },
};
