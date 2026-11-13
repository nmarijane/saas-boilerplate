import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRole } from "@/features/auth/guards";
import { deleteProject } from "@/features/projects/actions";
import { canDeleteProject, DELETE_MIN_ROLE } from "@/features/projects/permissions";

describe("who is offered the zone that deletes a project", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockClear();
  });

  it("is the owner and the admin of the workspace, and not the member", () => {
    expect(canDeleteProject("owner")).toBe(true);
    expect(canDeleteProject("admin")).toBe(true);
    expect(canDeleteProject("member")).toBe(false);
  });

  // The page only hides what a role cannot do: the server decides again, and the
  // role it asks for is the one the page tests, from the same constant. There is
  // nothing to delete here: it is the guard that is looked at.
  it("is whoever the server lets delete: deleteProject asks the guard for the same lowest role", async () => {
    await deleteProject({ organizationId: "org_1", projectId: "p1" });

    expect(requireRole).toHaveBeenCalledExactlyOnceWith("org_1", DELETE_MIN_ROLE);
    expect(DELETE_MIN_ROLE).toBe("admin");
  });
});
