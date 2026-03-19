"use client";

import type { Column } from "@/shared/components/data/data-table";
import { PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { DataTable } from "@/shared/components/data/data-table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { revokeApiKeyAction } from "../actions";
import { CreateKeyModal } from "./create-key-modal";

type ApiKeyRow = Record<string, unknown> & {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsed: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
};

function RevokeButton({
  keyId,
  orgId,
  userId,
}: {
  keyId: string;
  orgId: string;
  userId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleRevoke() {
    startTransition(async () => {
      await revokeApiKeyAction(keyId, orgId, userId);
    });
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleRevoke}
      disabled={isPending}
    >
      {isPending ? "Revoking..." : "Revoke"}
    </Button>
  );
}

function StatusBadge({ revokedAt }: { revokedAt: Date | null }) {
  if (revokedAt) {
    return <Badge variant="destructive">Revoked</Badge>;
  }
  return <Badge variant="default">Active</Badge>;
}

interface ApiKeyListProps {
  keys: ApiKeyRow[];
  orgId: string;
  userId: string;
}

export function ApiKeyList({ keys, orgId, userId }: ApiKeyListProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const columns: Column<ApiKeyRow>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
    },
    {
      key: "prefix",
      header: "Prefix",
      cell: (row) => (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
          {row.prefix}...
        </code>
      ),
    },
    {
      key: "scopes",
      header: "Scopes",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.scopes.map((scope) => (
            <Badge key={scope} variant="secondary">
              {scope}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "lastUsed",
      header: "Last Used",
      cell: (row) =>
        row.lastUsed
          ? new Date(row.lastUsed).toLocaleDateString()
          : "Never",
    },
    {
      key: "revokedAt",
      header: "Status",
      cell: (row) => <StatusBadge revokedAt={row.revokedAt} />,
    },
    {
      key: "id",
      header: "Actions",
      cell: (row) =>
        row.revokedAt ? null : (
          <RevokeButton keyId={row.id} orgId={orgId} userId={userId} />
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">API Keys</h2>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <PlusIcon />
          Create Key
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={keys}
        searchKey="name"
        searchPlaceholder="Search keys..."
      />
      <CreateKeyModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        orgId={orgId}
        userId={userId}
      />
    </div>
  );
}
