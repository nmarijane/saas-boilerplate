import type { Metadata } from "next";
import { HouseIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { appPageMetadata, getHome, getShell } from "@/features/app-shell";
import {
  requireWorkspace,
  scopeOf,
} from "@/features/auth/organization/workspace";
import { HomeActivity } from "@/features/dashboard/components/home-activity";
import { HomeTasks } from "@/features/dashboard/components/home-tasks";
import { SectionBoundary } from "@/features/dashboard/components/section-boundary";
import { PageHeader } from "@/shared/components/data/page-header";
import { QuotaCard } from "@/shared/components/data/quota-card";
import { firstNameOf } from "@/shared/shell/resolve";
import { cn } from "@/shared/utils/cn";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });

  return appPageMetadata(t("title"));
}

// The home of the workspace, from the session: the page takes the workspace
// from `requireWorkspace()`, never from the URL. A greeting, then what the
// plan limits and how much of it is used, then what the installed features put
// on the home (the sections), what is left to set up (the first steps) and what
// the team did last (the activity). The header's button is the home's one main
// action, which a feature gives: the steps below have secondary ones. Each
// section stands in a boundary of its own: one that throws shows an error in its
// place, and the rest of the home is still there.
//
// Before `lg` the blocks are one column, in the order of the page: sections,
// first steps, activity. From `lg` the sections and the activity are the left
// two thirds, and the first steps stand on the right third across both: the
// grid places them, and the markup keeps one order that reads the same for
// everyone. A block is there only when its feature is: with no activity to
// tell (`null`: no feature gives it) the section is left out, and so is the
// grid when no block is left. The steps are gone once they are all done, and
// never stand alone in the right third: with nothing beside them the page is
// one column at every width.
export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const ctx = await requireWorkspace();
  const scope = scopeOf(ctx);
  const [t, home, { view }] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getHome(scope),
    getShell(),
  ]);

  const name = firstNameOf(ctx.user.name);
  const plan = view.workspace?.plan ?? null;
  const { HomeAction, activity } = home;
  const hasSections = home.sections.length > 0;
  const showTasks =
    home.tasks.length > 0 && home.tasksDone < home.tasks.length;
  // The steps stand on the right when there is something on the left. Across
  // two rows if the left has two blocks: with one, a second row is a dead gap.
  const besideSteps = showTasks && (hasSections || activity !== null);
  const twoLeftBlocks = hasSections && activity !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={HouseIcon}
        title={name ? t("greeting", { name }) : t("greetingFallback")}
        context={
          plan
            ? t("context", { workspace: ctx.workspace.name, plan })
            : ctx.workspace.name
        }
        primaryAction={HomeAction ? <HomeAction scope={scope} /> : undefined}
      />

      {home.quotas.length > 0 ? (
        <section>
          <h2 className="sr-only">{t("usage")}</h2>
          <ul
            role="list"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {home.quotas.map((quota) => (
              <li key={quota.id}>
                <QuotaCard quota={quota} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showTasks || hasSections || activity !== null ? (
        <div
          className={cn(
            "grid grid-cols-1 gap-6",
            besideSteps &&
              "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start",
            besideSteps && twoLeftBlocks && "lg:grid-rows-[auto_1fr]",
          )}
        >
          {hasSections ? (
            <div
              className={cn(
                "space-y-6",
                besideSteps && "lg:col-start-1 lg:row-start-1",
              )}
            >
              {home.sections.map(({ id, Component }) => (
                <SectionBoundary key={id}>
                  <Component scope={scope} />
                </SectionBoundary>
              ))}
            </div>
          ) : null}
          {showTasks ? (
            <div
              className={
                cn(
                  besideSteps && "lg:col-start-2 lg:row-start-1",
                  besideSteps && twoLeftBlocks && "lg:row-span-2",
                ) || undefined
              }
            >
              <HomeTasks tasks={home.tasks} done={home.tasksDone} />
            </div>
          ) : null}
          {activity !== null ? (
            <div className={cn(besideSteps && "lg:col-start-1") || undefined}>
              <HomeActivity entries={activity} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
