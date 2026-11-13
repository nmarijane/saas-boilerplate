import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminMetricsPage, {
  generateMetadata as metricsMetadata,
} from "@/app/[locale]/(app)/(shell)/admin/metrics/page";
import { getAdminMetrics } from "@/features/admin/queries";
import { appPageMetadata } from "@/features/app-shell";
import { plan, subscription } from "@/models";
import {
  clearPeople,
  contextOf,
  describeAdminPage,
  draw,
  intl,
  params,
  resetAdminPage,
  seedOrganizations,
  seedUsers,
} from "../helpers/admin-pages";
import { textOf } from "../helpers/html";
import { seedOrg, seedPlan, seedSubscription } from "../helpers/seed";
import { testDb } from "../setup";

// The metrics page, with the real guards, against the in-memory database. What
// the admin pages share is in tests/helpers/admin-pages.tsx. Each figure is read
// by its label: the revenue is billing's, and goes with it.

vi.mock("@/features/auth/guards", async (importOriginal) => importOriginal());
vi.mock("@/features/auth/auth", async () => (await import("../helpers/admin-pages")).authMock());
vi.mock("@/features/app-shell", async () => (await import("../helpers/admin-pages")).appShellMock());
vi.mock("next-intl/server", async () => (await import("../helpers/admin-pages")).intlServerMock());
vi.mock("@/shared/lib/i18n-navigation", async () => (await import("../helpers/admin-pages")).navigationMock());

beforeEach(async () => {
  vi.mocked(appPageMetadata).mockClear();
  resetAdminPage();
  await testDb.delete(subscription);
  await testDb.delete(plan);
  await clearPeople();
});

describeAdminPage({
  name: "metrics",
  draw: (locale) => AdminMetricsPage(params(locale)),
  metadata: (locale) => metricsMetadata(params(locale)),
  title: { en: "Metrics", fr: "Métriques" },
  appPageMetadata,
});

describe("the metrics page", () => {
  it("has no line under its title: the page is made of counts", async () => {
    await seedUsers(2);
    const html = await draw(AdminMetricsPage(params()));

    expect(contextOf(html)).toBeNull();
  });

  it("gives the figure of the users by its label, past the limit of their list", async () => {
    await seedUsers(101);
    const html = textOf(await draw(AdminMetricsPage(params())));

    expect(html).toContain("Total Users101");
  });

  it("gives the figure of the organizations by its label, past the limit of their list", async () => {
    await seedOrganizations(2);
    const html = textOf(await draw(AdminMetricsPage(params())));

    expect(html).toContain("Total Organizations2");
  });

  // The counts go through the formatter of the page, as the revenue does: a bare 12345 is read as it is written, and
  // the thousands are not grouped the way the language groups them
  it("groups the thousands of the counts the way the language of the page does", async () => {
    await seedUsers(1234);
    await seedOrganizations(1500);
    const english = textOf(await draw(AdminMetricsPage(params())));
    intl.locale = "fr";
    // The thousands are separated by spaces that do not break: read as spaces
    const french = textOf(await draw(AdminMetricsPage(params("fr")), "fr")).replaceAll(/\s/g, " ");

    expect(english).toContain("Total Users1,234");
    expect(english).toContain("Total Organizations1,500");
    expect(french).toContain("Utilisateurs totaux1 234");
    expect(french).toContain("Organisations totales1 500");
  });

  it("shows the figures the query gives", async () => {
    await seedUsers(5);
    await seedOrganizations(3);
    const { totalUsers, totalOrganizations } = await getAdminMetrics();
    const html = textOf(await draw(AdminMetricsPage(params())));

    expect(html).toContain(`Total Users${totalUsers}`);
    expect(html).toContain(`Total Organizations${totalOrganizations}`);
  });
});

// The revenue is billing's: it reads the plans and their subscriptions, and goes with them when billing is
// removed (docs/SETUP.md, Phase 3), and so do these tests, which are the only ones to seed a plan.
describe("the revenue of the metrics page", () => {
  /** Active subscriptions of these plans' prices, in US cents, one organization each. */
  async function earn(...prices: number[]) {
    for (const [index, price] of prices.entries()) {
      await seedOrg(`paying-${index}`, { slug: `paying-${index}` });
      await seedPlan(`plan-${index}`, { name: `Plan ${index}`, price });
      await seedSubscription(`paying-${index}`, { id: `sub-${index}`, planId: `plan-${index}`, status: "active" });
    }
  }

  it("gives the revenue figure by its label, in dollars, whatever the subscriptions", async () => {
    const html = textOf(await draw(AdminMetricsPage(params())));

    expect(html).toContain("MRR$0.00");
  });

  it("tells the monthly revenue of the active subscriptions, from prices in US cents, in the format of the language of the page", async () => {
    await earn(2900, 9900);
    const english = textOf(await draw(AdminMetricsPage(params())));
    intl.locale = "fr";
    // The thousands and the currency are separated by spaces that do not break: read as spaces
    const french = textOf(await draw(AdminMetricsPage(params("fr")), "fr")).replaceAll(/\s/g, " ");

    expect(english).toContain("MRR$128.00");
    expect(french).toContain("MRR128,00 $US");
  });

  it("groups the thousands the way the language of the page does", async () => {
    await earn(123_456);
    const english = textOf(await draw(AdminMetricsPage(params())));
    intl.locale = "fr";
    const french = textOf(await draw(AdminMetricsPage(params("fr")), "fr")).replaceAll(/\s/g, " ");

    expect(english).toContain("MRR$1,234.56");
    expect(french).toContain("MRR1 234,56 $US");
  });
});
