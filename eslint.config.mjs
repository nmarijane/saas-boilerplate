import antfu from "@antfu/eslint-config";

export default antfu(
  {
    typescript: true,
    formatters: false,
    stylistic: false,
    ignores: [
      "node_modules",
      ".next",
      "dist",
      "migrations",
      "local.db",
      "docs",
    ],
  },
  {
    files: ["*.config.ts", "*.config.mjs", "scripts/**"],
    rules: {
      "node/prefer-global/process": "off",
    },
  },
  {
    rules: {
      "node/prefer-global/process": "off",
      "e18e/prefer-array-fill": "off",
    },
  },
);
