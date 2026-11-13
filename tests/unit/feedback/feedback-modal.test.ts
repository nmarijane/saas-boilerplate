import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ESLint } from "eslint";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * The attachment of the feedback dialog belongs to the upload feature, which a
 * project may remove (docs/SETUP.md, Phase 3). What it does to the dialog is
 * written in the dialog: a block between two markers, and the lines that end
 * with `// upload`. These checks keep the dialog removable by exactly that, and
 * leave it as clean as the project's linter asks (no import and no value left
 * that only the attachment used).
 */

const ROOT = resolve(import.meta.dirname, "../../..");
const MODAL = "src/features/feedback/components/feedback-modal.tsx";
const STORIES = "src/features/feedback/components/feedback-modal.stories.tsx";

const read = (path: string) => readFileSync(resolve(ROOT, path), "utf-8");
const SOURCE = read(MODAL);

const START = "{/* upload:start */}";
const END = "{/* upload:end */}";
const MARKED = /\/\/ upload\s*$/;

/** The block between the markers, markers included. */
function blockOf(source: string): string {
  const start = source.indexOf(START);
  const end = source.indexOf(END);

  return source.slice(start, end + END.length);
}

/** Every line that ends with `// upload` taken out. */
function withoutMarkedLines(source: string): string {
  return source
    .split("\n")
    .filter((line) => !MARKED.test(line))
    .join("\n");
}

/** The dialog as it is once the upload feature is gone: the block between the markers taken out, and every line marked `// upload`. */
function withoutUpload(source: string): string {
  return withoutMarkedLines(source.replace(blockOf(source), ""));
}

/** What the project's linter says about a source, as if it were the file at `path`. */
async function lint(source: string, path: string): Promise<string[]> {
  const [result] = await new ESLint({ cwd: ROOT }).lintText(source, { filePath: resolve(ROOT, path) });

  return (result?.messages ?? []).map(({ line, ruleId, message }) => `${line}: ${ruleId} ${message}`);
}

describe("the feedback dialog and the upload feature", () => {
  it("keeps the attachment between its two markers", () => {
    const start = SOURCE.indexOf(START);
    const end = SOURCE.indexOf(END);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(SOURCE.split(START)).toHaveLength(2);
    expect(SOURCE.split(END)).toHaveLength(2);

    const block = blockOf(SOURCE);
    expect(block).toContain("<UploadButton");
    expect(SOURCE.replace(block, "")).not.toContain("<UploadButton");
  });

  it("marks the two imports of the upload feature, and no other line names it", () => {
    const imports = SOURCE.split("\n").filter((line) => line.includes("@/features/upload/"));

    expect(imports).toHaveLength(2);
    for (const line of imports) {
      expect(line).toMatch(/^import .* from "@\/features\/upload\/[^"]+"; \/\/ upload$/);
    }
  });

  it("marks every other line outside the block that only the attachment uses", () => {
    const outside = SOURCE.replace(blockOf(SOURCE), "").split("\n");
    const lines = outside.filter((line) => /screenshot|userId|useUpload|UploadButton|useState|\bLabel\b/i.test(line));

    // The hook, the state, the label, the props, and what they are imported for.
    expect(lines.length).toBeGreaterThanOrEqual(6);
    for (const line of lines) {
      expect(line, "a line that only the attachment needs").toMatch(MARKED);
    }
  });

  it("marks the one line that calls the upload hook, which is outside the block", () => {
    const calls = SOURCE.split("\n").filter((line) => line.includes("useUpload("));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(MARKED);
  });

  it("says nothing of the upload feature once the block and the marked lines are taken out", () => {
    const left = withoutUpload(SOURCE);

    // Neither the components and the hook it imports, nor what the hook gave, nor what only it needed.
    expect(left).not.toMatch(/upload/i);
    expect(left).not.toMatch(/screenshot/i);
    expect(left).not.toContain("userId");
    expect(left).toContain("submitFeedback(");
  });

  it("is still a module once they are taken out", () => {
    const { diagnostics } = ts.transpileModule(withoutUpload(SOURCE), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
      reportDiagnostics: true,
    });

    expect(diagnostics).toEqual([]);
  });

  it("passes the linter of the project once they are taken out: no import and no value is left unused", async () => {
    expect(await lint(withoutUpload(SOURCE), MODAL)).toEqual([]);
  }, 30_000);

  it("is held to that by a linter that can fail: take out the block alone and what it used is left unused", async () => {
    const left = await lint(SOURCE.replace(blockOf(SOURCE), ""), MODAL);

    expect(left.length).toBeGreaterThan(0);
    expect(left.join("\n")).toContain("unused-imports/no-unused");
  }, 30_000);

  it("is the same as it is: the linter has nothing to say of the dialog with the upload feature", async () => {
    expect(await lint(SOURCE, MODAL)).toEqual([]);
  }, 30_000);

  describe("its story", () => {
    const stories = read(STORIES);

    it("marks the argument that only the attachment takes, as the dialog marks its prop", () => {
      const lines = stories.split("\n").filter((line) => line.includes("userId"));

      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(MARKED);
    });

    it("no longer passes it once the marked lines are taken out, so that the story still fits the dialog", () => {
      expect(withoutMarkedLines(stories)).not.toContain("userId");
    });
  });
});
