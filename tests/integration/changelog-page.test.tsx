import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminChangelogPage, {
  generateMetadata as changelogMetadata,
} from "@/app/[locale]/(app)/(shell)/admin/changelog/page";
import { appPageMetadata } from "@/features/app-shell";
import { CHANGELOG_LIMIT } from "@/features/changelog/queries";
import { changelogEntry } from "@/models";
import {
  clearPeople,
  contextOf,
  describeAdminPage,
  draw,
  intl,
  MINUTE,
  noteOf,
  params,
  resetAdminPage,
  resultsOf,
  rows,
} from "../helpers/admin-pages";
import { testDb } from "../setup";

// The changelog page, with the real guards, against the in-memory database. What
// the admin pages share is in tests/helpers/admin-pages.tsx.

vi.mock("@/features/auth/guards", async (importOriginal) => importOriginal());
vi.mock("@/features/auth/auth", async () => (await import("../helpers/admin-pages")).authMock());
vi.mock("@/features/app-shell", async () => (await import("../helpers/admin-pages")).appShellMock());
vi.mock("next-intl/server", async () => (await import("../helpers/admin-pages")).intlServerMock());
vi.mock("@/shared/lib/i18n-navigation", async () => (await import("../helpers/admin-pages")).navigationMock());

beforeEach(async () => {
  vi.mocked(appPageMetadata).mockClear();
  resetAdminPage();
  await testDb.delete(changelogEntry);
  await clearPeople();
});

describeAdminPage({
  name: "changelog",
  draw: (locale) => AdminChangelogPage(params(locale)),
  metadata: (locale) => changelogMetadata(params(locale)),
  title: { en: "Changelog", fr: "Changelog" },
  appPageMetadata,
});

describe("the data of the changelog page", () => {
  // The surface of a data table is a card: a card round it would be a card in a card.
  it("sits in one card: the surface of its table", async () => {
    const html = await draw(AdminChangelogPage(params()));

    expect(html.match(/data-slot="data-table-surface"/g)).toHaveLength(1);
    expect(html).not.toContain('data-slot="card"');
  });
});

describe("the changelog page", () => {
  async function seedEntries(count: number) {
    const now = Date.now();
    await testDb.insert(changelogEntry).values(
      rows(count, (index) => ({
        id: `entry-${index}`,
        title: `Release ${index}`,
        content: "What changed",
        version: `1.${index}.0`,
        publishedAt: new Date(now - index * MINUTE),
        createdAt: new Date(now),
      })),
    );
  }

  it("gives no count: its list stops at 50", async () => {
    await seedEntries(60);
    const html = await draw(AdminChangelogPage(params()));

    expect(resultsOf(html)).toBe("50 results");
    expect(contextOf(html)).toBeNull();
  });

  // The changelog has no total to tell either: a list that holds exactly the 50 it stops at says it may be the latest of more
  it("says in the card of its table that it shows the latest 50, when it holds 50", async () => {
    await seedEntries(CHANGELOG_LIMIT);
    const html = await draw(AdminChangelogPage(params()));

    expect(noteOf(html)).toBe("This list shows the 50 latest entries. Search and sorting cover these only.");
    expect(html.indexOf('data-slot="data-table-surface"')).toBeLessThan(html.indexOf('data-slot="data-table-note"'));
    expect(html.indexOf('data-slot="data-table-note"')).toBeLessThan(html.indexOf("<table"));
  });

  it("says it when there are more than that, and says nothing of the sort with one less", async () => {
    await seedEntries(CHANGELOG_LIMIT + 10);
    expect(noteOf(await draw(AdminChangelogPage(params())))).toContain("the 50 latest entries");

    await testDb.delete(changelogEntry);
    await seedEntries(CHANGELOG_LIMIT - 1);
    expect(noteOf(await draw(AdminChangelogPage(params())))).toBeNull();
  });

  it("says it in French", async () => {
    intl.locale = "fr";
    await seedEntries(CHANGELOG_LIMIT);

    expect(noteOf(await draw(AdminChangelogPage(params("fr")), "fr"))).toBe(
      "Cette liste montre les 50 entrées les plus récentes. La recherche et le tri ne portent que sur elles.",
    );
  });
});
