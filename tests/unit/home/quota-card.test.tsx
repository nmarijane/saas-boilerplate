import type { ComponentProps } from "react";
import type { ShellQuota } from "@/shared/shell/view";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { QuotaCard } from "@/shared/components/data/quota-card";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  tagSaying,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The locale-aware Link of next-intl is replaced: a plain anchor
// stands in.
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) =>
      createElement("a", { href, ...props }),
    usePathname: () => "/dashboard",
    useRouter: () => ({}),
    redirect: () => undefined,
  };
});

const ROOT = resolve(import.meta.dirname, "../../..");

// What the shell hands over: the icon already drawn, and the label already translated.
const QUOTA: ShellQuota = {
  id: "projects",
  label: "Projects",
  used: 41,
  limit: 50,
  status: "warning",
  icon: <svg data-icon="folder" aria-hidden="true" />,
  tone: 1,
  upgradeHref: "/settings/billing",
};

function render(quota: Partial<ShellQuota> = {}, locale: "en" | "fr" = "en") {
  return renderWithIntl(<QuotaCard quota={{ ...QUOTA, ...quota }} />, locale);
}

/** The bar of a card, as its start tag: undefined when the card draws none. */
function barOf(html: string): string | undefined {
  return startTags(html, "div").find(
    (tag) => attribute(tag, "role") === "progressbar",
  );
}

describe("quota card", () => {
  it("shows the share used and warns from 80 %", () => {
    const html = render();
    const bar = barOf(html) ?? "";

    expect(textOf(html)).toContain("41");
    expect(textOf(html)).toContain("of 50");
    expect(textOf(html)).toContain("Running low");
    // The bar says it as a sentence: a bare 41 does not say what it is out of
    expect(attribute(bar, "aria-valuetext")).toBe("41 of 50 used");
    expect(attribute(bar, "aria-valuenow")).toBe("41");
    expect(attribute(bar, "aria-valuemax")).toBe("50");
    expect(attribute(bar, "aria-label")).toBe("Projects");
  });

  it("says nothing of the state while the quota is fine", () => {
    const html = render({ used: 12, status: "ok", upgradeHref: null });

    expect(textOf(html)).toContain("12");
    expect(textOf(html)).toContain("of 50");
    expect(textOf(html)).not.toContain("Running low");
    expect(textOf(html)).not.toContain("Limit reached");
    expect(html).not.toContain('data-slot="badge"');
    expect(barOf(html)).toBeDefined();
  });

  it("names a limit that is reached, in the danger tone and in words", () => {
    const html = render({ used: 50, status: "limit" });
    const badge = startTags(html, "span").find((tag) =>
      tag.includes('data-slot="badge"'),
    );

    expect(textOf(html)).toContain("Limit reached");
    expect(textOf(html)).not.toContain("Running low");
    expect(decodedClassesOf(badge ?? "")).toContain("bg-danger");
  });

  it("marks running low with a warning icon beside the words, not by color alone", () => {
    const html = render();
    const [badge = ""] = elements(html, "span").filter((span) =>
      span.includes('data-slot="badge"'),
    );

    expect(textOf(badge)).toBe("Running low");
    expect(badge).toContain("<svg");
    expect(decodedClassesOf(badge.match(/^<span[^>]*>/)?.[0] ?? "")).toContain(
      "bg-warning-bg",
    );
  });

  it("shows Unlimited without a bar", () => {
    const html = render({
      used: 120,
      limit: -1,
      status: "unlimited",
      upgradeHref: null,
    });

    expect(textOf(html)).toContain("120");
    expect(textOf(html)).toContain("Unlimited");
    expect(barOf(html)).toBeUndefined();
    expect(html).not.toContain('role="progressbar"');
    // -1 is how the shell says "no limit": it is never read out, nor made a value
    expect(textOf(html)).not.toContain("-1");
    expect(html).not.toMatch(/aria-valu\w+="-1"/);
  });

  it("offers the upgrade only when the quota needs it", () => {
    const links = (quota: Partial<ShellQuota>) =>
      startTags(render(quota), "a").map((tag) => attribute(tag, "href"));

    // Fine: nothing to upgrade for
    expect(links({ used: 12, status: "ok" })).toEqual([]);
    // Unlimited: no limit to lift
    expect(links({ limit: -1, status: "unlimited" })).toEqual([]);
    // Running low, and at the limit: the way up
    expect(links({ status: "warning" })).toEqual(["/settings/billing"]);
    expect(links({ used: 50, status: "limit" })).toEqual(["/settings/billing"]);
    // Nothing above the plan: no link to nowhere
    expect(links({ status: "limit", used: 50, upgradeHref: null })).toEqual([]);
    expect(links({ status: "warning", upgradeHref: null })).toEqual([]);
  });

  it("says Upgrade, in a link of its own on its line", () => {
    const html = render({ used: 50, status: "limit" });
    const [link = ""] = elements(html, "a");

    expect(textOf(link)).toBe("Upgrade");
    // A link alone on its line is a 44 px target, and does not stretch across the card
    expect(decodedClassesOf(startTags(html, "a")[0] ?? "")).toEqual(
      expect.arrayContaining(["tap-target", "self-start"]),
    );
  });

  it("writes storage in megabytes", () => {
    const html = render({
      id: "storage",
      label: "Storage",
      used: 3200,
      limit: 10_000,
      unit: "megabyte",
      status: "ok",
      upgradeHref: null,
    });

    expect(textOf(html)).toContain("3,200 MB");
    expect(textOf(html)).toContain("of 10,000 MB");
    expect(attribute(barOf(html) ?? "", "aria-valuetext")).toBe(
      "3,200 MB of 10,000 MB used",
    );
  });

  it("writes a figure in its own unit in French too", () => {
    const html = render(
      { used: 3200, limit: 10_000, unit: "megabyte", status: "ok" },
      "fr",
    );

    // The figures follow the language: a narrow space groups the thousands
    expect(textOf(html).replaceAll(/\s/g, " ")).toContain("3 200 Mo");
    expect(textOf(html).replaceAll(/\s/g, " ")).toContain("sur 10 000 Mo");
  });

  it("is a card with the label as its heading, under the page's h2", () => {
    const html = render({ label: "AI credits this month" });
    const [heading = ""] = elements(html, "h3");
    const card = startTags(html, "div").find((tag) => tag.includes('data-slot="card"'));

    expect(html).toContain('data-slot="card"');
    // It fills its cell: the cards of a row are as tall as the tallest
    expect(decodedClassesOf(card ?? "")).toContain("h-full");
    expect(textOf(heading)).toBe("AI credits this month");
    expect(decodedClassesOf(startTags(html, "h3")[0] ?? "")).toEqual(
      expect.arrayContaining(["text-section", "wrap-break-word", "min-w-0"]),
    );
    expect(startTags(html, "h1")).toHaveLength(0);
    expect(startTags(html, "h2")).toHaveLength(0);
  });

  it("sets the figure in the monospace face the stat cards use", () => {
    const html = render();
    const figure = tagSaying(html, "span", "41");

    expect(decodedClassesOf(figure)).toEqual(
      expect.arrayContaining(["font-mono", "text-page", "font-medium"]),
    );
  });

  it.each([1, 2, 3, 4] as const)(
    "tints the tile with the tone %s of the shell, and draws the icon in it",
    (tone) => {
      const html = render({ tone });
      const tile = startTags(html, "span").find((tag) =>
        tag.includes('data-slot="icon-tile"'),
      );

      expect(decodedClassesOf(tile ?? "")).toEqual(
        expect.arrayContaining([`bg-tone-${tone}`, `text-tone-${tone}-ink`]),
      );
      // The icon was drawn by the shell: it sits in the tile, sized by it
      expect(html).toMatch(
        /data-slot="icon-tile"[^>]*><svg data-icon="folder" aria-hidden="true"/,
      );
    },
  );

  it("speaks French", () => {
    const html = render({ label: "Projets" }, "fr");

    expect(textOf(html)).toContain("sur 50");
    expect(textOf(html)).toContain("Bientôt épuisé");
    expect(textOf(html)).toContain("Passer à l'offre supérieure");
    expect(attribute(barOf(html) ?? "", "aria-valuetext")).toBe(
      "41 sur 50 utilisés",
    );
    expect(textOf(render({ limit: -1, status: "unlimited" }, "fr"))).toContain(
      "Illimité",
    );
  });

  it("keeps a long French label inside the card instead of pushing it", () => {
    const html = render({
      label: "Crédits d'IA consommés ce mois-ci par toute votre équipe",
    });
    const [heading = ""] = startTags(html, "h3");

    expect(decodedClassesOf(heading)).toEqual(
      expect.arrayContaining(["min-w-0", "wrap-break-word"]),
    );
  });

  it("keeps no client code: the figures are written on the server", () => {
    const source = readFileSync(
      resolve(ROOT, "src/shared/components/data/quota-card.tsx"),
      "utf-8",
    );

    expect(source).not.toMatch(/^\s*["']use client["']/);
  });
});
