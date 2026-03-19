import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { Column } from "./data-table";
import { DataTable } from "./data-table";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  [key: string]: unknown;
}

const sampleColumns: Column<User>[] = [
  { key: "name", header: "Name", sortable: true },
  { key: "email", header: "Email", sortable: true },
  { key: "role", header: "Role", sortable: true },
  {
    key: "status",
    header: "Status",
    cell: (row) => (
      <span
        className={
          row.status === "Active"
            ? "text-green-600 dark:text-green-400"
            : "text-muted-foreground"
        }
      >
        {row.status}
      </span>
    ),
  },
];

const sampleData: User[] = [
  { id: "1", name: "Alice Martin", email: "alice@example.com", role: "Admin", status: "Active" },
  { id: "2", name: "Bob Johnson", email: "bob@example.com", role: "Member", status: "Active" },
  { id: "3", name: "Charlie Brown", email: "charlie@example.com", role: "Member", status: "Inactive" },
  { id: "4", name: "Diana Prince", email: "diana@example.com", role: "Admin", status: "Active" },
  { id: "5", name: "Eve Wilson", email: "eve@example.com", role: "Viewer", status: "Active" },
  { id: "6", name: "Frank Castle", email: "frank@example.com", role: "Member", status: "Inactive" },
  { id: "7", name: "Grace Hopper", email: "grace@example.com", role: "Admin", status: "Active" },
  { id: "8", name: "Hank Pym", email: "hank@example.com", role: "Member", status: "Active" },
  { id: "9", name: "Iris West", email: "iris@example.com", role: "Viewer", status: "Active" },
  { id: "10", name: "Jack Ryan", email: "jack@example.com", role: "Member", status: "Inactive" },
  { id: "11", name: "Karen Page", email: "karen@example.com", role: "Member", status: "Active" },
  { id: "12", name: "Leo Messi", email: "leo@example.com", role: "Viewer", status: "Active" },
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

export const Default: Story = {};

export const WithSearch: Story = {
  args: {
    searchKey: "name",
    searchPlaceholder: "Search by name...",
  },
};

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
