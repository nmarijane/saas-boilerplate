"use client";

import type { Column } from "@/shared/components/data/data-table";
import { useFormatter, useTranslations } from "next-intl";
import { DataTable } from "@/shared/components/data/data-table";
import { Badge } from "@/shared/components/ui/badge";

type AuditLogRow = Record<string, unknown> & {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actorId: string | null;
  /** Null for an entry of the platform: the deletion of a workspace, which outlives it. */
  orgId: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
};

/** The name a platform entry gives its workspace, which is gone: the one it was deleted with. */
function deletedName(row: AuditLogRow): string | null {
  const name = row.metadata?.name;
  return typeof name === "string" && name.trim() !== "" ? name : null;
}

interface AuditLogTableProps {
  logs: AuditLogRow[];
  /** What the list is not (the latest of a log with no end), said in its card: see `DataTable`. */
  note?: string;
}

// The log keeps the time of day with the date: two events of one day are told
// apart by it. The date is told by the formatter of the page, so that the server
// and the browser write it the same way. The workspace of an event is told by its
// id; an entry of the platform has none left, and is told by the name of the
// workspace it says was deleted.
export function AuditLogTable({ logs, note }: AuditLogTableProps) {
  const t = useTranslations("admin.auditTable");
  const format = useFormatter();

  const columns: Column<AuditLogRow>[] = [
    {
      key: "createdAt",
      header: t("date"),
      sortable: true,
      cell: (row) => {
        const date = new Date(row.createdAt);

        return (
          <time dateTime={date.toISOString()}>
            {format.dateTime(date, { dateStyle: "medium", timeStyle: "short" })}
          </time>
        );
      },
    },
    {
      key: "action",
      header: t("action"),
      sortable: true,
      cell: (row) => <Badge variant="outline">{row.action}</Badge>,
    },
    {
      key: "resourceType",
      header: t("resourceType"),
      sortable: true,
    },
    {
      key: "resourceId",
      header: t("resourceId"),
      cell: (row) => (
        <code className="text-xs">{row.resourceId}</code>
      ),
    },
    {
      key: "orgId",
      header: t("workspace"),
      cell: (row) => {
        if (row.orgId) {
          return <code className="text-xs">{row.orgId}</code>;
        }

        const name = deletedName(row);
        return (
          <span className="text-ink-muted">
            {name ? t("deletedWorkspace", { name }) : t("platform")}
          </span>
        );
      },
    },
    {
      key: "actorId",
      header: t("actorId"),
      cell: (row) =>
        row.actorId ? (
          <code className="text-xs">{row.actorId}</code>
        ) : (
          <span className="text-ink-muted">{t("system")}</span>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={logs}
      searchKey="action"
      searchPlaceholder={t("search")}
      note={note}
    />
  );
}
