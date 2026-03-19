"use client";

import type { Column } from "@/shared/components/data/data-table";

import { useTransition } from "react";

import { DataTable } from "@/shared/components/data/data-table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { deleteChangelogEntry } from "../actions";

type ChangelogRow = Record<string, unknown> & {
  id: string;
  title: string;
  version: string | null;
  content: string;
  publishedAt: Date;
  createdAt: Date;
};

function DeleteButton({ entryId }: { entryId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteChangelogEntry(entryId);
    });
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleDelete}
      disabled={isPending}
    >
      {isPending ? "Deleting..." : "Delete"}
    </Button>
  );
}

const columns: Column<ChangelogRow>[] = [
  {
    key: "publishedAt",
    header: "Published",
    sortable: true,
    cell: (row) => new Date(row.publishedAt).toLocaleDateString(),
  },
  {
    key: "version",
    header: "Version",
    sortable: true,
    cell: (row) =>
      row.version ? (
        <Badge variant="outline">{row.version}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "title",
    header: "Title",
    sortable: true,
  },
  {
    key: "content",
    header: "Content",
    cell: (row) => (
      <span className="line-clamp-1 max-w-xs text-sm text-muted-foreground">
        {row.content}
      </span>
    ),
  },
  {
    key: "id",
    header: "Actions",
    cell: (row) => <DeleteButton entryId={row.id} />,
  },
];

interface ChangelogAdminTableProps {
  entries: ChangelogRow[];
}

export function ChangelogAdminTable({ entries }: ChangelogAdminTableProps) {
  return (
    <DataTable
      columns={columns}
      data={entries}
      searchKey="title"
      searchPlaceholder="Search entries..."
    />
  );
}
