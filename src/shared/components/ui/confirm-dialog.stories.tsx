import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { fn } from "storybook/test";

import { Button } from "./button";
import { ConfirmDialog } from "./confirm-dialog";
import { Toaster } from "./sonner";

type Props = Omit<
  React.ComponentProps<typeof ConfirmDialog>,
  "open" | "onOpenChange"
>;

/** A request that takes 1.5 seconds: long enough to see the button wait. */
const slow = () => new Promise<void>((resolve) => setTimeout(resolve, 1500));

/** The same request, which fails. */
const failing = () =>
  new Promise<void>((_resolve, reject) =>
    setTimeout(() => reject(new Error("Network error")), 1500),
  );

/**
 * Keeps `open`, as the page that uses the dialog would. The dialog is open when
 * the story loads; the button opens it again once it has closed.
 */
function Demo({ tone, ...props }: Props) {
  const [open, setOpen] = React.useState(true);

  return (
    <>
      <Button
        variant={tone === "danger" ? "destructive" : "default"}
        onClick={() => setOpen(true)}
      >
        {props.confirmLabel}
      </Button>
      <ConfirmDialog
        {...props}
        tone={tone}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

const meta = {
  title: "UI/ConfirmDialog",
  component: ConfirmDialog,
  tags: ["autodocs"],
  argTypes: {
    tone: {
      control: "inline-radio",
      options: ["danger", "neutral"],
    },
    // The demo keeps the state of the dialog itself.
    open: { table: { disable: true } },
    onOpenChange: { table: { disable: true } },
  },
  args: {
    open: true,
    onOpenChange: fn(),
    title: "Delete this project?",
    description: "Its files and its history are deleted for good.",
    confirmLabel: "Delete project",
    onConfirm: fn(slow),
  },
  // While a dialog is open, Radix hides the page (the trigger included) from
  // assistive technology and traps the focus in the dialog: the trigger cannot
  // be reached, which axe cannot tell.
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  render: ({ open: _open, onOpenChange: _onOpenChange, ...args }) => (
    <Demo {...args} />
  ),
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Press the red button: it shows a spinner for 1.5 seconds, Escape and Cancel do
 * nothing meanwhile, and the dialog closes once the request is done.
 */
export const Danger: Story = {
  args: { tone: "danger" },
};

/** Not destructive: the confirm button is the primary one. */
export const Neutral: Story = {
  args: {
    tone: "neutral",
    title: "Publish this page?",
    description: "Anyone with the link can read it.",
    confirmLabel: "Publish",
  },
};

/**
 * The request fails: the button stops waiting, the dialog stays open and an
 * error toast says so. The toast stays until it is closed, and closing it does
 * not close the dialog. The error also reaches the browser's error handlers,
 * which is why the console shows it.
 */
export const Failing: Story = {
  args: {
    tone: "danger",
    onConfirm: fn(failing),
  },
  render: ({ open: _open, onOpenChange: _onOpenChange, ...args }) => (
    <>
      <Demo {...args} />
      <Toaster />
    </>
  ),
};

export const WithoutDescription: Story = {
  args: {
    tone: "danger",
    title: "Remove Ada from the team?",
    description: undefined,
    confirmLabel: "Remove",
  },
};

/** French runs longer: the buttons stack on a narrow screen, the main one on top. */
export const LongLabels: Story = {
  args: {
    tone: "danger",
    title: "Supprimer définitivement ce projet et tout son historique ?",
    description:
      "Les fichiers, les commentaires et les invitations en cours seront supprimés. Cette action est irréversible.",
    confirmLabel: "Supprimer définitivement le projet",
    cancelLabel: "Garder le projet",
  },
};
