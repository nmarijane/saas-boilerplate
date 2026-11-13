import type { WorkspaceScope } from "@/shared/shell/contract";
import { getTranslations } from "next-intl/server";
import { TextLink } from "@/shared/components/ui/text-link";
import { Link } from "@/shared/lib/i18n-navigation";
import { listRecentProjects } from "../queries";
import { ProjectGrid } from "./project-grid";

// The block of the home that shows the three latest projects of the workspace:
// the shell hands it the scope, and it reads what it shows. The link to the
// whole list is alone on its line, so it is a 44 px target; it says where it
// goes, as it is read out of its heading. A workspace with no project yet gets
// a sentence in the place of the cards. Like the cards, it is drawn on the
// server, where the time of each project is told.
//
// The block does not have the width of the page: beside the first steps, from
// `lg`, it is the two thirds of it, where three cards would be 140 px wide with
// names cut mid-word, and with the steps gone (or on a phone) it has the whole
// width. So it is a container, and its cards follow its own width: two across
// from 448 px, three from 672 px.
export async function RecentProjects({ scope }: { scope: WorkspaceScope }) {
  const t = await getTranslations("projects");
  const projects = await listRecentProjects(scope.orgId, 3);

  return (
    <section className="@container space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-section text-ink">{t("recent")}</h2>
        <TextLink asChild className="tap-target">
          <Link href="/projects">{t("viewAll")}</Link>
        </TextLink>
      </div>
      {projects.length > 0 ? (
        <ProjectGrid projects={projects} columns="container" />
      ) : (
        <p className="text-body text-ink-muted">{t("recentEmpty")}</p>
      )}
    </section>
  );
}
