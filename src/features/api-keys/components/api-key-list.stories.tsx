import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ComponentProps } from "react";
import type { ApiKeyItem } from "./api-key-list";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { useEffect, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Toaster } from "@/shared/components/ui/sonner";
import { ApiKeyList } from "./api-key-list";

// The API keys of a workspace, as the Developers page draws them in the first of
// its cards. The server action the list calls is a stub (Storybook replaces every
// server action) that always works, and the router of a story never reads a page
// again, so one story gives the list a page that is read again, which
// `router.refresh()` makes hold what the story says the server now holds
// (RevokedRowKeepsTheFocus). A revocation that fails is the business of the tests
// of the list, which have a server that answers no
// (tests/unit/api-keys/api-key-list.test.tsx). The menu of a row and its
// confirmation are drawn in portals under the body, so the `play` functions look
// for them there.

const ACTIVE: ApiKeyItem = {
  id: "k1",
  name: "Production server",
  prefix: "sb_live_AbCd",
  status: "active",
  createdAt: "2026-11-03T12:00:00.000Z",
  lastUsed: "2026-11-05T09:30:00.000Z",
};
const EXPIRED: ApiKeyItem = {
  id: "k2",
  name: "Staging",
  prefix: "sb_live_Qw3e",
  status: "expired",
  createdAt: "2026-10-12T12:00:00.000Z",
  lastUsed: null,
};
const REVOKED: ApiKeyItem = {
  id: "k3",
  name: "Old laptop",
  prefix: "sb_live_Zz9y",
  status: "revoked",
  createdAt: "2026-10-01T12:00:00.000Z",
  lastUsed: "2026-10-20T08:00:00.000Z",
};
const FRESH: ApiKeyItem = {
  id: "k4",
  name: "CI pipeline",
  prefix: "sb_live_Mm1n",
  status: "active",
  createdAt: "2026-11-04T08:00:00.000Z",
  lastUsed: null,
};

const meta = {
  title: "Features/ApiKeyList",
  component: ApiKeyList,
  tags: ["autodocs"],
  args: {
    orgId: "org_1",
    keys: [ACTIVE, EXPIRED, REVOKED, FRESH],
  },
  argTypes: { keys: { control: "object" } },
  parameters: {
    // A revoked key reads the page again, through the router of the app:
    // Storybook has none, and mounts a stand-in for the stories that say they
    // use the App Router.
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
} satisfies Meta<typeof ApiKeyList>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * What the server holds, and a page that reads it: the list is given the keys of
 * the page, and when the page is read again (`router.refresh()` is made to call
 * `server.read`) it is drawn again with what `server.keys` says, as the
 * Developers page gives it after an action.
 */
const server = { keys: [] as ApiKeyItem[], read: () => {} };

function ReadAgain({ initial, ...props }: { initial: ApiKeyItem[] } & Omit<ComponentProps<typeof ApiKeyList>, "keys">) {
  const [keys, setKeys] = useState(initial);

  useEffect(() => {
    server.read = () => setKeys([...server.keys]);

    return () => {
      server.read = () => {};
    };
  }, []);

  return <ApiKeyList {...props} keys={keys} />;
}

/** The names of the buttons that open a menu: one for each key that is not revoked. */
function menusOf(canvasElement: HTMLElement): string[] {
  return within(canvasElement)
    .queryAllByRole("button", { name: /^(Actions for|Actions pour) / })
    .map((button) => button.getAttribute("aria-label") ?? "");
}

/** Opens the menu of a key, and hands back the page, the button and the menu. */
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
 * Each key is a row: a tile, the name over the start of the key in mono, when it
 * was made and when it was last used (or that it never was), and at the end its
 * status in a small badge. Only the key that can be used wears the success tone:
 * an expired and a revoked key are neutral, and say which in words. The menu is
 * on every key that is not revoked, an expired one included.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The list is named by the title of its card
    await expect(canvas.getByRole("heading", { level: 2, name: "API keys" })).toBeVisible();
    await expect(canvas.getByRole("list", { name: "API keys" })).toBeVisible();
    await expect(canvas.getAllByRole("listitem")).toHaveLength(4);
    await expect(canvas.getByText("sb_live_AbCd…")).toBeVisible();
    await expect(canvas.getByText("sb_live_AbCd…").tagName).toBe("CODE");
    await expect(canvas.getAllByText(/Last used/)).toHaveLength(2);
    await expect(canvas.getAllByText(/Never used/)).toHaveLength(2);
    await expect(canvas.getAllByText("Active")).toHaveLength(2);
    await expect(canvas.getByText("Expired")).toBeVisible();
    await expect(canvas.getByText("Revoked")).toBeVisible();
    await expect(menusOf(canvasElement)).toEqual([
      "Actions for Production server",
      "Actions for Staging",
      "Actions for CI pipeline",
    ]);
  },
};

/** Revoking asks first, in the danger tone, naming the key: nothing that uses it works after. */
export const RevokesAKey: Story = {
  play: async ({ canvasElement }) => {
    const { page, menu } = await openMenu(canvasElement, "Actions for Production server");

    await expect(within(menu).getAllByRole("menuitem")).toHaveLength(1);
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Revoke" }));
    const dialog = await page.findByRole("alertdialog", { name: "Revoke Production server?" });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(dialog).toHaveAccessibleDescription(/can't be undone/);
    await expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    await expect(page.queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));

    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    const toast = await page.findByText("Key revoked: Production server");
    // A toast fades in: it is in the page before it can be seen
    await waitFor(() => expect(toast).toBeVisible());
    // The row is going to lose its button: the focus is on the list, not on the body
    await waitFor(() => expect(canvasElement.querySelector('[tabindex="-1"]')).toHaveFocus());
  },
};

/**
 * The page is read again once the key is revoked, and the row says "Revoked": the
 * button of its menu, which had the focus, is gone with the menu. The focus must
 * stay on the page, on the box that holds the list, and not drop on the body.
 */
export const RevokedRowKeepsTheFocus: Story = {
  render: (args) => <ReadAgain orgId={args.orgId} initial={[ACTIVE, REVOKED]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    server.keys = [{ ...ACTIVE, status: "revoked" }, REVOKED];
    getRouter().refresh.mockImplementation(() => server.read());

    const { page, menu } = await openMenu(canvasElement, "Actions for Production server");
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Revoke" }));
    const dialog = await page.findByRole("alertdialog", { name: "Revoke Production server?" });
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));

    // The page is read again: both rows say "Revoked", and no row has a button of its menu
    await waitFor(() => expect(canvas.getAllByText("Revoked")).toHaveLength(2));
    await expect(canvas.queryAllByRole("button")).toEqual([]);
    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());

    // The box that keeps the focus is found from what it holds: the rows are in it, or there is no such box
    const box = canvas.getAllByText("Revoked")[0].closest<HTMLElement>('[tabindex="-1"]');
    await expect(box).not.toBeNull();
    await waitFor(() => expect(box).toHaveFocus());
    await expect(canvasElement.ownerDocument.activeElement).not.toBe(canvasElement.ownerDocument.body);
  },
};

/** Cancel closes the confirmation, revokes nothing, and the focus goes back to the button of the menu. */
export const CancelsTheRevocation: Story = {
  play: async ({ canvasElement }) => {
    const { page, button, menu } = await openMenu(canvasElement, "Actions for Staging");

    await userEvent.click(within(menu).getByRole("menuitem", { name: "Revoke" }));
    const dialog = await page.findByRole("alertdialog", { name: "Revoke Staging?" });
    await waitFor(() => expect(dialog).toBeVisible());
    // The focus is in the dialog it opened: the menu does not take it back
    await waitFor(() => expect(dialog).toContainElement(dialog.ownerDocument.activeElement as HTMLElement));

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
    await expect(page.queryByText(/Key revoked/)).not.toBeInTheDocument();
  },
};

/** With no key, an empty state says so under the title, and says no button twice: the header of the page has the one. */
export const Empty: Story = {
  args: { keys: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("heading", { level: 2, name: "API keys" })).toBeVisible();
    await expect(canvas.getByRole("heading", { level: 3, name: "No API keys yet" })).toBeVisible();
    await expect(canvas.getByText("Create a key to call the API from your own code.")).toBeVisible();
    await expect(canvas.queryAllByRole("button")).toEqual([]);
    await expect(canvas.queryByRole("list")).not.toBeInTheDocument();
  },
};

/** Every key revoked: no menu at all, and no empty room for one. */
export const OnlyRevoked: Story = {
  args: { keys: [REVOKED, { ...REVOKED, id: "k5", name: "Former CI" }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getAllByRole("listitem")).toHaveLength(2);
    await expect(canvas.getAllByText("Revoked")).toHaveLength(2);
    await expect(canvas.queryAllByRole("button")).toEqual([]);
  },
};

/** The badges of the rows line up on the right, whether a row has a menu or not. */
export const BadgesLineUp: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rights = canvas
      .getAllByRole("listitem")
      .map((row) => within(row).getByText(/^(Active|Expired|Revoked)$/).getBoundingClientRect().right);

    for (const right of rights) {
      await expect(Math.abs(right - (rights[0] ?? 0))).toBeLessThanOrEqual(1);
    }
  },
};

/** A name that is not ours to choose wraps in its row, and pushes nothing out of the card. */
export const LongNames: Story = {
  args: {
    keys: [
      { ...ACTIVE, name: "Production server of the accounting department's integration for the Northern region" },
      { ...FRESH, name: "Pipeline-de-déploiement-continu-avec-un-nom-sans-aucun-espace-pour-voir-comment-il-se-coupe" },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    for (const name of [/^Production server of the accounting/, /^Pipeline-de-déploiement/]) {
      const text = canvas.getByText(name);
      await expect(text.scrollWidth).toBeLessThanOrEqual(text.clientWidth);
    }
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth);
  },
};

/** The same list in French. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("list", { name: "Clés d'API" })).toBeVisible();
    // Each date is a <time>, in the language of the page
    await expect(canvas.getByText("3 nov. 2026")).toBeVisible();
    await expect(canvas.getAllByText(/Jamais utilisée/)).toHaveLength(2);
    await expect(canvas.getByText("Expirée")).toBeVisible();
    await expect(canvas.getByText("Révoquée")).toBeVisible();

    const { page, menu } = await openMenu(canvasElement, "Actions pour Production server");
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Révoquer" }));
    const asking = await page.findByRole("alertdialog", { name: "Révoquer Production server ?" });
    await waitFor(() => expect(asking).toBeVisible());
  },
};

/** The empty state, in French. */
export const EmptyInFrench: Story = {
  args: { keys: [] },
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("heading", { level: 3, name: "Aucune clé d'API pour le moment" })).toBeVisible();
  },
};
