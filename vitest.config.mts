import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 15000,
    hookTimeout: 30000,
    sequence: {
      concurrent: false,
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: [
        "src/features/**/actions.ts",
        "src/features/**/queries.ts",
        "src/features/**/helpers.ts",
        "src/features/**/helpers/*.ts",
        "src/features/events/**/*.ts",
        "src/features/webhooks/matching.ts",
        "src/features/billing/webhook-handlers.ts",
        "src/shared/utils/helpers.ts",
        "src/shared/lib/rate-limit/memory.ts",
        "src/features/feature-flags/helpers.ts",
        "src/features/api-keys/helpers.ts",
      ],
    },
  },
});
