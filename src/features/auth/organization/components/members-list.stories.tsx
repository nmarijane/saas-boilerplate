import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Toaster } from "@/shared/components/ui/sonner";
import { MembersList } from "./members-list";

// The people of a workspace, as the Team page draws them in its card. The server
// actions the list calls are stubs (Storybook replaces every server action) that
// always work: a role that is refused, or a removal that fails, is the business
// of the tests of the list, which have a server that answers no. The menu of a
// row and its confirmation are drawn in portals under the body, so the `play`
// functions look for them there.

/** A photo that is no network call: a plain tint, as an uploaded picture would be. */
const PHOTO =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='orange'/><circle cx='16' cy='13' r='6' fill='white'/><rect x='6' y='22' width='20' height='10' rx='5' fill='white'/></svg>";

function member(id: string, userId: string, name: string, role: string, userImage: string | null = null) {
  return { id, userId, role, userName: name, userEmail: `${userId}@example.com`, userImage };
}

const OLIVIA = member("m1", "u1", "Olivia Owen", "owner", PHOTO);
const ADAM = member("m2", "u2", "Adam Dupont", "admin");
const MIA = member("m3", "u3", "Mia Martin", "member");
const ADA = member("m4", "u4", "Ada Lopez", "admin");

/** The id of the title of the card, which names the list: the page gives the same one. */
const TITLE_ID = "members-title";

/** The card of the page: a level-two title, in the language of the story, and the list in the body of the card. */
function MembersCard({ children }: { children: ReactNode }) {
  const t = useTranslations("organization");

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" id={TITLE_ID}>
          {t("members")}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const meta = {
  title: "Features/MembersList",
  component: MembersList,
  tags: ["autodocs"],
  args: {
    orgId: "org_1",
    members: [OLIVIA, ADAM, MIA, ADA],
    viewer: { userId: "u1", role: "owner" },
    labelledBy: TITLE_ID,
  },
  argTypes: { members: { control: "object" }, viewer: { control: "object" } },
  parameters: {
    // A role that changes and a member that goes read the page again, through the
    // router of the app: Storybook has none, and mounts a stand-in for the
    // stories that say they use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/settings/team" } },
    // While a menu or a dialog is open, Radix hides the page (the button
    // included) from assistive technology and traps the focus in it: the button
    // cannot be reached, which axe cannot tell.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  // The list is in a card, as the Team page puts it: its rows line up with the
  // title, which names it.
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <MembersCard>
          <Story />
        </MembersCard>
        <Toaster />
      </div>
    ),
  ],
} satisfies Meta<typeof MembersList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The names that have a menu: each one is the label of the button that opens it. */
function menusOf(canvasElement: HTMLElement): string[] {
  return within(canvasElement)
    .queryAllByRole("button", { name: /^(Actions for|Actions pour) / })
    .map((button) => button.getAttribute("aria-label") ?? "");
}

/** Opens the menu of a member, and hands back the page, the button and the menu. */
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
 * The owner sees every member, an avatar (the photo, or the initials on a tint)
 * and the name over the email, then the role in a quiet badge. The menu is
 * theirs for everyone but the owner and themselves.
 */
export const AsOwner: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The list is named by the title of its card
    await expect(canvas.getByRole("list", { name: "Members" })).toBeVisible();
    await expect(canvas.getAllByRole("listitem")).toHaveLength(4);
    await expect(canvas.getByText("Olivia Owen")).toBeVisible();
    await expect(canvas.getByText("u2@example.com")).toBeVisible();
    await expect(canvas.getByText("Owner")).toBeVisible();
    await expect(canvas.getAllByText("Admin")).toHaveLength(2);
    await expect(canvas.getByText("Member")).toBeVisible();
    await expect(menusOf(canvasElement)).toEqual([
      "Actions for Adam Dupont",
      "Actions for Mia Martin",
      "Actions for Ada Lopez",
    ]);
  },
};

/**
 * An admin acts on members and on other admins, never on the owner. Their own row
 * has a menu too, with one entry: leaving the workspace (an admin changes nobody's
 * role from there, their own included, and removes nobody but others).
 */
export const AsAdmin: Story = {
  args: { viewer: { userId: "u2", role: "admin" } },
  play: async ({ canvasElement }) => {
    await expect(menusOf(canvasElement)).toEqual([
      "Actions for Adam Dupont",
      "Actions for Mia Martin",
      "Actions for Ada Lopez",
    ]);

    const { page, button, menu } = await openMenu(canvasElement, "Actions for Adam Dupont");
    await expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent?.trim())).toEqual(["Leave workspace"]);
    await expect(within(menu).queryByRole("menuitemradio")).not.toBeInTheDocument();

    // Escape closes the menu, and the story ends at rest, with the focus on the button that opened it
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("menu")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
  },
};

/** A plain member reads the list, and has one thing to press: the menu of their own row, which leaves the workspace. */
export const AsMember: Story = {
  args: { viewer: { userId: "u3", role: "member" } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole("listitem")).toHaveLength(4);
    await expect(menusOf(canvasElement)).toEqual(["Actions for Mia Martin"]);
    await expect(within(canvasElement).getAllByRole("button")).toHaveLength(1);

    const { page, button, menu } = await openMenu(canvasElement, "Actions for Mia Martin");
    await expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent?.trim())).toEqual(["Leave workspace"]);
    // Nobody else's role is theirs to change, and nobody else's row is theirs to remove
    await expect(within(menu).queryByRole("menuitemradio")).not.toBeInTheDocument();
    await expect(within(menu).queryByRole("menuitem", { name: "Remove from workspace" })).not.toBeInTheDocument();

    // Escape closes the menu, and the story ends at rest, with the focus on the button that opened it
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("menu")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
  },
};

/** The owner never leaves: a workspace is not left without one, so their row has no menu at all (they delete the workspace instead). */
export const TheOwnerDoesNotLeave: Story = {
  play: async ({ canvasElement }) => {
    await expect(menusOf(canvasElement)).not.toContain("Actions for Olivia Owen");
  },
};

/**
 * Leaving asks first, in the danger tone: the person loses the workspace at
 * once. Cancel closes the question and the focus goes back to the button of the
 * menu; confirming leaves (the stub answers that it is done) and says so.
 */
export const LeavesTheWorkspace: Story = {
  args: { viewer: { userId: "u3", role: "member" } },
  play: async ({ canvasElement }) => {
    const { page, button, menu } = await openMenu(canvasElement, "Actions for Mia Martin");

    await userEvent.click(within(menu).getByRole("menuitem", { name: "Leave workspace" }));
    const dialog = await page.findByRole("alertdialog", { name: "Leave this workspace?" });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(dialog).toHaveAccessibleDescription(/You lose access to it at once/);

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());

    const second = await openMenu(canvasElement, "Actions for Mia Martin");
    await userEvent.click(within(second.menu).getByRole("menuitem", { name: "Leave workspace" }));
    const again = await page.findByRole("alertdialog", { name: "Leave this workspace?" });
    await waitFor(() => expect(again).toBeVisible());
    await userEvent.click(within(again).getByRole("button", { name: "Leave" }));

    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    const toast = await page.findByText("You left the workspace.");
    await waitFor(() => expect(toast).toBeVisible());
  },
};

/**
 * The menu changes the role: the two roles a member can be given, with the
 * current one ticked. Choosing the other says so and reads the page again; the
 * menu closes, and the focus is on its button again.
 */
export const ChangesARole: Story = {
  play: async ({ canvasElement }) => {
    const { page, button, menu } = await openMenu(canvasElement, "Actions for Mia Martin");

    const roles = within(menu).getAllByRole("menuitemradio");
    await expect(roles.map((role) => role.textContent?.trim())).toEqual(["Admin", "Member"]);
    await expect(within(menu).getByRole("menuitemradio", { name: "Member" })).toBeChecked();
    await expect(within(menu).getByRole("menuitemradio", { name: "Admin" })).not.toBeChecked();
    await expect(within(menu).getByRole("menuitem", { name: "Remove from workspace" })).toBeVisible();

    await userEvent.click(within(menu).getByRole("menuitemradio", { name: "Admin" }));

    const toast = await page.findByText("Role updated.");
    // A toast fades in: it is in the page before it can be seen
    await waitFor(() => expect(toast).toBeVisible());
    await waitFor(() => expect(page.queryByRole("menu")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
  },
};

/**
 * Removing asks first, in the danger tone, naming the person: they lose the
 * workspace at once. Cancel closes it and the focus goes back to the button of
 * the menu; confirming removes the member (the stub answers that it is done),
 * says so, and puts the focus on the list, as the row it was on is going.
 */
export const RemovesAMember: Story = {
  play: async ({ canvasElement }) => {
    const { page, button, menu } = await openMenu(canvasElement, "Actions for Mia Martin");

    await userEvent.click(within(menu).getByRole("menuitem", { name: "Remove from workspace" }));
    const dialog = await page.findByRole("alertdialog", { name: "Remove Mia Martin?" });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(dialog).toHaveAccessibleDescription(/lose access/);
    await expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    // The menu is gone, and the focus is in the dialog it opened: the menu does not take it back
    await waitFor(() => expect(dialog).toContainElement(dialog.ownerDocument.activeElement as HTMLElement));
    await expect(page.queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());

    const second = await openMenu(canvasElement, "Actions for Mia Martin");
    await userEvent.click(within(second.menu).getByRole("menuitem", { name: "Remove from workspace" }));
    const again = await page.findByRole("alertdialog", { name: "Remove Mia Martin?" });
    await waitFor(() => expect(again).toBeVisible());
    await userEvent.click(within(again).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    const toast = await page.findByText("Mia Martin was removed.");
    await waitFor(() => expect(toast).toBeVisible());
    await waitFor(() => expect(canvasElement.querySelector('[tabindex="-1"]')).toHaveFocus());
  },
};

/** Names and emails that are not ours to choose wrap in their row, and push nothing out of the card. */
export const LongNames: Story = {
  args: {
    members: [
      OLIVIA,
      member(
        "m9",
        "u9",
        "Jean-Baptiste de la Fontaine-Beaumarchais-Montmorency-Villeneuve",
        "member",
      ),
      { ...MIA, userEmail: "mia.martin.with.an.address.that.is.far.too.long.for.a.row@exemple-association-internationale.org" },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = canvas.getByText(/^Jean-Baptiste/);
    const email = canvas.getByText(/^mia\.martin\.with/);

    // Each wraps in its own box, which is as wide as the row leaves it
    for (const text of [name, email]) {
      await expect(text.scrollWidth).toBeLessThanOrEqual(text.clientWidth);
    }
    // And nothing pushes the page sideways: the tap target of the last button reaches 2 px past its row, by design
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth);
  },
};

/** The same list in French. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("list", { name: "Membres" })).toBeVisible();
    await expect(canvas.getByText("Propriétaire")).toBeVisible();
    await expect(canvas.getAllByText("Administrateur")).toHaveLength(2);
    await expect(canvas.getByText("Membre")).toBeVisible();

    const { page, menu } = await openMenu(canvasElement, "Actions pour Mia Martin");
    await expect(within(menu).getByRole("menuitem", { name: "Retirer de l'espace" })).toBeVisible();
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Retirer de l'espace" }));
    const dialog = await page.findByRole("alertdialog", { name: "Retirer Mia Martin ?" });
    // The dialog fades in: it is in the page before it can be seen.
    await waitFor(() => expect(dialog).toBeVisible());
  },
};
