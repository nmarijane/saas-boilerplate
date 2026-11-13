import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEV_APP_URL } from "@/shared/config/app";

/**
 * `npm run dev` serves on one port, and every default and every example the
 * repository gives for the address of the app says that same port: a client
 * that follows a default to another one signs nobody in. The container is the
 * exception that is none: Docker maps its own port 3000, and says so itself.
 */

const root = resolve(import.meta.dirname, "../../..");

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf-8");
}

const devScript = (JSON.parse(read("package.json")) as { scripts: { dev: string } }).scripts.dev;
const devPort = /--port (\d+)/.exec(devScript)?.[1] ?? "";
const devOrigin = `http://localhost:${devPort}`;

/** What a file or a folder of the repository holds, as text: its path from the root, and its content. */
function textFilesUnder(path: string): { path: string; text: string }[] {
  const full = resolve(root, path);
  const files = readdirSync(full, { recursive: true, encoding: "utf8", withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)));

  return files.length > 0 ? files.map((file) => ({ path: file, text: read(file) })) : [];
}

/** The files that tell a reader where the app is, or build the address of the app from a default. Tests, docker and the old design notes are not among them. */
function shippedFiles(): { path: string; text: string }[] {
  const single = [
    ".env.example",
    "README.md",
    "CONTRIBUTING.md",
    "CLAUDE.md",
    "docs/SETUP.md",
    "playwright.config.ts",
    "playwright.screenshots.config.ts",
    ".vscode/launch.json",
    "landing/index.html",
  ];
  const folders = ["src", "emails", "content", "scripts"];

  return [
    ...single.map((path) => ({ path, text: read(path) })),
    ...folders.flatMap((folder) => textFilesUnder(folder)),
  ];
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("the port of npm run dev", () => {
  it("is a port the script names", () => {
    expect(devPort).toMatch(/^\d+$/);
  });

  it("is the one of the default origin of the app", () => {
    expect(DEV_APP_URL).toBe(devOrigin);
  });

  it("is the one of the example environment, for the server and for the browser", () => {
    const example = read(".env.example");

    expect(example).toContain(`BETTER_AUTH_URL=${devOrigin}\n`);
    expect(example).toContain(`NEXT_PUBLIC_APP_URL=${devOrigin}\n`);
  });

  it("is the one of the defaults of the validated environment", async () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "");
    vi.stubEnv("BETTER_AUTH_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.resetModules();

    const { env } = await import("@/shared/lib/env");

    expect(env.BETTER_AUTH_URL).toBe(devOrigin);
    expect(env.NEXT_PUBLIC_APP_URL).toBe(devOrigin);
  });

  it("is the one every shipped file gives, none of them sending a reader to port 3000", () => {
    const strays = shippedFiles()
      .filter(({ text }) => /localhost:3000\b/.test(text))
      .map(({ path }) => path);

    expect(strays).toEqual([]);
  });
});
