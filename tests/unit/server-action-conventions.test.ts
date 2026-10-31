import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Static checks on server actions. Every function exported from a "use server"
 * module is reachable by any browser through a POST request, with the
 * arguments of its choice: it must check the caller itself.
 */

const ROOT = join(__dirname, "../..");
const SRC = join(ROOT, "src");

/** Guards that redirect (throw) when the caller is not allowed. */
const GUARDS = new Set(["requireAuth", "requireAdmin", "requireRole"]);

/** Server actions open on purpose. Key: "<file>#<export>"; value: why, in one line. */
const PUBLIC_ACTIONS: Record<string, string> = {
  "src/features/waitlist/actions.ts#joinWaitlist":
    "Anonymous waitlist sign-up: zod-validated input, rate-limited per IP.",
};

/** Read modules and internal operations: server-only, never server actions. */
const NEVER_USE_SERVER = /(?:^|\/)(?:queries|helpers|service)\.tsx?$|\/helpers\//;
const MUST_IMPORT_SERVER_ONLY = /(?:^|\/)(?:queries|service)\.tsx?$/;

interface Source {
  path: string;
  ast: ts.SourceFile;
}

function parse(path: string, text: string): ts.SourceFile {
  const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
}

function loadSources(): Source[] {
  return readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file) && !/\.(?:test|stories)\.tsx?$|\.d\.ts$/.test(file))
    .map((file) => {
      const path = relative(ROOT, join(SRC, file)).split(sep).join("/");
      return { path, ast: parse(path, readFileSync(join(SRC, file), "utf8")) };
    });
}

/** Directive prologue: the leading string statements of a file or function body. */
function directives(statements: ts.NodeArray<ts.Statement>): string[] {
  const found: string[] = [];
  for (const statement of statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    found.push(statement.expression.text);
  }
  return found;
}

function blockBody(node: ts.Node): ts.Block | undefined {
  const isFunction = ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node) || ts.isMethodDeclaration(node);
  return isFunction && node.body && ts.isBlock(node.body) ? node.body : undefined;
}

/** Function bodies that open with an inline "use server" directive. */
function inlineServerFunctions(ast: ts.SourceFile): ts.Block[] {
  const found: ts.Block[] = [];
  const visit = (node: ts.Node) => {
    const body = blockBody(node);
    if (body && directives(body.statements).includes("use server")) found.push(body);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return found;
}

function isAwaitedGuard(expression: ts.Expression | undefined): boolean {
  if (!expression || !ts.isAwaitExpression(expression)) return false;
  const call = expression.expression;
  return ts.isCallExpression(call) && ts.isIdentifier(call.expression) && GUARDS.has(call.expression.text);
}

/**
 * The first statement (after directives) is an awaited guard:
 * `await requireAuth()`, `const { session } = await requireRole(orgId, "admin")`,
 * or the same as the first statement of `return safeAction(async () => { ... })`.
 */
function startsWithGuard(body: ts.Block): boolean {
  const first = body.statements[directives(body.statements).length];
  if (!first) return false;

  if (ts.isExpressionStatement(first)) return isAwaitedGuard(first.expression);
  if (ts.isVariableStatement(first)) {
    return first.declarationList.declarations.some((declaration) => isAwaitedGuard(declaration.initializer));
  }
  if (ts.isReturnStatement(first) && first.expression && ts.isCallExpression(first.expression)) {
    const { expression: callee, arguments: args } = first.expression;
    const callback = args[0];
    const wrapsAction = ts.isIdentifier(callee) && callee.text === "safeAction";
    if (wrapsAction && callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) && ts.isBlock(callback.body)) {
      return startsWithGuard(callback.body);
    }
  }
  return false;
}

function isExported(statement: ts.Statement): boolean {
  return ts.canHaveModifiers(statement)
    && (ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false);
}

interface ActionScan {
  /** "<file>#<export>" of every server action found. */
  actions: string[];
  /** Server actions that do not start with a guard and are not whitelisted. */
  violations: string[];
}

function scanServerActions(path: string, ast: ts.SourceFile): ActionScan {
  const actions: string[] = [];
  const violations: string[] = [];
  const check = (name: string, body: ts.Block | undefined) => {
    const id = `${path}#${name}`;
    actions.push(id);
    if (!(body && startsWithGuard(body)) && !(id in PUBLIC_ACTIONS)) violations.push(id);
  };

  if (directives(ast.statements).includes("use server")) {
    for (const statement of ast.statements) {
      if (ts.isFunctionDeclaration(statement) && isExported(statement)) {
        check(statement.name?.text ?? "default", statement.body);
      }
      else if (ts.isVariableStatement(statement) && isExported(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          const name = ts.isIdentifier(declaration.name) ? declaration.name.text : declaration.name.getText();
          check(name, declaration.initializer && blockBody(declaration.initializer));
        }
      }
      else if ((ts.isExportDeclaration(statement) && !statement.isTypeOnly) || ts.isExportAssignment(statement)) {
        // Re-exports would turn functions from another module into unchecked actions
        violations.push(`${path}#<re-export at line ${ast.getLineAndCharacterOfPosition(statement.getStart()).line + 1}>`);
      }
    }
  }

  for (const body of inlineServerFunctions(ast)) {
    const line = ast.getLineAndCharacterOfPosition(body.getStart()).line + 1;
    check(`<inline action at line ${line}>`, body);
  }

  return { actions, violations };
}

describe("server action conventions", () => {
  const sources = loadSources();
  const scans = sources.map(({ path, ast }) => scanServerActions(path, ast));
  const allActions = scans.flatMap((scan) => scan.actions);

  it("scans the server action modules of src/", () => {
    expect(allActions).toContain("src/features/api-keys/actions.ts#createApiKeyAction");
    expect(allActions).toContain("src/features/waitlist/actions.ts#joinWaitlist");
  });

  it("never uses \"use server\" in queries, helpers or service modules", () => {
    const offenders = sources
      .filter(({ path }) => NEVER_USE_SERVER.test(path))
      .filter(({ ast }) => directives(ast.statements).includes("use server") || inlineServerFunctions(ast).length > 0)
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  it("imports \"server-only\" in every queries and service module", () => {
    const missing = sources
      .filter(({ path }) => MUST_IMPORT_SERVER_ONLY.test(path))
      .filter(({ ast }) => !ast.statements.some((statement) =>
        ts.isImportDeclaration(statement)
        && ts.isStringLiteral(statement.moduleSpecifier)
        && statement.moduleSpecifier.text === "server-only"))
      .map(({ path }) => path);

    expect(missing).toEqual([]);
  });

  it("starts every server action with an awaited guard, unless whitelisted in PUBLIC_ACTIONS", () => {
    expect(scans.flatMap((scan) => scan.violations)).toEqual([]);
  });

  it("only whitelists existing actions, each with a one-line justification", () => {
    for (const [id, reason] of Object.entries(PUBLIC_ACTIONS)) {
      expect(allActions, `${id} is not a server action`).toContain(id);
      expect(reason.trim().length, `${id} needs a justification`).toBeGreaterThan(0);
      expect(reason, `${id}: one line only`).not.toContain("\n");
    }
  });

  it("flags unguarded, late-guarded, inline and re-exported actions", () => {
    const sample = [
      `"use server";`,
      `export async function open(id: string) { return db.delete(id); }`,
      `export async function late(id: string) { await db.delete(id); await requireAuth(); }`,
      `export async function guarded() { const session = await requireAuth(); return session.user.id; }`,
      `export async function wrapped() { return safeAction(async () => { await requireRole(orgId, "admin"); }); }`,
      `export async function wrappedLate() { return safeAction(async () => { await db.delete(); await requireAdmin(); }); }`,
      `export { other } from "./other";`,
    ].join("\n");
    const page = [
      `export default function Page() {`,
      `  async function save() { "use server"; await db.insert(); }`,
      `  async function remove() { "use server"; await requireAdmin(); await db.delete(); }`,
      `  return null;`,
      `}`,
    ].join("\n");

    expect(scanServerActions("sample.ts", parse("sample.ts", sample)).violations).toEqual([
      "sample.ts#open",
      "sample.ts#late",
      "sample.ts#wrappedLate",
      "sample.ts#<re-export at line 7>",
    ]);
    expect(scanServerActions("page.tsx", parse("page.tsx", page)).violations).toEqual([
      "page.tsx#<inline action at line 2>",
    ]);
  });
});
