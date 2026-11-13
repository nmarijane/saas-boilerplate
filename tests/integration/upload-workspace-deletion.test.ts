import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteOrganization } from "@/features/auth/organization/actions";
import { FEATURES } from "@/features/registry";
import { uploadShell } from "@/features/upload/shell";
import { organization, organizationMember, upload, user } from "@/models";
import { seedOrg, seedOrgMember, seedUpload, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

/**
 * What the uploads do when a workspace is deleted, with the features of the
 * registry: its stored files are deleted, object and row, before the rows of
 * the workspace go, and a storage that fails keeps the workspace. The storage is
 * faked at its adapter: each call records whether the workspace still existed
 * when it was made.
 */

const { storage, storageDelete } = vi.hoisted(() => ({ storage: { failing: false }, storageDelete: vi.fn() }));
vi.mock("@/features/upload/storage/adapter", () => ({
  getStorageAdapter: async () => ({ put: vi.fn(), get: vi.fn(), delete: storageDelete }),
}));
// The registry reaches the client components of the features, and the navigation
// of next-intl they import is replaced (no Next router runs in a test)
vi.mock("@/shared/lib/i18n-navigation", () => ({
  Link: () => null,
  getPathname: () => "",
  redirect: () => undefined,
  usePathname: () => "",
  useRouter: () => ({}),
}));

const OWNER = "test-user-1"; // the person the mocked guard signs in
const ORG = "upload-deletion-org";
const OTHER = "upload-deletion-other-org";

async function workspaceExists() {
  return (await testDb.select({ id: organization.id }).from(organization).where(eq(organization.id, ORG))).length === 1;
}

const deleted: string[] = [];

beforeEach(async () => {
  vi.clearAllMocks();
  deleted.length = 0;
  storage.failing = false;
  storageDelete.mockImplementation(async (key: string) => {
    if (storage.failing) {
      throw new Error("the storage did not answer");
    }
    deleted.push(`${key}:${(await workspaceExists()) ? "kept" : "gone"}`);
  });

  await testDb.delete(upload);
  await testDb.delete(organizationMember);
  await testDb.delete(organization);
  await testDb.delete(user);
  await seedUser(OWNER);
  await seedOrg(ORG, { name: "Northwind" });
  await seedOrg(OTHER, { name: "Acme" });
  await seedOrgMember(OWNER, ORG, "owner");
  await seedUpload(OWNER, { id: "file-1", organizationId: ORG, storageKey: `${ORG}/file-1-notes.pdf` });
  await seedUpload(OWNER, { id: "file-2", organizationId: ORG, storageKey: `${ORG}/file-2-logo.png` });
  await seedUpload(OWNER, { id: "file-other", organizationId: OTHER, storageKey: `${OTHER}/file-other.png` });
});

describe("deleting a workspace that has files", () => {
  it("deletes each stored file and its row while the workspace is still there, and the files of no other", async () => {
    expect(await deleteOrganization({ orgId: ORG })).toEqual({ success: true, data: { deleted: true } });

    expect(deleted).toEqual([`${ORG}/file-1-notes.pdf:kept`, `${ORG}/file-2-logo.png:kept`]);
    expect(await workspaceExists()).toBe(false);
    expect(await testDb.select({ id: upload.id }).from(upload)).toEqual([{ id: "file-other" }]);
  });

  it("keeps the workspace and the rows of its files when the storage refuses, and says why", async () => {
    storage.failing = true;

    expect(await deleteOrganization({ orgId: ORG })).toEqual({
      success: true,
      data: { deleted: false, messageKey: "upload.deleteWorkspaceFailed", done: [] },
    });

    expect(await workspaceExists()).toBe(true);
    expect(await testDb.select({ id: upload.id }).from(upload).where(eq(upload.organizationId, ORG))).toHaveLength(2);
  });

  it("is the uploads' own cleanup, declared in their shell.ts, after billing's: it goes with its line of the registry", () => {
    expect(uploadShell.onWorkspaceDelete).toMatchObject({ order: 50, failureKey: "upload.deleteWorkspaceFailed" });
    expect(FEATURES).toContain(uploadShell);
  });
});
