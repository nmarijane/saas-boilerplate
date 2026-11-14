import type { Metadata } from "next";
import { FolderIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { appPageMetadata } from "@/features/app-shell";
import { requireWorkspace } from "@/features/auth/organization/workspace";
import { getLimitStatus } from "@/features/plan-limits";
import { NewProjectButton } from "@/features/projects/components/new-project-button";
import { ProjectGrid } from "@/features/projects/components/project-grid";
import { ProjectsEmpty } from "@/features/projects/components/projects-empty";
import { countProjects, listProjects, PROJECTS_PAGE_SIZE } from "@/features/projects/queries";
import { PageHeader } from "@/shared/components/data/page-header";
import { Pagination } from "@/shared/components/data/pagination";
import { PlanLock } from "@/shared/components/data/plan-lock";
import { clampPage, pageFrom, totalPagesOf } from "@/shared/utils/pagination";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "projects" });

  return appPageMetadata(t("title"));
}

/** The address of a page of the list: the first has no page in it. */
function hrefOf(page: number) {
  return page === 1 ? "/projects" : `/projects?page=${page}`;
}

// The projects of the workspace, from the session: the page takes the workspace
// from `requireWorkspace()`, never from the URL. The list is read a page at a time,
// and a page past the last is the last, not an empty page that says "Page 99 of 2"
// (the pages are counted first, so that the read never starts past the end). The
// one button that creates a project is the header's once there are projects, and
// the empty state's while there are none, so that a zone never has two.
export default async function ProjectsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { page: requested } = await searchParams;
  const { workspace } = await requireWorkspace();
  const [t, total, room] = await Promise.all([
    getTranslations({ locale, namespace: "projects" }),
    countProjects(workspace.id),
    getLimitStatus(workspace.id, "projects"),
  ]);
  const totalPages = totalPagesOf(total, PROJECTS_PAGE_SIZE);
  const page = clampPage(pageFrom(requested), totalPages);
  const projects = await listProjects(workspace.id, page);
  const hasProjects = total > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FolderIcon}
        title={t("title")}
        context={t("count", { count: total })}
        primaryAction={
          hasProjects ? <NewProjectButton orgId={workspace.id} /> : undefined
        }
      />
      {/* The plan has no room for another project: said before the button is pressed (the server refuses anyway) */}
      {room.reached ? <PlanLock variant="line" feature={t("create.limitFeature")} planName={room.includedIn ?? undefined} href={room.upgradeHref} /> : null}
      {hasProjects ? (
        <>
          <ProjectGrid projects={projects} />
          <Pagination
            page={page}
            totalPages={totalPages}
            hrefOf={hrefOf}
            label={t("page", { page, total: totalPages })}
            previousLabel={t("previous")}
            nextLabel={t("next")}
          />
        </>
      ) : (
        <ProjectsEmpty orgId={workspace.id} />
      )}
    </div>
  );
}
