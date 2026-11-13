import { describe, expect, it, vi } from "vitest";
import { LimitNotice } from "@/shared/components/data/limit-notice";
import { attribute, startTags, textOf } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");

  return { Link: ({ href, ...props }: React.ComponentProps<"a">) => createElement("a", { href, ...props }) };
});

const limit = { key: "projects", limit: 3, used: 3, planId: "free", planName: "Free", includedIn: "Pro", upgradeHref: "/settings/billing" };

// A form that was refused for a limit must say so to a screen reader too: it is announced when it appears
describe("what a form says when a limit refused it", () => {
  it("is an alert, with the feature, the plan that includes it and the way to the plans", () => {
    const html = renderWithIntl(<LimitNotice limit={limit} feature="More projects" />);

    expect(startTags(html, "div").some((tag) => attribute(tag, "role") === "alert")).toBe(true);
    expect(textOf(html)).toContain("More projects");
    expect(textOf(html)).toContain("Included in the Pro plan");
    expect(attribute(startTags(html, "a")[0] ?? "", "href")).toBe("/settings/billing");
  });

  it("tells who may not buy to ask, with no link", () => {
    const html = renderWithIntl(<LimitNotice limit={{ ...limit, upgradeHref: null }} feature="More projects" />);

    expect(textOf(html)).toContain("Ask an owner or an admin");
    expect(startTags(html, "a")).toEqual([]);
  });
});
