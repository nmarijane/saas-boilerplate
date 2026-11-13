import type { ReactNode } from "react";
import type { NavSection, ShellRole } from "./contract";
import type { Tone } from "@/shared/components/ui/initial-tile";
import type { QuotaState } from "@/shared/components/ui/progress-bar";

// What the shell receives: the contributions of the installed features,
// resolved for one viewer. Everything here crosses from the server to the
// client, so it holds strings, numbers and rendered icons, never a function.

export interface ShellLink {
  id: string;
  href: string;
  /** Already translated. */
  label: string;
  /** Rendered on the server, hidden from assistive technology. */
  icon: ReactNode;
  /** The path this link stands for when it is not its own `href`. */
  match?: string;
}

export interface ShellWorkspace {
  id: string;
  name: string;
  role: ShellRole;
  /** The name of the plan, null when no feature gives one. */
  plan: string | null;
}

export interface ShellUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  isPlatformAdmin: boolean;
}

/** How full a quota is, or that it has no limit. */
export type QuotaStatus = QuotaState | "unlimited";

export interface ShellQuota {
  id: string;
  label: string;
  used: number;
  /** -1 when the status is `unlimited`. */
  limit: number;
  status: QuotaStatus;
  unit?: "megabyte";
  icon: ReactNode;
  tone: Tone;
  upgradeHref: string | null;
}

/** A first step of the home, ready to draw. */
export interface HomeTask {
  id: string;
  label: string;
  icon: ReactNode;
  tone: Tone;
  done: boolean;
  action: { href: string; label: string };
}

export interface ShellView {
  productName: string;
  user: ShellUser;
  /** The active workspace; null for someone who has none. */
  workspace: ShellWorkspace | null;
  workspaces: ShellWorkspace[];
  nav: Record<NavSection, ShellLink[]>;
  /** Links of the account menu. */
  account: ShellLink[];
  /** Tabs of the settings pages. */
  settings: ShellLink[];
  /** The quotas of the active workspace that its plan limits. */
  quotas: ShellQuota[];
}
