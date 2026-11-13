import type { ResolvedConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  serverActionStubs,
  stubServerModule,
} from "../../../.storybook/server-action-stubs";

const ROOT = resolve(import.meta.dirname, "../../..");

const SERVER_MODULE = `"use server";

import { db } from "@/shared/lib/DB";
import { requireAuth } from "@/features/auth/guards";

export async function submitFeedback(data: { message: string }) {
  await requireAuth();
  return db.insert(data);
}

export const markAllRead = async () => {};
`;

/** The exports a stub declares, by name. */
function exportsOf(stub: string): string[] {
  return [...stub.matchAll(/export const ([\w$]+) =/g)].map(([, name]) => name ?? "");
}

describe("stubServerModule", () => {
  it("stubs every export of a server module and imports nothing", () => {
    const stub = stubServerModule(SERVER_MODULE);

    expect(stub).not.toBeNull();
    expect(stub).not.toMatch(/\bimport\b/);
    expect(exportsOf(stub ?? "")).toEqual(["submitFeedback", "markAllRead"]);
  });

  it("makes each export an async function that answers success with no data", () => {
    const stub = stubServerModule(SERVER_MODULE) ?? "";

    for (const name of ["submitFeedback", "markAllRead"]) {
      expect(stub).toContain(
        `export const ${name} = async () => ({ success: true, data: undefined });`,
      );
    }
  });

  it("leaves other modules alone", () => {
    expect(stubServerModule('import x from "y"; export const a = 1;')).toBeNull();
  });

  it("takes the directive as the first statement only, after comments and in either quotes", () => {
    expect(
      stubServerModule(`// Server actions.\n/* more */\n'use server'\nexport async function a() {}`),
    ).not.toBeNull();
    expect(
      stubServerModule(`import x from "y";\n"use server";\nexport async function a() {}`),
    ).toBeNull();
    expect(
      stubServerModule(`const note = "use server";\nexport async function a() {}`),
    ).toBeNull();
  });

  it("names each export once, and still gives a module with no export a body", () => {
    const twice = stubServerModule(
      `"use server"; export async function a() {} export async function a() {}`,
    );
    const none = stubServerModule(`"use server"; const hidden = 1;`);

    expect(exportsOf(twice ?? "")).toEqual(["a"]);
    expect(none).toBe("export {};\n");
  });

  it("stubs the real server actions", () => {
    for (const path of [
      "src/features/auth/organization/actions.ts",
      "src/features/feedback/actions.ts",
    ]) {
      const stub = stubServerModule(readFileSync(resolve(ROOT, path), "utf-8"));

      expect(stub, path).not.toBeNull();
      expect(stub, path).not.toMatch(/\bimport\b/);
      expect(exportsOf(stub ?? "").length, path).toBeGreaterThan(0);
    }
  });

  it("stubs every function the organization actions export, the one the workspace dialog calls included", () => {
    const stub = stubServerModule(
      readFileSync(resolve(ROOT, "src/features/auth/organization/actions.ts"), "utf-8"),
    );

    expect(exportsOf(stub ?? "")).toContain("createOrganization");
  });
});

describe("serverActionStubs", () => {
  /** The plugin, once Vite has told it where the project is, and its `transform` as a plain function. */
  function plugin() {
    const stubs = serverActionStubs();
    const configured = stubs.configResolved;
    const configure = typeof configured === "function" ? configured : configured?.handler;
    configure?.call(undefined as never, { root: ROOT } as ResolvedConfig);

    const hook = stubs.transform;
    const handler = typeof hook === "function" ? hook : hook?.handler;

    return {
      stubs,
      transform: (code: string, id: string) =>
        handler?.call({} as never, code, id),
    };
  }

  it("runs before the other plugins, which would otherwise see the server code", () => {
    expect(plugin().stubs.enforce).toBe("pre");
  });

  it("stubs a server module under src/", () => {
    const result = plugin().transform(
      SERVER_MODULE,
      resolve(ROOT, "src/features/feedback/actions.ts"),
    );

    expect(result).toMatchObject({ map: null });
    expect(String((result as { code: string }).code)).toContain("export const submitFeedback");
  });

  it("reads through the query Vite adds to a module id", () => {
    const result = plugin().transform(
      SERVER_MODULE,
      `${resolve(ROOT, "src/features/feedback/actions.ts")}?v=abc123`,
    );

    expect(result).not.toBeNull();
  });

  it("leaves a module outside src/ alone, a dependency or the Storybook config", () => {
    const { transform } = plugin();

    expect(transform(SERVER_MODULE, resolve(ROOT, "node_modules/lib/actions.js"))).toBeNull();
    expect(transform(SERVER_MODULE, resolve(ROOT, ".storybook/actions.ts"))).toBeNull();
    // A folder that only starts like src.
    expect(transform(SERVER_MODULE, resolve(ROOT, "src-extra/actions.ts"))).toBeNull();
  });

  it("leaves a module under src/ that is no server module alone", () => {
    expect(
      plugin().transform("export const a = 1;", resolve(ROOT, "src/shared/a.ts")),
    ).toBeNull();
  });

  it("leaves what is not a script alone", () => {
    expect(
      plugin().transform('"use server"', resolve(ROOT, "src/styles/global.css")),
    ).toBeNull();
  });
});
