"use client";

import type { ToggleFlag } from "../toggle-flag";
import type { Column } from "@/shared/components/data/data-table";
import { useTranslations } from "next-intl";

import { useRef, useState } from "react";
import { DataTable } from "@/shared/components/data/data-table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { toast } from "@/shared/components/ui/sonner";
import { Switch } from "@/shared/components/ui/switch";
import { deleteFeatureFlag, toggleFeatureFlag } from "../actions";
import { toggleFlagFlow } from "../toggle-flag";

interface FeatureFlagRule {
  type: "plan" | "org";
  value: string;
}

type FlagRow = Record<string, unknown> & {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  rules: FeatureFlagRule[];
  createdAt: Date;
  updatedAt: Date;
};

// The switch moves at once and goes back, with a toast, if the server did not do it,
// as the switch of a webhook endpoint does. It is not disabled while it waits, as a
// disabled control drops the focus; a second change waits for the first.
function EnabledToggle({ flag, toggleFlag }: { flag: FlagRow; toggleFlag: ToggleFlag }) {
  const t = useTranslations("admin.flagsTable");
  const [enabled, setEnabled] = useState(flag.enabled);
  const toggling = useRef(false);

  const handleToggle = async (next: boolean) => {
    if (toggling.current) {
      return;
    }

    toggling.current = true;
    setEnabled(next);
    try {
      if (!(await toggleFlagFlow(toggleFlag, { flagId: flag.id, enabled: next }))) {
        setEnabled(!next);
        toast.error(t("toggleFailed"));
      }
    } finally {
      toggling.current = false;
    }
  };

  return (
    <Switch
      checked={enabled}
      onCheckedChange={(next) => void handleToggle(next)}
      aria-label={t("toggle", { key: flag.key })}
    />
  );
}

/** Deletes a flag on the server: it rejects when the flag could not be deleted. */
type DeleteFlag = (id: string) => Promise<unknown>;

interface DeleteButtonProps {
  flag: Pick<FlagRow, "id" | "key">;
  /** Puts the focus on the box that holds the table: where it goes when the button it was on is gone with its row. */
  focusTable: () => void;
  deleteFlag: DeleteFlag;
}

// The button of a row. Deleting a flag turns it off for every workspace that
// reads it and loses its rules, so it asks first (the button names the flag, as
// every row has one) and says it is done in a toast. When the server refuses, or
// does not answer, the dialog stays open with its error toast. The confirmation
// has no Radix `Trigger` to give the focus back to (Cancel and Escape leave the
// person on this page): the button does, unless the flag was deleted, and then
// the button is going with its row: the table's box keeps the focus.
function DeleteButton({ flag, focusTable, deleteFlag }: DeleteButtonProps) {
  const t = useTranslations("admin.flagsTable");
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const deleted = useRef(false);

  // It rejects when the flag is still there, so that the dialog stays open and says so.
  const remove = async () => {
    await deleteFlag(flag.id);

    deleted.current = true;
    toast.success(t("deleted", { key: flag.key }));
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
        aria-label={t("deleteLabel", { key: flag.key })}
        onClick={() => setOpen(true)}
      >
        {t("delete")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="danger"
        title={t("deleteTitle", { key: flag.key })}
        description={t("deleteDescription")}
        confirmLabel={t("deleteConfirm")}
        onCloseAutoFocus={restoreFocus}
        onConfirm={remove}
      />
    </>
  );
}

interface FlagAdminTableProps {
  flags: FlagRow[];
  /**
   * Deletes a flag on the server. The page gives nothing, and the action is
   * called; a story, which has no server, gives one that answers by itself (and
   * takes the flag from its list, as the page does when it is read again).
   */
  deleteFlag?: DeleteFlag;
  /** Turns a flag on or off on the server, as `deleteFlag` does for deleting. */
  toggleFlag?: ToggleFlag;
}

export function FlagAdminTable({ flags, deleteFlag = deleteFeatureFlag, toggleFlag = toggleFeatureFlag }: FlagAdminTableProps) {
  const t = useTranslations("admin.flagsTable");
  const container = useRef<HTMLDivElement>(null);

  const columns: Column<FlagRow>[] = [
    {
      key: "key",
      header: t("key"),
      sortable: true,
    },
    {
      key: "description",
      header: t("description"),
    },
    {
      key: "enabled",
      header: t("enabled"),
      cell: (row) => <EnabledToggle flag={row} toggleFlag={toggleFlag} />,
    },
    {
      key: "rules",
      header: t("rules"),
      cell: (row) => (
        <Badge variant="neutral">
          {Array.isArray(row.rules) ? row.rules.length : 0}
        </Badge>
      ),
    },
    {
      key: "id",
      header: t("actions"),
      cell: (row) => (
        <DeleteButton flag={row} focusTable={() => container.current?.focus()} deleteFlag={deleteFlag} />
      ),
    },
  ];

  return (
    <div ref={container} tabIndex={-1} className="focus:outline-hidden">
      <DataTable
        columns={columns}
        data={flags}
        searchKey="key"
        searchPlaceholder={t("search")}
        // A row holds a confirmation and a switch of its own: they stay with their flag when another above it is deleted
        getRowId={(flag) => flag.id}
      />
    </div>
  );
}
