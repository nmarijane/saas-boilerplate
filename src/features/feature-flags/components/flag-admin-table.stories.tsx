import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Toaster } from "@/shared/components/ui/sonner";
import { FlagAdminTable } from "./flag-admin-table";

// The feature flags on the admin page, in the table the other admin lists
// share. The server actions it calls are stubs (Storybook replaces every server
// action) that always work: a deletion that fails is shown by the confirm
// dialog's own stories. The table is not changed by the stub, so the flag stays
// where it is: what these stories read is what the person is asked, told and
// left on.

const DAY = new Date(Date.UTC(2026, 9, 20));

const FLAGS = [
  {
    id: "f1",
    key: "new-dashboard",
    description: "The redesigned home",
    enabled: true,
    rules: [{ type: "plan" as const, value: "pro" }],
    createdAt: DAY,
    updatedAt: DAY,
  },
  { id: "f2", key: "bulk-export", description: "CSV export", enabled: false, rules: [], createdAt: DAY, updatedAt: DAY },
  {
    id: "f3",
    key: "beta-search",
    description: "The new search, for a few workspaces",
    enabled: true,
    rules: [{ type: "org" as const, value: "org_1" }],
    createdAt: DAY,
    updatedAt: DAY,
  },
];

const meta = {
  title: "Features/FlagAdminTable",
  component: FlagAdminTable,
  tags: ["autodocs"],
  args: { flags: FLAGS, deleteFlag: async () => {}, toggleFlag: async () => {} },
  parameters: {
    // While a dialog is open, Radix hides the page (the button included) from
    // assistive technology and traps the focus in the dialog: the button
    // cannot be reached, which axe cannot tell.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  decorators: [
    (Story) => (
      <div className="max-w-5xl">
        <Story />
        <Toaster />
      </div>
    ),
  ],
} satisfies Meta<typeof FlagAdminTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One row each, with the key, the description, a switch, the number of rules, and a button that deletes the flag, named by it. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getAllByRole("row")).toHaveLength(FLAGS.length + 1);
    await expect(canvas.getByRole("switch", { name: "Toggle new-dashboard" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Delete bulk-export" })).toBeVisible();
  },
};

/**
 * Deleting asks first, in the danger tone, naming the flag. Cancel closes the
 * question and the focus goes back to the button that asked it, and nothing is
 * deleted.
 */
export const AsksFirst: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const button = within(canvasElement).getByRole("button", { name: "Delete new-dashboard" });

    await userEvent.click(button);
    const dialog = await page.findByRole("alertdialog", { name: "Delete new-dashboard?" });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(dialog).toHaveAccessibleDescription(/can't be undone/);

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
    await expect(page.queryByText("Flag deleted: new-dashboard.")).not.toBeInTheDocument();
  },
};

/**
 * Confirming deletes the flag (the stub answers that it is done) and says so in
 * a toast. The button that asked is going with its row, so the focus is not left
 * to fall on the page: it is put on the box that holds the table, as it is on the
 * other lists.
 */
export const Deletes: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete new-dashboard" }));
    const dialog = await page.findByRole("alertdialog", { name: "Delete new-dashboard?" });
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete flag" }));

    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    const toast = await page.findByText("Flag deleted: new-dashboard.");
    // A toast fades in: it is in the page before it can be seen
    await waitFor(() => expect(toast).toBeVisible());
    await waitFor(() => expect(canvasElement.querySelector('[tabindex="-1"]')).toHaveFocus());
  },
};

/**
 * When the server refuses, the dialog stays open and an error toast says so: the
 * flag is still there, and nothing says it was deleted.
 */
export const StaysOpenWhenTheServerRefuses: Story = {
  args: {
    deleteFlag: async () => {
      throw new Error("refused");
    },
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete bulk-export" }));
    const dialog = await page.findByRole("alertdialog", { name: "Delete bulk-export?" });
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete flag" }));

    await expect(await page.findByRole("alertdialog", { name: "Delete bulk-export?" })).toBeVisible();
    await expect(page.queryByText("Flag deleted: bulk-export.")).not.toBeInTheDocument();
  },
};

/** The server does what the switch asks: it stays where it was put, and nothing is said. */
export const Toggles: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const flag = within(canvasElement).getByRole("switch", { name: "Toggle bulk-export" });

    await userEvent.click(flag);

    await waitFor(() => expect(flag).toBeChecked());
    await expect(page.queryByText("We couldn't update this flag. Please try again.")).not.toBeInTheDocument();
  },
};

/** The server refuses: the switch goes back where it was, and a toast says so. */
export const ToggleRefused: Story = {
  args: {
    toggleFlag: async () => {
      throw new Error("refused");
    },
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const flag = within(canvasElement).getByRole("switch", { name: "Toggle bulk-export" });
    await expect(flag).not.toBeChecked();

    await userEvent.click(flag);

    const toast = await page.findByText("We couldn't update this flag. Please try again.");
    // A toast fades in: it is in the page before it can be seen
    await waitFor(() => expect(toast).toBeVisible());
    await waitFor(() => expect(flag).not.toBeChecked());
  },
};

/**
 * The table over a list that loses the flag that is deleted, as the page does when it
 * is read again: the flags below move up a row.
 */
function Shrinking(args: React.ComponentProps<typeof FlagAdminTable>) {
  const [flags, setFlags] = React.useState(args.flags);

  return (
    <FlagAdminTable
      {...args}
      flags={flags}
      deleteFlag={async (id) => {
        setFlags((current) => current.filter((flag) => flag.id !== id));
      }}
    />
  );
}

/**
 * What a row holds follows its flag. After a delete the flags below move up, and the one that is
 * first now asks before it is deleted like any other: Cancel leaves the focus on its own button, and
 * not on the table, where the focus of the delete before went (that row's state stayed with the place).
 */
export const KeepsEachRowsOwnFocus: Story = {
  render: (args) => <Shrinking {...args} />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const canvas = within(canvasElement);

    // The first flag is deleted: the others move up
    await userEvent.click(canvas.getByRole("button", { name: "Delete new-dashboard" }));
    const first = await page.findByRole("alertdialog", { name: "Delete new-dashboard?" });
    await waitFor(() => expect(first).toBeVisible());
    await userEvent.click(within(first).getByRole("button", { name: "Delete flag" }));
    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(canvas.queryByRole("button", { name: "Delete new-dashboard" })).not.toBeInTheDocument());
    await waitFor(() => expect(canvasElement.querySelector('[tabindex="-1"]')).toHaveFocus());

    // The one that moved up is asked about, and the question is cancelled
    const moved = canvas.getByRole("button", { name: "Delete bulk-export" });
    await userEvent.click(moved);
    const second = await page.findByRole("alertdialog", { name: "Delete bulk-export?" });
    await waitFor(() => expect(second).toBeVisible());
    await userEvent.click(within(second).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(moved).toHaveFocus());
    await expect(canvas.getAllByRole("row")).toHaveLength(2 + 1);
  },
};

/** The same table in French. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Supprimer new-dashboard" }));
    const dialog = await page.findByRole("alertdialog", { name: "Supprimer new-dashboard ?" });

    await waitFor(() => expect(dialog).toBeVisible());
    await expect(within(dialog).getByRole("button", { name: "Supprimer l'indicateur" })).toBeVisible();
    await expect(within(dialog).getByRole("button", { name: "Annuler" })).toBeVisible();
  },
};
