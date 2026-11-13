import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Static checks on the shell. The shell (src/shared) knows no feature: each
 * feature declares what it adds in its own shell.ts, and the registry is the
 * one place that lists the features installed.
 */

const ROOT = join(__dirname, "../../..");
const SRC = join(ROOT, "src");
const REGISTRY = "src/features/registry.ts";

function parse(path: string, text: string): ts.SourceFile {
  const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
}

function read(path: string): ts.SourceFile {
  return parse(path, readFileSync(join(ROOT, path), "utf8"));
}

/** The files of a folder under src/, as paths from the root of the repository. */
function filesUnder(folder: string, pattern: RegExp): string[] {
  const base = join(SRC, folder);
  return readdirSync(base, { recursive: true, encoding: "utf8" })
    .filter((file) => pattern.test(file))
    .map((file) => relative(ROOT, join(base, file)).split(sep).join("/"))
    .sort();
}

/** Every module a file names: static, dynamic, type-only and re-exported. */
function specifiersOf(ast: ts.SourceFile): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push(node.moduleSpecifier.text);
    }
    else if (ts.isCallExpression(node)) {
      const [first] = node.arguments;
      const loads = node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === "require");
      if (loads && first && ts.isStringLiteralLike(first)) found.push(first.text);
    }
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      found.push(node.argument.literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return found;
}

const FEATURE_IMPORT = /^@\/features\/|\/features\//;

function importsServerOnly(ast: ts.SourceFile): boolean {
  return ast.statements.some((statement) =>
    ts.isImportDeclaration(statement)
    && !statement.importClause
    && ts.isStringLiteral(statement.moduleSpecifier)
    && statement.moduleSpecifier.text === "server-only");
}

/** The value imports of the registry (`import "server-only"` has no binding, so it is not one): the names it takes from each module. */
function registryImports(ast: ts.SourceFile): { specifier: string; names: string[] }[] {
  return ast.statements.flatMap((statement) => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return [];
    const { importClause } = statement;
    if (!importClause || importClause.isTypeOnly) return [];

    const bindings = importClause.namedBindings;
    const names = bindings && ts.isNamedImports(bindings)
      ? bindings.elements.filter((element) => !element.isTypeOnly).map((element) => element.name.text)
      : [];
    return [{ specifier: statement.moduleSpecifier.text, names }];
  });
}

/** The identifiers listed in `export const FEATURES = [ ... ]`. */
function listedFeatures(ast: ts.SourceFile): string[] {
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "FEATURES") continue;

      let value = declaration.initializer;
      while (value && (ts.isAsExpression(value) || ts.isSatisfiesExpression(value) || ts.isParenthesizedExpression(value))) {
        value = value.expression;
      }
      if (!value || !ts.isArrayLiteralExpression(value)) throw new Error("FEATURES must be an array literal");

      return value.elements.map((element) => {
        if (!ts.isIdentifier(element)) throw new Error(`FEATURES lists something other than an imported shell: ${element.getText()}`);
        return element.text;
      });
    }
  }
  throw new Error("The registry exports no FEATURES");
}

describe("shell boundaries", () => {
  it("keeps src/shared free of feature imports", () => {
    const offenders = filesUnder("shared", /\.tsx?$/)
      .flatMap((path) => specifiersOf(read(path)).filter((specifier) => FEATURE_IMPORT.test(specifier)).map((specifier) => `${path} imports ${specifier}`));

    expect(offenders).toEqual([]);
  });

  it("sees every form of import when it looks for feature imports", () => {
    const sample = [
      `import a from "@/features/a";`,
      `import type { B } from "../../features/b";`,
      `export * from "@/features/c";`,
      `export { d } from "../features/d";`,
      `const e = await import("@/features/e");`,
      `const f = require("@/features/f");`,
      `type G = import("@/features/g").G;`,
      `import fine from "@/shared/features-grid";`,
      `import react from "react";`,
    ].join("\n");

    expect(specifiersOf(parse("sample.ts", sample)).filter((specifier) => FEATURE_IMPORT.test(specifier))).toEqual([
      "@/features/a",
      "../../features/b",
      "@/features/c",
      "../features/d",
      "@/features/e",
      "@/features/f",
      "@/features/g",
    ]);
  });

  it("lists every feature shell in the registry, and nothing else", () => {
    const shells = filesUnder("features", /(?:^|[\\/])shell\.ts$/).map((path) => `@/${path.replace(/^src\//, "").replace(/\.ts$/, "")}`);
    const ast = read(REGISTRY);
    const imports = registryImports(ast);

    // The modules the registry imports are the shell files, one for one.
    expect(shells.length).toBeGreaterThan(0);
    expect(imports.map(({ specifier }) => specifier).sort()).toEqual(shells);

    // And what it imports is what FEATURES lists: no shell is imported then forgotten.
    expect(listedFeatures(ast).sort()).toEqual(imports.flatMap(({ names }) => names).sort());
  });

  it("marks the registry and the shell composition server-only", () => {
    for (const path of [REGISTRY, "src/features/app-shell.ts", "src/features/auth/organization/workspace.ts"]) {
      expect(importsServerOnly(read(path)), `${path} must import "server-only"`).toBe(true);
    }
  });
});
