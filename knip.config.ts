import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    "src/app/**/*.{ts,tsx}",
    "scripts/*.ts",
  ],
  project: ["src/**/*.{ts,tsx}"],
  ignore: ["src/shared/components/ui/**"],
  ignoreDependencies: [
    "@commitlint/config-conventional",
    "@tailwindcss/postcss",
    "dotenv-cli",
    // The screenshots (tests/screenshots/save-png.ts) are outside the project knip reads
    "sharp",
  ],
  next: {
    entry: [
      "src/app/**/*.{ts,tsx}",
      "next.config.ts",
    ],
  },
};

export default config;
