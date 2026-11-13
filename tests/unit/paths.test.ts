import { describe, expect, it } from "vitest";
import { activeHref, isActivePath, pathOf, withSearch } from "@/shared/utils/paths";

describe("pathOf", () => {
  it("drops the query, the fragment and the trailing slash", () => {
    expect(pathOf("/settings/team")).toBe("/settings/team");
    expect(pathOf("/settings/team/")).toBe("/settings/team");
    expect(pathOf("/settings/team///")).toBe("/settings/team");
    expect(pathOf("/settings?tab=1")).toBe("/settings");
    expect(pathOf("/settings#top")).toBe("/settings");
    expect(pathOf("/settings/?tab=1#top")).toBe("/settings");
  });

  it("keeps the root as a slash", () => {
    expect(pathOf("/")).toBe("/");
    expect(pathOf("/?tab=1")).toBe("/");
  });

  it("reads an empty link as no path", () => {
    expect(pathOf("")).toBe("");
    expect(pathOf("?tab=1")).toBe("");
  });
});

describe("withSearch", () => {
  it("keeps the query of the page on the path it is given", () => {
    expect(withSearch("/projects", new URLSearchParams("tab=billing"))).toBe(
      "/projects?tab=billing",
    );
  });

  it("keeps every parameter, the ones that come twice too, in their order", () => {
    expect(
      withSearch("/projects", new URLSearchParams("q=a%20b&x=1&x=2&empty=")),
    ).toBe("/projects?q=a+b&x=1&x=2&empty=");
  });

  it("leaves the path alone when the page has no query", () => {
    expect(withSearch("/projects", new URLSearchParams())).toBe("/projects");
    expect(withSearch("/", new URLSearchParams(""))).toBe("/");
  });

  it("takes anything that says its query, the read-only parameters of the router included", () => {
    expect(withSearch("/projects", { toString: () => "tab=billing" })).toBe(
      "/projects?tab=billing",
    );
  });
});

describe("isActivePath", () => {
  it("is true for the page itself and for the pages under it, whole segments only", () => {
    expect(isActivePath("/dashboard", "/dashboard")).toBe(true);
    expect(isActivePath("/settings/team", "/settings")).toBe(true);
    expect(isActivePath("/settings/team/invite", "/settings")).toBe(true);
    expect(isActivePath("/settings-old", "/settings")).toBe(false);
    expect(isActivePath("/settingsx", "/settings")).toBe(false);
    expect(isActivePath("/settings", "/settings/team")).toBe(false);
  });

  it("reads only the path of each side", () => {
    expect(isActivePath("/settings/", "/settings")).toBe(true);
    expect(isActivePath("/settings/team", "/settings/?tab=1#top")).toBe(true);
    expect(isActivePath("/settings?tab=1", "/settings")).toBe(true);
  });

  it("is the path of the root page alone when it is the root", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/dashboard", "/")).toBe(false);
    expect(isActivePath("/", "/dashboard")).toBe(false);
  });
});

describe("activeHref", () => {
  const items = (...hrefs: string[]) => hrefs.map((href) => ({ href }));
  const exact = (href: string) => ({ href, exact: true });

  it("is the item whose path is the page", () => {
    expect(activeHref(items("/a", "/b"), "/b")).toBe("/b");
  });

  it("is the item whose path the page is under, unless it is exact", () => {
    expect(activeHref(items("/a"), "/a/b/c")).toBe("/a");
    expect(activeHref([exact("/a")], "/a/b")).toBeUndefined();
    expect(activeHref([exact("/a")], "/a")).toBe("/a");
  });

  it("stops at a whole segment: /a is not the path of /ab, nor of /a-old", () => {
    expect(activeHref(items("/a"), "/ab")).toBeUndefined();
    expect(activeHref(items("/a"), "/a-old")).toBeUndefined();
  });

  it("takes the most specific item when several fit, so that one link at most is current", () => {
    expect(activeHref(items("/a", "/a/b"), "/a/b/c")).toBe("/a/b");
    expect(activeHref(items("/a/b", "/a"), "/a/b")).toBe("/a/b");
    expect(activeHref([exact("/a"), ...items("/a/b")], "/a/b")).toBe("/a/b");
  });

  it("ignores a trailing slash, on the page and on the item", () => {
    expect(activeHref(items("/a"), "/a/")).toBe("/a");
    expect(activeHref(items("/a/"), "/a")).toBe("/a/");
    expect(activeHref([exact("/a/")], "/a/")).toBe("/a/");
  });

  it("reads the path of an item that carries a query or a fragment", () => {
    expect(activeHref(items("/a?tab=1"), "/a")).toBe("/a?tab=1");
    expect(activeHref(items("/a#top"), "/a/b")).toBe("/a#top");
  });

  it("takes the root for the root page only: it is not the path of every page", () => {
    expect(activeHref(items("/"), "/")).toBe("/");
    expect(activeHref(items("/"), "/a")).toBeUndefined();
  });

  it("is nothing where there is no page: outside the app, or on no match", () => {
    expect(activeHref(items("/a"), null)).toBeUndefined();
    expect(activeHref(items("/a"), "/b")).toBeUndefined();
    expect(activeHref([], "/a")).toBeUndefined();
  });
});
