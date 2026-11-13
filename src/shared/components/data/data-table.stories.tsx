import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { Column } from "./data-table";
import { expect, userEvent, within } from "storybook/test";
import { StatusDot } from "@/shared/components/ui/status-dot";
import { DataTable } from "./data-table";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  projects: number;
  status: string;
  [key: string]: unknown;
}

const sampleColumns: Column<User>[] = [
  { key: "name", header: "Name", sortable: true },
  { key: "email", header: "Email", sortable: true },
  { key: "role", header: "Role", sortable: true },
  // A number with no cell of its own is set in a monospace face with tabular figures.
  { key: "projects", header: "Projects", sortable: true },
  {
    key: "status",
    header: "Status",
    cell: (row) => (
      <StatusDot
        tone={row.status === "Active" ? "success" : "neutral"}
        label={row.status}
      />
    ),
  },
];

const sampleData: User[] = [
  { id: "1", name: "Alice Martin", email: "alice@example.com", role: "Admin", projects: 12, status: "Active" },
  { id: "2", name: "Bob Johnson", email: "bob@example.com", role: "Member", projects: 3, status: "Active" },
  { id: "3", name: "Charlie Brown", email: "charlie@example.com", role: "Member", projects: 0, status: "Inactive" },
  { id: "4", name: "Diana Prince", email: "diana@example.com", role: "Admin", projects: 28, status: "Active" },
  { id: "5", name: "Eve Wilson", email: "eve@example.com", role: "Viewer", projects: 1, status: "Active" },
  { id: "6", name: "Frank Castle", email: "frank@example.com", role: "Member", projects: 7, status: "Inactive" },
  { id: "7", name: "Grace Hopper", email: "grace@example.com", role: "Admin", projects: 41, status: "Active" },
  { id: "8", name: "Hank Pym", email: "hank@example.com", role: "Member", projects: 5, status: "Active" },
  { id: "9", name: "Iris West", email: "iris@example.com", role: "Viewer", projects: 2, status: "Active" },
  { id: "10", name: "Jack Ryan", email: "jack@example.com", role: "Member", projects: 9, status: "Inactive" },
  { id: "11", name: "Karen Page", email: "karen@example.com", role: "Member", projects: 16, status: "Active" },
  { id: "12", name: "Leo Messi", email: "leo@example.com", role: "Viewer", projects: 4, status: "Active" },
];

const meta = {
  title: "Data/DataTable",
  component: DataTable<User>,
  tags: ["autodocs"],
  args: {
    columns: sampleColumns,
    data: sampleData,
  },
} satisfies Meta<typeof DataTable<User>>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A table earns its place from about a dozen rows: for a handful of items, cards or a list read better. */
export const Default: Story = {};

export const WithSearch: Story = {
  args: {
    searchKey: "name",
    searchPlaceholder: "Search by name…",
  },
};

/** Five rows a page: the figure beside the arrows counts the pages. */
export const SmallPageSize: Story = {
  args: {
    searchKey: "name",
    pageSize: 5,
  },
};

export const EmptyState: Story = {
  args: {
    data: [],
  },
};

/** In a narrow column the table scrolls inside its box, and the footer wraps. */
export const Narrow: Story = {
  args: {
    searchKey: "name",
    pageSize: 5,
  },
  decorators: [
    (Story) => (
      <div className="w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
};

/**
 * A line in the card, above the table, for what the rows are not: the newest of more. Search and
 * sorting only cover the rows the table is given, so a search that finds no one is not "no such
 * person". The table is described by it.
 */
export const WithNote: Story = {
  args: {
    searchKey: "name",
    note: "This list shows the 12 newest users out of 140. Search and sorting cover these only.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const note = canvas.getByText(/This list shows the 12 newest users out of 140/);

    await expect(note).toBeVisible();
    await expect(canvas.getByRole("table")).toHaveAccessibleDescription(note.textContent ?? "");
  },
};

// The weekday of these dates runs against their order: as text, Fri 6 November comes
// before Wed 4, and Thu 5 sits between them the wrong way.
const JOINED = [
  "2026-11-05",
  "2026-01-23",
  "2026-11-04",
  "2026-11-06",
  "2026-08-21",
  "2026-02-13",
  "2026-03-06",
  "2026-10-29",
  "2026-06-19",
  "2026-04-17",
  "2026-09-11",
  "2026-12-01",
].map((day) => new Date(`${day}T09:00:00Z`));

/** The cell of a date: a time element, in words. */
const joinedColumn: Column<User> = {
  key: "joined",
  header: "Joined",
  sortable: true,
  cell: (row) => {
    const joined = row.joined as Date;

    return (
      <time dateTime={joined.toISOString()}>
        {joined.toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })}
      </time>
    );
  },
};

/** A column of dates sorts by the time, both ways, and a third click gives the order of the rows back. */
export const SortsDates: Story = {
  args: {
    columns: [sampleColumns[0]!, joinedColumn],
    data: sampleData.map((user, index) => ({ ...user, joined: JOINED[index] })),
    pageSize: 12,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const days = () =>
      canvas
        .getAllByRole("row")
        .slice(1)
        .map((row) => Date.parse(within(row).getAllByRole("cell")[1]!.textContent ?? ""));
    const inOrder = (values: number[], direction: 1 | -1) =>
      values.every((value, index) => index === 0 || (value - values[index - 1]!) * direction >= 0);
    const asGiven = days();

    await userEvent.click(canvas.getByRole("button", { name: "Joined" }));
    await expect(canvas.getByRole("columnheader", { name: "Joined" })).toHaveAttribute("aria-sort", "ascending");
    await expect(inOrder(days(), 1)).toBe(true);

    await userEvent.click(canvas.getByRole("button", { name: "Joined" }));
    await expect(canvas.getByRole("columnheader", { name: "Joined" })).toHaveAttribute("aria-sort", "descending");
    await expect(inOrder(days(), -1)).toBe(true);

    await userEvent.click(canvas.getByRole("button", { name: "Joined" }));
    await expect(days()).toEqual(asGiven);
  },
};
