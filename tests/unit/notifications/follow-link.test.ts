import { describe, expect, it, vi } from "vitest";
import { followNotification, followNotificationLink } from "@/features/notifications/follow-link";

function navigation() {
  return { push: vi.fn(), assign: vi.fn() };
}

describe("followNotificationLink", () => {
  it("goes to a page of the app through the router, which adds the language and keeps the page", () => {
    const nav = navigation();

    expect(followNotificationLink("/settings/billing", nav)).toBe(true);

    expect(nav.push).toHaveBeenCalledExactlyOnceWith("/settings/billing");
    expect(nav.assign).not.toHaveBeenCalled();
  });

  it("keeps the query and the anchor of a page of the app", () => {
    const nav = navigation();

    followNotificationLink("/projects?status=late#row-3", nav);

    expect(nav.push).toHaveBeenCalledExactlyOnceWith("/projects?status=late#row-3");
  });

  it.each(["https://example.com/invoice/42", "http://example.com/status", "HTTPS://EXAMPLE.COM"])(
    "leaves the app for the web address %s",
    (link) => {
      const nav = navigation();

      expect(followNotificationLink(link, nav)).toBe(true);

      expect(nav.assign).toHaveBeenCalledExactlyOnceWith(link);
      expect(nav.push).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["a javascript: address, which would run in this page", "javascript:alert(document.cookie)"],
    ["a data: address", "data:text/html,<script>alert(1)</script>"],
    ["a mailto: address", "mailto:support@example.com"],
    ["a host with no scheme, which is not a page of the app", "//example.com/path"],
    ["a host written with a backslash, which a browser reads as //host", String.raw`/\example.com/path`],
    ["a path with no slash", "settings/billing"],
    ["an empty link", ""],
  ])("follows nothing for %s", (_name, link) => {
    const nav = navigation();

    expect(followNotificationLink(link, nav)).toBe(false);

    expect(nav.push).not.toHaveBeenCalled();
    expect(nav.assign).not.toHaveBeenCalled();
  });

  it("follows nothing for a notification that has no link", () => {
    const nav = navigation();

    expect(followNotificationLink(null, nav)).toBe(false);

    expect(nav.push).not.toHaveBeenCalled();
    expect(nav.assign).not.toHaveBeenCalled();
  });
});

// A notification belongs to the person, and its link to a workspace: a project of
// Acme is not found from Northwind. Following one of another workspace opens its
// page in that workspace: the switch makes it the active one first, then goes there.
describe("followNotification", () => {
  function workspaceNavigation(order: string[] = [], switched = true) {
    return {
      push: vi.fn((href: string) => order.push(`push:${href}`)),
      assign: vi.fn((href: string) => order.push(`assign:${href}`)),
      switchTo: vi.fn(async (id: string, href: string) => {
        order.push(`switch:${id}:${href}`);
        return switched;
      }),
    };
  }

  it("opens the page of a notification of another workspace in that workspace", async () => {
    const order: string[] = [];

    expect(await followNotification({ link: "/projects/atlas", organizationId: "acme" }, "northwind", workspaceNavigation(order))).toBe(true);

    expect(order).toEqual(["switch:acme:/projects/atlas"]);
  });

  it("goes straight to the page of a notification of the active workspace, or of the account", async () => {
    for (const organizationId of ["acme", null, undefined]) {
      const order: string[] = [];

      expect(await followNotification({ link: "/settings/billing", organizationId }, "acme", workspaceNavigation(order))).toBe(true);
      expect(order, String(organizationId)).toEqual(["push:/settings/billing"]);
    }
  });

  it("opens the workspace of the notification for a person who has none active", async () => {
    const order: string[] = [];

    await followNotification({ link: "/projects/atlas", organizationId: "acme" }, null, workspaceNavigation(order));

    expect(order).toEqual(["switch:acme:/projects/atlas"]);
  });

  it("switches nothing for a web address, or for a link it does not follow", async () => {
    const order: string[] = [];

    expect(await followNotification({ link: "https://example.com/invoice", organizationId: "acme" }, "northwind", workspaceNavigation(order))).toBe(true);
    expect(await followNotification({ link: "javascript:alert(1)", organizationId: "acme" }, "northwind", workspaceNavigation(order))).toBe(false);
    expect(await followNotification({ link: null, organizationId: "acme" }, "northwind", workspaceNavigation(order))).toBe(false);

    expect(order).toEqual(["assign:https://example.com/invoice"]);
  });

  it("says it went nowhere when the workspace cannot be opened: the switch has said so", async () => {
    const order: string[] = [];

    expect(await followNotification({ link: "/projects/atlas", organizationId: "gone" }, "northwind", workspaceNavigation(order, false))).toBe(false);

    expect(order).toEqual(["switch:gone:/projects/atlas"]);
  });
});
