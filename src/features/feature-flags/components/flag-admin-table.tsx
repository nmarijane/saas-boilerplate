"use client";

import type { Column } from "@/shared/components/data/data-table";
import { useState, useTransition } from "react";

import { DataTable } from "@/shared/components/data/data-table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { deleteFeatureFlag, toggleFeatureFlag } from "../actions";

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

function EnabledToggle({ flag }: { flag: FlagRow }) {
  const [isPending, startTransition] = useTransition();
  const [optimisticEnabled, setOptimisticEnabled] = useState(flag.enabled);

  function handleToggle(checked: boolean) {
    setOptimisticEnabled(checked);
    startTransition(async () => {
      await toggleFeatureFlag(flag.id, checked);
    });
  }

  return (
    <Switch
      checked={optimisticEnabled}
      onCheckedChange={handleToggle}
      disabled={isPending}
      aria-label={`Toggle ${flag.key}`}
    />
  );
}

function DeleteButton({ flagId }: { flagId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteFeatureFlag(flagId);
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

const columns: Column<FlagRow>[] = [
  {
    key: "key",
    header: "Key",
    sortable: true,
  },
  {
    key: "description",
    header: "Description",
  },
  {
    key: "enabled",
    header: "Enabled",
    cell: (row) => <EnabledToggle flag={row} />,
  },
  {
    key: "rules",
    header: "Rules",
    cell: (row) => (
      <Badge variant="secondary">
        {Array.isArray(row.rules) ? row.rules.length : 0}
      </Badge>
    ),
  },
  {
    key: "id",
    header: "Actions",
    cell: (row) => <DeleteButton flagId={row.id} />,
  },
];

interface FlagAdminTableProps {
  flags: FlagRow[];
}

export function FlagAdminTable({ flags }: FlagAdminTableProps) {
  return (
    <DataTable
      columns={columns}
      data={flags}
      searchKey="key"
      searchPlaceholder="Search flags..."
    />
  );
}
