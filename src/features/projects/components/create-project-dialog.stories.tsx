import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent } from "@/shared/components/ui/dialog";
import { PROJECT_DESCRIPTION_MAX, PROJECT_NAME_MAX } from "../schemas";
import { CreateProjectDialog, CreateProjectFormView } from "./create-project-dialog";

// The dialog that creates a project. The server action it calls is a stub
// (Storybook replaces every server action): no story submits the form, which
// would only get the stub's answer. What a refusal and a wait look like is shown
// by the stories of the form's view, the way the feedback form shows its own.

/** A dialog that is open when the story loads; its trigger opens it again once closed. */
function Example({
  open: initialOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof CreateProjectDialog>) {
  const [open, setOpen] = React.useState(initialOpen);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open the dialog
      </Button>
      <CreateProjectDialog
        {...props}
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
  title: "Features/CreateProjectDialog",
  component: CreateProjectDialog,
  args: { orgId: "org_1", open: true, onOpenChange: () => {} },
  argTypes: { onOpenChange: { action: "onOpenChange" } },
  parameters: {
    layout: "centered",
    // The dialog goes to the new project through the router of the app, once it
    // has created it: Storybook has none, and mounts a stand-in for the stories
    // that say they use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/projects" } },
    // While a dialog is open, Radix hides the page (the trigger included) from
    // assistive technology and traps the focus in the dialog: the trigger
    // cannot be reached, which axe cannot tell.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  render: (args) => <Example {...args} />,
} satisfies Meta<typeof CreateProjectDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A name is all it needs, and the description is for those who have one. The
 * name has the focus, and "Create" waits for it: it is disabled while the field
 * is empty, or holds only spaces.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "New project");
    const field = within(dialog).getByLabelText(/Name/);
    const create = within(dialog).getByRole("button", { name: "Create" });

    await expect(field).toHaveFocus();
    await expect(create).toBeDisabled();

    await userEvent.type(field, "   ");
    await expect(create).toBeDisabled();

    await userEvent.type(field, "Atlas website");
    await expect(create).toBeEnabled();
    await expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  },
};

/** The fields stop at what the server accepts: 80 characters for the name, 280 for the description. */
export const Limits: Story = {
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "New project");
    const name = within(dialog).getByLabelText(/Name/);
    const description = within(dialog).getByLabelText("Description");

    await userEvent.type(name, "a".repeat(PROJECT_NAME_MAX + 20));
    await userEvent.type(description, "b".repeat(PROJECT_DESCRIPTION_MAX + 20));

    await expect(name).toHaveValue("a".repeat(PROJECT_NAME_MAX));
    await expect(description).toHaveValue("b".repeat(PROJECT_DESCRIPTION_MAX));
  },
};

/** Cancel closes the dialog, and an empty dialog is what opens again. */
export const Cancels: Story = {
  play: async ({ canvasElement }) => {
    const { page, dialog } = await findDialog(canvasElement, "New project");

    await userEvent.type(within(dialog).getByLabelText(/Name/), "Atlas website");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open the dialog" }));
    const again = await page.findByRole("dialog", { name: "New project" });
    await expect(within(again).getByLabelText(/Name/)).toHaveValue("");
  },
};

/** The same dialog in French. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Nouveau projet");

    await expect(within(dialog).getByLabelText(/Nom/)).toHaveFocus();
    await expect(within(dialog).getByRole("button", { name: "Créer" })).toBeDisabled();
  },
};

// The view of the form, in the dialog it lives in, for what the stub cannot show.
type ViewProps = React.ComponentProps<typeof CreateProjectFormView>;

function ViewInDialog(props: Partial<ViewProps>) {
  return (
    <Dialog open>
      <DialogContent size="sm">
        <CreateProjectFormView
          name="Atlas website"
          description="Rebuild the marketing site."
          pending={false}
          failed={false}
          onNameChange={fn()}
          onDescriptionChange={fn()}
          onSubmit={fn()}
          {...props}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * The server refused, or did not answer: what was typed is kept, and the dialog
 * says so with an alert, announced when it appears, above the button that was
 * just pressed.
 */
export const Failed: Story = {
  render: () => <ViewInDialog failed />,
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "New project");

    await expect(within(dialog).getByRole("alert")).toHaveTextContent("We couldn't create the project. Please try again.");
    await expect(within(dialog).getByLabelText(/Name/)).toHaveValue("Atlas website");
    await expect(within(dialog).getByRole("button", { name: "Create" })).toBeEnabled();
  },
};

/**
 * The creation is running: the fields are read-only (not disabled, so that a
 * failure finds the focus where it was), Cancel is held, and Create shows that
 * it works and keeps the focus.
 */
export const Sending: Story = {
  render: () => <ViewInDialog pending />,
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "New project");
    const create = within(dialog).getByRole("button", { name: /Create/ });

    await expect(within(dialog).getByLabelText(/Name/)).toHaveAttribute("readonly");
    await expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    await expect(create).toHaveAttribute("aria-disabled", "true");
    await expect(create).not.toBeDisabled();
  },
};

export const FailedInFrench: Story = {
  globals: { locale: "fr" },
  render: () => <ViewInDialog failed />,
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Nouveau projet");

    await expect(within(dialog).getByRole("alert")).toHaveTextContent("Impossible de créer le projet. Veuillez réessayer.");
  },
};
