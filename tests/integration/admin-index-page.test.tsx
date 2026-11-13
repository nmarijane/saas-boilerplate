import type { ShellLink } from "@/shared/shell/view";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminIndexPage, { generateMetadata as indexMetadata } from "@/app/[locale]/(app)/(shell)/admin/page";
import { appPageMetadata, getShell  } from "@/features/app-shell";
import { intl, params, redirectOf, resetAdminPage, signInAs } from "../helpers/admin-pages";

// There is no page of the administration at /admin: the address of the section is the address of its first page. The
// page is guarded like every page of the admin (the guard of the layout is not run again on a navigation inside it),
// and it sends to the first page the registry gives the section, so that it follows a feature that is taken away.
// The guards are the real ones; the shell is a stand-in, to give the section the pages a test wants, and the
// redirect of the page and of the guards is a stand-in of the localized one of next-intl (Next's own `redirect`).

vi.mock("@/features/auth/guards", async (importOriginal) => importOriginal());
vi.mock("@/features/auth/auth", async () => (await import("../helpers/admin-pages")).authMock());
vi.mock("next-intl/server", async () => (await import("../helpers/admin-pages")).intlServerMock());
vi.mock("@/features/app-shell", async () => ({
  ...(await (await import("../helpers/admin-pages")).appShellMock()),
  getShell: vi.fn(),
}));
vi.mock("@/shared/lib/i18n-navigation", async () => ({
  ...(await (await import("../helpers/admin-pages")).navigationMock()),
}));

function link(id: string, href: string): ShellLink {
  return { id, href, label: id, icon: null };
}

/** The shell, with these pages in the section of the administration. */
function shellWith(...admin: ShellLink[]) {
  vi.mocked(getShell).mockResolvedValue({
    view: { nav: { main: [], admin, secondary: [] } },
    Providers: [],
    Notifications: null,
    SidebarActions: [],
  } as unknown as Awaited<ReturnType<typeof getShell>>);
}

beforeEach(() => {
  vi.mocked(getShell).mockReset();
  vi.mocked(appPageMetadata).mockClear();
  resetAdminPage();
  shellWith(link("users", "/admin/users"), link("organizations", "/admin/organizations"), link("metrics", "/admin/metrics"));
});

describe("the address of the administration", () => {
  it("sends a platform admin to the first page of the section, in the language of the page", async () => {
    expect(await redirectOf(AdminIndexPage(params("en")))).toBe("/en/admin/users");
    expect(await redirectOf(AdminIndexPage(params("fr")))).toBe("/fr/admin/users");
  });

  it("sends to the first page the registry gives the section, whichever it is: a feature that is taken away leaves the next", async () => {
    shellWith(link("audit", "/admin/audit"), link("changelog", "/admin/changelog"));

    expect(await redirectOf(AdminIndexPage(params("en")))).toBe("/en/admin/audit");
  });

  it("answers a 404 when the section has no page at all: there is nowhere to send", async () => {
    shellWith();

    await expect(AdminIndexPage(params("en"))).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });

  describe("for someone who is not a platform admin", () => {
    it("sends a member to the home, as every page of the administration does, before the shell is read: the section is not told", async () => {
      signInAs("member");

      expect(await redirectOf(AdminIndexPage(params("en")))).toBe("/en/dashboard");
      expect(getShell).not.toHaveBeenCalled();
    });

    it("sends a visitor with no session to sign in, before the shell is read", async () => {
      signInAs("nobody");

      expect(await redirectOf(AdminIndexPage(params("en")))).toBe("/en/sign-in");
      expect(getShell).not.toHaveBeenCalled();
    });

    it("sends in the language of the page", async () => {
      signInAs("member");
      intl.locale = "fr";

      expect(await redirectOf(AdminIndexPage(params("fr")))).toBe("/fr/dashboard");
    });

    it("tells a member nothing of the pages of the section, whatever they are", async () => {
      signInAs("member");
      shellWith(link("secret", "/admin/secret-page"));

      expect(await redirectOf(AdminIndexPage(params("fr")))).not.toContain("secret-page");
    });
  });

  it("titles the tab like the pages of the section, in the language of the page", async () => {
    await indexMetadata(params("en"));
    await indexMetadata(params("fr"));

    expect(vi.mocked(appPageMetadata).mock.calls.map(([title]) => title)).toEqual(["Admin", "Administration"]);
  });
});
