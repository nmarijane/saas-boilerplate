import type { ComponentProps, ReactNode } from "react";
import type { ShellData } from "@/features/app-shell";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminLayout from "@/app/[locale]/(app)/(shell)/admin/layout";
import ShellLayout from "@/app/[locale]/(app)/(shell)/layout";
import OnboardingLayout from "@/app/[locale]/(app)/onboarding/layout";
import { requireAdmin } from "@/features/auth/guards";
import { APP_NAME } from "@/shared/config/app";
import { attribute, decodedClassesOf, elements, startTags, textOf } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";
import { shellLink, shellView, USER } from "../../helpers/shell";

// What the layout reads and calls, replaced: the shell data it is given, the
// localized redirect of next-intl (a real one throws the way a stand-in does
// here), the two slots it mounts, and the links and the router of next-intl.
// The slots draw what they were given as attributes, so that a test can read
// what the layout handed them.
const shell = vi.hoisted(() => ({ getShell: vi.fn() }));
const navigation = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("@/features/app-shell", () => shell);

vi.mock("@/features/auth/organization/components/workspace-switcher", async () => {
  const { createElement } = await import("react");
  return {
    WorkspaceSwitcher: ({
      workspaces,
      activeId,
    }: {
      workspaces: { id: string }[];
      activeId: string | null;
    }) =>
      createElement("span", {
        "data-fake": "workspaces",
        "data-ids": workspaces.map(({ id }) => id).join(","),
        "data-active": activeId ?? "none",
      }),
  };
});

vi.mock("@/features/auth/components/account-menu", async () => {
  const { createElement } = await import("react");
  return {
    AccountMenu: ({
      user,
      workspace,
      workspaces,
      links,
      quotas,
    }: {
      user: { id: string };
      workspace: { id: string } | null;
      workspaces: unknown[];
      links: { id: string }[];
      quotas: { id: string }[];
    }) =>
      createElement("span", {
        "data-fake": "account",
        "data-user": user.id,
        "data-workspace": workspace?.id ?? "none",
        "data-workspaces": workspaces.length,
        "data-links": links.map(({ id }) => id).join(","),
        "data-quotas": quotas.map(({ id }) => id).join(","),
      }),
  };
});

vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) =>
      createElement("a", { href, ...props }),
    redirect: navigation.redirect,
    usePathname: () => "/dashboard",
    useRouter: () => ({ push: () => {}, refresh: () => {} }),
  };
});
// The header of onboarding signs out through the auth client, which has no server here
vi.mock("@/features/auth/auth-client", () => ({ authClient: {} }));

beforeEach(() => {
  shell.getShell.mockReset();
  navigation.redirect.mockReset();
  navigation.redirect.mockImplementation(({ href, locale }: { href: string; locale: string }) => {
    throw new Error(`redirect:/${locale}${href}`);
  });
  vi.mocked(requireAdmin).mockClear();
});

function shellData(overrides: Partial<ShellData> = {}): ShellData {
  return {
    view: shellView(),
    Providers: [],
    Notifications: null,
    SidebarActions: [],
    ...overrides,
  };
}

/** A provider that marks where it sits in the tree: a section, which nothing in the shell is. */
function provider(name: string) {
  return function Provider({ children }: { children: ReactNode }) {
    return <section data-provider={name}>{children}</section>;
  };
}

function fake(name: string) {
  return function Fake() {
    return <span data-fake={name} />;
  };
}

const params = (locale: "en" | "fr") => ({ params: Promise.resolve({ locale }) });

const count = (html: string, needle: string) => html.split(needle).length - 1;

async function renderLayout(data: ShellData): Promise<string> {
  shell.getShell.mockResolvedValue(data);
  return renderWithIntl(await ShellLayout({ children: <p>page</p>, ...params("en") }));
}

describe("the layout of the shell", () => {
  it("draws the shell around the page", async () => {
    const html = await renderLayout(shellData());

    expect(html).toContain("data-shell");
    expect(html).toContain("<p>page</p>");
  });

  it("sends someone with no workspace to onboarding", async () => {
    shell.getShell.mockResolvedValue(
      shellData({ view: shellView({ workspace: null, workspaces: [] }) }),
    );

    await expect(ShellLayout({ children: null, ...params("en") })).rejects.toThrow(
      "redirect:/en/onboarding",
    );
    expect(navigation.redirect).toHaveBeenCalledWith({ href: "/onboarding", locale: "en" });
  });

  it("sends it to onboarding in the language of the page", async () => {
    shell.getShell.mockResolvedValue(
      shellData({ view: shellView({ workspace: null, workspaces: [] }) }),
    );

    await expect(ShellLayout({ children: null, ...params("fr") })).rejects.toThrow(
      "redirect:/fr/onboarding",
    );
  });

  it("lets a platform admin with no workspace in, for the admin pages", async () => {
    const html = await renderLayout(
      shellData({
        view: shellView({
          workspace: null,
          workspaces: [],
          user: { ...USER, isPlatformAdmin: true },
        }),
      }),
    );

    expect(html).toContain("data-shell");
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it("wraps the shell in the providers, the first of the registry outermost", async () => {
    const html = await renderLayout(
      shellData({ Providers: [provider("first"), provider("second")] }),
    );

    // The first wraps the second, which wraps the shell, and both close after it.
    expect(html).toMatch(
      /^<section data-provider="first"><section data-provider="second"><div[^>]* data-shell=[\s\S]*<\/div><\/section><\/section>$/,
    );
  });

  it("draws the shell as it is when no feature gives a provider", async () => {
    const html = await renderLayout(shellData({ Providers: [] }));

    expect(html).not.toContain("data-provider");
    expect(html).toMatch(/^<div[^>]* data-shell=/);
  });

  it("draws the bell the features give in the sidebar and in the header", async () => {
    const html = await renderLayout(shellData({ Notifications: fake("bell") }));

    expect(count(html, 'data-fake="bell"')).toBe(2);
  });

  it("draws no bell when no feature gives one", async () => {
    const html = await renderLayout(shellData({ Notifications: null }));

    expect(html).not.toContain('data-fake="bell"');
  });

  it("draws each sidebar action under the secondary navigation, in the order of the registry", async () => {
    const html = await renderLayout(
      shellData({ SidebarActions: [fake("feedback"), fake("help")] }),
    );
    const aside = /<aside\b[\s\S]*?<\/aside>/.exec(html)?.[0] ?? "";

    expect(count(aside, 'data-fake="feedback"')).toBe(1);
    expect(aside.indexOf('data-fake="feedback"')).toBeLessThan(
      aside.indexOf('data-fake="help"'),
    );
    expect(aside.indexOf('aria-label="Secondary navigation"')).toBeLessThan(
      aside.indexOf('data-fake="feedback"'),
    );
  });

  it("mounts the workspace switcher and the account menu in the sidebar", async () => {
    const html = await renderLayout(shellData());
    const aside = /<aside\b[\s\S]*?<\/aside>/.exec(html)?.[0] ?? "";

    expect(aside).toContain('data-fake="workspaces"');
    expect(aside).toContain('data-fake="account"');
  });

  it("hands the switcher the workspaces of the person and the one they work in", async () => {
    const other = { id: "org_2", name: "Atelier Sud", role: "admin", plan: null } as const;
    const view = shellView();
    const html = await renderLayout(
      shellData({ view: { ...view, workspaces: [...view.workspaces, other] } }),
    );
    const [tag = ""] = startTags(html, "span").filter((span) =>
      span.includes('data-fake="workspaces"'),
    );

    expect(attribute(tag, "data-ids")).toBe("org_1,org_2");
    expect(attribute(tag, "data-active")).toBe("org_1");
  });

  it("hands the switcher no active workspace for someone who has none", async () => {
    const html = await renderLayout(
      shellData({
        view: shellView({
          workspace: null,
          workspaces: [],
          user: { ...USER, isPlatformAdmin: true },
        }),
      }),
    );
    const [tag = ""] = startTags(html, "span").filter((span) =>
      span.includes('data-fake="workspaces"'),
    );

    expect(attribute(tag, "data-ids")).toBe("");
    expect(attribute(tag, "data-active")).toBe("none");
  });

  it("hands the account menu the person, their workspace, the links of the features and the quotas", async () => {
    const view = shellView({
      account: [shellLink("account", "/settings/account", "Account")],
      quotas: [
        {
          id: "storage",
          label: "Storage",
          used: 41,
          limit: 50,
          status: "warning",
          icon: <svg />,
          tone: 1,
          upgradeHref: null,
        },
      ],
    });
    const html = await renderLayout(shellData({ view }));
    const [tag = ""] = startTags(html, "span").filter((span) =>
      span.includes('data-fake="account"'),
    );

    expect(attribute(tag, "data-user")).toBe(USER.id);
    expect(attribute(tag, "data-workspace")).toBe("org_1");
    expect(attribute(tag, "data-workspaces")).toBe("1");
    expect(attribute(tag, "data-links")).toBe("account");
    expect(attribute(tag, "data-quotas")).toBe("storage");
  });
});

describe("the layout of the admin pages", () => {
  it("asks for an administrator, then lets the pages through", async () => {
    const page = <p>admin page</p>;

    expect(await AdminLayout({ children: page })).toBe(page);
    expect(requireAdmin).toHaveBeenCalledOnce();
  });

  it("keeps the pages away from anyone else: the guard sends them elsewhere", async () => {
    vi.mocked(requireAdmin).mockRejectedValueOnce(new Error("redirect:/dashboard"));

    await expect(AdminLayout({ children: <p>admin page</p> })).rejects.toThrow(
      "redirect:/dashboard",
    );
  });
});

describe("the layout of onboarding", () => {
  const html = renderWithIntl(
    <OnboardingLayout>
      <p>first step</p>
    </OnboardingLayout>,
  );

  it("draws the page on the sunken surface", () => {
    expect(decodedClassesOf(startTags(html, "div")[0] ?? "")).toContain(
      "bg-surface-sunken",
    );
  });

  it("shows the logo of the product, with nowhere to go", () => {
    expect(html).toContain(APP_NAME);
    // There is no workspace to go home to yet: the logo is not a link.
    expect(startTags(html, "a")).toEqual([]);
  });

  // Someone with no workspace has no shell and so no account menu, and the page for
  // the account asks for a workspace: signing out is the one way out that is left to
  // a person who is stuck here (an owner who deleted their only workspace, a removed
  // member, the seeded admin)
  it("offers the one way out, signing out, as a button on the other side of the header", () => {
    const header = /<header\b[\s\S]*?<\/header>/.exec(html)?.[0] ?? "";
    const buttons = elements(header, "button");

    expect(buttons.map(textOf)).toEqual(["Sign out"]);
    expect(attribute(startTags(header, "button")[0] ?? "", "type")).toBe("button");
    // The logo comes first, and the way out after it
    expect(header.indexOf(APP_NAME)).toBeLessThan(header.indexOf("Sign out"));
    expect(header).toContain("lucide-log-out");
    expect(decodedClassesOf(startTags(header, "div")[0] ?? "")).toBeDefined();
  });

  it("says it in French, and keeps it out of the page, which is the step's", () => {
    const french = renderWithIntl(
      <OnboardingLayout>
        <p>first step</p>
      </OnboardingLayout>,
      "fr",
    );

    expect(elements(french, "button").map(textOf)).toEqual(["Se déconnecter"]);
    expect(/<main\b[\s\S]*<\/main>/.exec(french)?.[0] ?? "").not.toContain("button");
  });

  it("centers the content in a column of 576 px", () => {
    const [main] = startTags(html, "main");
    // The first <div> after <main> opens: the column.
    const column = startTags(/<main\b[\s\S]*/.exec(html)?.[0] ?? "", "div")[0] ?? "";

    expect(attribute(main ?? "", "id")).toBe("main-content");
    expect(decodedClassesOf(column)).toEqual(
      expect.arrayContaining(["mx-auto", "w-full", "max-w-xl"]),
    );
    expect(html).toContain("<p>first step</p>");
  });

  it("draws no shell: no sidebar, no header, no tab bar", () => {
    expect(html).not.toContain("<aside");
    expect(html).not.toContain("<nav");
    expect(html).not.toContain("data-shell");
  });
});
