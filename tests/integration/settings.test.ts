import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAccount, updateProfile } from "@/features/settings/actions";
import { organizationMember } from "@/models/organization";
import { user } from "@/models/user";
import { seedOrg, seedOrgMember, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

describe("updateProfile", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await testDb.delete(user).where(eq(user.id, "test-user-1"));
    await seedUser("test-user-1", { name: "Original Name" });
  });

  it("updates user name", async () => {
    await updateProfile({ name: "New Name" });

    const users = await testDb
      .select()
      .from(user)
      .where(eq(user.id, "test-user-1"));
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe("New Name");
  });

  it("updates user name and image", async () => {
    await updateProfile({ name: "With Image", image: "https://example.com/avatar.png" });

    const users = await testDb
      .select()
      .from(user)
      .where(eq(user.id, "test-user-1"));
    expect(users[0].name).toBe("With Image");
    expect(users[0].image).toBe("https://example.com/avatar.png");
  });

  it("sets image to null when empty string", async () => {
    await updateProfile({ name: "No Image", image: "" });

    const users = await testDb
      .select()
      .from(user)
      .where(eq(user.id, "test-user-1"));
    expect(users[0].image).toBeNull();
  });

  it("rejects empty name", async () => {
    const result = await updateProfile({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.validationErrors?.name).toBeDefined();
    }
  });

  it("rejects name exceeding max length", async () => {
    const result = await updateProfile({ name: "x".repeat(101) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.validationErrors?.name).toBeDefined();
    }
  });
});

describe("deleteAccount", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Clean up any leftover data from previous tests
    await testDb.delete(organizationMember);
    await testDb.delete(user).where(eq(user.id, "test-user-1"));
    await seedUser("test-user-1", { name: "Delete Me" });
  });

  it("deletes a user with no orgs", async () => {
    await deleteAccount();

    const users = await testDb
      .select()
      .from(user)
      .where(eq(user.id, "test-user-1"));
    expect(users).toHaveLength(0);
  });

  it("deletes user and transfers ownership when org has other members", async () => {
    const orgId = "set-org-transfer";
    const otherUserId = "set-other-user";

    await seedUser(otherUserId, { email: "other@test.com" });
    await seedOrg(orgId);
    await seedOrgMember("test-user-1", orgId, "owner");
    await seedOrgMember(otherUserId, orgId, "admin");

    await deleteAccount();

    // User should be deleted
    const users = await testDb
      .select()
      .from(user)
      .where(eq(user.id, "test-user-1"));
    expect(users).toHaveLength(0);

    // Other member should now be owner
    const members = await testDb
      .select()
      .from(organizationMember)
      .where(eq(organizationMember.organizationId, orgId));
    expect(members).toHaveLength(1);
    expect(members[0].userId).toBe(otherUserId);
    expect(members[0].role).toBe("owner");
  });
});
