import type { ComponentProps } from "react";
import type { ActivityEntry } from "@/shared/shell/contract";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeActivity } from "@/features/dashboard/components/home-activity";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
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

const NOW = new Date("2026-11-03T12:00:00.000Z");

// The rows say how long ago it happened, and the clock is the machine's: only
// the Date is held still, so that "2 hours ago" is the same on every run.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const ROOT = resolve(import.meta.dirname, "../../..");

function entry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: "a1",
    action: "project.created",
    actorName: "Léa Martin",
    actorImage: null,
    values: { name: "Atlas" },
    at: new Date("2026-11-03T10:00:00.000Z"),
    ...overrides,
  };
}

function render(entries: ActivityEntry[], locale: "en" | "fr" = "en") {
  return renderWithIntl(<HomeActivity entries={entries} />, locale);
}

/** The rows of the list, one markup each. */
function rowsOf(html: string): string[] {
  return elements(html, "li");
}

describe("home activity", () => {
  it("tells what happened, who did it and when", () => {
    const html = render([entry()]);
    const [row = ""] = rowsOf(html);
    const [time = ""] = elements(row, "time");

    expect(textOf(row)).toContain("Léa Martin created Atlas");
    expect(textOf(time)).toBe("2 hours ago");
    // (React writes the attribute as the DOM names it: dateTime)
    expect(attribute(time, "dateTime")).toBe("2026-11-03T10:00:00.000Z");
  });

  it("heads the list with an h2 and draws the rows in a card, newest first as given", () => {
    const html = render([
      entry({ id: "a1", values: { name: "Atlas" } }),
      entry({ id: "a2", values: { name: "Borealis" } }),
    ]);
    const [heading = ""] = elements(html, "h2");

    expect(textOf(heading)).toBe("Activity");
    expect(html).toContain('data-slot="card"');
    expect(attribute(startTags(html, "ul")[0] ?? "", "role")).toBe("list");
    const rows = rowsOf(html);
    expect(rows).toHaveLength(2);
    expect(textOf(rows[0] ?? "")).toContain("Léa Martin created Atlas");
    expect(textOf(rows[1] ?? "")).toContain("Léa Martin created Borealis");
    // The sentence, then how long ago, under it
    expect(textOf(rows[0] ?? "").endsWith("Léa Martin created Atlas2 hours ago")).toBe(true);
  });

  it("falls back for an unknown event", () => {
    const html = render([entry({ action: "custom.thing", values: {} })]);

    expect(textOf(html)).toContain("Léa Martin did something");
  });

  it("falls back for the start of a known event too, which is a group of messages and no message", () => {
    for (const action of ["project", "ai", "activity", "", "constructor"]) {
      const html = render([entry({ action, values: {} })]);

      expect(textOf(rowsOf(html)[0] ?? ""), action).toContain("Léa Martin did something");
    }
  });

  it("falls back when the sentence wants a detail the event does not carry, rather than showing the name of the message", () => {
    // A row with no name (an event written by hand, or before the name was kept)
    const html = render([entry({ action: "project.created", values: {} })]);

    expect(textOf(rowsOf(html)[0] ?? "")).toContain("Léa Martin did something");
    expect(textOf(html)).not.toContain("activity.project");
    // Whatever else the event carries, it is the name that is missing
    expect(textOf(render([entry({ values: { planId: "pro" } })]))).toContain("Léa Martin did something");
    // A sentence that takes no detail needs none
    expect(textOf(render([entry({ action: "api_key.created", values: {} })]))).toContain("Léa Martin created an API key");
  });

  it("says when there is no activity yet", () => {
    const html = render([]);
    const [heading = ""] = elements(html, "h2");

    expect(textOf(heading)).toBe("Activity");
    expect(html).toContain('data-slot="empty-state"');
    expect(textOf(html)).toContain("No activity yet");
    expect(html).not.toContain('role="list"');
    expect(html).not.toContain("<time");
    // A compact state: the shared one, with less room round it
    expect(decodedClassesOf(startTags(html, "div").find((tag) => tag.includes('data-slot="empty-state"')) ?? "")).toContain("p-6");
  });

  it("names an event with no author by its words, and draws a neutral person for it, not a tinted tile with a question mark", () => {
    const html = render([entry({ actorName: null })]);
    const tile = startTags(html, "span").find((tag) => tag.includes('data-slot="icon-tile"'));

    expect(textOf(rowsOf(html)[0] ?? "")).toContain("Someone created Atlas");
    expect(decodedClassesOf(tile ?? "")).toEqual(
      expect.arrayContaining(["bg-secondary", "size-8", "rounded-full"]),
    );
    expect(html).toContain("lucide-user-round");
    expect(html).not.toContain('data-slot="initial-tile"');
    expect(html).not.toContain(">?</span>");
  });

  it("reads a blank author as no author, whatever picture comes with it", () => {
    const html = render([entry({ actorName: "   ", actorImage: "https://example.com/blank.png" })]);

    expect(textOf(rowsOf(html)[0] ?? "")).toContain("Someone created Atlas");
    expect(html).toContain("lucide-user-round");
    expect(html).not.toContain('data-slot="avatar"');
  });

  it("draws the initials of the author on a tile when there is no photo", () => {
    const html = render([entry()]);
    const tile = startTags(html, "span").find((tag) =>
      tag.includes('data-slot="initial-tile"'),
    );

    expect(html).toContain(">LM</span>");
    expect(decodedClassesOf(tile ?? "")).toEqual(
      expect.arrayContaining(["size-8", "rounded-full"]),
    );
    // A picture of a person, hidden from assistive technology: the sentence says who
    expect(attribute(tile ?? "", "aria-hidden")).toBe("true");
  });

  it("gives a photo the tile as its fallback while it loads", () => {
    const html = render([entry({ actorImage: "https://example.com/lea.png" })]);

    expect(html).toContain('data-slot="avatar"');
    expect(html).toContain(">LM</span>");
  });

  it("never tells an event in the future: a clock that runs ahead reads as now", () => {
    // The database of a machine whose time zone is not UTC stamps the rows an hour ahead
    const ahead = new Date(NOW.getTime() + 60 * 60 * 1000);
    const html = render([entry({ at: ahead })]);
    const [time = ""] = elements(html, "time");

    expect(textOf(time)).toBe("now");
    expect(textOf(html)).not.toMatch(/\bin \d/);
    // The machine-readable time stays what is stored
    expect(attribute(time, "dateTime")).toBe(ahead.toISOString());
  });

  it("keeps the author the author, whatever the details of the event hold", () => {
    const html = render([entry({ values: { name: "Atlas", actor: "Someone Else" } })]);

    expect(textOf(rowsOf(html)[0] ?? "")).toContain("Léa Martin created Atlas");
    expect(textOf(html)).not.toContain("Someone Else");
  });

  it("writes a name of the event as text, never as markup", () => {
    const html = render([entry({ values: { name: "<b>Atlas</b> & {co}" } })]);

    expect(html).not.toContain("<b>");
    expect(textOf(rowsOf(html)[0] ?? "")).toContain("Léa Martin created <b>Atlas</b> & {co}");
  });

  it("speaks French, in the formal register the app uses and the time of French", () => {
    const html = render([entry()], "fr");
    const [heading = ""] = elements(html, "h2");

    expect(textOf(heading)).toBe("Activité");
    expect(textOf(rowsOf(html)[0] ?? "")).toContain("Léa Martin a créé Atlas");
    expect(textOf(elements(html, "time")[0] ?? "")).toBe("il y a 2 heures");
    expect(textOf(render([entry({ actorName: null })], "fr"))).toContain("Quelqu'un a créé Atlas");
    expect(textOf(render([], "fr"))).toContain("Aucune activité");
  });

  it("keeps no client code: it tells the time on the server, where the clock is the same for everyone", () => {
    const source = readFileSync(
      resolve(ROOT, "src/features/dashboard/components/home-activity.tsx"),
      "utf-8",
    );

    expect(source).not.toMatch(/^\s*["']use client["']/);
  });
});
