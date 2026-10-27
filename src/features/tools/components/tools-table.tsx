"use client";

import type {Column, RecordRow} from "@ai-chambers/design-system";
import {
  
  
  RecordTable
} from "@ai-chambers/design-system";
import { useRouter } from "@/shared/lib/i18n-navigation";

export interface ToolRow {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  status: string;
  type: string;
  updatedAt: string;
}

const columns: Column[] = [
  { key: "name", label: "Name", width: 220, required: true },
  { key: "category", label: "Category", width: 160 },
  { key: "type", label: "Type", width: 120 },
  { key: "status", label: "Status", width: 140 },
  { key: "updatedAt", label: "Updated", width: 160 },
];

export function ToolsTable({ tools }: { tools: ToolRow[] }) {
  const router = useRouter();

  const rows: RecordRow[] = tools.map((tool) => ({
    id: tool.id,
    name: tool.name,
    category: tool.category ?? "—",
    type: tool.type,
    status: tool.status === "published" ? "Available" : tool.status,
    updatedAt: tool.updatedAt,
    slug: tool.slug,
  }));

  return (
    <RecordTable
      rows={rows}
      columns={columns}
      label="AI Tools"
      onInspect={(row) => {
        const slug = tools.find((t) => t.id === row.id)?.slug;
        if (slug) router.push(`/tools/${slug}`);
      }}
    />
  );
}
