import type { Metadata } from "next";
import { BoxIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { appPageMetadata } from "@/features/app-shell";
import { requireProject } from "@/features/projects/require-project";
import { EmptyState } from "@/shared/components/data/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { List, ListRow } from "@/shared/components/ui/list";

interface Props {
  params: Promise<{ locale: string; projectId: string }>;
}

// The first tab of a project is titled with the project alone; the tabs after it
// say which they are (settings/page.tsx).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);

  return appPageMetadata(project.name);
}

// What the project is, in a card of rows, then the place for what it holds: the
// boilerplate has nothing to put there, and says so in an empty state, which a
// project replaces with its own content. The status is not a row: the header
// says it, once. The dates are days, not moments: no time zone is configured, so
// the hour would be the server's, and a reader elsewhere would take it for theirs.
export default async function ProjectOverviewPage({ params }: Props) {
  const { locale, projectId } = await params;
  const { project } = await requireProject(projectId);
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: "projects" }),
    getFormatter({ locale }),
  ]);

  const day = (date: Date) => (
    <time dateTime={date.toISOString()}>
      {format.dateTime(date, { dateStyle: "medium" })}
    </time>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t("overview.details")}</CardTitle>
        </CardHeader>
        <CardContent>
          <List>
            <ListRow
              title={t("overview.createdBy")}
              trailing={project.createdByName ?? t("overview.unknown")}
            />
            <ListRow
              title={t("overview.created")}
              trailing={day(project.createdAt)}
            />
            <ListRow
              title={t("overview.modified")}
              trailing={day(project.updatedAt)}
            />
          </List>
        </CardContent>
      </Card>
      <EmptyState
        icon={BoxIcon}
        headingLevel={2}
        title={t("overview.empty.title")}
        description={t("overview.empty.description")}
      />
    </div>
  );
}
