import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { ProjectStatus } from "@/features/projects/components/project-status";
import { requireProject } from "@/features/projects/require-project";
import { EntityHeader } from "@/shared/components/data/entity-header";
import { TabLinks } from "@/shared/components/ui/tab-links";

interface Props {
  children: ReactNode;
  params: Promise<{ locale: string; projectId: string }>;
}

// The frame of a project, drawn once for its pages: the trail from the list,
// its name, its description and its status, then its two tabs. A project that is
// not in the workspace of the session is a 404 (`requireProject`); the pages ask
// again, as a layout is not run for every page under it. Overview is `exact`: it
// is the current tab on the project itself, and Settings, under it, is not.
export default async function ProjectLayout({ children, params }: Props) {
  const { locale, projectId } = await params;
  const { project } = await requireProject(projectId);
  const t = await getTranslations({ locale, namespace: "projects" });
  const base = `/projects/${project.id}`;

  return (
    <div className="space-y-6">
      <EntityHeader
        breadcrumb={[
          { label: t("title"), href: "/projects" },
          { label: project.name },
        ]}
        title={project.name}
        description={project.description ?? undefined}
        meta={<ProjectStatus status={project.status} />}
        tabs={
          <TabLinks
            label={t("tabsLabel")}
            items={[
              { href: base, label: t("tabs.overview"), exact: true },
              { href: `${base}/settings`, label: t("tabs.settings") },
            ]}
          />
        }
      />
      {children}
    </div>
  );
}
