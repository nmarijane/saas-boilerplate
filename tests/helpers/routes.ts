import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { sourceOf } from "./source";

/**
 * The route tree of the app, read from the disk: where the pages, the states of
 * the pages and their layouts are. It knows no feature, and imports none: a rule
 * that is written with it keeps standing when a feature is removed.
 */

export const ROOT = resolve(import.meta.dirname, "../..");
export const SRC = join(ROOT, "src");
export const ROUTES = join(SRC, "app");
export const LOCALE = join(ROUTES, "[locale]");
export const APP = join(LOCALE, "(app)");
export const SHELL = join(APP, "(shell)");

/** A path as the repository writes it, for the message of a failure. */
export function inRepo(path: string): string {
  return relative(ROOT, path).split("\\").join("/");
}

/**
 * The folders under `under` (the connected space by default) that hold a file
 * of this name, relative to the language: "(app)/(shell)/ai". The folder of the
 * language itself is ".".
 */
export function foldersWith(name: string, under: string = APP): string[] {
  return readdirSync(under, { recursive: true, encoding: "utf8" })
    .map((file) => file.split("\\").join("/"))
    .filter((file) => basename(file) === name)
    .map((file) => relative(LOCALE, join(under, dirname(file))) || ".")
    .sort();
}

/** The folders above one, nearest first, up to `stop` (none for `stop` itself). */
export function above(folder: string, stop: string): string[] {
  const folders: string[] = [];
  let next = folder;
  while (next !== stop && next !== dirname(next)) {
    next = dirname(next);
    folders.push(next);
  }

  return folders;
}

/** The modules of the app a file imports (`@/` is `src/`, or a relative path), found on the disk. */
function localImports(file: string): string[] {
  const ast = ts.createSourceFile(
    file,
    readFileSync(file, "utf-8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  return ast.statements
    .filter(ts.isImportDeclaration)
    .flatMap(({ moduleSpecifier }) => {
      if (!ts.isStringLiteral(moduleSpecifier)) {
        return [];
      }
      const { text } = moduleSpecifier;
      const base = text.startsWith("@/")
        ? join(SRC, text.slice(2))
        : text.startsWith(".")
          ? resolve(dirname(file), text)
          : null;
      const found = base
        ? [".ts", ".tsx", "/index.ts", "/index.tsx"]
            .map((extension) => base + extension)
            .find((candidate) => existsSync(candidate))
        : undefined;

      return found ? [found] : [];
    });
}

const CALLS_NOT_FOUND = /\bnotFound\(\)/;

/**
 * Whether a layout decides a 404: it calls `notFound()`, or a module of the app
 * it imports does (the function that reads an entity and answers "not found" for
 * one that is not there). One step is enough: a layout asks, and the answer is
 * given where it asks.
 */
function decidesA404(layout: string): boolean {
  return (
    CALLS_NOT_FOUND.test(sourceOf(layout)) ||
    localImports(layout).some((file) => CALLS_NOT_FOUND.test(sourceOf(file)))
  );
}

/** The layouts of the language that decide a 404, as folders relative to it. */
export function layoutsThatDecideA404(): string[] {
  return foldersWith("layout.tsx", LOCALE).filter((folder) =>
    decidesA404(join(LOCALE, folder, "layout.tsx")),
  );
}

/**
 * The loading states that wrap a layout: those of the folders above it, up to
 * the root of the app, as folders relative to it. A loading state is a Suspense
 * boundary around everything under its folder, and the status of a response is
 * sent with the first boundary.
 */
export function loadingsAbove(layout: string): string[] {
  return above(join(LOCALE, layout), ROUTES)
    .filter((folder) => existsSync(join(folder, "loading.tsx")))
    .map((folder) => relative(ROUTES, folder));
}
