import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/features/ai-chambers/components/workspace-shell";
import { WorkspaceTopbar } from "@/features/ai-chambers/components/workspace-topbar";
import { buildWorkspaceNav } from "@/features/ai-chambers/nav";
import { requireAuth } from "@/features/auth/guards";
import { getActiveOrgId } from "@/features/auth/organization/active-org";
import { getOrganization } from "@/features/auth/organization/queries";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();
  const orgId = await getActiveOrgId();

  if (!orgId) {
    redirect("/onboarding");
  }

  const org = await getOrganization(orgId);
  const isPlatformAdmin = Boolean(
    (session.user as Record<string, unknown>).isPlatformAdmin,
  );
  const nav = buildWorkspaceNav({ isPlatformAdmin });

  return (
    <WorkspaceShell workspace={org?.name ?? "Workspace"} nav={nav}>
      <WorkspaceTopbar orgName={org?.name ?? "Workspace"} />
      {children}
    </WorkspaceShell>
  );
}
