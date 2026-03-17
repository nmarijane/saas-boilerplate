"use client";

import type {Column} from "@/shared/components/data/data-table";
import {  DataTable } from "@/shared/components/data/data-table";
import { Badge } from "@/shared/components/ui/badge";

type UserRow = Record<string, unknown> & {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  emailVerified: boolean;
  createdAt: Date;
};

const columns: Column<UserRow>[] = [
  {
    key: "name",
    header: "Name",
    sortable: true,
  },
  {
    key: "email",
    header: "Email",
    sortable: true,
  },
  {
    key: "isAdmin",
    header: "Role",
    cell: (row) =>
      row.isAdmin ? (
        <Badge variant="default">Admin</Badge>
      ) : (
        <Badge variant="secondary">User</Badge>
      ),
  },
  {
    key: "emailVerified",
    header: "Verified",
    cell: (row) =>
      row.emailVerified ? (
        <Badge variant="outline">Verified</Badge>
      ) : (
        <Badge variant="destructive">Unverified</Badge>
      ),
  },
  {
    key: "createdAt",
    header: "Joined",
    sortable: true,
    cell: (row) => new Date(row.createdAt).toLocaleDateString(),
  },
];

interface AdminUsersTableProps {
  users: UserRow[];
}

export function AdminUsersTable({ users }: AdminUsersTableProps) {
  return (
    <DataTable
      columns={columns}
      data={users}
      searchKey="name"
      searchPlaceholder="Search users..."
    />
  );
}
