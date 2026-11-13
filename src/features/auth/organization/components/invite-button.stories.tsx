import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Toaster } from "@/shared/components/ui/sonner";
import { InviteButton } from "./invite-button";

// The button of the header of the Team page, with the dialog it opens. The
// server action the dialog calls is a stub (Storybook replaces every server
// action) that always works: an invitation that is refused is the business of the
// tests of the flow, which have a server that answers no.

const meta = {
  title: "Features/InviteButton",
  component: InviteButton,
  tags: ["autodocs"],
  args: { orgId: "org_1" },
  parameters: {
    layout: "centered",
    // While a dialog is open, Radix hides the page (the button included) from
    // assistive technology and traps the focus in the dialog: the button
    // cannot be reached, which axe cannot tell.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  decorators: [
    (Story) => (
      <>
        <Story />
        <Toaster />
      </>
    ),
  ],
} satisfies Meta<typeof InviteButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The one primary button of the zone, with a person and a plus. It says that it opens a dialog. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Invite member" });

    await expect(button).toHaveAttribute("aria-haspopup", "dialog");
    await expect(button).toHaveAttribute("aria-expanded", "false");
  },
};

/**
 * The dialog opens on the email, with the member role to start with. Send waits
 * for an address; Cancel closes the dialog, and the button has the focus again.
 */
export const OpensAndCancels: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const button = within(canvasElement).getByRole("button", { name: "Invite member" });

    await userEvent.click(button);
    const dialog = await page.findByRole("dialog", { name: "Invite member" });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(within(dialog).getByLabelText(/Email/)).toHaveFocus();
    await expect(within(dialog).getByRole("combobox", { name: "Role" })).toHaveTextContent("Member");
    await expect(within(dialog).getByRole("button", { name: "Send invitation" })).toBeDisabled();
    await expect(button).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
    await expect(button).toHaveAttribute("aria-expanded", "false");
  },
};

/** An address that is not one is said under the field, as an alert, and nothing is sent. */
export const RefusesABadAddress: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Invite member" }));
    const dialog = await page.findByRole("dialog", { name: "Invite member" });
    await waitFor(() => expect(dialog).toBeVisible());
    const email = within(dialog).getByLabelText(/Email/);

    await userEvent.type(email, "mia");
    await userEvent.click(within(dialog).getByRole("button", { name: "Send invitation" }));

    await expect(within(dialog).getByRole("alert")).toHaveTextContent("Enter a valid email address.");
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(dialog).toBeVisible();

    // Typing again is another try: the message goes away
    await userEvent.type(email, "@example.com");
    await expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  },
};

/** A role can be chosen: the Select offers the two roles a person can be invited as. */
export const ChoosesARole: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Invite member" }));
    const dialog = await page.findByRole("dialog", { name: "Invite member" });
    await waitFor(() => expect(dialog).toBeVisible());

    await userEvent.click(within(dialog).getByRole("combobox", { name: "Role" }));
    const options = await page.findAllByRole("option");
    await expect(options.map((option) => option.textContent?.trim())).toEqual(["Admin", "Member"]);
    await userEvent.click(page.getByRole("option", { name: "Admin" }));

    await expect(within(dialog).getByRole("combobox", { name: "Role" })).toHaveTextContent("Admin");
  },
};

/** A good address is sent (the stub answers that it is done): the dialog closes, says so, and gives the focus back. */
export const Invites: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const button = within(canvasElement).getByRole("button", { name: "Invite member" });

    await userEvent.click(button);
    const dialog = await page.findByRole("dialog", { name: "Invite member" });
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.type(within(dialog).getByLabelText(/Email/), "mia@example.com");
    await userEvent.click(within(dialog).getByRole("button", { name: "Send invitation" }));

    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    const toast = await page.findByText("Invitation sent to mia@example.com.");
    // A toast fades in: it is in the page before it can be seen
    await waitFor(() => expect(toast).toBeVisible());
    await waitFor(() => expect(button).toHaveFocus());
  },
};

export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Inviter un membre" }));
    const dialog = await page.findByRole("dialog", { name: "Inviter un membre" });

    await waitFor(() => expect(dialog).toBeVisible());
    await expect(within(dialog).getByRole("combobox", { name: "Rôle" })).toHaveTextContent("Membre");
    await expect(within(dialog).getByRole("button", { name: "Envoyer l'invitation" })).toBeDisabled();
  },
};
