import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminAuditPage, {
  generateMetadata as auditMetadata,
} from "@/app/[locale]/(app)/(shell)/admin/audit/page";
import { appPageMetadata } from "@/features/app-shell";
import { AUDIT_LOG_LIMIT } from "@/features/audit/queries";
import { auditLog } from "@/models";
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
import { seedOrg } from "../helpers/seed";
import { testDb } from "../setup";

// The audit log page, with the real guards, against the in-memory database. What
// the admin pages share is in tests/helpers/admin-pages.tsx.

vi.mock("@/features/auth/guards", async (importOriginal) => importOriginal());
vi.mock("@/features/auth/auth", async () => (await import("../helpers/admin-pages")).authMock());
vi.mock("@/features/app-shell", async () => (await import("../helpers/admin-pages")).appShellMock());
vi.mock("next-intl/server", async () => (await import("../helpers/admin-pages")).intlServerMock());
vi.mock("@/shared/lib/i18n-navigation", async () => (await import("../helpers/admin-pages")).navigationMock());

beforeEach(async () => {
  vi.mocked(appPageMetadata).mockClear();
  resetAdminPage();
  await testDb.delete(auditLog);
  await clearPeople();
});

describeAdminPage({
  name: "audit",
  draw: (locale) => AdminAuditPage(params(locale)),
  metadata: (locale) => auditMetadata(params(locale)),
  title: { en: "Audit Log", fr: "Journal d'audit" },
  appPageMetadata,
});

describe("the data of the audit log page", () => {
  // The surface of a data table is a card: a card round it would be a card in a card.
  it("sits in one card: the surface of its table", async () => {
    const html = await draw(AdminAuditPage(params()));

    expect(html.match(/data-slot="data-table-surface"/g)).toHaveLength(1);
    expect(html).not.toContain('data-slot="card"');
  });
});

describe("the audit log page", () => {
  async function seedAuditLog(count: number) {
    await seedOrg("audited");
    const now = Date.now();
    await testDb.insert(auditLog).values(
      rows(count, (index) => ({
        id: `event-${index}`,
        orgId: "audited",
        actorId: null,
        action: "project.created",
        resourceType: "project",
        resourceId: `project-${index}`,
        createdAt: new Date(now - index * MINUTE),
      })),
    );
  }

  // Its list stops at 50 and the log has no end: a count would be the length of the list, and
  // "view all system activity" would not be true of it: the header has no line under its title.
  it("gives no line under its title: its list stops at 50, and the log grows without end", async () => {
    await seedAuditLog(60);
    const html = await draw(AdminAuditPage(params()));

    expect(resultsOf(html)).toBe("50 results");
    expect(contextOf(html)).toBeNull();
  });

  // The log has no total to tell: a list that holds exactly the 50 it stops at says it may be the latest of more
  it("says in the card of its table that it shows the latest 50, when it holds 50", async () => {
    await seedAuditLog(AUDIT_LOG_LIMIT);
    const html = await draw(AdminAuditPage(params()));

    expect(noteOf(html)).toBe("This list shows the 50 latest events. Search and sorting cover these only.");
    expect(html.indexOf('data-slot="data-table-surface"')).toBeLessThan(html.indexOf('data-slot="data-table-note"'));
    expect(html.indexOf('data-slot="data-table-note"')).toBeLessThan(html.indexOf("<table"));
  });

  it("says it when the log holds more than that, and says nothing of the sort with one less", async () => {
    await seedAuditLog(AUDIT_LOG_LIMIT + 10);
    expect(noteOf(await draw(AdminAuditPage(params())))).toContain("the 50 latest events");

    await testDb.delete(auditLog);
    await seedAuditLog(AUDIT_LOG_LIMIT - 1);
    expect(noteOf(await draw(AdminAuditPage(params())))).toBeNull();
  });

  it("says it in French", async () => {
    intl.locale = "fr";
    await seedAuditLog(AUDIT_LOG_LIMIT);

    expect(noteOf(await draw(AdminAuditPage(params("fr")), "fr"))).toBe(
      "Cette liste montre les 50 événements les plus récents. La recherche et le tri ne portent que sur eux.",
    );
  });
});

// The deletion of a workspace is kept as an entry of the platform: its workspace
// is gone, and the page names it by the name the entry holds.
describe("the entries of the platform", () => {
  beforeEach(async () => {
    await seedOrg("audited");
    await testDb.insert(auditLog).values([
      { id: "event-workspace", orgId: "audited", actorId: null, action: "project.created", resourceType: "project", resourceId: "project-1", createdAt: new Date(Date.now() - MINUTE) },
      { id: "event-platform", orgId: null, actorId: null, action: "organization.deleted", resourceType: "organization", resourceId: "org-gone", metadata: { name: "Northwind" }, createdAt: new Date() },
    ]);
  });

  it("lists the deletion of a workspace, named, beside the events of a workspace, named by its id", async () => {
    const html = await draw(AdminAuditPage(params()));

    expect(html).toContain("organization.deleted");
    expect(html).toContain("Northwind (deleted)");
    expect(html).toContain("audited");
    expect(html).toContain(">Workspace<");
  });

  it("says it in French", async () => {
    intl.locale = "fr";
    const html = await draw(AdminAuditPage(params("fr")), "fr");

    expect(html).toContain("Northwind (supprimé)");
    expect(html).toContain(">Espace<");
  });
});
