import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type {
  FeatureShell,
  LinkContribution,
  NavContribution,
  PlanSummary,
  ShellRole,
  Viewer,
} from "./contract";
import type {
  ShellLink,
  ShellQuota,
  ShellUser,
  ShellView,
  ShellWorkspace,
} from "./view";
import { CircleHelpIcon } from "lucide-react";
import { collectEntries, isVisible, quotasToRead, resolveNav, resolveQuota } from "./resolve";

/** Who is signed in and which workspaces they belong to: what the session and the database say. */
interface WorkspaceSnapshot {
  user: ShellUser;
  workspace: { id: string; name: string; role: ShellRole } | null;
  workspaces: { id: string; name: string; role: ShellRole }[];
}

/**
 * "Help" is not a feature's: the shell adds it to the secondary navigation,
 * after Settings, when the product has a help URL. Unlike every other link
 * its `href` leaves the app (`mailto:` or a full URL), so whoever draws it
 * must not run it through the locale-aware Link.
 */
function helpEntry(href: string): NavContribution {
  return {
    id: "help",
    section: "secondary",
    href,
    labelKey: "shell.nav.help",
    icon: CircleHelpIcon,
    order: 20,
  };
}

/**
 * The view of the shell for one person, from what the installed features
 * declare. It is pure: the translator, the plans and the usage it needs are
 * given, so what a feature that is not installed would have added is simply
 * not there.
 *
 * `plans` is read by workspace id and `usage` by quota id; the quotas are those
 * of the active workspace alone, counted against its plan.
 */
export function assembleShellView(input: {
  snapshot: WorkspaceSnapshot;
  features: readonly FeatureShell[];
  t: (key: string) => string;
  plans: ReadonlyMap<string, PlanSummary>;
  usage: ReadonlyMap<string, number>;
  productName: string;
  helpUrl: string | null;
  renderIcon: (icon: LucideIcon) => ReactNode;
}): ShellView {
  const { snapshot, features, t, plans, usage, productName, helpUrl, renderIcon } = input;
  const active = snapshot.workspace;
  const viewer: Viewer = {
    role: active?.role ?? null,
    isPlatformAdmin: snapshot.user.isPlatformAdmin,
  };

  const toLink = (entry: LinkContribution): ShellLink => ({
    id: entry.id,
    href: entry.href,
    label: t(entry.labelKey),
    icon: renderIcon(entry.icon),
    ...(entry.match !== undefined && { match: entry.match }),
  });
  const toWorkspace = (workspace: { id: string; name: string; role: ShellRole }): ShellWorkspace => ({
    id: workspace.id,
    name: workspace.name,
    role: workspace.role,
    plan: plans.get(workspace.id)?.name ?? null,
  });

  const shell: FeatureShell = { id: "shell", nav: helpUrl ? [helpEntry(helpUrl)] : [] };
  const nav = resolveNav([...features, shell], viewer);

  const activePlan = (active && plans.get(active.id)) || null;
  // The way to a bigger plan is offered to whoever may take it: a role below the
  // one the plan names has its quotas without an Upgrade link.
  const upgradeHref =
    activePlan && isVisible({ minRole: activePlan.upgradeMinRole }, viewer)
      ? activePlan.upgradeHref
      : null;
  const quotas: ShellQuota[] = [];
  if (active) {
    for (const entry of quotasToRead(features, viewer, activePlan)) {
      const used = usage.get(entry.id);
      const resolved = used === undefined ? null : resolveQuota(entry, used, activePlan);
      if (!resolved) {
        continue;
      }

      quotas.push({
        id: resolved.id,
        label: t(resolved.labelKey),
        used: resolved.used,
        limit: resolved.limit,
        status: resolved.status,
        ...(resolved.unit !== undefined && { unit: resolved.unit }),
        icon: renderIcon(resolved.icon),
        tone: resolved.tone,
        upgradeHref,
      });
    }
  }

  return {
    productName,
    user: snapshot.user,
    workspace: active ? toWorkspace(active) : null,
    workspaces: snapshot.workspaces.map(toWorkspace),
    nav: {
      main: nav.main.map(toLink),
      secondary: nav.secondary.map(toLink),
      admin: nav.admin.map(toLink),
    },
    account: collectEntries(features.map((feature) => feature.account), viewer).map(toLink),
    settings: collectEntries(features.map((feature) => feature.settings), viewer).map(toLink),
    quotas,
  };
}

/**
 * Where the shell sends this person instead of drawing itself: to onboarding
 * when they have no workspace to work in. A platform admin has none and still
 * enters, for the admin pages.
 */
export function shellRedirect(
  view: Pick<ShellView, "workspace" | "user">,
): "/onboarding" | null {
  return view.workspace === null && !view.user.isPlatformAdmin
    ? "/onboarding"
    : null;
}
