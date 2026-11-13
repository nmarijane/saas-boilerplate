"use client";

import type { Column } from "@/shared/components/data/data-table";
import { useFormatter, useTranslations } from "next-intl";
import { DataTable } from "@/shared/components/data/data-table";
import { Badge } from "@/shared/components/ui/badge";

type UserRow = Record<string, unknown> & {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  emailVerified: boolean;
  createdAt: Date;
};

interface AdminUsersTableProps {
  users: UserRow[];
  /** What the list is not (the newest of more), said in its card: see `DataTable`. */
  note?: string;
}

// The role is a word in a quiet badge, as in the list of a team: an admin is
// neutral and a user, who has nothing to add to it, an outline. No tone is
// borrowed from the brand or from a status: on a page of people, neither a rank
// nor whether an address is verified is what should catch the eye. The date is
// told by the formatter of the page, so that the server and the browser write
// it the same way.
export function AdminUsersTable({ users, note }: AdminUsersTableProps) {
  const t = useTranslations("admin.usersTable");
  const format = useFormatter();

  const columns: Column<UserRow>[] = [
    {
      key: "name",
      header: t("name"),
      sortable: true,
    },
    {
      key: "email",
      header: t("email"),
      sortable: true,
    },
    {
      key: "isAdmin",
      header: t("role"),
      cell: (row) =>
        row.isAdmin ? (
          <Badge variant="neutral">{t("admin")}</Badge>
        ) : (
          <Badge variant="outline">{t("user")}</Badge>
        ),
    },
    {
      key: "emailVerified",
      header: t("verified"),
      cell: (row) =>
        row.emailVerified ? (
          <Badge variant="outline">{t("verifiedYes")}</Badge>
        ) : (
          <Badge variant="neutral">{t("verifiedNo")}</Badge>
        ),
    },
    {
      key: "createdAt",
      header: t("joined"),
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
      data={users}
      searchKey="name"
      searchPlaceholder={t("search")}
      note={note}
    />
  );
}
