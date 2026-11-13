import type { StorybookConfig } from "@storybook/nextjs-vite";
import { serverActionStubs } from "./server-action-stubs";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  // The essentials (controls, actions, viewport...) are built into Storybook since 9.
  addons: [
    "@storybook/addon-a11y",
  ],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  staticDirs: ["../public"],
  // A story has no server to call: the modules that hold server actions are
  // replaced by stubs of the same names (server-action-stubs.ts), so that no
  // server code reaches the bundle. And a bundle cannot keep a `"use client"`
  // directive, which a story has no use for: the build drops that warning and
  // prints every other log. (`onLog` is what Rolldown, under Vite 8,
  // recommends over the legacy `onwarn`.)
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: [serverActionStubs(), ...(viteConfig.plugins ?? [])],
    // The framework maps `@opentelemetry/api` to the copy that Next compiles for
    // its server, a CommonJS file that reads `__dirname`, which a browser does
    // not have. The AI SDK imports it, and the stories of the chat load the SDK:
    // without a value the module fails on that line. It uses it for nothing here.
    define: { ...viteConfig.define, __dirname: JSON.stringify("/") },
    build: {
      ...viteConfig.build,
      rolldownOptions: {
        ...viteConfig.build?.rolldownOptions,
        onLog(level, log, defaultHandler) {
          if (log.code !== "MODULE_LEVEL_DIRECTIVE") {
            defaultHandler(level, log);
          }
        },
      },
    },
  }),
};

export default config;
