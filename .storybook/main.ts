import type { StorybookConfig } from "@storybook/nextjs-vite";

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
  // A bundle cannot keep a `"use client"` directive, and a story has no use for
  // it: the build drops that warning and prints every other log. (`onLog` is
  // what Rolldown, under Vite 8, recommends over the legacy `onwarn`.)
  viteFinal: (viteConfig) => ({
    ...viteConfig,
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
