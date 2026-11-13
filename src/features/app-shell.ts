import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import type { ComponentType, ReactNode } from "react";
import type {
  ActivityEntry,
  HomeSection,
  PlanSummary,
  QuotaContribution,
  ScopedComponent,
  TaskContribution,
  Viewer,
  WorkspaceScope,
} from "@/shared/shell/contract";
import type { HomeTask, ShellQuota, ShellView } from "@/shared/shell/view";
import { getTranslations } from "next-intl/server";
import { unstable_rethrow } from "next/navigation";
import { cache, createElement } from "react";
import {
  getWorkspaceContext,
  scopeOf,
} from "@/features/auth/organization/workspace";
import { FEATURES } from "@/features/registry";
import { APP_NAME, HELP_URL } from "@/shared/config/app";
import { assembleShellView } from "@/shared/shell/assemble";
import {
  collectEntries,
  formatPageTitle,
  quotasOf,
} from "@/shared/shell/resolve";
import "server-only";

// The input and output of the shell: it reads the workspace, asks the features
// for what they know of it (plans, usage), and hands it all to the pure
// `assembleShellView`. A feature that fails to answer loses its own part of the
// shell, never the whole page.

export interface ShellData {
  view: ShellView;
  /** Wrap the shell, outermost first, in the order of the registry. */
  Providers: ComponentType<{ children: ReactNode }>[];
  /** The bell, or null when no feature gives one. */
  Notifications: ComponentType | null;
  /** Rows under the secondary navigation. */
  SidebarActions: ComponentType[];
}

// A bare icon is decoration: the label next to it says what the link is.
function renderIcon(icon: LucideIcon): ReactNode {
  return createElement(icon, { "aria-hidden": "true" });
}

/**
 * The plan of each workspace, from the first feature that gives plans, asked
 * once for all of them. A workspace whose plan cannot be read has none in the
 * result: it is shown without a plan, and its quotas are not shown.
 */
async function loadPlans(
  workspaces: readonly { id: string }[],
): Promise<Map<string, PlanSummary>> {
  const provider = FEATURES.find((feature) => feature.plans)?.plans;
  if (!provider || workspaces.length === 0) {
    return new Map();
  }

  try {
    return await provider(workspaces.map(({ id }) => id));
  } catch (error) {
    unstable_rethrow(error);
    console.error("Shell: the plans of the workspaces could not be read", error);
    return new Map();
  }
}

/** How much of each quota the workspace uses. A quota whose loader fails is left out of the result. */
async function loadUsage(
  scope: WorkspaceScope,
  quotas: readonly QuotaContribution[],
): Promise<Map<string, number>> {
  const usage = new Map<string, number>();

  const read = await Promise.all(
    quotas.map(async (quota) => {
      try {
        return [quota.id, await quota.usage(scope)] as const;
      } catch (error) {
        unstable_rethrow(error);
        console.error(`Shell: the usage of quota ${quota.id} could not be read`, error);
        return null;
      }
    }),
  );
  for (const entry of read) {
    if (entry) {
      usage.set(...entry);
    }
  }

  return usage;
}

/**
 * Everything the shell needs for the signed-in person, read once per request.
 * The plans are read in one query for every workspace, and the usage of the
 * quotas the person may see is counted at the same time, not after: the plan
 * only decides which of them are shown (a quota it does not name is dropped
 * when the view is assembled). With no feature that gives plans nothing could
 * be shown, so nothing is counted.
 */
export const getShell: () => Promise<ShellData> = cache(async () => {
  const { user, workspace, workspaces } = await getWorkspaceContext();
  const hasPlans = FEATURES.some((feature) => feature.plans);
  const quotas: readonly QuotaContribution[] =
    workspace && hasPlans
      ? quotasOf(FEATURES, { role: workspace.role, isPlatformAdmin: user.isPlatformAdmin })
      : [];

  const [t, plans, usage] = await Promise.all([
    getTranslations(),
    loadPlans(workspaces),
    workspace ? loadUsage(scopeOf({ user, workspace }), quotas) : new Map<string, number>(),
  ]);

  const view = assembleShellView({
    snapshot: {
      user,
      workspace: workspace && { id: workspace.id, name: workspace.name, role: workspace.role },
      workspaces: workspaces.map(({ id, name, role }) => ({ id, name, role })),
    },
    features: FEATURES,
    t: (key) => t(key),
    plans,
    usage,
    productName: APP_NAME,
    helpUrl: HELP_URL,
    renderIcon,
  });

  return {
    view,
    Providers: FEATURES.flatMap(({ Provider }) => (Provider ? [Provider] : [])),
    Notifications: FEATURES.find((feature) => feature.Notifications)?.Notifications ?? null,
    SidebarActions: FEATURES.flatMap(({ SidebarActions }) => SidebarActions ?? []),
  };
});

/** What the home page draws for a workspace. */
export interface HomeView {
  /** The quotas of the workspace, as the shell shows them: the home reads no figure of its own. */
  quotas: ShellQuota[];
  /** The first steps this person sees, in order, each with whether it is done. */
  tasks: HomeTask[];
  /** How many of `tasks` are done. */
  tasksDone: number;
  /**
   * The latest events of the workspace, newest first. `[]` is a feature that
   * answered that nothing has happened yet: the home says so. `null` is nothing
   * to tell, as no feature gives activity or the one that does failed: the home
   * leaves the section out, as it would say "No activity yet" for ever.
   */
  activity: ActivityEntry[] | null;
  /** The blocks the features add to the home, in order. */
  sections: HomeSection[];
  /** The main action of the header: the first feature of the registry that has one gives it. */
  HomeAction: ScopedComponent | null;
}

/** How many events the home tells. */
const ACTIVITY_LIMIT = 5;

/**
 * Whether each first step is done, all asked at the same time. A step whose
 * loader fails is left out: its state is not known, and a step that is shown as
 * not done when it may well be would send someone to do it twice.
 */
async function loadTaskStates(
  scope: WorkspaceScope,
  tasks: readonly TaskContribution[],
): Promise<{ task: TaskContribution; done: boolean }[]> {
  const read = await Promise.all(
    tasks.map(async (task) => {
      try {
        return { task, done: await task.isDone(scope) };
      } catch (error) {
        unstable_rethrow(error);
        console.error(`Home: the first step ${task.id} could not be read`, error);
        return null;
      }
    }),
  );

  return read.filter((state) => state !== null);
}

/**
 * The latest events of the workspace, from the first feature that gives some.
 * `[]` is its answer that nothing has happened yet. `null` is that there is
 * nothing to tell: no feature gives activity, or the one that does fails (and
 * says so), and the home then leaves the section out.
 */
async function loadActivity(
  scope: WorkspaceScope,
): Promise<ActivityEntry[] | null> {
  const provider = FEATURES.find((feature) => feature.activity)?.activity;
  if (!provider) {
    return null;
  }

  try {
    return await provider(scope, ACTIVITY_LIMIT);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Home: the latest activity could not be read", error);
    return null;
  }
}

/**
 * Everything the home page draws for a workspace, read for the person of the
 * scope. The quotas are the shell's, already read for the layout (`getShell` is
 * read once per request): the home counts nothing again. The first steps are
 * those the person's role sees, and the sections are those of the features, in
 * order. A loader that fails (a quota's, a step's, the activity) loses its own
 * part of the home, never the page. The sections are not loaded here: the page
 * draws them, each in a boundary of its own, so that one that throws shows an
 * error in its place and leaves the rest of the page.
 */
export async function getHome(scope: WorkspaceScope): Promise<HomeView> {
  // A step or a section has no platform-admin side: the role in the workspace is all that tells who sees it.
  const viewer: Viewer = { role: scope.role, isPlatformAdmin: false };
  const [{ view }, t, states, activity] = await Promise.all([
    getShell(),
    getTranslations(),
    loadTaskStates(
      scope,
      collectEntries(
        FEATURES.map((feature) => feature.tasks),
        viewer,
      ),
    ),
    loadActivity(scope),
  ]);
  const tasks: HomeTask[] = states.map(({ task, done }) => ({
    id: task.id,
    label: t(task.labelKey),
    icon: renderIcon(task.icon),
    tone: task.tone,
    done,
    action: { href: task.action.href, label: t(task.action.labelKey) },
  }));

  return {
    // The shell read the session's workspace: a scope of another one has none of its figures.
    quotas: view.workspace?.id === scope.orgId ? view.quotas : [],
    tasks,
    tasksDone: tasks.filter(({ done }) => done).length,
    activity,
    sections: collectEntries(
      FEATURES.map((feature) => feature.homeSections),
      viewer,
    ),
    HomeAction:
      FEATURES.find((feature) => feature.HomeAction)?.HomeAction ?? null,
  };
}

/**
 * The metadata of a page of the connected space: its title ("Projects · Acme —
 * Product", the workspace unless a context is given) and no indexing, as
 * nothing in there is for a search engine.
 */
export async function appPageMetadata(
  page: string,
  options?: { context?: string },
): Promise<Metadata> {
  const { workspace } = await getWorkspaceContext();

  return {
    title: {
      absolute: formatPageTitle({
        page,
        context: options?.context ?? workspace?.name,
        product: APP_NAME,
      }),
    },
    robots: { index: false, follow: false },
  };
}
