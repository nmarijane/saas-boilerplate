import { randomBytes } from "node:crypto";
import { defineConfig } from "@playwright/test";
import { SIGNED_IN } from "./tests/screenshots/signed-in";

// The screenshots of the README (`npm run screenshots`): the app is built and
// served on its own port, over a database it seeds with the demo workspace and
// deletes before each run, and signed in as one of the demo people. The files
// go to docs/screenshots, one per page and per project below. The database is
// the script's business (screenshots:serve names it at each step), not the
// environment's: it is the same when the script is started by hand.

const ORIGIN = "http://localhost:3089";

const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
};

/** `desktop-light`, `mobile-dark`...: the name tells the device and the color scheme. */
function screen(device: keyof typeof DEVICES, colorScheme: "light" | "dark") {
  return {
    name: `${device}-${colorScheme}`,
    dependencies: ["setup"],
    use: { ...DEVICES[device], colorScheme, storageState: SIGNED_IN },
  };
}

export default defineConfig({
  testDir: "./tests/screenshots",
  testMatch: "*.screenshots.ts",
  timeout: 60_000,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: ORIGIN,
    locale: "en-US",
    timezoneId: "UTC",
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    { name: "setup", testMatch: "auth.setup.ts" },
    screen("desktop", "light"),
    screen("desktop", "dark"),
    screen("mobile", "light"),
    screen("mobile", "dark"),
  ],
  webServer: {
    command: "npm run screenshots:serve",
    url: `${ORIGIN}/en/sign-in`,
    timeout: 600_000,
    reuseExistingServer: false,
    stdout: "pipe",
    env: {
      BETTER_AUTH_URL: ORIGIN,
      NEXT_PUBLIC_APP_URL: ORIGIN,
      // The seed and the server read the same clock: the dates of the demo
      // are relative to it, and a database that stamps a row in another zone
      // would shift it by the offset.
      TZ: "UTC",
      // A production server refuses the default secret of Better Auth: this one
      // is drawn for the run and lives as long as the server does.
      BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
      // The AI page says "not configured" until a provider has a key. It only
      // reads the seeded conversation and the run sends no message, so no
      // request reaches the provider: this is not a key, and none is needed.
      OPENAI_API_KEY: "not-a-key",
    },
  },
});
