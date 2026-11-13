import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Toaster } from "@/shared/components/ui/sonner";
import { DeleteAccountZone } from "./delete-account-zone";

// The zone of the account page that deletes the account. The server action it
// calls is a stub (Storybook replaces every server action) that always works: a
// deletion that fails is shown by the confirm dialog's own stories, and tested
// here and there.

const meta = {
  title: "Features/DeleteAccountZone",
  component: DeleteAccountZone,
  tags: ["autodocs"],
  parameters: {
    // Once the account is deleted, the zone goes to the sign-in page through the
    // router of the app: Storybook has none, and mounts a stand-in for the
    // stories that say they use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/settings/account" } },
    // While a dialog is open, Radix hides the page (the button included) from
    // assistive technology and traps the focus in the dialog: the button
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
} satisfies Meta<typeof DeleteAccountZone>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One sentence on the danger background, with a danger edge, and the one destructive button. */
export const Default: Story = {
  args: { needsPassword: true },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Delete account" });

    await expect(button).toHaveAttribute("aria-haspopup", "dialog");
    await expect(button).toHaveAccessibleDescription(/permanent/);
  },
};

/**
 * The button opens a confirmation in the danger tone: an alert dialog that asks
 * for DELETE to be typed. The button that deletes waits for the word, as it is
 * written. Cancel closes it, and the focus goes back to the button of the zone.
 */
export const AsksForTheWord: Story = {
  args: { needsPassword: false },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const button = within(canvasElement).getByRole("button", { name: "Delete account" });

    await userEvent.click(button);
    const dialog = await page.findByRole("alertdialog", { name: "Delete your account?" });
    await waitFor(() => expect(dialog).toBeVisible());
    const field = within(dialog).getByLabelText("Type DELETE to confirm");
    const confirm = within(dialog).getByRole("button", { name: "Delete account" });

    await expect(confirm).toBeDisabled();
    await userEvent.type(field, "delete");
    await expect(confirm).toBeDisabled();
    await userEvent.clear(field);
    await userEvent.type(field, "DELETE");
    await expect(confirm).toBeEnabled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
  },
};

/** Typing the word and confirming deletes the account (the stub answers that it is done), and the dialog closes. */
export const Deletes: Story = {
  args: { needsPassword: false },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete account" }));
    const dialog = await page.findByRole("alertdialog", { name: "Delete your account?" });
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.type(within(dialog).getByLabelText("Type DELETE to confirm"), "DELETE");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete account" }));

    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    const toast = await page.findByText("Your account was deleted.");
    // A toast fades in: it is in the page before it can be seen
    await waitFor(() => expect(toast).toBeVisible());
  },
};

/** The same zone in French: the word to type is still DELETE, and the dialog says so. */
export const French: Story = {
  args: { needsPassword: false },
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Supprimer le compte" }));
    const dialog = await page.findByRole("alertdialog", { name: "Supprimer votre compte ?" });

    await waitFor(() => expect(dialog).toBeVisible());
    await expect(within(dialog).getByLabelText("Saisissez DELETE pour confirmer")).toBeVisible();
    await expect(within(dialog).getByRole("button", { name: "Annuler" })).toBeVisible();
  },
};

/**
 * An account with a password asks for it again before it can be deleted: the button that
 * deletes waits for the word and for a password, which the server checks.
 */
export const AsksForThePassword: Story = {
  args: { needsPassword: true },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete account" }));
    const dialog = await page.findByRole("alertdialog", { name: "Delete your account?" });
    await waitFor(() => expect(dialog).toBeVisible());
    const confirm = within(dialog).getByRole("button", { name: "Delete account" });

    await userEvent.type(within(dialog).getByLabelText("Type DELETE to confirm"), "DELETE");
    await expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Current password"), "a-password");
    await expect(confirm).toBeEnabled();
  },
};
