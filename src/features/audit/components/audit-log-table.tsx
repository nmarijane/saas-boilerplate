"use client";

import type { Column } from "@/shared/components/data/data-table";
import { DataTable } from "@/shared/components/data/data-table";
import { Badge } from "@/shared/components/ui/badge";

type AuditLogRow = Record<string, unknown> & {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actorId: string | null;
  orgId: string;
  createdAt: Date;
};

const columns: Column<AuditLogRow>[] = [
  {
    key: "createdAt",
    header: "Date",
    sortable: true,
    cell: (row) => new Date(row.createdAt).toLocaleString(),
  },
  {
    key: "action",
    header: "Action",
    sortable: true,
    cell: (row) => <Badge variant="outline">{row.action}</Badge>,
  },
  {
    key: "resourceType",
    header: "Resource Type",
    sortable: true,
  },
  {
    key: "resourceId",
    header: "Resource ID",
    cell: (row) => (
      <code className="text-xs">{row.resourceId}</code>
    ),
  },
  {
    key: "actorId",
    header: "Actor ID",
    cell: (row) =>
      row.actorId ? (
        <code className="text-xs">{row.actorId}</code>
      ) : (
        <span className="text-muted-foreground">System</span>
      ),
  },
];

interface AuditLogTableProps {
  logs: AuditLogRow[];
}

export function AuditLogTable({ logs }: AuditLogTableProps) {
  return (
    <DataTable
      columns={columns}
      data={logs}
      searchKey="action"
      searchPlaceholder="Search actions..."
    />
  );
}
