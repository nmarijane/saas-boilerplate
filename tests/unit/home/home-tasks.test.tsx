import type { ComponentProps } from "react";
import type { HomeTask } from "@/shared/shell/view";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { HomeTasks } from "@/features/dashboard/components/home-tasks";
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

const ROOT = resolve(import.meta.dirname, "../../..");

function task(id: string, label: string, overrides: Partial<HomeTask> = {}): HomeTask {
  return {
    id,
    label,
    icon: <svg data-icon={id} aria-hidden="true" />,
    tone: 1,
    done: false,
    action: { href: `/${id}`, label: `Go to ${id}` },
    ...overrides,
  };
}

// Two steps done and one to do, as the shell hands them over.
const TASKS: HomeTask[] = [
  task("first-project", "Create your first project", { done: true, tone: 1 }),
  task("invite-team", "Invite your first teammate", { done: true, tone: 3 }),
  task("api-key", "Create your first API key", {
    tone: 2,
    action: { href: "/settings/developers", label: "Create an API key" },
  }),
];

function render(
  tasks: HomeTask[] = TASKS,
  done = tasks.filter((entry) => entry.done).length,
  locale: "en" | "fr" = "en",
) {
  return renderWithIntl(<HomeTasks tasks={tasks} done={done} />, locale);
}

/** The rows of the list, one markup each. */
function rowsOf(html: string): string[] {
  return elements(html, "li");
}

describe("home tasks", () => {
  it("counts what is done", () => {
    const html = render();
    const [heading = ""] = elements(html, "h2");
    const rows = rowsOf(html);

    expect(textOf(heading)).toBe("First steps");
    expect(textOf(html)).toContain("2 of 3");
    expect(rows).toHaveLength(3);

    // A step that is done says so in words, and has no button
    for (const row of rows.slice(0, 2)) {
      expect(textOf(row)).toMatch(/^Done:\s/);
      expect(startTags(row, "a")).toHaveLength(0);
      expect(startTags(row, "button")).toHaveLength(0);
    }
    // The one that is not: its label, and a button that leads to the action
    const [open = ""] = rows.slice(2);
    expect(textOf(open)).toContain("Create your first API key");
    expect(textOf(open)).not.toContain("Done:");
    const links = startTags(open, "a");
    expect(links).toHaveLength(1);
    expect(attribute(links[0] ?? "", "href")).toBe("/settings/developers");
    expect(textOf(elements(open, "a")[0] ?? "")).toBe("Create an API key");
  });

  it("reads the steps in order, as a list that says how many there are", () => {
    const html = render();
    const [list = ""] = startTags(html, "ol");

    expect(startTags(html, "ol")).toHaveLength(1);
    // The one list of the app, ordered: its role and its hairlines are its own (ui/list.tsx)
    expect(attribute(list, "data-slot")).toBe("list");
    expect(attribute(list, "role")).toBe("list");
    expect(decodedClassesOf(list)).toEqual(expect.arrayContaining(["divide-y", "divide-hairline"]));
    expect(rowsOf(html).map((row) => textOf(row).replace(/^Done:\s/, ""))).toEqual([
      "Create your first project",
      "Invite your first teammate",
      "Create your first API keyCreate an API key",
    ]);
  });

  it("tells a done step from the others with a check on a success tile, and hides it from assistive technology", () => {
    const [done = ""] = rowsOf(render());
    const tile = startTags(done, "span").find((tag) =>
      tag.includes('data-slot="icon-tile"'),
    );

    expect(decodedClassesOf(tile ?? "")).toEqual(
      expect.arrayContaining(["bg-success-bg", "text-success-text"]),
    );
    expect(done).toContain("lucide-check");
    // The words are what says it: the check is a picture
    expect(done).not.toContain("first-project");
    expect(attribute(startTags(done, "svg")[0] ?? "", "aria-hidden")).toBe("true");
  });

  it("hides the words of a done step from the eye and gives them to a screen reader, ahead of the label", () => {
    const [done = ""] = rowsOf(render());
    const hidden = startTags(done, "span").find((tag) =>
      decodedClassesOf(tag).includes("sr-only"),
    );

    expect(hidden).toBeDefined();
    expect(textOf(elements(done, "span").find((span) => span.includes("sr-only")) ?? "")).toBe(
      "Done: ",
    );
    expect(textOf(done)).toBe("Done: Create your first project");
  });

  it("gives a step still to do its own tile, in the tone it asks for, and a secondary button of 44 px", () => {
    const [, , open = ""] = rowsOf(render());
    const tile = startTags(open, "span").find((tag) =>
      tag.includes('data-slot="icon-tile"'),
    );
    const [button = ""] = startTags(open, "a");

    expect(decodedClassesOf(tile ?? "")).toEqual(
      expect.arrayContaining(["bg-tone-2", "text-tone-2-ink"]),
    );
    expect(open).toMatch(/data-slot="icon-tile"[^>]*><svg data-icon="api-key"/);
    // One secondary button, small (36 px) with the hit area of 44 px that every button has
    expect(attribute(button, "data-slot")).toBe("button");
    expect(decodedClassesOf(button)).toEqual(
      expect.arrayContaining(["bg-secondary", "h-9", "tap-target"]),
    );
    // Never a second main button in the zone
    expect(decodedClassesOf(button)).not.toContain("bg-primary");
  });

  it("shows how many are done out of how many there are, from the figures it is given", () => {
    expect(textOf(render(TASKS, 1))).toContain("1 of 3");
    expect(textOf(render(TASKS, 3))).toContain("3 of 3");
    expect(textOf(render([TASKS[2] as HomeTask], 0))).toContain("0 of 1");
  });

  it("draws nothing without steps: an empty card would say nothing", () => {
    expect(render([], 0)).toBe("");
  });

  it("keeps a long label and a long button inside the column", () => {
    const html = render([
      task("long", "Invitez votre premier collaborateur dans l'équipe de travail", {
        action: { href: "/settings/team", label: "Inviter un collaborateur" },
      }),
    ]);
    const [row = ""] = rowsOf(html);

    // The label wraps, in a column that may shrink below its content
    expect(row).toContain("wrap-break-word");
    expect(row).toContain("min-w-0");
  });

  it("speaks French", () => {
    const html = render(TASKS, 2, "fr");
    const [heading = ""] = elements(html, "h2");

    expect(textOf(heading)).toBe("Premiers pas");
    expect(textOf(html)).toContain("2 sur 3");
    expect(textOf(rowsOf(html)[0] ?? "")).toMatch(/^Fait :\s/);
  });

  it("keeps no client code: it is drawn on the server, from what the shell gives it", () => {
    const source = readFileSync(
      resolve(ROOT, "src/features/dashboard/components/home-tasks.tsx"),
      "utf-8",
    );

    expect(source).not.toMatch(/^\s*["']use client["']/);
  });
});
