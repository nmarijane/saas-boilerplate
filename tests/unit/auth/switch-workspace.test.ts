import { describe, expect, it } from "vitest";
import {
  createWorkspace,
} from "@/features/auth/organization/create-workspace";
import { workspaceSlug } from "@/features/auth/organization/slug";
import { switchWorkspace } from "@/features/auth/organization/switch-workspace";

/** What `createOrganization` accepts for a slug: the schema of the server action. */
const SERVER_SLUG = /^[a-z0-9-]+$/;
const SERVER_MAX = 100;

describe("switchWorkspace", () => {
  it("activates the workspace, then goes home and refreshes", async () => {
    const calls: string[] = [];

    await switchWorkspace(
      {
        setActive: async (id) => {
          calls.push(`active:${id}`);
        },
        push: (href) => calls.push(`push:${href}`),
        refresh: () => calls.push("refresh"),
      },
      "org_2",
    );

    expect(calls).toEqual(["active:org_2", "push:/dashboard", "refresh"]);
  });

  // A notification of another workspace opens its own page there, not the home
  it("goes to the page it is given in the new workspace, once it is the active one", async () => {
    const calls: string[] = [];

    await switchWorkspace(
      {
        setActive: async (id) => {
          calls.push(`active:${id}`);
        },
        push: (href) => calls.push(`push:${href}`),
        refresh: () => calls.push("refresh"),
      },
      "org_2",
      "/projects/atlas",
    );

    expect(calls).toEqual(["active:org_2", "push:/projects/atlas", "refresh"]);
  });

  it("waits for the activation before it goes anywhere: the page it leaves belongs to the workspace it left", async () => {
    const calls: string[] = [];
    let activated: () => void = () => {};
    const done = switchWorkspace(
      {
        setActive: (id) =>
          new Promise<void>((resolve) => {
            calls.push(`active:${id}`);
            activated = resolve;
          }),
        push: (href) => calls.push(`push:${href}`),
        refresh: () => calls.push("refresh"),
      },
      "org_2",
    );

    await Promise.resolve();
    expect(calls).toEqual(["active:org_2"]);

    activated();
    await done;
    expect(calls).toEqual(["active:org_2", "push:/dashboard", "refresh"]);
  });

  it("stays where it is, and says why, when the workspace cannot be activated", async () => {
    const calls: string[] = [];

    await expect(
      switchWorkspace(
        {
          setActive: async (id) => {
            calls.push(`active:${id}`);
            throw new Error("not a member");
          },
          push: (href) => calls.push(`push:${href}`),
          refresh: () => calls.push("refresh"),
        },
        "org_2",
      ),
    ).rejects.toThrow("not a member");

    expect(calls).toEqual(["active:org_2"]);
  });
});

describe("workspaceSlug", () => {
  it("builds a slug the server accepts", () => {
    expect(workspaceSlug("Studio Nord", () => "abc123")).toBe(
      "studio-nord-abc123",
    );
    expect(workspaceSlug("!!!", () => "x1y2z3")).toBe("workspace-x1y2z3");
    expect(workspaceSlug("Acme")).toMatch(/^acme-[a-z0-9]{6}$/);
  });

  it("drops accents, and falls back for a name with no Latin letter", () => {
    expect(workspaceSlug("Café Été", () => "abc123")).toBe("cafe-ete-abc123");
    expect(workspaceSlug("日本語", () => "abc123")).toBe("workspace-abc123");
  });

  it("draws a new suffix of six base-36 characters every time", () => {
    const slugs = Array.from({ length: 40 }, () => workspaceSlug("Acme"));

    for (const slug of slugs) {
      expect(slug).toMatch(/^acme-[a-z0-9]{6}$/);
    }
    expect(new Set(slugs).size).toBeGreaterThan(1);
  });

  it("stays within the 100 characters of the server, whatever the name", () => {
    const slug = workspaceSlug("a".repeat(100), () => "abc123");

    expect(slug).toHaveLength(SERVER_MAX);
    expect(slug.endsWith("-abc123")).toBe(true);
  });

  it("does not leave a hyphen of its own where the name was cut", () => {
    // Cut at 93 characters, the name ends on the hyphen that stood for the space.
    const slug = workspaceSlug(`${"a".repeat(92)} ${"b".repeat(10)}`, () => "abc123");

    expect(slug).toBe(`${"a".repeat(92)}-abc123`);
  });

  it.each([
    "Studio Nord",
    "   ",
    "🚀🚀🚀",
    "---",
    "Ünïcödé & Çie",
    "a".repeat(300),
    "x - ".repeat(60),
    "مساحة العمل",
  ])("gives a slug that passes the schema for %j", (name) => {
    const slug = workspaceSlug(name);

    expect(slug).toMatch(SERVER_SLUG);
    expect(slug.length).toBeGreaterThanOrEqual(1);
    expect(slug.length).toBeLessThanOrEqual(SERVER_MAX);
  });
});

describe("createWorkspace", () => {
  const created = { success: true, data: { id: "org_new" } } as const;

  /** The dependencies of the flow, each call written to `calls`; `switched` is what the switch answers. */
  function flow(
    calls: string[],
    {
      switched = true,
      create = async ({ name, slug }: { name: string; slug: string }) => {
        calls.push(`create:${name}:${slug}`);
        return created;
      },
    }: {
      switched?: boolean;
      create?: Parameters<typeof createWorkspace>[0]["create"];
    } = {},
  ) {
    return {
      create,
      switchTo: async (id: string) => {
        calls.push(`switch:${id}`);
        return switched;
      },
      refresh: () => calls.push("refresh"),
    };
  }

  it("creates the workspace under its name and a slug, then switches to it", async () => {
    const calls: string[] = [];

    const ok = await createWorkspace(flow(calls), "Studio Nord");

    expect(ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatch(/^create:Studio Nord:studio-nord-[a-z0-9]{6}$/);
    expect(calls[1]).toBe("switch:org_new");
  });

  it("trims the name it creates the workspace under", async () => {
    let received = "";

    await createWorkspace(
      flow([], {
        create: async ({ name }) => {
          received = name;
          return created;
        },
      }),
      "  Studio Nord  ",
    );

    expect(received).toBe("Studio Nord");
  });

  it("does not switch to a workspace that was not created, and has nothing to read again", async () => {
    const calls: string[] = [];

    const ok = await createWorkspace(
      flow(calls, {
        create: async () => ({ success: false, error: "Failed to create organization" }),
      }),
      "Studio Nord",
    );

    expect(ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it("lets a call that failed outright through, for the dialog to say so", async () => {
    const calls: string[] = [];

    await expect(
      createWorkspace(
        flow(calls, {
          create: async () => {
            throw new Error("Failed to fetch");
          },
        }),
        "Studio Nord",
      ),
    ).rejects.toThrow("Failed to fetch");

    expect(calls).toEqual([]);
  });

  it("reads the shell again when the switch to the new workspace fails: it exists, and the list must show it", async () => {
    const calls: string[] = [];

    const ok = await createWorkspace(flow(calls, { switched: false }), "Studio Nord");

    // The workspace was created, so the dialog is done: a second try would create another.
    expect(ok).toBe(true);
    expect(calls).toHaveLength(3);
    expect(calls[1]).toBe("switch:org_new");
    expect(calls[2]).toBe("refresh");
  });

  it("does not read the shell again when the switch worked: going to the new home does it", async () => {
    const calls: string[] = [];

    await createWorkspace(flow(calls, { switched: true }), "Studio Nord");

    expect(calls).not.toContain("refresh");
  });
});
