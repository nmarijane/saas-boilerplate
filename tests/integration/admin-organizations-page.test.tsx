import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminOrganizationsPage, {
  generateMetadata as organizationsMetadata,
} from "@/app/[locale]/(app)/(shell)/admin/organizations/page";
import { AdminOrgsTable } from "@/features/admin/components/admin-orgs-table";
import { appPageMetadata } from "@/features/app-shell";
import { organization } from "@/models";
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
  seedOrganizations,
} from "../helpers/admin-pages";
import { testDb } from "../setup";

// The organizations page, with the real guards, against the in-memory database.
// What the admin pages share is in tests/helpers/admin-pages.tsx.

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
  name: "organizations",
  draw: (locale) => AdminOrganizationsPage(params(locale)),
  metadata: (locale) => organizationsMetadata(params(locale)),
  title: { en: "Organizations", fr: "Organisations" },
  appPageMetadata,
});

describe("the data of the organizations page", () => {
  // The surface of a data table is a card: a card round it would be a card in a card.
  it("sits in one card: the surface of its table", async () => {
    const html = await draw(AdminOrganizationsPage(params()));

    expect(html.match(/data-slot="data-table-surface"/g)).toHaveLength(1);
    expect(html).not.toContain('data-slot="card"');
  });
});

describe("the organizations page", () => {
  it("counts the organizations in its header", async () => {
    await seedOrganizations(2);
    const html = await draw(AdminOrganizationsPage(params()));

    expect(contextOf(html)).toBe("2 organizations");
    expect(rowsOf(html)).toHaveLength(2);
  });

  it("counts every organization in its header, not the 100 its table stops at", async () => {
    await seedOrganizations(101);
    const html = await draw(AdminOrganizationsPage(params()));

    expect(contextOf(html)).toBe("101 organizations");
    expect(resultsOf(html)).toBe("100 results");
  });

  it("counts in French", async () => {
    intl.locale = "fr";
    await seedOrganizations(2);

    expect(contextOf(await draw(AdminOrganizationsPage(params("fr")), "fr"))).toBe("2 organisations");
  });
});

// The table is handed the newest 100, and its search and its sorting cover those only:
// when there are more, its card says so.
describe("the organizations page, when its table stops short", () => {
  it("says 100 out of 101 in the card of its table", async () => {
    await seedOrganizations(101);
    const html = await draw(AdminOrganizationsPage(params()));

    expect(noteOf(html)).toBe(
      "This list shows the 100 newest organizations out of 101. Search and sorting cover these only.",
    );
  });

  it("says nothing of the sort while the table holds all of them", async () => {
    await seedOrganizations(3);
    expect(noteOf(await draw(AdminOrganizationsPage(params())))).toBeNull();

    await testDb.delete(organization);
    await seedOrganizations(100);
    expect(noteOf(await draw(AdminOrganizationsPage(params())))).toBeNull();
  });

  it("says it in French", async () => {
    intl.locale = "fr";
    await seedOrganizations(101);

    expect(noteOf(await draw(AdminOrganizationsPage(params("fr")), "fr"))).toBe(
      "Cette liste montre les 100 organisations les plus récentes sur 101. La recherche et le tri ne portent que sur elles.",
    );
  });

  it("leaves out the oldest, and hands the table the newest first", async () => {
    await seedOrganizations(101, MINUTE);
    const tree = await AdminOrganizationsPage(params());
    const [table] = findAll(tree, AdminOrgsTable);
    const ids = (table?.props.organizations as { id: string }[]).map((company) => company.id);

    expect(ids).toHaveLength(100);
    expect(ids[0]).toBe("company-100");
    expect(ids).not.toContain("company-0");
  });
});
