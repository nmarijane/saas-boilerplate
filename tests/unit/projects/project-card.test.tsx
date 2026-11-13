import type { ComponentProps } from "react";
import type { ProjectSummary } from "@/features/projects/queries";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectCard } from "@/features/projects/components/project-card";
import { ProjectGrid } from "@/features/projects/components/project-grid";
import { ProjectStatus } from "@/features/projects/components/project-status";
import { toneOf } from "@/shared/components/ui/initial-tile";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  tagSaying,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The locale-aware Link of next-intl is replaced: no Next router runs in a test. A plain anchor stands in.
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) =>
      createElement("a", { href, ...props }),
  };
});

const NOW = new Date("2026-11-03T12:00:00.000Z");

// The card says how long ago the project changed, and the clock is the
// machine's: only the Date is held still, so that "2 hours ago" is the same on
// every run.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const ROOT = resolve(import.meta.dirname, "../../..");

const PROJECT: ProjectSummary = {
  id: "p1",
  name: "Atlas",
  description: null,
  status: "active",
  createdByName: "Léa Martin",
  createdAt: new Date("2026-10-01T09:00:00.000Z"),
  updatedAt: new Date("2026-11-03T10:00:00.000Z"),
};

function render(project: Partial<ProjectSummary> = {}, locale: "en" | "fr" = "en") {
  return renderWithIntl(<ProjectCard project={{ ...PROJECT, ...project }} />, locale);
}

/** The start tag right before a piece of markup, when it is the one that opens the box the markup sits in. */
function openerOf(html: string, markup: string): string {
  const before = html.slice(0, html.indexOf(markup));

  return /<[a-z]+\b[^>]*>$/.exec(before)?.[0] ?? "";
}

describe("project card", () => {
  it("makes the whole card one link to its project", () => {
    const html = render();
    const links = startTags(html, "a");

    expect(links).toHaveLength(1);
    expect(attribute(links[0] ?? "", "href")).toMatch(/\/projects\/p1$/);
    // The link is the card: everything the card says is inside it.
    expect(html.startsWith(links[0] ?? "?")).toBe(true);
    expect(html.endsWith("</a>")).toBe(true);
  });

  it("cuts a long name instead of overflowing", () => {
    const name = "Relaunch of the customer portal, whose working title is far too long to fit on one line";
    const html = render({ name });
    const title = tagSaying(html, "p", name);

    // `wrap-break-word` is the overflow-wrap of the app (the entity header, the rows, the notifications use it too)
    expect(decodedClassesOf(title)).toEqual(
      expect.arrayContaining(["line-clamp-2", "wrap-break-word", "text-section"]),
    );
    // It sits in a column that may shrink below its content: without that, the clamp has nothing to cut.
    expect(decodedClassesOf(openerOf(html, title))).toContain("min-w-0");
  });

  it("speaks the status in words, not only by color", () => {
    expect(textOf(render({ status: "active" }))).toContain("Active");
    expect(textOf(render({ status: "draft" }))).toContain("Draft");
  });

  it("tints the tile from the id, so that a rename does not repaint it", () => {
    const tile = (html: string) => startTags(html, "span").find((tag) => tag.includes('data-slot="initial-tile"')) ?? "";
    // Names whose own tint is not the one of the id: a tile seeded with the name would change color with them
    const names = ["Atlas Web", "Zephyr Mobile", "Borealis", "Cirrus", "Drizzle", "Equinox", "Fjord", "Granite"].filter(
      (name) => toneOf(name) !== toneOf("p1"),
    );

    expect(names.length).toBeGreaterThanOrEqual(2);
    for (const name of names) {
      expect(decodedClassesOf(tile(render({ name })))).toEqual(
        expect.arrayContaining(["size-10", `bg-tone-${toneOf("p1")}`]),
      );
    }
    // Two initials, from the first two words
    expect(render({ name: "Atlas Web" })).toContain(">AW</span>");
  });

  it("says how long ago the project changed, from the clock of the server", () => {
    const html = render();
    const [time = ""] = elements(html, "time");

    expect(textOf(html)).toContain("Updated 2 hours ago");
    // (React writes the attribute as the DOM names it: dateTime)
    expect(attribute(time, "dateTime")).toBe("2026-11-03T10:00:00.000Z");
    expect(textOf(time)).toBe("2 hours ago");
  });

  it("never says a project changed in the future: a clock that runs ahead reads as now", () => {
    // The database of a machine whose time zone is not UTC stamps the rows an hour ahead
    const ahead = new Date(NOW.getTime() + 60 * 60 * 1000);
    const html = render({ updatedAt: ahead });

    expect(textOf(html)).toContain("Updated now");
    expect(textOf(html)).not.toMatch(/\bin \d/);
    // The machine-readable time stays what is stored
    expect(attribute(elements(html, "time")[0] ?? "", "dateTime")).toBe(ahead.toISOString());
  });

  it("speaks French", () => {
    const html = render({ status: "draft" }, "fr");

    expect(textOf(html)).toContain("Modifié il y a 2 heures");
    expect(textOf(html)).toContain("Brouillon");
  });

  it("keeps no client code: it tells the time on the server, where the clock is the same for everyone", () => {
    for (const file of ["project-card", "project-grid", "project-status", "recent-projects"]) {
      const source = readFileSync(resolve(ROOT, `src/features/projects/components/${file}.tsx`), "utf-8");

      expect(source, `${file} must stay a Server Component`).not.toMatch(/^\s*["']use client["']/);
    }
  });
});

describe("project status", () => {
  it("draws a green dot for an active project and a neutral one for a draft", () => {
    const active = renderWithIntl(<ProjectStatus status="active" />);
    const draft = renderWithIntl(<ProjectStatus status="draft" />);

    expect(active).toContain("bg-success");
    expect(draft).toContain("bg-ink-muted");
    expect(textOf(active)).toBe("Active");
    expect(textOf(draft)).toBe("Draft");
  });

  it("hides the dot from assistive technology: the word is what says it", () => {
    const dot = startTags(renderWithIntl(<ProjectStatus status="active" />), "span").find((tag) =>
      decodedClassesOf(tag).includes("rounded-full"),
    );

    expect(attribute(dot ?? "", "aria-hidden")).toBe("true");
  });
});

describe("project grid", () => {
  const projects = [
    PROJECT,
    { ...PROJECT, id: "p2", name: "Borealis" },
    { ...PROJECT, id: "p3", name: "Cirrus" },
  ];

  it("lays the cards out on one, two (sm) or three (lg) columns", () => {
    const html = renderWithIntl(<ProjectGrid projects={projects} />);
    const [list = ""] = startTags(html, "ul");

    expect(decodedClassesOf(list)).toEqual(
      expect.arrayContaining(["grid", "grid-cols-1", "sm:grid-cols-2", "lg:grid-cols-3"]),
    );
  });

  it("follows the width of the block that holds it instead of the window's, when it is told to (columns=\"container\")", () => {
    const html = renderWithIntl(<ProjectGrid projects={projects} columns="container" />);
    const [list = ""] = startTags(html, "ul");

    expect(decodedClassesOf(list)).toEqual(
      expect.arrayContaining(["grid", "grid-cols-1", "gap-4", "@md:grid-cols-2", "@2xl:grid-cols-3"]),
    );
    expect(decodedClassesOf(list).filter((name) => /^(?:sm|md|lg|xl|2xl):grid-cols/.test(name))).toEqual([]);
  });

  it("follows the window when it is not told otherwise: the list of the projects keeps its columns", () => {
    const [list = ""] = startTags(renderWithIntl(<ProjectGrid projects={projects} />), "ul");

    expect(decodedClassesOf(list).filter((name) => name.includes("grid-cols"))).toEqual([
      "grid-cols-1",
      "sm:grid-cols-2",
      "lg:grid-cols-3",
    ]);
  });

  it("is a list, one item and one link per project", () => {
    const html = renderWithIntl(<ProjectGrid projects={projects} />);

    // role="list" gives back the list that Safari drops from a list with no bullets
    expect(attribute(startTags(html, "ul")[0] ?? "", "role")).toBe("list");
    expect(startTags(html, "li")).toHaveLength(3);
    expect(startTags(html, "a").map((tag) => attribute(tag, "href"))).toEqual(["/projects/p1", "/projects/p2", "/projects/p3"]);
  });
});
