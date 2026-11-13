import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Nothing in the repository has the shape of a secret. The repository is public and
 * its host refuses a push that holds what looks like a live key (GitHub's push protection),
 * and every fork and every scanner (gitleaks, trufflehog) reports it as a real leak: a value
 * that a story or a test made up must not pass for one. Where a long key is needed, the run
 * of characters is cut by hyphens or underscores (`sk_live_Zk3V-EXAMPLE-0000-0000`): the
 * prefix a person sees stays, and no scanner can match it.
 */

const ROOT = resolve(import.meta.dirname, "../../..");
const SKIPPED_FOLDERS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".superpowers",
  ".e2e",
  ".screenshots",
  "coverage",
  "storybook-static",
  "test-results",
  "playwright-report",
  "local.db",
]);
const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs", ".mts", ".json", ".md", ".mdx", ".html", ".css",
  ".yml", ".yaml", ".txt", ".example", ".sql", ".sh",
]);

// The shapes of the secrets of the providers the app talks to, or that scanners look for first
const SHAPES: [string, RegExp][] = [
  ["a Stripe live key", /\b(?:sk|rk|pk)_live_[A-Za-z0-9]{16,}/],
  ["a Stripe webhook secret", /\bwhsec_[A-Za-z0-9]{24,}/],
  ["a GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,})/],
  ["an AWS access key id", /\b(?:AKIA|ASIA)[0-9A-Z]{12,}/],
  ["a Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["an Anthropic or OpenAI project key", /\bsk-(?:ant|proj)-[\w-]{20,}/],
  ["a Google API key", /\bAIza[\w-]{30,}/],
  ["a private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

/** The text files of the repository, as paths from its root. */
function textFiles(): string[] {
  return readdirSync(ROOT, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)))
    .filter((path) => !path.split("/").some((part) => SKIPPED_FOLDERS.has(part)))
    .filter((path) => path !== "package-lock.json")
    .filter((path) => TEXT_EXTENSIONS.has(extname(path)) || path.endsWith(".env.example"));
}

describe("the repository", () => {
  it("reads the files of the app, of the tests and of the docs", () => {
    const files = textFiles();

    expect(files.length).toBeGreaterThan(500);
    expect(files).toEqual(expect.arrayContaining([
      "src/features/api-keys/helpers.ts",
      "tests/unit/config/no-secrets.test.ts",
      "docs/SETUP.md",
      ".env.example",
    ]));
  });

  it("holds no value that has the shape of a secret: stories, tests, docs and examples included", () => {
    const found = textFiles().flatMap((path) =>
      readFileSync(resolve(ROOT, path), "utf-8")
        .split("\n")
        .flatMap((line, index) =>
          SHAPES.filter(([, shape]) => shape.test(line)).map(([name]) => `${path}:${index + 1} looks like ${name}`),
        ),
    );

    expect(found).toEqual([]);
  });

  // The test is only worth something if it sees what it is looking for
  it.each([
    ["a Stripe live key", `sk_live_${"A1b2".repeat(6)}`],
    ["a Stripe live key", `rk_live_${"A1b2".repeat(6)}`],
    ["a Stripe webhook secret", `whsec_${"A1b2".repeat(6)}`],
    ["a GitHub token", `ghp_${"A1b2".repeat(9)}`],
    ["an AWS access key id", `AKIA${"A1B2".repeat(4)}`],
    ["a Slack token", `xoxb-${"1234567890-"}abcdef`],
    ["a Google API key", `AIza${"A1b2".repeat(9)}`],
  ])("tells %s: %s", (name, value) => {
    expect(SHAPES.filter(([, shape]) => shape.test(`const KEY = "${value}";`)).map(([shapeName]) => shapeName)).toContain(name);
  });

  it("does not take for a secret what is cut by hyphens or underscores, which is what a story uses", () => {
    for (const value of ["sk_live_Zk3V-EXAMPLE-0000-0000-0000", "whsec_Q9n3-EXAMPLE-0000-0000-0000", `whsec_${"Q9n3_Vb7X_cLz2_MfHk_".repeat(8)}`, "sk_live_AbCd", "whsec_xxx"]) {
      expect(SHAPES.filter(([, shape]) => shape.test(value))).toEqual([]);
    }
  });
});
