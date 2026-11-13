"use client";

import type { Column } from "@/shared/components/data/data-table";
import { useFormatter, useTranslations } from "next-intl";
import { DataTable } from "@/shared/components/data/data-table";

type OrgRow = Record<string, unknown> & {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
};

interface AdminOrgsTableProps {
  organizations: OrgRow[];
  /** What the list is not (the newest of more), said in its card: see `DataTable`. */
  note?: string;
}

// The date is told by the formatter of the page, so that the server and the
// browser write it the same way.
export function AdminOrgsTable({ organizations, note }: AdminOrgsTableProps) {
  const t = useTranslations("admin.organizationsTable");
  const format = useFormatter();

  const columns: Column<OrgRow>[] = [
    {
      key: "name",
      header: t("name"),
      sortable: true,
    },
    {
      key: "slug",
      header: t("slug"),
      sortable: true,
    },
    {
      key: "createdAt",
      header: t("created"),
      sortable: true,
      cell: (row) => {
        const date = new Date(row.createdAt);

        return (
          <time dateTime={date.toISOString()}>
            {format.dateTime(date, { dateStyle: "medium" })}
          </time>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={organizations}
      searchKey="name"
      searchPlaceholder={t("search")}
      note={note}
    />
  );
}
