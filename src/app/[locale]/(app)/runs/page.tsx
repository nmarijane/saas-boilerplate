import { redirect } from "next/navigation";
import { PageHeader } from "@/features/ai-chambers/components/primitives";
import { getActiveOrgId } from "@/features/auth/organization/active-org";
import { RunsTable } from "@/features/runs/components/runs-table";
import { getRunsByOrg } from "@/features/runs/queries";

export default async function RunsPage() {
  const orgId = await getActiveOrgId();
  if (!orgId) redirect("/onboarding");

  const runs = await getRunsByOrg(orgId);
  const rows = runs.map((run) => ({
    id: run.id,
    status: run.status,
    paymentStatus: run.paymentStatus,
    createdAt: run.createdAt.toISOString().slice(0, 10),
  }));

  return (
    <div>
      <PageHeader title="Runs & Results" />
      <RunsTable runs={rows} />
    </div>
  );
}
