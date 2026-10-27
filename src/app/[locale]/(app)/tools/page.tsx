import { PageHeader } from "@/features/ai-chambers/components/primitives";
import { ToolsTable } from "@/features/tools/components/tools-table";
import { getPublishedTools } from "@/features/tools/queries";

export default async function ToolsPage() {
  const tools = await getPublishedTools();

  const rows = tools.map((tool) => ({
    id: tool.id,
    slug: tool.slug,
    name: tool.name,
    category: tool.category,
    status: tool.status,
    type: tool.type,
    updatedAt: tool.updatedAt.toISOString().slice(0, 10),
  }));

  return (
    <div>
      <PageHeader title="AI Tools" />
      <ToolsTable tools={rows} />
    </div>
  );
}
