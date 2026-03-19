"use client";

import type { Column } from "@/shared/components/data/data-table";
import { PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { DataTable } from "@/shared/components/data/data-table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import {
  deleteWebhookEndpointAction,
  toggleWebhookEndpointAction,
} from "../actions";
import { CreateWebhookModal } from "./create-webhook-modal";

type WebhookRow = Record<string, unknown> & {
  id: string;
  orgId: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: Date;
};

function ActiveToggle({ endpoint }: { endpoint: WebhookRow }) {
  const [isPending, startTransition] = useTransition();
  const [optimisticActive, setOptimisticActive] = useState(endpoint.active);

  function handleToggle(checked: boolean) {
    setOptimisticActive(checked);
    startTransition(async () => {
      await toggleWebhookEndpointAction(endpoint.id, checked);
    });
  }

  return (
    <Switch
      checked={optimisticActive}
      onCheckedChange={handleToggle}
      disabled={isPending}
      aria-label={`Toggle ${endpoint.url}`}
    />
  );
}

function DeleteButton({
  endpointId,
  orgId,
  userId,
}: {
  endpointId: string;
  orgId: string;
  userId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteWebhookEndpointAction(endpointId, orgId, userId);
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

interface WebhookListProps {
  endpoints: WebhookRow[];
  orgId: string;
  userId: string;
}

export function WebhookList({ endpoints, orgId, userId }: WebhookListProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const columns: Column<WebhookRow>[] = [
    {
      key: "url",
      header: "URL",
      sortable: true,
      cell: (row) => (
        <code className="text-xs break-all">{row.url}</code>
      ),
    },
    {
      key: "events",
      header: "Events",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.events.map((event) => (
            <Badge key={event} variant="secondary">
              {event}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "active",
      header: "Active",
      cell: (row) => <ActiveToggle endpoint={row} />,
    },
    {
      key: "id",
      header: "Actions",
      cell: (row) => (
        <DeleteButton endpointId={row.id} orgId={orgId} userId={userId} />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Webhook Endpoints</h2>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <PlusIcon />
          Add Endpoint
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={endpoints}
        searchKey="url"
        searchPlaceholder="Search endpoints..."
      />
      <CreateWebhookModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        orgId={orgId}
        userId={userId}
      />
    </div>
  );
}
