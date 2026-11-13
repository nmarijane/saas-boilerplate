import type { DrawerState } from "@/shared/components/shell/drawer-state";
import { describe, expect, it } from "vitest";
import { syncDrawer } from "@/shared/components/shell/drawer-state";

const OPEN: DrawerState = {
  open: true,
  side: "bottom",
  pathname: "/projects",
  workspaceId: "org_1",
};

describe("syncDrawer", () => {
  it("leaves the drawer alone while the page and the workspace are those it was opened over", () => {
    // The same object: React has nothing to render again.
    expect(
      syncDrawer(OPEN, { pathname: "/projects", workspaceId: "org_1" }),
    ).toBe(OPEN);
  });

  it("closes it when the route changes: a link of the drawer, the account menu, the back button", () => {
    const synced = syncDrawer(OPEN, {
      pathname: "/settings/team",
      workspaceId: "org_1",
    });

    expect(synced.open).toBe(false);
    expect(synced.pathname).toBe("/settings/team");
  });

  it("closes it when the workspace changes under the same route: a switch from the home pushes the page it is on", () => {
    const synced = syncDrawer(
      { ...OPEN, pathname: "/dashboard" },
      { pathname: "/dashboard", workspaceId: "org_2" },
    );

    expect(synced.open).toBe(false);
    expect(synced.workspaceId).toBe("org_2");
    expect(synced.pathname).toBe("/dashboard");
  });

  it("closes it when the person gets a workspace, or loses theirs", () => {
    expect(
      syncDrawer(
        { ...OPEN, workspaceId: null },
        { pathname: "/projects", workspaceId: "org_1" },
      ).open,
    ).toBe(false);
    expect(
      syncDrawer(OPEN, { pathname: "/projects", workspaceId: null }).open,
    ).toBe(false);
  });

  it("keeps the edge it opened from, so that the sheet leaves by it", () => {
    expect(
      syncDrawer(OPEN, { pathname: "/ai", workspaceId: "org_1" }).side,
    ).toBe("bottom");
    expect(
      syncDrawer(
        { ...OPEN, side: "left" },
        { pathname: "/projects", workspaceId: "org_2" },
      ).side,
    ).toBe("left");
  });

  it("remembers the new page: once synced, the same page changes nothing more", () => {
    const page = { pathname: "/ai", workspaceId: "org_2" };
    const synced = syncDrawer(OPEN, page);

    expect(syncDrawer(synced, page)).toBe(synced);
  });

  it("does not open a drawer that was closed", () => {
    const closed = { ...OPEN, open: false };

    expect(
      syncDrawer(closed, { pathname: "/ai", workspaceId: "org_2" }).open,
    ).toBe(false);
  });
});
