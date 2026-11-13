import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Static checks on the openers of PGlite. Every one goes through `openPglite()`
 * (src/shared/lib/pglite-open.ts), which takes the lock of the directory first and
 * keeps one client per directory in a process: two processes on one PGlite
 * directory break it for good, and the next one to open it aborts. A script that
 * opened ./local.db by itself, with `new PGlite(path)` or with Drizzle's own
 * `drizzle(path)`, would take no lock, and run while `npm run dev` holds the
 * directory it would break it without a word. So the package is loaded by
 * pglite-open.ts alone, and Drizzle's PGlite driver only by the two files that hand
 * it a client of `openPglite()`. Types load nothing, and the tests open throwaway
 * directories of their own: both are free.
 */

const ROOT = join(__dirname, "../..");

const RULE = "Open PGlite through openPglite() (src/shared/lib/pglite-open.ts), never with `new PGlite()` or "
  + "Drizzle's `drizzle(path)`: it takes the lock of the directory first, and two processes on one PGlite directory "
  + "break it for good (the next one to open it aborts).";

/** The modules that open PGlite, and the only files that may load them. */
const OPENERS: Array<{ name: string; loads: (module: string) => boolean; files: string[] }> = [
  {
    name: "@electric-sql/pglite",
    loads: (module) => module === "@electric-sql/pglite" || module.startsWith("@electric-sql/pglite/"),
    files: ["src/shared/lib/pglite-open.ts"],
  },
  {
    // Its `drizzle()` opens a PGlite of its own when it is given a path; the migrator and the session open nothing
    name: "drizzle-orm/pglite",
    loads: (module) => module === "drizzle-orm/pglite" || module === "drizzle-orm/pglite/driver",
    files: ["src/shared/lib/DB.ts", "scripts/seed.ts"],
  },
];

const CODE = /\.(?:[cm]?[jt]s|[jt]sx)$/;

function parse(path: string, text: string): ts.SourceFile {
  const kind = path.endsWith("x") ? ts.ScriptKind.TSX : path.endsWith("js") ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
}

/** The code of the app, of the scripts and the config files at the root, as paths from the root. */
function codeFiles(): string[] {
  const under = (folder: string) => readdirSync(join(ROOT, folder), { recursive: true, encoding: "utf8" })
    .filter((file) => CODE.test(file))
    .map((file) => relative(ROOT, join(ROOT, folder, file)).split(sep).join("/"));
  const root = readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && CODE.test(entry.name))
    .map((entry) => entry.name);

  return [...under("src"), ...under("scripts"), ...root].sort();
}

/** Whether an import loads nothing at run time: `import type`, or names that are all types. */
function typeOnlyImport(clause: ts.ImportClause | undefined): boolean {
  if (!clause) {
    return false;
  }
  const bindings = clause.namedBindings;

  return clause.isTypeOnly || (!clause.name && !!bindings && ts.isNamedImports(bindings)
    && bindings.elements.length > 0 && bindings.elements.every((element) => element.isTypeOnly));
}

function typeOnlyExport(node: ts.ExportDeclaration): boolean {
  const clause = node.exportClause;

  return node.isTypeOnly || (!!clause && ts.isNamedExports(clause)
    && clause.elements.length > 0 && clause.elements.every((element) => element.isTypeOnly));
}

/** The modules a source loads at run time, with their lines: imports and re-exports that are not type-only, `import()` and `require()`. */
function loadsOf(path: string, text: string): Array<{ module: string; line: number }> {
  const ast = parse(path, text);
  const found: Array<{ module: string; line: number }> = [];
  const add = (node: ts.Node, module: string) =>
    found.push({ module, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 });
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && !typeOnlyImport(node.importClause)) {
      add(node, node.moduleSpecifier.text);
    }
    else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && !typeOnlyExport(node)) {
      add(node, node.moduleSpecifier.text);
    }
    else if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly && ts.isExternalModuleReference(node.moduleReference)
      && ts.isStringLiteral(node.moduleReference.expression)) {
      add(node, node.moduleReference.expression.text);
    }
    else if (ts.isCallExpression(node)) {
      const [first] = node.arguments;
      const loads = node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === "require");
      if (loads && first && ts.isStringLiteralLike(first)) {
        add(node, first.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);

  return found;
}

/** Where a module of OPENERS is loaded, as `file:line`, in the files that may not load it. */
function strayLoads(opener: (typeof OPENERS)[number]): string[] {
  return codeFiles()
    .filter((file) => !opener.files.includes(file))
    .flatMap((file) => loadsOf(file, readFileSync(join(ROOT, file), "utf8"))
      .filter(({ module }) => opener.loads(module))
      .map(({ module, line }) => `${file}:${line} loads ${module}`));
}

/** Whether a config names a `driver: "pglite"`. */
function namesPgliteDriver(path: string): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && node.name.getText() === "driver"
      && ts.isStringLiteralLike(node.initializer) && node.initializer.text === "pglite") {
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(path, readFileSync(join(ROOT, path), "utf8")));

  return found;
}

describe("the openers of PGlite", () => {
  it.each(OPENERS)("load $name only where a client of openPglite() is made or handed over", (opener) => {
    expect(strayLoads(opener), RULE).toEqual([]);
  });

  // drizzle-kit would open the directory itself, with no lock, for db:migrate and db:studio
  it("leave drizzle-kit to PostgreSQL: drizzle.config.ts names no PGlite driver", () => {
    expect(namesPgliteDriver("drizzle.config.ts"), RULE).toBe(false);
  });

  // The checks are only worth something if they see what they look for
  it("are found where they are allowed: the files read hold them", () => {
    const files = codeFiles();

    expect(files).toEqual(expect.arrayContaining(["src/shared/lib/pglite-open.ts", "scripts/seed.ts", "drizzle.config.ts", "next.config.ts"]));
    for (const opener of OPENERS) {
      for (const file of opener.files) {
        const modules = loadsOf(file, readFileSync(join(ROOT, file), "utf8")).map(({ module }) => module);

        expect(modules.some(opener.loads), `${file} loads ${opener.name}`).toBe(true);
      }
    }
  });

  it.each([
    ["a static import", "import { PGlite } from \"@electric-sql/pglite\";", ["@electric-sql/pglite"]],
    ["an import of the module for its effects", "import \"@electric-sql/pglite\";", ["@electric-sql/pglite"]],
    ["an import()", "const { PGlite } = await import(\"@electric-sql/pglite\");", ["@electric-sql/pglite"]],
    ["a require()", "const { PGlite } = require(\"@electric-sql/pglite\");", ["@electric-sql/pglite"]],
    ["a re-export", "export { PGlite } from \"@electric-sql/pglite\";", ["@electric-sql/pglite"]],
    ["an import type", "import type { PGlite } from \"@electric-sql/pglite\";", []],
    ["an import of types only", "import { type PGlite } from \"@electric-sql/pglite\";", []],
    ["a type re-export", "export type { PGlite } from \"@electric-sql/pglite\";", []],
    ["a type of import()", "type Client = typeof import(\"@electric-sql/pglite\");", []],
    ["the name in a string", "const external = [\"@electric-sql/pglite\"];", []],
  ])("tell %s from what loads nothing", (_, source, modules) => {
    expect(loadsOf("example.ts", source).map(({ module }) => module)).toEqual(modules);
  });
});
