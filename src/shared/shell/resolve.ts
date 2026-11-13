import type {
  FeatureShell,
  NavContribution,
  NavSection,
  PlanSummary,
  QuotaContribution,
  ShellRole,
  Viewer,
} from "./contract";
import type { QuotaStatus } from "./view";
import { quotaState } from "@/shared/components/ui/progress-bar";
import { ROLE_HIERARCHY } from "@/shared/types";

// Pure rules of the shell: who sees what, in which order, how full a quota is,
// how a page is titled. No input or output here: `assemble.ts` puts them
// together, `src/features/app-shell.ts` feeds them.

/** The one matcher of the app: the page `target` stands for, or one under it. Whole segments only. */
export { isActivePath } from "@/shared/utils/paths";

interface Resolvable {
  id: string;
  order: number;
  minRole?: ShellRole;
  section?: NavSection;
}

/**
 * Whether a viewer sees an entry. An entry with a `minRole` needs a workspace
 * and a role at least as high (owner above admin above member); the admin
 * section is for platform admins, whatever their role in a workspace.
 */
export function isVisible(
  entry: { minRole?: ShellRole; section?: NavSection },
  viewer: Viewer,
): boolean {
  if (entry.section === "admin" && !viewer.isPlatformAdmin) {
    return false;
  }
  if (entry.minRole === undefined) {
    return true;
  }

  return (
    viewer.role !== null &&
    ROLE_HIERARCHY[viewer.role] >= ROLE_HIERARCHY[entry.minRole]
  );
}

/**
 * The entries of several lists (one per feature, in the order of the
 * registry) that a viewer sees, sorted by `order`. When two entries have the
 * same id the first one keeps it, whoever the viewer is, so that an id always
 * stands for the same entry; equal orders keep the order of the registry.
 */
export function collectEntries<T extends Resolvable>(
  lists: readonly (readonly T[] | undefined)[],
  viewer: Viewer,
): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];

  for (const list of lists) {
    for (const entry of list ?? []) {
      if (seen.has(entry.id)) {
        continue;
      }
      seen.add(entry.id);

      if (isVisible(entry, viewer)) {
        kept.push(entry);
      }
    }
  }

  return kept.sort((a, b) => a.order - b.order);
}

/** The navigation of the installed features, by section. */
export function resolveNav(
  features: readonly FeatureShell[],
  viewer: Viewer,
): Record<NavSection, NavContribution[]> {
  const entries = collectEntries(
    features.map((feature) => feature.nav),
    viewer,
  );

  return {
    main: entries.filter((entry) => entry.section === "main"),
    secondary: entries.filter((entry) => entry.section === "secondary"),
    admin: entries.filter((entry) => entry.section === "admin"),
  };
}

type ResolvedQuota = Omit<QuotaContribution, "usage"> & {
  used: number;
  limit: number;
  status: QuotaStatus;
};

/**
 * A quota counted against the limits of a plan. It is null, and so not shown,
 * when there is no plan or the plan has no limit under the quota's key. A
 * negative limit (-1) is unlimited; any other is a figure, and a limit of 0 is
 * already reached.
 */
export function resolveQuota(
  entry: QuotaContribution,
  used: number,
  plan: PlanSummary | null,
): ResolvedQuota | null {
  const limit = plan?.limits[entry.limitKey];
  if (limit === undefined) {
    return null;
  }

  const { usage: _usage, ...declared } = entry;

  return {
    ...declared,
    used,
    limit,
    status: limit < 0 ? "unlimited" : quotaState(used, limit),
  };
}

/** The quotas a viewer may see, in order, whatever limits the plan gives: the ones that can be counted before the plan is known. */
export function quotasOf(features: readonly FeatureShell[], viewer: Viewer): QuotaContribution[] {
  return collectEntries(
    features.map((feature) => feature.quotas),
    viewer,
  );
}

/**
 * The quotas a viewer sees whose limit the plan states, in order: the ones that
 * are shown. A quota the plan does not name is not shown. The shell decides it
 * here once, when it assembles the view; the home takes what the shell
 * assembled and decides nothing.
 */
export function quotasToRead(
  features: readonly FeatureShell[],
  viewer: Viewer,
  plan: PlanSummary | null,
): QuotaContribution[] {
  return quotasOf(features, viewer).filter((quota) => resolveQuota(quota, 0, plan) !== null);
}

/** The quotas to point out: those at their limit first, then those running low, each group in the order given. */
export function needsAttention<T extends { status: QuotaStatus }>(
  quotas: readonly T[],
): T[] {
  return [
    ...quotas.filter(({ status }) => status === "limit"),
    ...quotas.filter(({ status }) => status === "warning"),
  ];
}

/** The title of a tab: "Projects · Acme — Product", or "Projects — Product" without a context. */
export function formatPageTitle(parts: {
  page: string;
  context?: string | null;
  product: string;
}): string {
  const context = parts.context?.trim();
  const head = context ? `${parts.page} · ${context}` : parts.page;

  return `${head} — ${parts.product}`;
}

const WHITESPACE_RE = /\s+/;

/** The first word of a name, or null when there is none. */
export function firstNameOf(name: string | null | undefined): string | null {
  return name?.trim().split(WHITESPACE_RE)[0] || null;
}

/** The entries of a tab bar that fit (`max`, four by default: the fifth is "More"), and those that go behind "More". */
export function splitTabBar<T>(
  main: readonly T[],
  max = 4,
): { tabs: T[]; overflow: T[] } {
  const count = Math.max(0, max);

  return { tabs: main.slice(0, count), overflow: main.slice(count) };
}
