import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Toaster } from "@/shared/components/ui/sonner";
import { DeleteProjectZone } from "./delete-project-zone";

// The zone of the settings that deletes a project, for those who may. The
// server action it calls is a stub (Storybook replaces every server action)
// that always works: a deletion that fails is shown by the confirm dialog's own
// stories, and tested here and there.

const meta = {
  title: "Features/DeleteProjectZone",
  component: DeleteProjectZone,
  tags: ["autodocs"],
  args: { orgId: "org_1", projectId: "project_atlas" },
  parameters: {
    // Once the project is deleted, the zone goes back to the list through the
    // router of the app: Storybook has none, and mounts a stand-in for the
    // stories that say they use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/projects/project_atlas/settings" } },
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
} satisfies Meta<typeof DeleteProjectZone>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One sentence on the danger background, with a danger edge, and the one destructive button. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Delete project" });

    await expect(button).toHaveAttribute("aria-haspopup", "dialog");
    await expect(button).toHaveAccessibleDescription(/can't be undone/);
  },
};

/**
 * The button opens a confirmation in the danger tone: an alert dialog, with
 * nothing to type and a button that says what it does. Cancel closes it, and the
 * focus goes back to the button of the zone.
 */
export const Confirms: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const button = within(canvasElement).getByRole("button", { name: "Delete project" });

    await userEvent.click(button);
    const dialog = await page.findByRole("alertdialog", { name: "Delete this project?" });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(dialog).toHaveAccessibleDescription(/can't be undone/);
    await expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    await expect(within(dialog).getByRole("button", { name: "Delete project" })).toBeEnabled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
  },
};

/** Confirming deletes the project (the stub answers that it is done), and the dialog closes. */
export const Deletes: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete project" }));
    const dialog = await page.findByRole("alertdialog", { name: "Delete this project?" });
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete project" }));

    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    await expect(await page.findByText("Project deleted.")).toBeVisible();
  },
};

/** The same zone in French. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Supprimer le projet" }));
    const dialog = await page.findByRole("alertdialog", { name: "Supprimer ce projet ?" });

    await waitFor(() => expect(dialog).toBeVisible());
    await expect(within(dialog).getByRole("button", { name: "Annuler" })).toBeVisible();
  },
};
