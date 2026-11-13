import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A variable set to nothing (`DATABASE_URL=`) counts as unset. The screenshot
 * server sets `DATABASE_URL` to nothing on purpose: Next fills a variable that
 * is missing from the environment from the `.env` files, but not one that is
 * set, even to nothing, so a developer's `.env.local` cannot send the server to
 * their PostgreSQL. Without the option, the URL check of the schema refuses the
 * empty value as soon as a route that reads `env` is loaded, and the build stops.
 * Nothing is loosened beyond that: a value that is there is still checked.
 */

/** Loads the schema afresh with these variables, and with the validation on (CI skips it). */
async function loadEnv(variables: Record<string, string>) {
  vi.stubEnv("SKIP_ENV_VALIDATION", "");
  for (const [name, value] of Object.entries(variables)) {
    vi.stubEnv(name, value);
  }
  vi.resetModules();

  return (await import("@/shared/lib/env")).env;
}

describe("the validated environment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("reads an optional URL set to nothing as unset", async () => {
    const env = await loadEnv({ DATABASE_URL: "" });

    expect(env.DATABASE_URL).toBeUndefined();
  });

  it.each([
    ["SMTP_PORT", 587],
    ["BETTER_AUTH_URL", "http://localhost:3088"],
    ["RATE_LIMIT_ADAPTER", "memory"],
  ] as const)(
    "gives %s set to nothing the default of its schema: %s",
    async (name, expected) => {
      const env = await loadEnv({ [name]: "" });

      expect(env[name]).toBe(expected);
    },
  );

  it("still refuses a value that is there and is not a URL", async () => {
    // The schema prints what it refused before it throws: kept out of the output
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(loadEnv({ DATABASE_URL: "not-a-url" })).rejects.toThrow(
      "Invalid environment variables",
    );
  });
});
