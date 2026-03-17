import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    "src/app/**/*.{ts,tsx}",
    "src/middleware.ts",
    "scripts/*.ts",
  ],
  project: ["src/**/*.{ts,tsx}"],
  ignore: ["src/shared/components/ui/**"],
  ignoreDependencies: [
    "@commitlint/config-conventional",
    "@tailwindcss/postcss",
    "cross-env",
    "dotenv-cli",
    "rimraf",
  ],
  next: {
    entry: [
      "src/app/**/*.{ts,tsx}",
      "next.config.ts",
    ],
  },
};

export default config;
