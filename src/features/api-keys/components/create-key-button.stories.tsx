import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { CreateKeyButton } from "./create-key-button";

// The button of the header of the Developers page, with the dialog it opens. The
// server action the dialog calls is a stub (Storybook replaces every server
// action): the stories of the dialog itself (CreateKeyModal) give it a server
// that answers.

const meta = {
  title: "Features/CreateKeyButton",
  component: CreateKeyButton,
  tags: ["autodocs"],
  args: { orgId: "org_1" },
  parameters: {
    layout: "centered",
    nextjs: { appDirectory: true, navigation: { pathname: "/settings/developers" } },
    // While a dialog is open, Radix hides the page (the button included) from
    // assistive technology and traps the focus in the dialog: the button
    // cannot be reached, which axe cannot tell.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
} satisfies Meta<typeof CreateKeyButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The one primary button of the zone, with a plus. It says that it opens a dialog. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Create API key" });

    await expect(button).toHaveAttribute("aria-haspopup", "dialog");
    await expect(button).toHaveAttribute("aria-expanded", "false");
  },
};

/**
 * The dialog opens on the name. Cancel closes the dialog, and the button has the
 * focus again, as it is the opener the dialog has no trigger to give it back to.
 */
export const OpensAndCancels: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const button = within(canvasElement).getByRole("button", { name: "Create API key" });

    await userEvent.click(button);
    const dialog = await page.findByRole("dialog", { name: "Create API key" });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(within(dialog).getByLabelText(/Name/)).toHaveFocus();
    await expect(button).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
    await expect(button).toHaveAttribute("aria-expanded", "false");
  },
};

/** Escape closes it too, and the focus goes back to the button the same way. */
export const ClosesWithEscape: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const button = within(canvasElement).getByRole("button", { name: "Create API key" });

    await userEvent.click(button);
    await waitFor(async () => expect(await page.findByRole("dialog", { name: "Create API key" })).toBeVisible());

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
  },
};

export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Créer une clé d'API" }));
    const dialog = await page.findByRole("dialog", { name: "Créer une clé d'API" });

    await waitFor(() => expect(dialog).toBeVisible());
    await expect(within(dialog).getByLabelText(/Nom/)).toHaveFocus();
  },
};
