import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The providers the sign-in pages draw a button for, from the real `auth.ts`:
 * its rule (a provider is on when both its keys are set) decides, and the
 * pages only ask. `auth.ts` reads the environment when it loads, so each case
 * sets the environment first and loads a fresh copy of the modules.
 */

async function providersFor(env: Record<string, string>) {
  vi.resetModules();
  for (const name of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"]) {
    vi.stubEnv(name, env[name] ?? "");
  }
  const { enabledSocialProviders } = await import("@/features/auth/social-providers");

  return enabledSocialProviders();
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the providers that sign-in can use, on this install", () => {
  it("are none when no OAuth key is set: a click would answer 404, so no button is drawn", async () => {
    await expect(providersFor({})).resolves.toEqual([]);
  });

  it("are the one whose two keys are set", async () => {
    await expect(providersFor({ GITHUB_CLIENT_ID: "dummy", GITHUB_CLIENT_SECRET: "dummy" })).resolves.toEqual(["github"]);
  });

  it("are both when both are set, in the order of the buttons", async () => {
    await expect(
      providersFor({
        GITHUB_CLIENT_ID: "dummy",
        GITHUB_CLIENT_SECRET: "dummy",
        GOOGLE_CLIENT_ID: "dummy",
        GOOGLE_CLIENT_SECRET: "dummy",
      }),
    ).resolves.toEqual(["google", "github"]);
  });

  it("leave out a provider that has its id but not its secret", async () => {
    await expect(providersFor({ GOOGLE_CLIENT_ID: "dummy" })).resolves.toEqual([]);
  });
});
