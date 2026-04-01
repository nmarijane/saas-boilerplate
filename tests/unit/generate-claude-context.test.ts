import { execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");
const OUTPUT = join(ROOT, "CLAUDE-CONTEXT.md");

describe("generate-claude-context", () => {
  afterEach(() => {
    // Clean up generated file
    try {
      unlinkSync(OUTPUT);
    } catch {
      // ignore
    }
  });

  it("generates CLAUDE-CONTEXT.md with expected sections", () => {
    execSync("npx tsx scripts/generate-claude-context.ts", {
      cwd: ROOT,
      stdio: "pipe",
    });

    expect(existsSync(OUTPUT)).toBe(true);

    const content = readFileSync(OUTPUT, "utf-8");

    // Header
    expect(content).toContain("# CLAUDE-CONTEXT.md");
    expect(content).toContain("Auto-generated on");

    // DB Schema section — should find known tables
    expect(content).toContain("## Database Schema (Drizzle ORM)");
    expect(content).toContain("`user`");
    expect(content).toContain("`feature_flag`");
    expect(content).toContain("`plan`");
    expect(content).toContain("`subscription`");

    // Column extraction
    expect(content).toContain("| Column | Type |");
    expect(content).toContain("| email | text |");

    // Feature flags section
    expect(content).toContain("## Feature Flags");
    expect(content).toContain("getAllFeatureFlags");

    // API Routes section
    expect(content).toContain("## API Routes");
    expect(content).toContain("/api/");

    // Feature modules section
    expect(content).toContain("## Feature Modules");
    expect(content).toContain("**auth**");
    expect(content).toContain("**billing**");

    // Usage section
    expect(content).toContain("## Usage");
  });

  it("includes total table count", () => {
    execSync("npx tsx scripts/generate-claude-context.ts", {
      cwd: ROOT,
      stdio: "pipe",
    });

    const content = readFileSync(OUTPUT, "utf-8");
    const match = content.match(/\*\*Total tables:\*\* (\d+)/);
    expect(match).not.toBeNull();
    const count = Number(match![1]);
    // Should find at least the core tables (user, session, feature_flag, plan, subscription, etc.)
    expect(count).toBeGreaterThanOrEqual(5);
  });
});
