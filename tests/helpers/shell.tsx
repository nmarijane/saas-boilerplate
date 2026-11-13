import type { ShellLink, ShellUser, ShellView, ShellWorkspace } from "@/shared/shell/view";

/**
 * Fixtures for the shell: a link as the server hands it over (its icon already
 * drawn, a bare svg here), and a whole view that a test changes as it needs.
 */

/** A link of the navigation. `extra` carries what only some links have (`match`). */
export function shellLink(
  id: string,
  href: string,
  label: string,
  extra: Partial<Pick<ShellLink, "match">> = {},
): ShellLink {
  return {
    id,
    href,
    label,
    icon: <svg data-icon={id} aria-hidden="true" />,
    ...extra,
  };
}

export const USER: ShellUser = {
  id: "user_1",
  name: "Camille Laurent",
  email: "camille@example.com",
  image: null,
  isPlatformAdmin: false,
};

export const WORKSPACE: ShellWorkspace = {
  id: "org_1",
  name: "Studio Nord",
  role: "owner",
  plan: "Pro",
};

/** A signed-in member of one workspace, with three pages in the main navigation and Settings and Help below. */
export function shellView(overrides: Partial<ShellView> = {}): ShellView {
  return {
    productName: "Example",
    user: USER,
    workspace: WORKSPACE,
    workspaces: [WORKSPACE],
    nav: {
      main: [
        shellLink("home", "/dashboard", "Home"),
        shellLink("projects", "/projects", "Projects"),
        shellLink("assistant", "/ai", "Assistant"),
      ],
      secondary: [
        shellLink("settings", "/settings/account", "Settings", {
          match: "/settings",
        }),
        shellLink("help", "mailto:support@example.com", "Help"),
      ],
      admin: [],
    },
    account: [],
    settings: [
      shellLink("account", "/settings/account", "Account"),
      shellLink("team", "/settings/team", "Team"),
    ],
    quotas: [],
    ...overrides,
  };
}
