import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { Column } from "./data-table";
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
