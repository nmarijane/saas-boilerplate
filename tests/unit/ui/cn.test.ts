import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cn } from "@/shared/utils/cn";
import { cn as helpersCn } from "@/shared/utils/helpers";
import { parseBlock } from "../../helpers/color";

/**
 * The type-scale sizes among CSS tokens: `--text-caption` or `--text-body-lg`,
 * but not a companion such as `--text-caption--line-height`.
 */
function sizeNames(tokens: string[]): string[] {
  return tokens.flatMap(
    (token) => /^--text-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(token)?.[1] ?? [],
  );
}

const scale = sizeNames(
  Object.keys(
    parseBlock(
      readFileSync(
        resolve(import.meta.dirname, "../../../src/styles/global.css"),
        "utf-8",
      ),
      "@theme",
    ),
  ),
);

describe("cn with the type scale", () => {
  it("keeps a type-scale size next to a text color, in either order", () => {
    expect(cn("text-caption text-warning-text")).toBe(
      "text-caption text-warning-text",
    );
    expect(cn("text-warning-text text-caption")).toBe(
      "text-warning-text text-caption",
    );
  });

  it("lets the last size win, whether it is ours or Tailwind's", () => {
    expect(cn("text-sm", "text-meta")).toBe("text-meta");
    expect(cn("text-caption", "text-sm")).toBe("text-sm");
    expect(cn("text-body", "text-key")).toBe("text-key");
  });

  it("still lets the last color win", () => {
    expect(cn("text-ink", "text-brand")).toBe("text-brand");
  });

  it("reads the sizes among the tokens, hyphens and digits included, and not their companions", () => {
    expect(
      sizeNames([
        "--text-caption",
        "--text-caption--line-height",
        "--text-section--font-weight",
        "--text-body-lg",
        "--text-2xs",
        "--container-content",
        "--ease-expo",
      ]),
    ).toEqual(["caption", "body-lg", "2xs"]);
  });

  it("knows every size global.css declares", () => {
    expect(scale.length).toBeGreaterThan(0);
    for (const size of scale) {
      expect(cn(`text-${size}`, "text-ink")).toBe(`text-${size} text-ink`);
    }
  });

  it("is the cn of the whole app: helpers.ts re-exports it", () => {
    expect(helpersCn).toBe(cn);
  });
});
