import type { ComponentProps } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import MarketingLayout from "@/app/[locale]/(marketing)/layout";
import { classesOf, startTags } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The locale-aware Link of next-intl cannot be imported in Node: its ESM build
// resolves `next/navigation` without an extension. A plain anchor stands in.
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) =>
      createElement("a", { href, ...props }),
  };
});

const globalCss = readFileSync(
  resolve(import.meta.dirname, "../../../src/styles/global.css"),
  "utf-8",
);

// The base body text is 14 px, which suits the signed-in app. The public pages
// (the landing page, pricing, the blog) are read, not operated: they set 16 px
// once, on the root of their layout, and everything inside inherits it.
describe("marketing layout", () => {
  const root = classesOf(
    startTags(
      renderWithIntl(<MarketingLayout>page</MarketingLayout>),
      "div",
    )[0] ?? "",
  );

  it("reads at 16 px, on its root", () => {
    expect(root).toContain("text-section");
  });

  it("reads at a normal weight: text-section is semi-bold by itself", () => {
    expect(root).toContain("font-normal");
  });

  it("keeps the root a full-height column, as it was", () => {
    expect(root).toEqual(
      expect.arrayContaining(["flex", "min-h-screen", "flex-col"]),
    );
  });

  it("leaves the base body at 14 px, which the app keeps", () => {
    expect(globalCss).toMatch(/body\s*\{[^}]*\btext-body\b/);
  });
});
