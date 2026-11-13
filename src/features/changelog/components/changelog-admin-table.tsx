"use client";

import type { Column } from "@/shared/components/data/data-table";

import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { DataTable } from "@/shared/components/data/data-table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { toast } from "@/shared/components/ui/sonner";
import { deleteChangelogEntry } from "../actions";

type ChangelogRow = Record<string, unknown> & {
  id: string;
  title: string;
  version: string | null;
  content: string;
  publishedAt: Date;
  createdAt: Date;
};

/** Deletes an entry on the server: it rejects when the entry is still there. */
type DeleteEntry = (id: string) => Promise<unknown>;

interface DeleteButtonProps {
  entry: Pick<ChangelogRow, "id" | "title">;
  /** Puts the focus on the box that holds the table: where it goes when the button it was on is gone with its row. */
  focusTable: () => void;
  deleteEntry: DeleteEntry;
}

// The button of a row. Deleting an entry takes it from the public changelog for
// good, so it asks first (the button names the entry, as every row has one), and
// says it is done in a toast. When the server refuses, or does not answer, the
// dialog stays open with its error toast. The confirmation has no Radix `Trigger`
// to give the focus back to (Cancel and Escape leave the person on this page):
// the button does, unless the entry was deleted, and then the button is going with
// its row: the table's box keeps the focus.
function DeleteButton({ entry, focusTable, deleteEntry }: DeleteButtonProps) {
  const t = useTranslations("admin.changelogTable");
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const deleted = useRef(false);

  // It rejects when the entry is still there, so that the dialog stays open and says so.
  const remove = async () => {
    await deleteEntry(entry.id);

    deleted.current = true;
    toast.success(t("deleted", { title: entry.title }));
  };

  const restoreFocus = (event: Event) => {
    event.preventDefault();
    if (deleted.current) {
      focusTable();
    } else {
      trigger.current?.focus();
    }
  };

  return (
    <>
      <Button
        ref={trigger}
        type="button"
        variant="destructive"
        size="sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("deleteLabel", { title: entry.title })}
        onClick={() => setOpen(true)}
      >
        {t("delete")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="danger"
        title={t("deleteTitle", { title: entry.title })}
        description={t("deleteDescription")}
        confirmLabel={t("deleteConfirm")}
        onCloseAutoFocus={restoreFocus}
        onConfirm={remove}
      />
    </>
  );
}

interface ChangelogAdminTableProps {
  entries: ChangelogRow[];
  /** What the list is not (the latest entries of more), said in its card: see `DataTable`. */
  note?: string;
  /**
   * Deletes an entry on the server. The page gives nothing, and the action is
   * called; a story, which has no server, gives one that answers by itself (and
   * takes the entry from its list, as the page does when it is read again).
   */
  deleteEntry?: DeleteEntry;
}

// The date is told by the formatter of the page, so that the server and the
// browser write it the same way, as the other admin tables do.
export function ChangelogAdminTable({ entries, note, deleteEntry = deleteChangelogEntry }: ChangelogAdminTableProps) {
  const t = useTranslations("admin.changelogTable");
  const format = useFormatter();
  const container = useRef<HTMLDivElement>(null);

  const columns: Column<ChangelogRow>[] = [
    {
      key: "publishedAt",
      header: t("published"),
      sortable: true,
      cell: (row) => {
        const date = new Date(row.publishedAt);

        return (
          <time dateTime={date.toISOString()}>
            {format.dateTime(date, { dateStyle: "medium" })}
          </time>
        );
      },
    },
    {
      key: "version",
      header: t("version"),
      sortable: true,
      cell: (row) =>
        row.version ? (
          <Badge variant="outline">{row.version}</Badge>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    {
      key: "title",
      header: t("title"),
      sortable: true,
    },
    {
      key: "content",
      header: t("content"),
      cell: (row) => (
        <span className="line-clamp-1 max-w-xs text-ink-muted">
          {row.content}
        </span>
      ),
    },
    {
      key: "id",
      header: t("actions"),
      cell: (row) => (
        <DeleteButton entry={row} focusTable={() => container.current?.focus()} deleteEntry={deleteEntry} />
      ),
    },
  ];

  return (
    <div ref={container} tabIndex={-1} className="focus:outline-hidden">
      <DataTable
        columns={columns}
        data={entries}
        searchKey="title"
        searchPlaceholder={t("search")}
        note={note}
        // A row holds a confirmation and a flag of its own: they stay with their entry when another above it is deleted
        getRowId={(entry) => entry.id}
      />
    </div>
  );
}
