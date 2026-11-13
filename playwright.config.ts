import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// The end-to-end tests (`npm run test:e2e`): the app is built and served on its
// own port, over a database it seeds and deletes before each run, as the
// screenshots' is (playwright.screenshots.config.ts). It is never the dev server:
// that one holds port 3088 and ./local.db, and a test that signs people up and
// deletes workspaces must not touch the database a developer works in. The
// database is the script's business (e2e:serve names it at each step), not the
// environment's: it is the same when the script is started by hand. The tests sign
// in as the people of the seed (admin@example.com, dev@example.com and the demo
// workspace of camille@example.com), and each one that changes an account has one
// of its own.

const ORIGIN = "http://localhost:3090";

// The secret of Better Auth is drawn for the run, and the tests need it too: the server mails nothing, so a test
// that makes an account signs the link of its verification itself (tests/e2e/support.ts). The workers load this
// file again and inherit the environment of the process that started them: the secret is drawn once, there, and
// every one of them reads the same.
const AUTH_SECRET = process.env.E2E_AUTH_SECRET ?? randomBytes(32).toString("hex");
process.env.E2E_AUTH_SECRET = AUTH_SECRET;

export default defineConfig({
  testDir: "./tests/e2e",
  // The files are `*.e2e.ts`: the default match (`*.spec.*`, `*.test.*`) finds none of them
  testMatch: "*.e2e.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: ORIGIN,
    locale: "en-US",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run e2e:serve",
    url: `${ORIGIN}/en/sign-in`,
    timeout: 600_000,
    reuseExistingServer: false,
    stdout: "pipe",
    env: {
      BETTER_AUTH_URL: ORIGIN,
      NEXT_PUBLIC_APP_URL: ORIGIN,
      // The seed and the server read the same clock: the dates of the demo are relative to it
      TZ: "UTC",
      // A production server refuses the default secret of Better Auth: this one is drawn for the run
      BETTER_AUTH_SECRET: AUTH_SECRET,
      // No assistant provider: a key in the environment of the machine would put a chat where the tests of
      // the assistant page look for its empty state. An empty variable is set, and counts for nothing.
      OPENAI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      GOOGLE_GENERATIVE_AI_API_KEY: "",
      GROQ_API_KEY: "",
      OLLAMA_BASE_URL: "",
    },
  },
});
