import { readFileSync } from "node:fs";

/**
 * What a file runs: its source without the comments, which may talk about what
 * no rule is met by.
 */
export function sourceOf(path: string): string {
  return readFileSync(path, "utf-8")
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/^\s*\/\/.*$/gm, "");
}

/**
 * Whether a source (read with `sourceOf`) hands the error it caught to the
 * shared reporter, `useReportError(error)`: an error boundary is a client file,
 * and an effect does not run in static markup, so the call is read where it is
 * written.
 */
export function reportsItsError(source: string): boolean {
  return /\buseReportError\(error\)/.test(source);
}
