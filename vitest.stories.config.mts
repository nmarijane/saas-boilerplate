import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// The play function of every story, in a real browser (`npm run test:stories`). It is a config of its own, not a
// project of vitest.config.mts: `npx vitest run` runs the unit and integration tests in Node, over PGlite, with no
// browser installed, and must stay that. The plugin reads the stories and the Vite config of Storybook
// (.storybook/main.ts, preview.tsx), and each story is rendered at the viewport it asks for
// (`globals: { viewport }`), as Storybook itself does.
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [storybookTest({ configDir: resolve(root, ".storybook") })],
  test: {
    name: "stories",
    include: [],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
