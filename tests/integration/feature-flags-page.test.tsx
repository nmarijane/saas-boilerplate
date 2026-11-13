import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminFeaturesPage, {
  generateMetadata as featuresMetadata,
} from "@/app/[locale]/(app)/(shell)/admin/features/page";
import { appPageMetadata } from "@/features/app-shell";
import { FlagAdminTable } from "@/features/feature-flags/components/flag-admin-table";
import { featureFlag } from "@/models";
import {
  clearPeople,
  contextOf,
  describeAdminPage,
  draw,
  findAll,
  intl,
  noteOf,
  params,
  resetAdminPage,
  rows,
  rowsOf,
} from "../helpers/admin-pages";
import { testDb } from "../setup";

// The feature flags page, with the real guards, against the in-memory database.
// What the admin pages share is in tests/helpers/admin-pages.tsx.

vi.mock("@/features/auth/guards", async (importOriginal) => importOriginal());
vi.mock("@/features/auth/auth", async () => (await import("../helpers/admin-pages")).authMock());
vi.mock("@/features/app-shell", async () => (await import("../helpers/admin-pages")).appShellMock());
vi.mock("next-intl/server", async () => (await import("../helpers/admin-pages")).intlServerMock());
vi.mock("@/shared/lib/i18n-navigation", async () => (await import("../helpers/admin-pages")).navigationMock());

beforeEach(async () => {
  vi.mocked(appPageMetadata).mockClear();
  resetAdminPage();
  await testDb.delete(featureFlag);
  await clearPeople();
});

describeAdminPage({
  name: "features",
  draw: (locale) => AdminFeaturesPage(params(locale)),
  metadata: (locale) => featuresMetadata(params(locale)),
  title: { en: "Feature Flags", fr: "Indicateurs de fonctionnalité" },
  appPageMetadata,
});

describe("the data of the feature flags page", () => {
  // The surface of a data table is a card: a card round it would be a card in a card.
  it("sits in one card: the surface of its table", async () => {
    const html = await draw(AdminFeaturesPage(params()));

    expect(html.match(/data-slot="data-table-surface"/g)).toHaveLength(1);
    expect(html).not.toContain('data-slot="card"');
  });
});

describe("the feature flags page", () => {
  async function seedFlags(count: number) {
    const now = new Date();
    await testDb.insert(featureFlag).values(
      rows(count, (index) => ({
        id: `flag-${index}`,
        key: `flag-${index}`,
        description: "A flag",
        enabled: index % 2 === 0,
        rules: [],
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  it("counts every flag in its header, the list of flags having no limit", async () => {
    await seedFlags(3);
    const html = await draw(AdminFeaturesPage(params()));

    expect(contextOf(html)).toBe("3 feature flags");
    expect(rowsOf(html)).toHaveLength(3);
  });

  it("says one flag in the singular, and counts in French", async () => {
    await seedFlags(1);
    expect(contextOf(await draw(AdminFeaturesPage(params())))).toBe("1 feature flag");

    intl.locale = "fr";
    expect(contextOf(await draw(AdminFeaturesPage(params("fr")), "fr"))).toBe("1 indicateur de fonctionnalité");
  });
});

// The flags have no limit: the table is handed every one of them, and there is nothing to say of what it leaves out.
describe("the feature flags page, which has no limit", () => {
  it("hands the table every flag, however many, and has no note to write", async () => {
    await testDb.insert(featureFlag).values(
      rows(120, (index) => ({
        id: `flag-${index}`,
        key: `flag-${String(index).padStart(3, "0")}`,
        description: "A flag",
        enabled: false,
        rules: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
    const tree = await AdminFeaturesPage(params());
    const [table] = findAll(tree, FlagAdminTable);

    expect(table?.props.flags).toHaveLength(120);
    expect(noteOf(await draw(Promise.resolve(tree)))).toBeNull();
    expect(contextOf(await draw(Promise.resolve(tree)))).toBe("120 feature flags");
  });
});
