"use client";

import type {Column, RecordRow} from "@ai-chambers/design-system";
import {
  
  
  RecordTable
} from "@ai-chambers/design-system";
import { useRouter } from "@/shared/lib/i18n-navigation";

export interface RunRow {
  id: string;
  status: string;
  paymentStatus: string | null;
  createdAt: string;
}

const columns: Column[] = [
  { key: "id", label: "Run ID", width: 220, required: true },
  { key: "status", label: "Status", width: 160 },
  { key: "paymentStatus", label: "Payment", width: 140 },
  { key: "createdAt", label: "Created", width: 160 },
];

const statusLabel: Record<string, string> = {
  queued: "Needs review",
  running: "Needs review",
  succeeded: "Completed",
  failed: "Failed",
  cancelled: "Failed",
};

export function RunsTable({ runs }: { runs: RunRow[] }) {
  const router = useRouter();

  const rows: RecordRow[] = runs.map((run) => ({
    id: run.id,
    status: statusLabel[run.status] ?? run.status,
    paymentStatus: run.paymentStatus ?? "—",
    createdAt: run.createdAt,
  }));

  return (
    <RecordTable
      rows={rows}
      columns={columns}
      label="Runs & Results"
      onInspect={(row) => router.push(`/runs/${row.id}`)}
    />
  );
}
