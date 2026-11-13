import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminUsersPage, {
  generateMetadata as usersMetadata,
} from "@/app/[locale]/(app)/(shell)/admin/users/page";
import { AdminUsersTable } from "@/features/admin/components/admin-users-table";
import { appPageMetadata } from "@/features/app-shell";
import { user } from "@/models";
import {
  clearPeople,
  contextOf,
  describeAdminPage,
  draw,
  findAll,
  intl,
  MINUTE,
  noteOf,
  params,
  resetAdminPage,
  resultsOf,
  rowsOf,
  seedUsers,
} from "../helpers/admin-pages";
import {
  decodedClassesOf,
  elements,
  startTags,
  textOf,
} from "../helpers/html";
import { testDb } from "../setup";

// The users page, with the real guards, against the in-memory database. What the
// admin pages share (the session, the translator, the stand-ins below) is in
// tests/helpers/admin-pages.tsx.

vi.mock("@/features/auth/guards", async (importOriginal) => importOriginal());
vi.mock("@/features/auth/auth", async () => (await import("../helpers/admin-pages")).authMock());
vi.mock("@/features/app-shell", async () => (await import("../helpers/admin-pages")).appShellMock());
vi.mock("next-intl/server", async () => (await import("../helpers/admin-pages")).intlServerMock());
vi.mock("@/shared/lib/i18n-navigation", async () => (await import("../helpers/admin-pages")).navigationMock());

beforeEach(async () => {
  vi.mocked(appPageMetadata).mockClear();
  resetAdminPage();
  await clearPeople();
});

describeAdminPage({
  name: "users",
  draw: (locale) => AdminUsersPage(params(locale)),
  metadata: (locale) => usersMetadata(params(locale)),
  title: { en: "Users", fr: "Utilisateurs" },
  appPageMetadata,
});

describe("the data of the users page", () => {
  // The surface of a data table is a card: a card round it would be a card in a card.
  it("sits in one card: the surface of its table", async () => {
    const html = await draw(AdminUsersPage(params()));

    expect(html.match(/data-slot="data-table-surface"/g)).toHaveLength(1);
    expect(html).not.toContain('data-slot="card"');
  });
});

describe("the users page", () => {
  it("counts the users in its header, and lists them in a table", async () => {
    await seedUsers(3);
    const html = await draw(AdminUsersPage(params()));

    expect(contextOf(html)).toBe("3 users");
    expect(textOf(html)).toContain("Person 1");
    expect(rowsOf(html)).toHaveLength(3);
  });

  it("counts every user in its header, not the 100 its table stops at", async () => {
    await seedUsers(101);
    const html = await draw(AdminUsersPage(params()));

    expect(contextOf(html)).toBe("101 users");
    expect(resultsOf(html)).toBe("100 results");
  });

  it("says one user in the singular, and none in the plural", async () => {
    await seedUsers(1);
    expect(contextOf(await draw(AdminUsersPage(params())))).toBe("1 user");

    await testDb.delete(user);
    expect(contextOf(await draw(AdminUsersPage(params())))).toBe("0 users");
  });

  it("counts in French, with the French plural", async () => {
    intl.locale = "fr";
    await seedUsers(2);
    expect(contextOf(await draw(AdminUsersPage(params("fr")), "fr"))).toBe("2 utilisateurs");

    await testDb.delete(user);
    await seedUsers(1);
    expect(contextOf(await draw(AdminUsersPage(params("fr")), "fr"))).toBe("1 utilisateur");
  });

  it("tells an admin from a user by a quiet badge: neutral for the admin, an outline for the user", async () => {
    await seedUsers(2);
    const html = await draw(AdminUsersPage(params()));
    const badges = elements(html, "span").filter((span) => span.includes('data-slot="badge"'));
    const classesOfBadge = (word: string) =>
      decodedClassesOf(startTags(badges.find((badge) => textOf(badge) === word) ?? "", "span")[0] ?? "");

    expect(classesOfBadge("Admin")).toContain("bg-secondary");
    expect(classesOfBadge("Admin")).not.toContain("bg-brand");
    expect(classesOfBadge("User")).toContain("border-border");
    expect(classesOfBadge("User")).not.toContain("bg-secondary");
    expect(classesOfBadge("User")).not.toContain("bg-brand");
  });
});

// The table is handed the newest 100, and its search and its sorting cover those only:
// when there are more, its card says so, or a search that finds no one would read
// as "no such person".
describe("the users page, when its table stops short", () => {
  it("says 100 out of 101 in the card of its table", async () => {
    await seedUsers(101);
    const html = await draw(AdminUsersPage(params()));

    expect(noteOf(html)).toBe("This list shows the 100 newest users out of 101. Search and sorting cover these only.");
  });

  it("says it above the table, in the card", async () => {
    await seedUsers(101);
    const html = await draw(AdminUsersPage(params()));

    expect(html.indexOf('data-slot="data-table-surface"')).toBeLessThan(html.indexOf('data-slot="data-table-note"'));
    expect(html.indexOf('data-slot="data-table-note"')).toBeLessThan(html.indexOf("<table"));
  });

  it("says nothing of the sort while the table holds everyone", async () => {
    await seedUsers(3);
    expect(noteOf(await draw(AdminUsersPage(params())))).toBeNull();

    // Exactly 100: the list is the whole, not a part of it
    await testDb.delete(user);
    await seedUsers(100);
    expect(noteOf(await draw(AdminUsersPage(params())))).toBeNull();
  });

  it("says it in French", async () => {
    intl.locale = "fr";
    await seedUsers(101);

    expect(noteOf(await draw(AdminUsersPage(params("fr")), "fr"))).toBe(
      "Cette liste montre les 100 utilisateurs les plus récents sur 101. La recherche et le tri ne portent que sur eux.",
    );
  });

  it("leaves out the oldest, and hands the table the newest first", async () => {
    await seedUsers(101, MINUTE);
    const tree = await AdminUsersPage(params());
    const [table] = findAll(tree, AdminUsersTable);
    const ids = (table?.props.users as { id: string }[]).map((person) => person.id);

    expect(ids).toHaveLength(100);
    expect(ids[0]).toBe("person-100");
    expect(ids.at(-1)).toBe("person-1");
    expect(ids).not.toContain("person-0");
  });
});
