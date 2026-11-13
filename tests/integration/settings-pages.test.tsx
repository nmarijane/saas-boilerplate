import type { ComponentProps, ReactElement, ReactNode } from "react";
import type { ShellRole } from "@/shared/shell/contract";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountSettingsPage, {
  generateMetadata as accountMetadata,
} from "@/app/[locale]/(app)/(shell)/settings/account/page";
import NotificationsSettingsPage, {
  generateMetadata as notificationsMetadata,
} from "@/app/[locale]/(app)/(shell)/settings/notifications/page";
import TeamSettingsPage, {
  generateMetadata as teamMetadata,
} from "@/app/[locale]/(app)/(shell)/settings/team/page";
import { appPageMetadata } from "@/features/app-shell";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { ActiveSessions } from "@/features/settings/components/active-sessions";
import { ConnectedAccounts } from "@/features/settings/components/connected-accounts";
import { notification, organization, organizationMember, user } from "@/models";
import { ShellProvider } from "@/shared/components/shell/shell-context";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  textOf,
} from "../helpers/html";
import { renderWithIntl } from "../helpers/intl";
import { seedNotification, seedOrg, seedOrgMember, seedUser } from "../helpers/seed";
import { shellView } from "../helpers/shell";
import { testDb } from "../setup";

// What the pages reach for outside themselves, replaced: the workspace of the
// person (a page takes it from the session), the titles the shell gives a tab,
// the translator of the server (built from the message files, so the words are
// the real ones, and a message that is missing throws) and the navigation of
// next-intl (no Next router runs in a test). What the pages read, the members
// and the notifications, is read from the in-memory database.
const session = vi.hoisted(() => ({ requireWorkspace: vi.fn() }));
const intl = vi.hoisted(() => ({ locale: "en" as "en" | "fr" }));

vi.mock("@/features/auth/organization/workspace", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/auth/organization/workspace")>()),
  requireWorkspace: session.requireWorkspace,
}));

vi.mock("@/features/app-shell", async () => {
  // The title the shell gives a tab, by its own rule: the page, then the context
  // (the workspace, Acme here), then the product.
  const { APP_NAME } = await import("@/shared/config/app");
  const { formatPageTitle } = await import("@/shared/shell/resolve");

  return {
    appPageMetadata: vi.fn(async (page: string) => ({
      title: { absolute: formatPageTitle({ page, context: "Acme", product: APP_NAME }) },
    })),
  };
});

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: en } = await import("@/locales/en.json");
  const { default: fr } = await import("@/locales/fr.json");
  const messages = { en, fr };
  interface Options { locale?: string; namespace?: string }

  return {
    getTranslations: async (options?: Options) => {
      const locale = options?.locale === "fr" ? "fr" : options?.locale === "en" ? "en" : intl.locale;
      return createTranslator({
        locale,
        messages: messages[locale],
        namespace: options?.namespace as "settings",
        // A message that is missing, or that cannot be formatted, fails the test
        onError: (error) => {
          throw error;
        },
      });
    },
  };
});

vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) => createElement("a", { href, ...props }),
    useRouter: () => ({ push: () => {}, refresh: () => {} }),
    usePathname: () => "/settings/account",
  };
});

// The client parts that reach for the network or the server
vi.mock("@/features/auth/auth-client", () => ({ authClient: {} }));
vi.mock("@/features/auth/auth", () => ({ auth: { api: {} } }));
vi.mock("@/features/notifications/components/notifications-provider", () => ({
  useNotificationCenter: () => ({ unreadCount: 0, markRead: async () => {}, markAllRead: async () => {} }),
}));

const ME = "test-user-1";
const ORG = "pages-org";
const OTHER_ORG = "pages-other-org";

function signIn(role: ShellRole = "owner", overrides: { name?: string; email?: string; image?: string | null } = {}) {
  const workspace = { id: ORG, name: "Acme", slug: "acme", role };
  session.requireWorkspace.mockResolvedValue({
    user: {
      id: ME,
      name: overrides.name ?? "Test User",
      email: overrides.email ?? "test@test.com",
      image: overrides.image ?? null,
      isPlatformAdmin: false,
    },
    workspace,
    workspaces: [workspace],
  });
}

/** A page of the settings, inside the shell that gives it its tabs. */
async function draw(page: Promise<ReactNode>, locale: "en" | "fr" = "en") {
  return renderWithIntl(<ShellProvider view={shellView()}>{await page}</ShellProvider>, locale);
}

const params = (locale: "en" | "fr" = "en") => ({ params: Promise.resolve({ locale }) });

/** Every element of a type in a tree of React elements, as a Server Component returns it. */
function findAll(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => findAll(child, type));
  }
  if (!isValidElement<{ children?: ReactNode } & Record<string, unknown>>(node)) {
    return [];
  }

  return [
    ...(node.type === type ? [node] : []),
    ...Object.values(node.props).flatMap((value) => (isValidElement(value) || Array.isArray(value) ? findAll(value as ReactNode, type) : [])),
  ];
}

beforeEach(async () => {
  vi.mocked(appPageMetadata).mockClear();
  intl.locale = "en";
  signIn();
  await testDb.delete(notification);
  await testDb.delete(organizationMember);
  await testDb.delete(organization);
  await testDb.delete(user);
  await seedUser(ME, { name: "Test User", email: "test@test.com" });
  await seedOrg(ORG, { name: "Acme", slug: "acme" });
  await seedOrg(OTHER_ORG, { name: "Elsewhere", slug: "elsewhere" });
});

/** The heads of a page: its one h1 and the h2 of its sections, in order. */
function headings(html: string) {
  return {
    h1: elements(html, "h1").map(textOf),
    h2: elements(html, "h2").map(textOf),
  };
}

/** The id of the level-two title of a card that says this, which names the list the card holds. */
function titleIdOf(html: string, text: string): string | undefined {
  const title = elements(html, "h2").find((heading) => textOf(heading) === text);
  return attribute(startTags(title ?? "", "h2")[0] ?? "", "id");
}

/** The line under the title of the page: what the header says of it. */
function contextOf(html: string): string {
  const [, context = ""] = /<div data-slot="page-header-context"[^>]*>([\s\S]*?)<\/div>/.exec(html) ?? [];
  return textOf(context);
}

/** The rows of the page, in its sections: the tabs of the settings are a list of links too, and are not rows. */
function rowsOf(html: string): string[] {
  return elements(html.replace(/<nav [^>]*data-slot="tab-links"[\s\S]*?<\/nav>/, ""), "li");
}

describe("the account page", () => {
  it("heads the page with a person, the title and their email, and puts the tabs of the settings under it", async () => {
    const html = await draw(AccountSettingsPage(params()));

    expect(headings(html).h1).toEqual(["Account"]);
    expect(startTags(html, "h1")).toHaveLength(1);
    expect(contextOf(html)).toBe("test@test.com");
    expect(html).toContain('data-slot="icon-tile"');
    expect(html).toContain('data-slot="tab-links"');
    expect(attribute(startTags(html, "nav")[0] ?? "", "aria-label")).toBe("Settings");
    // No main action: every card has its own button
    expect(html).not.toContain('data-slot="page-header-actions"');
  });

  it("is four sections in cards, each titled by a level-two heading, in order", async () => {
    const html = await draw(AccountSettingsPage(params()));

    expect(headings(html).h2).toEqual(["Profile", "Password", "Connected accounts", "Sessions"]);
    for (const title of startTags(html, "h2")) {
      expect(attribute(title, "data-slot")).toBe("card-title");
    }
  });

  // The two lists are read in the browser (the cards ask the auth client): the page draws a
  // skeleton, and gives each card the id of its title to name its list by, which is checked
  // on the cards as the page hands them over. The lists are named in the stories.
  it("gives the list of the connected accounts and the list of the sessions the id of the title of their card", async () => {
    const tree = await AccountSettingsPage(params());
    const html = await draw(Promise.resolve(tree));
    const accountsId = titleIdOf(html, "Connected accounts");
    const sessionsId = titleIdOf(html, "Sessions");

    expect(accountsId).toBeTruthy();
    expect(sessionsId).toBeTruthy();
    expect(sessionsId).not.toBe(accountsId);
    expect(findAll(tree, ConnectedAccounts).map((card) => card.props.labelledBy)).toEqual([accountsId]);
    expect(findAll(tree, ActiveSessions).map((card) => card.props.labelledBy)).toEqual([sessionsId]);
  });

  it("fills the profile with the person of the session", async () => {
    signIn("member", { name: "Camille Laurent", email: "camille@example.com", image: "https://example.com/c.png" });
    const html = await draw(AccountSettingsPage(params()));
    const [name = "", email = "", image = ""] = startTags(html, "input");

    expect(attribute(name, "value")).toBe("Camille Laurent");
    expect(attribute(email, "value")).toBe("camille@example.com");
    expect(attribute(image, "value")).toBe("https://example.com/c.png");
  });

  it("ends with the zone that deletes the account: the one destructive button of the page, apart", async () => {
    const html = await draw(AccountSettingsPage(params()));
    const destructive = startTags(html, "button").filter((tag) => decodedClassesOf(tag).includes("bg-destructive"));

    expect(destructive).toHaveLength(1);
    expect(attribute(destructive[0] ?? "", "aria-haspopup")).toBe("dialog");
    expect(html.lastIndexOf("Delete account")).toBeGreaterThan(html.lastIndexOf("Sessions"));
    expect(textOf(html)).toContain("Deleting your account is permanent.");
  });

  it("titles the tab through the shell, in the language of the page", async () => {
    const english = await accountMetadata(params("en"));
    const french = await accountMetadata(params("fr"));

    expect(english.title).toEqual({ absolute: "Account · Acme — SaaS Boilerplate" });
    expect(french.title).toEqual({ absolute: "Compte · Acme — SaaS Boilerplate" });
  });

  it("speaks French", async () => {
    intl.locale = "fr";
    const html = await draw(AccountSettingsPage(params("fr")), "fr");

    expect(headings(html)).toEqual({
      h1: ["Compte"],
      h2: ["Profil", "Mot de passe", "Comptes liés", "Sessions"],
    });
    expect(textOf(html)).toContain("Supprimer le compte");
  });
});

describe("the team page", () => {
  async function seedTeam() {
    await seedUser("u-admin", { name: "Adam Dupont", email: "adam@example.com" });
    await seedUser("u-member", { name: "Mia Martin", email: "mia@example.com" });
    await seedUser("u-foreign", { name: "Fiona Elsewhere", email: "fiona@example.com" });
    await seedOrgMember(ME, ORG, "owner");
    await seedOrgMember("u-admin", ORG, "admin");
    await seedOrgMember("u-member", ORG, "member");
    await seedOrgMember("u-foreign", OTHER_ORG, "owner");
  }

  const page = (locale: "en" | "fr" = "en") => draw(TeamSettingsPage(params(locale)), locale);

  it("heads the page with a people icon, the title and how many people the workspace has", async () => {
    await seedTeam();
    const html = await page();

    expect(headings(html).h1).toEqual(["Team"]);
    expect(contextOf(html)).toBe("3 members");
    expect(html).toContain('data-slot="icon-tile"');
    expect(html).toContain('data-slot="tab-links"');
  });

  it("counts the person alone as one member, in both languages", async () => {
    await seedOrgMember(ME, ORG, "owner");

    expect(contextOf(await page())).toBe("1 member");
    intl.locale = "fr";
    expect(contextOf(await page("fr"))).toBe("1 membre");
  });

  it("lists the members of the workspace of the session, never those of another", async () => {
    await seedTeam();
    const html = await page();

    expect(headings(html).h2).toContain("Members");
    expect(rowsOf(html).map((row) => textOf(row))).toEqual([
      expect.stringContaining("Test User"),
      expect.stringContaining("Adam Dupont"),
      expect.stringContaining("Mia Martin"),
    ]);
    expect(textOf(html)).not.toContain("Fiona Elsewhere");
    expect(textOf(html)).toContain("adam@example.com");
  });

  it("names the list of the members by the title of its card", async () => {
    await seedTeam();
    const html = await page();
    const lists = startTags(html, "ul").filter((tag) => attribute(tag, "data-slot") === "list");
    const titleId = titleIdOf(html, "Members");

    expect(titleId).toBeTruthy();
    expect(lists.map((list) => attribute(list, "aria-labelledby"))).toEqual([titleId]);
  });

  it("gives the owner the invitation button, as the one main action of the header, and the zone that deletes the workspace", async () => {
    await seedTeam();
    const html = await page();
    const header = html.slice(html.indexOf('data-slot="page-header-actions"'), html.indexOf('data-slot="tab-links"'));

    expect(textOf(header)).toContain("Invite member");
    expect(elements(html, "button").filter((button) => textOf(button) === "Invite member")).toHaveLength(1);
    expect(textOf(html)).toContain("Delete workspace");
    // Their own row has no menu: the owner is never touched, and nobody acts on themselves
    expect(startTags(html, "button").map((tag) => attribute(tag, "aria-label")).filter(Boolean)).toEqual([
      "Actions for Adam Dupont",
      "Actions for Mia Martin",
    ]);
  });

  it("gives an admin the invitation, the menus of the members and of their own row, and not the zone that deletes the workspace", async () => {
    await seedTeam();
    signIn("admin");
    // The admin of the session is u-admin's row: they are the viewer
    session.requireWorkspace.mockResolvedValue({
      user: { id: "u-admin", name: "Adam Dupont", email: "adam@example.com", image: null, isPlatformAdmin: false },
      workspace: { id: ORG, name: "Acme", slug: "acme", role: "admin" },
      workspaces: [],
    });
    const html = await page();

    expect(textOf(html)).toContain("Invite member");
    // Their own row offers to leave
    expect(startTags(html, "button").map((tag) => attribute(tag, "aria-label")).filter(Boolean)).toEqual([
      "Actions for Adam Dupont",
      "Actions for Mia Martin",
    ]);
    expect(textOf(html)).not.toContain("Delete workspace");
    expect(html).not.toContain("bg-destructive");
  });

  it("gives a plain member the list and the way to leave, on their own row: no invitation, no other menu, no deletion", async () => {
    await seedTeam();
    session.requireWorkspace.mockResolvedValue({
      user: { id: "u-member", name: "Mia Martin", email: "mia@example.com", image: null, isPlatformAdmin: false },
      workspace: { id: ORG, name: "Acme", slug: "acme", role: "member" },
      workspaces: [],
    });
    const html = await page();

    expect(rowsOf(html)).toHaveLength(3);
    expect(html).not.toContain('data-slot="page-header-actions"');
    expect(textOf(html)).not.toContain("Invite member");
    expect(textOf(html)).not.toContain("Delete workspace");
    expect(startTags(html, "button").map((tag) => attribute(tag, "aria-label")).filter(Boolean)).toEqual(["Actions for Mia Martin"]);
    // Whatever the page hides, the roles still read in words
    expect(textOf(html)).toContain("Owner");
  });

  it("asks the workspace to be typed to delete it: it hands the name of the workspace of the session, and its id", async () => {
    await seedTeam();
    const tree = await TeamSettingsPage(params());
    const { DeleteWorkspaceZone } = await import("@/features/auth/organization/components/delete-workspace-zone");

    expect(findAll(tree, DeleteWorkspaceZone).map(({ props }) => props)).toEqual([{ orgId: ORG, name: "Acme" }]);
  });

  it("titles the tab through the shell, in the language of the page", async () => {
    expect((await teamMetadata(params("en"))).title).toEqual({ absolute: "Team · Acme — SaaS Boilerplate" });
    expect((await teamMetadata(params("fr"))).title).toEqual({ absolute: "Équipe · Acme — SaaS Boilerplate" });
  });

  it("speaks French, with the plural of French", async () => {
    await seedTeam();
    intl.locale = "fr";
    const html = await page("fr");

    expect(headings(html)).toEqual({ h1: ["Équipe"], h2: ["Membres"] });
    expect(contextOf(html)).toBe("3 membres");
    expect(textOf(html)).toContain("Inviter un membre");
    expect(textOf(html)).toContain("Supprimer l'espace");
  });
});

describe("the notifications page", () => {
  const page = (locale: "en" | "fr" = "en") => draw(NotificationsSettingsPage(params(locale)), locale);

  async function seedList(unread: number, read = 0) {
    const base = Date.parse("2026-11-03T12:00:00.000Z");
    for (let index = 0; index < unread + read; index += 1) {
      await seedNotification(ME, {
        id: `n-${String(index).padStart(3, "0")}`,
        title: `Notification ${index}`,
        read: index >= unread,
        createdAt: new Date(base - index * 60_000),
      });
    }
  }

  it("heads the page with a bell, the title and how many are unread, and puts the tabs under it", async () => {
    await seedList(2, 1);
    const html = await page();

    expect(headings(html).h1).toEqual(["Notifications"]);
    expect(contextOf(html)).toBe("2 unread notifications");
    expect(html).toContain('data-slot="icon-tile"');
    expect(html).toContain('data-slot="tab-links"');
  });

  it("says one unread in the singular, and none in words", async () => {
    await seedList(1);
    expect(contextOf(await page())).toBe("1 unread notification");

    await testDb.delete(notification);
    await seedList(0, 2);
    expect(contextOf(await page())).toBe("No unread notifications");
  });

  it("offers one button, Mark all as read, as the main action of the header, while something is unread", async () => {
    await seedList(2, 1);
    const html = await page();
    const header = html.slice(html.indexOf('data-slot="page-header-actions"'), html.indexOf('data-slot="tab-links"'));

    expect(textOf(header)).toContain("Mark all as read");
    expect(elements(html, "button").filter((button) => textOf(button) === "Mark all as read")).toHaveLength(1);
  });

  it("offers it no more once everything is read", async () => {
    await seedList(0, 2);
    const html = await page();

    expect(html).not.toContain('data-slot="page-header-actions"');
    expect(textOf(html)).not.toContain("Mark all as read");
    // The list is still there, read
    expect(rowsOf(html)).toHaveLength(2);
  });

  it("lists the notifications of the person, newest first, in a card titled by a level-two heading, and none of anyone else's", async () => {
    await seedList(1, 1);
    await seedUser("u-other", { email: "other@test.com" });
    await seedNotification("u-other", { id: "n-other", title: "Not yours", createdAt: new Date("2026-11-04T00:00:00.000Z") });
    const html = await page();

    expect(headings(html).h2).toEqual(["Latest notifications"]);
    expect(rowsOf(html).map((row) => /Notification \d/.exec(textOf(row))?.[0])).toEqual(["Notification 0", "Notification 1"]);
    expect(textOf(html)).not.toContain("Not yours");
  });

  it("lists the latest fifty and counts every unread one, the ones that are not listed too", async () => {
    await seedList(60);
    const html = await page();

    expect(rowsOf(html)).toHaveLength(50);
    expect(contextOf(html)).toBe("60 unread notifications");
    expect(textOf(html)).toContain("Notification 0");
    expect(textOf(html)).not.toContain("Notification 50");
  });

  // The workspace of a notification is what following it opens first, and its values what its words name
  it("gives the list the dates as ISO strings, the workspace and the values of each, and nothing of the row that the person does not read", async () => {
    await seedList(1);
    const tree = await NotificationsSettingsPage(params());
    const [list] = findAll(tree, NotificationList);

    expect(list?.props.notifications).toEqual([
      {
        id: "n-000",
        title: "Notification 0",
        body: "This is a test notification",
        read: false,
        type: "info",
        values: null,
        link: null,
        organizationId: null,
        createdAt: "2026-11-03T12:00:00.000Z",
      },
    ]);
  });

  it("says that there is nothing, with an empty state under a level-two heading, and no card, no button", async () => {
    const html = await page();

    expect(html).toContain('data-slot="empty-state"');
    expect(headings(html).h2).toEqual(["No notifications"]);
    expect(textOf(html)).toContain("New activity will show up here.");
    expect(html).not.toContain('data-slot="card"');
    expect(elements(html, "button")).toEqual([]);
    expect(contextOf(html)).toBe("No unread notifications");
  });

  it("titles the tab through the shell, in the language of the page", async () => {
    expect((await notificationsMetadata(params("en"))).title).toEqual({ absolute: "Notifications · Acme — SaaS Boilerplate" });
    expect((await notificationsMetadata(params("fr"))).title).toEqual({ absolute: "Notifications · Acme — SaaS Boilerplate" });
  });

  it("speaks French, with the plural of French", async () => {
    await seedList(2);
    intl.locale = "fr";
    const html = await page("fr");

    expect(contextOf(html)).toBe("2 notifications non lues");
    expect(headings(html).h2).toEqual(["Dernières notifications"]);
    expect(textOf(html)).toContain("Tout marquer comme lu");
  });
});
