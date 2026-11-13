import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ProjectsEmpty } from "./projects-empty";

// The button opens the dialog that creates a project. The server action it
// calls is a stub (Storybook replaces every server action): no story submits
// the form, which would only get the stub's answer.

const meta = {
  title: "Features/ProjectsEmpty",
  component: ProjectsEmpty,
  tags: ["autodocs"],
  args: { orgId: "org_1" },
  parameters: {
    // The dialog goes to the new project through the router of the app, once it
    // has created it: Storybook has none, and mounts a stand-in for the stories
    // that say they use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/projects" } },
    // While a dialog is open, Radix hides the page (the button included) from
    // assistive technology and traps the focus in the dialog: the button
    // cannot be reached, which axe cannot tell.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProjectsEmpty>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A workspace with no project: one sentence and the one button that creates the first. */
export const Default: Story = {};

/**
 * The button opens the dialog, which has the focus on its name, and Escape
 * closes it and gives the focus back to the button: Radix would give it to a
 * trigger that does not exist, and drop it on the page.
 */
export const OpensTheDialogAndGetsTheFocusBack: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const button = within(canvasElement).getByRole("button", { name: "New project" });

    await userEvent.click(button);
    const dialog = await page.findByRole("dialog", { name: "New project" });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(within(dialog).getByLabelText(/Name/)).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
  },
};

export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("heading", { level: 2, name: "Aucun projet pour l'instant" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Nouveau projet" })).toBeVisible();
  },
};
