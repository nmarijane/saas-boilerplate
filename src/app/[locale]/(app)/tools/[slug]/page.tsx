import { notFound } from "next/navigation";
import { PageHeader } from "@/features/ai-chambers/components/primitives";
import { getToolBySlug } from "@/features/tools/queries";

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = await getToolBySlug(slug);
  if (!tool || tool.status !== "published") notFound();

  return (
    <div>
      <PageHeader title={tool.name} />
      <p>{tool.description}</p>
      <p>This tool is not available to run yet.</p>
    </div>
  );
}
