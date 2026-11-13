import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { NewProjectButton } from "./new-project-button";

// The button of the header of the projects and of the home, with the dialog it
// opens. The server action the dialog calls is a stub (Storybook replaces every
// server action): no story submits the form, which would only get the stub's answer.

const meta = {
  title: "Features/NewProjectButton",
  component: NewProjectButton,
  tags: ["autodocs"],
  args: { orgId: "org_1" },
  parameters: {
    layout: "centered",
    // The dialog goes to the new project through the router of the app, once it
    // has created it: Storybook has none, and mounts a stand-in for the stories
    // that say they use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/projects" } },
    // While a dialog is open, Radix hides the page (the button included) from
    // assistive technology and traps the focus in the dialog: the button
    // cannot be reached, which axe cannot tell.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
} satisfies Meta<typeof NewProjectButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The one primary button of the zone, with a plus. It says that it opens a dialog. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "New project" });

    await expect(button).toHaveAttribute("aria-haspopup", "dialog");
    await expect(button).toHaveAttribute("aria-expanded", "false");
  },
};

/** The dialog opens on the name; Cancel closes it, and the button has the focus again. */
export const OpensAndCancels: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const button = within(canvasElement).getByRole("button", { name: "New project" });

    await userEvent.click(button);
    const dialog = await page.findByRole("dialog", { name: "New project" });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(within(dialog).getByLabelText(/Name/)).toHaveFocus();
    await expect(button).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
    await expect(button).toHaveAttribute("aria-expanded", "false");
  },
};

export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "Nouveau projet" })).toBeVisible();
  },
};
