import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Which files of the auth feature may take a value from which. A server module
 * imports values from plain modules only: a function taken from a `"use client"`
 * file reaches it as a reference to the client, which cannot be called there.
 * The other way round, a client file that takes a value from a module that
 * imports `"server-only"` breaks the build of the page. Only values count: a
 * type is erased, and a component taken from a client file is only drawn.
 */

const ROOT = resolve(import.meta.dirname, "../../..");
const FEATURE = "src/features/auth";

type Kind = "client" | "server-only" | "plain";

function parse(path: string, text: string): ts.SourceFile {
  const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
}

function read(path: string): ts.SourceFile {
  return parse(path, readFileSync(join(ROOT, path), "utf8"));
}

/** The files of a folder, recursively, as paths from the root of the repository. */
function filesUnder(folder: string): string[] {
  return readdirSync(join(ROOT, folder), { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file) && !/\.(?:stories|test)\.tsx?$/.test(file))
    .map((file) => `${folder}/${file.split(sep).join("/")}`)
    .sort();
}

/** What a file is: a client file (`"use client"` opens it), a server-only module (it imports `"server-only"`), or plain. */
function kindOf(ast: ts.SourceFile): Kind {
  const [first] = ast.statements;
  if (first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === "use client") {
    return "client";
  }

  const serverOnly = ast.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      !statement.importClause &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "server-only",
  );

  return serverOnly ? "server-only" : "plain";
}

/** The modules a file takes a value from: no `import type`, no import of types only; `export … from` counts. */
function valueSpecifiersOf(ast: ts.SourceFile): string[] {
  return ast.statements.flatMap((statement) => {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause;
      if (!clause) return [];
      if (clause.isTypeOnly) return [];

      const bindings = clause.namedBindings;
      const onlyTypes =
        !clause.name &&
        bindings !== undefined &&
        ts.isNamedImports(bindings) &&
        bindings.elements.every((element) => element.isTypeOnly);

      return onlyTypes ? [] : [statement.moduleSpecifier.text];
    }
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      return statement.isTypeOnly ? [] : [statement.moduleSpecifier.text];
    }

    return [];
  });
}

/** The file a specifier of a file of the app names, or undefined for a package. */
function resolveSpecifier(from: string, specifier: string): string | undefined {
  let base: string;
  if (specifier.startsWith("@/")) base = `src/${specifier.slice(2)}`;
  else if (specifier.startsWith(".")) base = relative(ROOT, resolve(dirname(join(ROOT, from)), specifier)).split(sep).join("/");
  else return undefined;

  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((candidate) => existsSync(join(ROOT, candidate)));
}

const FILES = filesUnder(FEATURE);
const KINDS = new Map(FILES.map((path) => [path, kindOf(read(path))]));

/** `file takes a value from other`, for every value import of a file of the feature that lands on a file of this kind. */
function importsOfKind(files: string[], kind: Kind): string[] {
  return files.flatMap((path) =>
    valueSpecifiersOf(read(path)).flatMap((specifier) => {
      const target = resolveSpecifier(path, specifier);
      return target && (KINDS.get(target) ?? kindOf(read(target))) === kind ? [`${path} takes a value from ${target}`] : [];
    }),
  );
}

describe("the boundaries of the auth feature", () => {
  it("reads the kind of a file as the build does", () => {
    expect(kindOf(parse("a.ts", `"use client";\nimport "x";`))).toBe("client");
    expect(kindOf(parse("a.ts", `import "server-only";\nimport x from "y";`))).toBe("server-only");
    expect(kindOf(parse("a.ts", `import x from "y";`))).toBe("plain");
    // A string that is not the first statement is no directive
    expect(kindOf(parse("a.ts", `import x from "y";\n"use client";`))).toBe("plain");
  });

  it("counts the values a file takes, and only them", () => {
    const sample = [
      `import a from "./a";`,
      `import { b } from "./b";`,
      `import type { C } from "./c";`,
      `import { type D, type E } from "./de";`,
      `import { type F, g } from "./fg";`,
      `import "./side-effect";`,
      `export { h } from "./h";`,
      `export type { I } from "./i";`,
      `import react from "react";`,
    ].join("\n");

    expect(valueSpecifiersOf(parse("sample.ts", sample))).toEqual(["./a", "./b", "./fg", "./h", "react"]);
  });

  it("finds the files of the feature, and tells the three kinds among them", () => {
    expect(FILES).toEqual(expect.arrayContaining([
      `${FEATURE}/auth-client.ts`,
      `${FEATURE}/auth-flows.ts`,
      `${FEATURE}/components/auth-card.tsx`,
      `${FEATURE}/components/sign-in-form.tsx`,
    ]));
    expect(KINDS.get(`${FEATURE}/auth-client.ts`)).toBe("client");
    expect(KINDS.get(`${FEATURE}/components/sign-in-form.tsx`)).toBe("client");
    expect(KINDS.get(`${FEATURE}/auth-flows.ts`)).toBe("plain");
    expect(KINDS.get(`${FEATURE}/components/auth-card.tsx`)).toBe("plain");
  });

  // A plain module of logic (a `.ts` file: the flows, the rules, the table of
  // error codes) may be imported by a server module, so it takes no value from
  // a client file. (A plain `.tsx` file draws a component from a client file: that is
  // what a server component does too, and it is fine.)
  it("keeps every plain module of logic free of values from a client file", () => {
    const plain = FILES.filter((path) => path.endsWith(".ts") && KINDS.get(path) === "plain");

    expect(plain.length).toBeGreaterThan(5);
    expect(importsOfKind(plain, "client")).toEqual([]);
  });

  it("keeps every client file free of values from a server-only module", () => {
    const clients = FILES.filter((path) => KINDS.get(path) === "client");

    expect(clients.length).toBeGreaterThan(5);
    expect(importsOfKind(clients, "server-only")).toEqual([]);
  });
});
