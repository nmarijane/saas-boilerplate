"use client";

import type {Column} from "@/shared/components/data/data-table";
import {  DataTable } from "@/shared/components/data/data-table";

type OrgRow = Record<string, unknown> & {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
};

const columns: Column<OrgRow>[] = [
  {
    key: "name",
    header: "Name",
    sortable: true,
  },
  {
    key: "slug",
    header: "Slug",
    sortable: true,
  },
  {
    key: "createdAt",
    header: "Created",
    sortable: true,
    cell: (row) => new Date(String(row.createdAt)).toLocaleDateString(),
  },
];

interface AdminOrgsTableProps {
  organizations: OrgRow[];
}

export function AdminOrgsTable({ organizations }: AdminOrgsTableProps) {
  return (
    <DataTable
      columns={columns}
      data={organizations}
      searchKey="name"
      searchPlaceholder="Search organizations..."
    />
  );
}
