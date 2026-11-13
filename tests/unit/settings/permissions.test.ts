import { describe, expect, it } from "vitest";
import {
  ASSIGNABLE_ROLES,
  canDeleteWorkspace,
  canManageMember,
  canManageMembers,
  DELETE_WORKSPACE_MIN_ROLE,
  isAssignableRole,
  MANAGE_MEMBERS_MIN_ROLE,
} from "@/features/auth/organization/permissions";

// What the Team page offers a role. The page only hides what a role cannot do:
// the server asks for the same roles again, which tests/integration/org-actions
// proves from the other side.

describe("who is offered the invitation and the actions of the members", () => {
  it("is the owner and the admin, and not the member", () => {
    expect(canManageMembers("owner")).toBe(true);
    expect(canManageMembers("admin")).toBe(true);
    expect(canManageMembers("member")).toBe(false);
    expect(MANAGE_MEMBERS_MIN_ROLE).toBe("admin");
  });
});

describe("who is offered the zone that deletes the workspace", () => {
  it("is the owner alone", () => {
    expect(canDeleteWorkspace("owner")).toBe(true);
    expect(canDeleteWorkspace("admin")).toBe(false);
    expect(canDeleteWorkspace("member")).toBe(false);
    expect(DELETE_WORKSPACE_MIN_ROLE).toBe("owner");
  });
});

describe("who is offered the menu of a row", () => {
  const owner = { userId: "u1", role: "owner" } as const;
  const admin = { userId: "u2", role: "admin" } as const;
  const member = { userId: "u3", role: "member" } as const;

  it("is an owner or an admin, for a member or another admin", () => {
    expect(canManageMember(owner, admin)).toBe(true);
    expect(canManageMember(owner, member)).toBe(true);
    expect(canManageMember(admin, member)).toBe(true);
    expect(canManageMember(admin, { userId: "u4", role: "admin" })).toBe(true);
  });

  it("is never for the owner: the server refuses to touch it, and an admin could take the workspace over", () => {
    expect(canManageMember(admin, owner)).toBe(false);
    expect(canManageMember(member, owner)).toBe(false);
    // Another owner, were there ever two, is as safe as the first
    expect(canManageMember(owner, { userId: "u9", role: "owner" })).toBe(false);
  });

  it("is never for yourself, whatever your role", () => {
    expect(canManageMember(owner, owner)).toBe(false);
    expect(canManageMember(admin, admin)).toBe(false);
    expect(canManageMember(member, member)).toBe(false);
  });

  it("is not for a plain member, for anyone", () => {
    expect(canManageMember(member, admin)).toBe(false);
    expect(canManageMember(member, { userId: "u5", role: "member" })).toBe(false);
  });

  it("takes a role it does not know for an ordinary member of the workspace", () => {
    expect(canManageMember(admin, { userId: "u6", role: "guest" })).toBe(true);
    expect(canManageMember(member, { userId: "u6", role: "guest" })).toBe(false);
  });
});

describe("the roles a person can be given", () => {
  it("are admin and member: the owner is made once, with the workspace", () => {
    expect(ASSIGNABLE_ROLES).toEqual(["admin", "member"]);
    expect(isAssignableRole("admin")).toBe(true);
    expect(isAssignableRole("member")).toBe(true);
    expect(isAssignableRole("owner")).toBe(false);
    expect(isAssignableRole("")).toBe(false);
    expect(isAssignableRole("Admin")).toBe(false);
  });
});
