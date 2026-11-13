import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { appPageMetadata } from "@/features/app-shell";
import { DeleteProjectZone } from "@/features/projects/components/delete-project-zone";
import { ProjectSettingsForm } from "@/features/projects/components/project-settings-form";
import { canDeleteProject } from "@/features/projects/permissions";
import { requireProject } from "@/features/projects/require-project";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

interface Props {
  params: Promise<{ locale: string; projectId: string }>;
}

// A tab after the first says which it is, under the project: "Settings · Atlas".
// Its own name is the page and the project is the context (appPageMetadata puts
// the workspace there otherwise), so the tabs of a project are told apart in the
// browser, and the first tab keeps the project's name alone.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, projectId } = await params;
  const [{ project }, t] = await Promise.all([
    requireProject(projectId),
    getTranslations({ locale, namespace: "projects" }),
  ]);

  return appPageMetadata(t("tabs.settings"), { context: project.name });
}

// The form of the project, and for the roles that may delete it the zone that
// does: the role is the one of the scope `requireProject` read with the project,
// not a new query. The member does not see the zone, and could not use it: the
// server asks for the same role again.
export default async function ProjectSettingsPage({ params }: Props) {
  const { locale, projectId } = await params;
  const { scope, project } = await requireProject(projectId);
  const t = await getTranslations({ locale, namespace: "projects" });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t("settings.general")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectSettingsForm
            orgId={scope.orgId}
            project={{
              id: project.id,
              name: project.name,
              description: project.description,
              status: project.status,
            }}
          />
        </CardContent>
      </Card>
      {canDeleteProject(scope.role) ? (
        <DeleteProjectZone orgId={scope.orgId} projectId={project.id} />
      ) : null}
    </div>
  );
}
