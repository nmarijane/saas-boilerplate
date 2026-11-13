import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/shared/components/ui/button";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";

// The dialog that creates a workspace. The server action it calls is a stub
// (Storybook replaces every server action): no story submits the form, which
// would only get the stub's answer.

/** A dialog that is open when the story loads; its trigger opens it again once closed. */
function Example({
  open: initialOpen,
  onOpenChange,
}: React.ComponentProps<typeof CreateWorkspaceDialog>) {
  const [open, setOpen] = React.useState(initialOpen);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Create workspace
      </Button>
      <CreateWorkspaceDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange(next);
        }}
      />
    </>
  );
}

/** The dialog, in its place on the page: the body, where Radix draws it. */
async function findDialog(canvasElement: HTMLElement, name: string) {
  const page = within(canvasElement.ownerDocument.body);
  const dialog = await page.findByRole("dialog", { name });
  // The dialog fades in: it is in the page before it can be seen.
  await waitFor(() => expect(dialog).toBeVisible());

  return { page, dialog };
}

const meta = {
  title: "Features/CreateWorkspaceDialog",
  component: CreateWorkspaceDialog,
  args: { open: true, onOpenChange: () => {} },
  argTypes: { onOpenChange: { action: "onOpenChange" } },
  parameters: {
    layout: "centered",
    // The dialog goes home through the router of the app, once it has created
    // the workspace: Storybook has none, and mounts a stand-in for the stories
    // that say they use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/dashboard" } },
    // While a dialog is open, Radix hides the page (the trigger included) from
    // assistive technology and traps the focus in the dialog: the trigger
    // cannot be reached, which axe cannot tell.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  render: (args) => <Example {...args} />,
} satisfies Meta<typeof CreateWorkspaceDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The name is all it asks: the address is made from it. The field has the
 * focus, and "Create" waits for a name: it is disabled while the field is
 * empty, or holds only spaces.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Create workspace");
    const field = within(dialog).getByLabelText(/Workspace name/);
    const create = within(dialog).getByRole("button", { name: "Create" });

    await expect(field).toHaveFocus();
    await expect(create).toBeDisabled();

    await userEvent.type(field, "   ");
    await expect(create).toBeDisabled();

    await userEvent.type(field, "Atelier Sud");
    await expect(create).toBeEnabled();
  },
};

/** The field takes at most 100 characters, which is what the server accepts. */
export const NameLimit: Story = {
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Create workspace");
    const field = within(dialog).getByLabelText(/Workspace name/);

    await userEvent.type(field, "a".repeat(120));

    await expect(field).toHaveValue("a".repeat(100));
  },
};

/** Cancel closes the dialog, and an empty dialog is what opens again. */
export const Cancels: Story = {
  play: async ({ canvasElement }) => {
    const { page, dialog } = await findDialog(canvasElement, "Create workspace");

    await userEvent.type(
      within(dialog).getByLabelText(/Workspace name/),
      "Atelier Sud",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(page.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Create workspace" }),
    );
    const again = await page.findByRole("dialog", { name: "Create workspace" });
    await expect(within(again).getByLabelText(/Workspace name/)).toHaveValue("");
  },
};

/** The same dialog in French. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Créer un espace");

    await expect(within(dialog).getByLabelText(/Nom de l'espace/)).toHaveFocus();
    await expect(
      within(dialog).getByRole("button", { name: "Créer" }),
    ).toBeDisabled();
  },
};
