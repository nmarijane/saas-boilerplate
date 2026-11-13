import type { ProjectSummary } from "../queries";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { Card, CardContent } from "@/shared/components/ui/card";
import { InitialTile } from "@/shared/components/ui/initial-tile";
import { Link } from "@/shared/lib/i18n-navigation";
import { notAfter } from "@/shared/utils/helpers";
import { ProjectStatus } from "./project-status";

// A project in a list: its tile, its name, its status and when it changed. The
// whole card is the one link to the project, and the name of that link is what
// the card says. The tile takes its tint from the id, so that a rename does not
// repaint it. The name stops at two lines and breaks a long word, as it is not
// ours to choose, in a column that may shrink below its content, without which
// the cut would never come.
//
// It is a Server Component on purpose: how long ago the project changed is told
// once, from the clock of the server. A card drawn on the client would tell it
// again from another clock, and the two would not agree when the page hydrates.
export function ProjectCard({ project }: { project: ProjectSummary }) {
  const t = useTranslations("projects");
  const format = useFormatter();
  const now = useNow();

  // A project cannot have changed in the future: the clock of the database can
  // run ahead of this one (a session whose time zone is not UTC, as on a
  // machine that develops against the local database), and a card that was
  // just made must not read "in an hour".
  const changedAt = notAfter(project.updatedAt, now);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block h-full rounded-lg focus-visible:focus-ring"
    >
      <Card className="h-full transition-colors duration-150 ease-expo group-hover:border-ink-muted">
        <CardContent className="flex h-full flex-col gap-4">
          <div className="flex items-start gap-3">
            <InitialTile name={project.name} seed={project.id} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="line-clamp-2 text-section wrap-break-word text-ink">
                {project.name}
              </p>
              <ProjectStatus status={project.status} />
            </div>
          </div>
          <p className="mt-auto text-meta text-ink-muted">
            {t.rich("updated", {
              when: format.relativeTime(changedAt, now),
              time: (moment) => (
                <time dateTime={project.updatedAt.toISOString()}>{moment}</time>
              ),
            })}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
