import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `--danger` is the color of a graphic or of a control (3:1): a danger fill, a
 * border, an icon. Text takes `--danger-text`, which holds 4.5:1 on the
 * surfaces. The primitives of `ui/` keep the shadcn names (`bg-destructive` with
 * `text-destructive-foreground`, which the `destructive` variants build on); the
 * rest of the app writes `text-danger-text`, or `text-danger-on` on a danger fill.
 */

const ROOT = resolve(import.meta.dirname, "../../..");

const DESTRUCTIVE_TEXT = /\btext-destructive\b/;

const PRIMITIVES = "src/shared/components/ui/";

/** The `.tsx` sources of src outside the primitives, as paths from the root of the project. */
const files = readdirSync(join(ROOT, "src"), {
  recursive: true,
  encoding: "utf8",
})
  .filter((file) => file.endsWith(".tsx"))
  .map((file) => `src/${file.split("\\").join("/")}`)
  .filter((file) => !file.startsWith(PRIMITIVES))
  .sort();

/** `file:line: text` for each line of a source that writes `text-destructive`. */
function offences(file: string): string[] {
  return readFileSync(join(ROOT, file), "utf-8")
    .split("\n")
    .flatMap((line, index) =>
      DESTRUCTIVE_TEXT.test(line)
        ? [`${file}:${index + 1}: ${line.trim()}`]
        : [],
    );
}

describe("danger text guard", () => {
  it.each([
    "text-destructive",
    "hover:text-destructive",
    "text-destructive/80",
    // A label on a danger fill is `text-danger-on` outside the primitives.
    "bg-destructive text-destructive-foreground",
  ])("flags %s", (text) => {
    expect(DESTRUCTIVE_TEXT.test(text)).toBe(true);
  });

  it.each([
    "text-danger-text",
    "text-danger-on",
    "bg-danger text-danger-on",
    "bg-destructive",
    "aria-invalid:border-destructive",
    "text-ink-muted",
  ])("lets %s through", (text) => {
    expect(DESTRUCTIVE_TEXT.test(text)).toBe(false);
  });

  it("covers the components of the app and leaves the primitives out", () => {
    expect(files).toContain("src/shared/components/data/page-header.tsx");
    expect(files.filter((file) => file.startsWith(PRIMITIVES))).toEqual([]);
  });

  it("colors error text with --danger-text, not --danger", () => {
    const found = files.flatMap(offences);

    expect(
      found,
      `Write text-danger-text for error text, or text-danger-on on a danger fill:\n${found.join("\n")}`,
    ).toEqual([]);
  });
});
