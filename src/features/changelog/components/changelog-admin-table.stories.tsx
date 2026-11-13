import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Toaster } from "@/shared/components/ui/sonner";
import { ChangelogAdminTable } from "./changelog-admin-table";

// The changelog entries on the admin page, in the table the other admin lists
// share. The server action it calls is a stub (Storybook replaces every server
// action) that always works: a deletion that fails is shown by the confirm
// dialog's own stories, and tested with a server that answers no. The table is
// not changed by the stub, so the entry stays where it is: what these stories
// read is what the person is asked, told and left on.

const ENTRIES = [
  {
    id: "c1",
    title: "Faster exports",
    version: "1.4.0",
    content: "Exports of a thousand rows or more now run in the background.",
    publishedAt: new Date(Date.UTC(2026, 9, 20)),
    createdAt: new Date(Date.UTC(2026, 9, 20)),
  },
  {
    id: "c2",
    title: "Roles for teammates",
    version: "1.3.0",
    content: "Invite a teammate as an admin or as a member.",
    publishedAt: new Date(Date.UTC(2026, 9, 6)),
    createdAt: new Date(Date.UTC(2026, 9, 6)),
  },
  {
    id: "c3",
    title: "Dark mode",
    version: null,
    content: "Every screen follows the theme of your system.",
    publishedAt: new Date(Date.UTC(2026, 8, 22)),
    createdAt: new Date(Date.UTC(2026, 8, 22)),
  },
];

const meta = {
  title: "Features/ChangelogAdminTable",
  component: ChangelogAdminTable,
  tags: ["autodocs"],
  args: { entries: ENTRIES },
  parameters: {
    // A deletion reads the page again, through the router of the app: Storybook
    // has none, and mounts a stand-in for the stories that say they use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/admin/changelog" } },
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
} satisfies Meta<typeof ChangelogAdminTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One row each, with the day, the version, the title and the start of the text, and a button that deletes it, named by the entry. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getAllByRole("row")).toHaveLength(ENTRIES.length + 1);
    await expect(canvas.getByRole("button", { name: "Delete Faster exports" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Delete Dark mode" })).toBeVisible();
  },
};

/**
 * Deleting asks first, in the danger tone, naming the entry. Cancel closes the
 * question and the focus goes back to the button that asked it, and nothing is
 * deleted.
 */
export const AsksFirst: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const button = within(canvasElement).getByRole("button", { name: "Delete Faster exports" });

    await userEvent.click(button);
    const dialog = await page.findByRole("alertdialog", { name: "Delete Faster exports?" });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(dialog).toHaveAccessibleDescription(/can't be undone/);

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
    await expect(page.queryByText("Entry deleted: Faster exports.")).not.toBeInTheDocument();
  },
};

/**
 * Confirming deletes the entry (the stub answers that it is done) and says so in
 * a toast. The button that asked is going with its row, so the focus is not left
 * to fall on the page: it is put on the box that holds the table, as it is on the
 * other lists.
 */
export const Deletes: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete Faster exports" }));
    const dialog = await page.findByRole("alertdialog", { name: "Delete Faster exports?" });
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete entry" }));

    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    const toast = await page.findByText("Entry deleted: Faster exports.");
    // A toast fades in: it is in the page before it can be seen
    await waitFor(() => expect(toast).toBeVisible());
    await waitFor(() => expect(canvasElement.querySelector('[tabindex="-1"]')).toHaveFocus());
  },
};

/**
 * The table over a list that loses the entry that is deleted, as the page does when it
 * is read again: the entries below move up a row.
 */
function Shrinking(args: React.ComponentProps<typeof ChangelogAdminTable>) {
  const [entries, setEntries] = React.useState(args.entries);

  return (
    <ChangelogAdminTable
      {...args}
      entries={entries}
      deleteEntry={async (id) => {
        setEntries((current) => current.filter((entry) => entry.id !== id));
      }}
    />
  );
}

/**
 * What a row holds follows its entry. After a delete the entries below move up, and the one that is
 * first now asks before it is deleted like any other: Cancel leaves the focus on its own button, and
 * not on the table, where the focus of the delete before went (that row's flag stayed with the place).
 */
export const KeepsEachRowsOwnFocus: Story = {
  render: (args) => <Shrinking {...args} />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const canvas = within(canvasElement);

    // The first entry is deleted: the others move up
    await userEvent.click(canvas.getByRole("button", { name: "Delete Faster exports" }));
    const first = await page.findByRole("alertdialog", { name: "Delete Faster exports?" });
    await waitFor(() => expect(first).toBeVisible());
    await userEvent.click(within(first).getByRole("button", { name: "Delete entry" }));
    await waitFor(() => expect(page.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(canvas.queryByRole("button", { name: "Delete Faster exports" })).not.toBeInTheDocument());
    await waitFor(() => expect(canvasElement.querySelector('[tabindex="-1"]')).toHaveFocus());

    // The one that moved up is asked about, and the question is cancelled
    const moved = canvas.getByRole("button", { name: "Delete Roles for teammates" });
    await userEvent.click(moved);
    const second = await page.findByRole("alertdialog", { name: "Delete Roles for teammates?" });
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

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Supprimer Faster exports" }));
    const dialog = await page.findByRole("alertdialog", { name: "Supprimer Faster exports ?" });

    await waitFor(() => expect(dialog).toBeVisible());
    await expect(within(dialog).getByRole("button", { name: "Supprimer l'entrée" })).toBeVisible();
    await expect(within(dialog).getByRole("button", { name: "Annuler" })).toBeVisible();
  },
};
