import type { LucideIcon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import type { Tone } from "@/shared/components/ui/initial-tile";

// What a feature declares to the shell, and to the deletion of a workspace. Each
// feature writes one `FeatureShell` in its own `shell.ts`, and
// `src/features/registry.ts` lists the ones that are installed: the shell
// (src/shared) never imports a feature, so removing a feature is deleting its
// folder and its line in the registry.

/** What a member may do in a workspace, from the most to the least: owner, admin, member. */
export type ShellRole = "owner" | "admin" | "member";

/** Who is looking: their role in the active workspace (null without one), and whether they run the platform. */
export interface Viewer {
  role: ShellRole | null;
  isPlatformAdmin: boolean;
}

/** The workspace a loader reads and the person it reads it for: always taken from the session, never from the client. */
export interface WorkspaceScope {
  orgId: string;
  userId: string;
  role: ShellRole;
}

/** Where an entry of the navigation lives: the main list, the secondary one (settings, help), or the admin one. */
export type NavSection = "main" | "secondary" | "admin";

/** A link a feature adds. `labelKey` is a full message key ("projects.nav"); the shell translates it. */
export interface LinkContribution {
  /** Unique in its list: when two features give the same id, the first of the registry wins. */
  id: string;
  /** A page of the app, without the language. */
  href: string;
  labelKey: string;
  icon: LucideIcon;
  /** Ascending: 10 comes before 20. */
  order: number;
  /** Hidden from a viewer below this role, and from anyone without a workspace. */
  minRole?: ShellRole;
  /** The path this link stands for when it is not its own `href`: "/settings" for a link to "/settings/account". */
  match?: string;
}

export interface NavContribution extends LinkContribution {
  section: NavSection;
}

/** The plan of a workspace, as the shell shows it: its name, its limits (-1 is unlimited), and where to upgrade. */
export interface PlanSummary {
  id: string;
  name: string;
  limits: Partial<Record<string, number>>;
  /** Null when there is no plan above this one. */
  upgradeHref: string | null;
  /** The lowest role that may upgrade: below it the shell offers no upgrade. Without it, every role is offered one. */
  upgradeMinRole?: ShellRole;
}

/** A figure counted against a limit of the plan, shown in the account menu and on the home. */
export interface QuotaContribution {
  id: string;
  /** The key of the plan's `limits` this quota is counted against. Without that key in the plan, no quota is shown. */
  limitKey: string;
  labelKey: string;
  unit?: "megabyte";
  icon: LucideIcon;
  tone: Tone;
  order: number;
  /** How much of the workspace's limit is used. */
  usage: (scope: WorkspaceScope) => Promise<number>;
}

/** A first step of the home ("create a project"), done or not. */
export interface TaskContribution {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  tone: Tone;
  order: number;
  minRole?: ShellRole;
  action: { href: string; labelKey: string };
  isDone: (scope: WorkspaceScope) => Promise<boolean>;
}

/** One event of the workspace, as the home lists it. */
export interface ActivityEntry {
  id: string;
  action: string;
  actorName: string | null;
  actorImage: string | null;
  values: Record<string, string>;
  at: Date;
}

/** A server component given the scope of the workspace; it may be asynchronous. */
export type ScopedComponent = (props: {
  scope: WorkspaceScope;
}) => ReactNode | Promise<ReactNode>;

/** A block of the home page. */
export interface HomeSection {
  id: string;
  order: number;
  Component: ScopedComponent;
}

/**
 * What a feature does on the server before a workspace is deleted: it cleans
 * up what it holds for the workspace outside the rows that go with it (a
 * subscription at the payment provider, files in a storage). The cleanups run in
 * `order`, before the rows go; one that throws stops the deletion, and the
 * workspace stays, with `failureKey` saying why.
 */
export interface WorkspaceCleanup {
  /** Ascending: a step that may be refused (billing, 10) runs before one that cannot be undone (files, 50). */
  order: number;
  /**
   * Cleans up what the feature holds for the workspace. It answers the message
   * (a full key) of what it did that the person must hear when a later step
   * keeps the workspace (a subscription it cancelled), or null.
   */
  run: (orgId: string) => Promise<string | null>;
  /** The message (a full key) that tells the person why the workspace was kept when this step fails. */
  failureKey: string;
}

export interface FeatureShell {
  id: string;
  nav?: NavContribution[];
  /** Tabs of the settings pages. */
  settings?: LinkContribution[];
  /** Links of the account menu. */
  account?: LinkContribution[];
  /**
   * The plan of each of these workspaces, read together (one query for all of them, not one each).
   * The first provider of the registry is the one asked. A workspace is in the answer once.
   */
  plans?: (orgIds: readonly string[]) => Promise<Map<string, PlanSummary>>;
  quotas?: QuotaContribution[];
  tasks?: TaskContribution[];
  /** The latest events of a workspace, newest first. The first provider of the registry is the one asked. */
  activity?: (scope: WorkspaceScope, limit: number) => Promise<ActivityEntry[]>;
  homeSections?: HomeSection[];
  /** The main action of the home page (a "New project" button). */
  HomeAction?: ScopedComponent;
  /** Wraps the shell, for what the pages under it share (a client store, a poller). */
  Provider?: ComponentType<{ children: ReactNode }>;
  /** The bell of the shell. The first one of the registry is the one drawn. */
  Notifications?: ComponentType;
  /** Rows added under the secondary navigation. */
  SidebarActions?: ComponentType[];
  /** What the feature cleans up, on the server, before a workspace is deleted (`deleteOrganization`). */
  onWorkspaceDelete?: WorkspaceCleanup;
}
