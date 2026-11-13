import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { DeleteWorkspace } from "./delete-workspace-zone";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Toaster } from "@/shared/components/ui/sonner";
import { DeleteWorkspaceZone } from "./delete-workspace-zone";

// The zone of the Team page that deletes the workspace, for its owner. Storybook
// replaces every server action by a stub that answers with no data, and the zone
// reads what the server answers (the workspace is deleted, or a feature kept it,
// and says why): each story gives it the answer it needs.

/** `beforeEach` of a story: the errors the app reports (`reportError`) are taken away from the page, for a story that fails on purpose. */
const reported = fn();
function catchReports() {
  reported.mockClear();
  const original = window.reportError;
  window.reportError = reported;

  return () => {
    window.reportError = original;
  };
}

const meta = {
  title: "Features/DeleteWorkspaceZone",
  component: DeleteWorkspaceZone,
  tags: ["autodocs"],
  args: {
    orgId: "org_1",
    name: "Studio Nord",
    // The workspace is deleted, unless a story says otherwise
    deleteWorkspace: fn<DeleteWorkspace>(async () => ({ success: true, data: { deleted: true } })),
  },
  parameters: {
    // Once the workspace is deleted, the zone goes to the home through the
    // router of the app: Storybook has none, and mounts a stand-in for the
    // stories that say they use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/settings/team" } },
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
} satisfies Meta<typeof DeleteWorkspaceZone>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One sentence on the danger background, with a danger edge, and the one destructive button. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Delete workspace" });

    await expect(button).toHaveAttribute("aria-haspopup", "dialog");
    await expect(button).toHaveAccessibleDescription(/can't be undone/);
  },
};

/**
 * The button opens a confirmation in the danger tone: an alert dialog that asks
 * for the name of the workspace, as it is written. The button that deletes waits
 * for the exact name: a slip of case or a missing letter does not unlock it.
 * Cancel closes it, and the focus goes back to the button of the zone.
 */
export const AsksForTheName: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const button = within(canvasElement).getByRole("button", { name: "Delete workspace" });

    await userEvent.click(button);
    const dialog = await page.findByRole("alertdialog", { name: "Delete this workspace?" });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(dialog).toHaveAccessibleDescription(/Studio Nord and everything in it/);
    const field = within(dialog).getByLabelText("Type Studio Nord to confirm");
    const confirm = within(dialog).getByRole("button", { name: "Delete workspace" });

    await expect(confirm).toBeDisabled();
    await userEvent.type(field, "studio nord");
    await expect(confirm).toBeDisabled();
    await userEvent.clear(field);
    await userEvent.type(field, "Studio Nord");
    await expect(confirm).toBeEnabled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
  },
};

/** Typing the name and confirming deletes the workspace (the server answers that it is done), and the dialog closes. */
export const Deletes: Story = {
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete workspace" }));
    const dialog = await page.findByRole("alertdialog", { name: "Delete this workspace?" });
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.type(within(dialog).getByLabelText("Type Studio Nord to confirm"), "Studio Nord");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete workspace" }));

    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    await expect(args.deleteWorkspace).toHaveBeenCalledTimes(1);
    await expect(args.deleteWorkspace).toHaveBeenCalledWith({ orgId: "org_1" });
    const toast = await page.findByText("Workspace deleted.");
    // A toast fades in: it is in the page before it can be seen
    await waitFor(() => expect(toast).toBeVisible());
  },
};

/**
 * A feature that holds something for the workspace outside its rows (the
 * subscription, the stored files) could not clean it up: the workspace is kept,
 * and the toast says why, in the words of the feature, rather than that it is
 * deleted.
 */
export const KeptByAFeature: Story = {
  args: {
    deleteWorkspace: fn<DeleteWorkspace>(async () => ({
      success: true,
      data: { deleted: false, messageKey: "billing.deleteWorkspaceFailed", done: [] },
    })),
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete workspace" }));
    const dialog = await page.findByRole("alertdialog", { name: "Delete this workspace?" });
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.type(within(dialog).getByLabelText("Type Studio Nord to confirm"), "Studio Nord");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete workspace" }));

    const toast = await page.findByText(/The subscription of this workspace could not be cancelled, so the workspace was kept/);
    await waitFor(() => expect(toast).toBeVisible());
    await expect(page.queryByText("Workspace deleted.")).not.toBeInTheDocument();
  },
};

/** The server refuses, or does not answer: the dialog stays open with an error toast, so that a workspace that is still there never looks deleted. */
export const Refused: Story = {
  args: {
    deleteWorkspace: fn<DeleteWorkspace>(async () => ({ success: false, error: "Failed to delete organization" })),
  },
  beforeEach: catchReports,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete workspace" }));
    const dialog = await page.findByRole("alertdialog", { name: "Delete this workspace?" });
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.type(within(dialog).getByLabelText("Type Studio Nord to confirm"), "Studio Nord");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete workspace" }));

    const toast = await page.findByText("An error occurred");
    await waitFor(() => expect(toast).toBeVisible());
    await expect(dialog).toBeVisible();
    await expect(page.queryByText("Workspace deleted.")).not.toBeInTheDocument();
    // Handled with the toast, not hidden: the error reporter of the app still hears it
    await expect(reported).toHaveBeenCalledOnce();
  },
};

/** The same zone in French: the name is still typed as it is written. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Supprimer l'espace" }));
    const dialog = await page.findByRole("alertdialog", { name: "Supprimer cet espace ?" });

    await waitFor(() => expect(dialog).toBeVisible());
    await expect(within(dialog).getByLabelText("Saisissez Studio Nord pour confirmer")).toBeVisible();
    await expect(within(dialog).getByRole("button", { name: "Annuler" })).toBeVisible();
  },
};
