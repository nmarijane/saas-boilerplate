import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * A page is always asked for with its language (`/fr/sign-in`): a redirect to a
 * bare `/sign-in` leaves the proxy to add it, a second hop for the browser. So
 * no file of `src` takes `redirect` or `permanentRedirect` from `next/navigation`:
 * a page and a layout use the localized `redirect` of `@/shared/lib/i18n-navigation`
 * with the language of their `params`, and a guard or an action calls `redirectTo`
 * (`@/features/auth/redirect-to`), which reads the language of the request.
 *
 * The only plain redirect of the app, the proxy's, is `NextResponse.redirect`,
 * which builds its address from the language of the URL, and is not this import.
 */

const SRC = join(__dirname, "../../src");
const FORBIDDEN = new Set(["redirect", "permanentRedirect"]);

function filesOf(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return filesOf(path);
    }

    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** The names a file imports from `next/navigation`. */
export function importedFromNextNavigation(source: string): string[] {
  const file = ts.createSourceFile("file.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names: string[] = [];

  file.forEachChild((node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === "next/navigation"
    ) {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        names.push(...bindings.elements.map((element) => (element.propertyName ?? element.name).text));
      }
    }
  });

  return names;
}

describe("the redirects of the app are localized", () => {
  it("sees the plain redirects it is made to find", () => {
    expect(importedFromNextNavigation('import { notFound, redirect } from "next/navigation";')).toEqual(["notFound", "redirect"]);
    expect(importedFromNextNavigation('import { redirect as go } from "next/navigation";')).toEqual(["redirect"]);
    expect(importedFromNextNavigation('import { redirect } from "@/shared/lib/i18n-navigation";')).toEqual([]);
  });

  it("is run over the files of src", () => {
    expect(filesOf(SRC).length).toBeGreaterThan(100);
  });

  it("has no file of src that redirects with Next's own redirect", () => {
    const plain = filesOf(SRC)
      .filter((path) => importedFromNextNavigation(readFileSync(path, "utf-8")).some((name) => FORBIDDEN.has(name)))
      .map((path) => relative(SRC, path).split(sep).join("/"));

    expect(plain, "use `redirect` of @/shared/lib/i18n-navigation with the locale, or `redirectTo` in a guard").toEqual([]);
  });
});
