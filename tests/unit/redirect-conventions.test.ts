import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Static check on the `catch` clauses that wait. `redirect()` and `notFound()`
 * throw errors that Next itself catches, higher up, to send the person elsewhere
 * (the session is gone, the role is too low): a `catch` that takes one for a failure
 * of its own tells a refusal that was not one, and the error reporter hears of it.
 * `unstable_rethrow` hands the framework's errors on and leaves every other error
 * to the place.
 *
 * The rule: every `catch` clause of `src` whose `try` contains an `await` starts
 * with `unstable_rethrow(error)`, unless the file that holds it is named below with
 * what it waits for. Nothing says where the server is called from: an action given
 * to a flow as a parameter, a method of a context hook, a helper, a component that
 * imports the action, all are read the same. A call to the server is awaited inside
 * a `try`; one chained with `.catch(` is not read, and does not belong there.
 *
 * The behaviour of each place that can be called without a page is tested in the
 * test file of that place (its flow, its helper), with the real errors of Next
 * (`tests/helpers/next-errors.ts`); the handlers that live inside a component
 * cannot be (no DOM to press a button in), and this reads them instead.
 *
 * A list entry whose file is gone is forgiven, wherever the file sat: a project
 * that takes a feature out (docs/SETUP.md, Phase 3) deletes files that the lists
 * name, and none of its steps names this test. A name that hides nothing costs
 * nothing, and a typo names no file, so the real file, which is not named, is read
 * all the same. An entry whose file exists must still hold a catch that waits and
 * hands nothing on, or the test says to take it off the list. A file of server
 * actions (it begins with "use server") is never on the list: every catch of one
 * that waits starts with the rethrow, whatever it waits for.
 */

const ROOT = join(__dirname, "../..");
const SRC = join(ROOT, "src");

/** What a file that hands nothing on waits for, and why that is no call for a redirect to come out of. */
const KINDS = {
  "better-auth": "the client of Better Auth, which answers `{ error }` and never redirects",
  fetch: "a `fetch` or a request of the browser, which answers a status",
  clipboard: "the clipboard of the browser",
  stripe: "Stripe, whose errors are its own",
  log: "work that runs after the answer, whose `catch` only writes the error down: there is no request to send anywhere",
  database: "a read or a write of the database that falls back, or that decides what a failure means",
  "json-route":
    "a route handler that answers JSON, reads the session with `requireApiAuth`, which answers 401 itself, and calls no server action; the workspace it reads next (`getActiveOrgId`) asks `requireAuth` again, which would redirect only if the session went between the two reads, a case that is left open for the routes of `ANSWER_A_CLIENT_THAT_IS_NO_PAGE` too",
  "session-route":
    "a route handler that reads the session itself with `auth.api.getSession` and answers 401 itself, and calls no server action; the workspace it reads next (`getWorkspaceContext`) asks `requireAuth` again, which would redirect only if the session went between the two reads, a case that is left open for the routes of `ANSWER_A_CLIENT_THAT_IS_NO_PAGE` too",
} as const;

type Kind = keyof typeof KINDS;

/**
 * The files with a `catch` that waits and does not start with the rethrow, each
 * with the kind of thing it waits for (the list above). A file that is not here
 * and has one fails the test: either the `catch` starts with `unstable_rethrow`, or
 * the file is named, which says what it waits for and is read in review. A file of
 * server actions is never named here, whatever it waits for.
 */
const NOT_HANDED_ON: Record<string, Kind | Kind[]> = {
  "src/features/billing/helpers.ts": "stripe",
  "src/features/notifications/list-reader.ts": "fetch",
  "src/features/notifications/unread-count.ts": "fetch",
  "src/features/upload/hooks/use-upload.ts": "fetch",
  "src/features/webhooks/service.ts": ["fetch", "database"],
  "src/shared/utils/clipboard.ts": "clipboard",
  "src/features/auth/hooks/use-sign-out.ts": "better-auth",
  "src/features/onboarding/components/profile-step.tsx": "better-auth",
  "src/features/onboarding/hooks/use-onboarding.ts": "better-auth",
  "src/features/settings/components/active-sessions.tsx": "better-auth",
  "src/features/settings/components/connected-accounts.tsx": "better-auth",
  "src/features/events/handlers/notification.ts": ["log", "database"],
  "src/features/events/handlers/webhook.ts": "log",
  "src/app/api/health/route.ts": "database",
  "src/app/[locale]/(marketing)/changelog/page.tsx": "database",
  "src/app/[locale]/(marketing)/waitlist/page.tsx": "database",
  "src/app/[locale]/(marketing)/waitlist/[code]/page.tsx": "database",
  "src/app/api/ai/chat/route.ts": "session-route",
  "src/app/api/stripe/webhook/route.ts": ["stripe", "database"],
  "src/app/api/upload/route.ts": "json-route",
};

/**
 * The files whose rethrow is the body of an `if` that comes first, and that
 * hand on every error of Next but a not found. An action is called from a click:
 * Next gives its rejection to the caller, and the page of a not found is drawn
 * only for a rejection that a render throws, so one handed on from a click shows
 * nothing (`safeAction` answers it as a refusal instead). Key: the file; value: why.
 */
const HANDS_ON_UNLESS_NOT_FOUND: Record<string, string> = {
  "src/shared/lib/safe-action.ts": "a not found raised in an action is answered as a refusal: no boundary draws it for a click",
};

/**
 * Route handlers that call a server action as a plain function, and answer a
 * client that is no page with JSON. A redirect is not an answer such a client can
 * use (it would follow it to an HTML page), and what to say instead (a 403) is a
 * decision about access, not a line in a `catch`: they answer a generic error as
 * they always did, until it is made. Key: the file; value: what is undecided.
 */
const ANSWER_A_CLIENT_THAT_IS_NO_PAGE: Record<string, string> = {
  "src/app/api/feedback/route.ts": "the guard of submitFeedback redirects when the session is gone after the route checked it (a workspace that is not the person's is answered 403 before)",
  "src/app/api/notifications/route.ts": "the guards of markAsRead and markAllRead redirect when the session is gone after the route checked it",
  "src/app/api/upload/[id]/route.ts": "the guard of deleteFile redirects when the session is gone after the route checked it",
};

interface Source {
  path: string;
  ast: ts.SourceFile;
}

/** A file read as the check reads it: its path says whether it is a component, and which rule it is under. */
function sourceOf(path: string, text: string): Source {
  const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;

  return { path, ast: ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind) };
}

function loadSources(): Source[] {
  return readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file) && !/\.(?:test|stories)\.tsx?$|\.d\.ts$/.test(file))
    .map((file) => sourceOf(relative(ROOT, join(SRC, file)).split(sep).join("/"), readFileSync(join(SRC, file), "utf8")));
}

function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function containsAwait(node: ts.Node): boolean {
  let found = false;
  walk(node, (child) => {
    if (ts.isAwaitExpression(child)) {
      found = true;
    }
  });
  return found;
}

interface Catch {
  /** 1-based line of the `catch`. */
  line: number;
  /** The name the error is bound to, or null for a `catch {`. */
  binding: string | null;
  /** The `try` waits for something. */
  awaits: boolean;
  /** The first statement of the clause is `unstable_rethrow(<binding>)` (or, in the files of `HANDS_ON_UNLESS_NOT_FOUND`, an `if` that starts with it). */
  rethrows: boolean;
}

/** Whether a statement is `unstable_rethrow(<binding>)`. */
function isRethrowOf(statement: ts.Statement | undefined, binding: string | null): boolean {
  const call = statement && ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) ? statement.expression : undefined;

  return (
    call !== undefined &&
    ts.isIdentifier(call.expression) &&
    call.expression.text === "unstable_rethrow" &&
    binding !== null &&
    call.arguments.length === 1 &&
    ts.isIdentifier(call.arguments[0] as ts.Expression) &&
    (call.arguments[0] as ts.Identifier).text === binding
  );
}

/** Whether a statement is an `if` with no `else` whose block starts with `unstable_rethrow(<binding>)`. */
function isConditionalRethrowOf(statement: ts.Statement | undefined, binding: string | null): boolean {
  return (
    statement !== undefined &&
    ts.isIfStatement(statement) &&
    statement.elseStatement === undefined &&
    ts.isBlock(statement.thenStatement) &&
    isRethrowOf(statement.thenStatement.statements[0], binding)
  );
}

/** Every `catch` of a file, with what is needed to judge it. */
function catchesOf({ ast, path }: Source): Catch[] {
  const conditional = path in HANDS_ON_UNLESS_NOT_FOUND;
  const found: Catch[] = [];
  walk(ast, (node) => {
    if (!ts.isTryStatement(node) || !node.catchClause) {
      return;
    }

    const clause = node.catchClause;
    const binding = clause.variableDeclaration && ts.isIdentifier(clause.variableDeclaration.name) ? clause.variableDeclaration.name.text : null;
    const [first] = clause.block.statements;

    found.push({
      line: ast.getLineAndCharacterOfPosition(clause.getStart()).line + 1,
      binding,
      awaits: containsAwait(node.tryBlock),
      rethrows: isRethrowOf(first, binding) || (conditional && isConditionalRethrowOf(first, binding)),
    });
  });

  return found;
}

/**
 * The lines of the `catch` clauses of a file that wait and do not start with the
 * rethrow: the ones that would take a redirect for a failure. This is the detector
 * the rule is made of, a function of a file's path and text.
 */
function swallowingCatches(source: Source): number[] {
  return catchesOf(source)
    .filter(({ awaits, rethrows }) => awaits && !rethrows)
    .map(({ line }) => line);
}

/** Whether a file imports `unstable_rethrow`, and from where. */
function importsRethrowFromNext({ ast }: Source): boolean {
  return ast.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "next/navigation" &&
      statement.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some((element) => element.name.text === "unstable_rethrow"),
  );
}

/** Whether a file imports a module of server actions (`../actions`, `@/features/x/actions`). */
function importsServerActions({ ast }: Source): boolean {
  return ast.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      /(?:^|\/)actions$/.test(statement.moduleSpecifier.text) &&
      !statement.importClause?.isTypeOnly,
  );
}

/** Whether a file begins with the directive "use server": it is a module of server actions. */
function isServerActions({ ast }: Source): boolean {
  for (const statement of ast.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) {
      return false;
    }
    if (statement.expression.text === "use server") {
      return true;
    }
  }

  return false;
}

/**
 * The catches that would take a redirect for a failure, as `path:line`, in the files that no list names.
 * `isNamed` says whether a list names a path.
 */
function offendersOf(files: Source[], isNamed: (path: string) => boolean): string[] {
  return files.filter(({ path }) => !isNamed(path)).flatMap((file) => swallowingCatches(file).map((line) => `${file.path}:${line}`));
}

/**
 * The entries of a list that are stale: their file exists, and has no catch that waits and hands nothing on. An entry
 * whose file is gone is not stale: it names nothing, and hides nothing.
 */
function staleEntries(entries: string[], files: Source[]): string[] {
  return entries.filter((entry) => {
    const file = files.find(({ path }) => path === entry);

    return file !== undefined && swallowingCatches(file).length === 0;
  });
}

/** The entries of a list whose file is a module of server actions: none may be named. */
function actionModulesNamed(entries: string[], files: Source[]): string[] {
  return entries.filter((entry) => {
    const file = files.find(({ path }) => path === entry);

    return file !== undefined && isServerActions(file);
  });
}

const sources = loadSources();

const named = (path: string) => path in NOT_HANDED_ON || path in ANSWER_A_CLIENT_THAT_IS_NO_PAGE;

describe("the catch clauses that wait", () => {
  it("start with unstable_rethrow(error), unless their file is named with what it waits for", () => {
    expect(
      offendersOf(sources, named),
      "start the catch with `unstable_rethrow(error)` (from next/navigation), or name the file in NOT_HANDED_ON with the kind of thing it waits for",
    ).toEqual([]);
  });

  it("are named only in files that still have one that hands nothing on (a file that is gone is forgiven)", () => {
    expect(staleEntries(Object.keys(NOT_HANDED_ON), sources), "take these files off the list").toEqual([]);
  });

  it("are never named in a module of server actions: every catch of one that waits starts with the rethrow", () => {
    expect(actionModulesNamed([...Object.keys(NOT_HANDED_ON), ...Object.keys(ANSWER_A_CLIENT_THAT_IS_NO_PAGE)], sources)).toEqual([]);
  });

  it("name only kinds of the list, and no file in both lists", () => {
    for (const [path, kinds] of Object.entries(NOT_HANDED_ON)) {
      for (const kind of [kinds].flat()) {
        expect(Object.keys(KINDS), `${path}: ${kind} is no kind of the list`).toContain(kind);
      }
      expect(path in ANSWER_A_CLIENT_THAT_IS_NO_PAGE, `${path} is in both lists`).toBe(false);
    }
  });

  it("are handed the errors of Next by a function that comes from next/navigation, wherever one starts with the rethrow", () => {
    for (const source of sources) {
      if (catchesOf(source).some(({ rethrows }) => rethrows)) {
        expect(importsRethrowFromNext(source), `${source.path} must import unstable_rethrow from next/navigation`).toBe(true);
      }
    }
  });

  it("keep the files that hand on but a not found where the rule can see it: each starts with the `if`", () => {
    for (const path of Object.keys(HANDS_ON_UNLESS_NOT_FOUND)) {
      const source = sources.find((candidate) => candidate.path === path);

      expect(source, `${path} does not exist`).toBeDefined();
      expect(catchesOf(source as Source).some(({ awaits, rethrows }) => awaits && rethrows), `${path} has no catch that waits and hands on`).toBe(true);
    }
  });

  it("keep the routes that answer JSON honest: each still calls a server action in a catch that does not hand anything on", () => {
    // A route goes with its feature (Phase 3 deletes `src/app/api/<name>/`): one that is gone is not in the way
    for (const source of sources.filter(({ path }) => path in ANSWER_A_CLIENT_THAT_IS_NO_PAGE)) {
      expect(importsServerActions(source), `${source.path} calls no server action any more: take it off the list`).toBe(true);
      expect(swallowingCatches(source), `${source.path} has no catch that waits and hands nothing on: take it off the list`).not.toEqual([]);
    }
  });
});

// The detector is a function of a file's text: it is read here on snippets, the ones that the rule exists for
// and the ones it leaves alone.
describe("the detector of the catch clauses that swallow", () => {
  const lines = (code: string, path = "src/features/x/flow.ts") => swallowingCatches(sourceOf(path, code));

  it("sees an action that a flow is given as a parameter, awaited in a try with nothing handed on", () => {
    const flow = `
export async function archiveFlow(archive: (id: string) => Promise<void>, id: string) {
  try {
    await archive(id);
  } catch (error) {
    reportHandledError(error);
  }
}`;

    expect(lines(flow)).toEqual([5]);
  });

  it("sees the method of a context hook, awaited the same way", () => {
    const component = `
"use client";

export function MarkAll() {
  const { markAllRead } = useNotificationCenter();

  const press = async () => {
    try {
      await markAllRead();
    } catch (error) {
      toast.error(String(error));
    }
  };

  return <button onClick={press}>Mark all</button>;
}`;

    expect(lines(component, "src/features/x/mark-all.tsx")).toEqual([10]);
  });

  it("sees a catch with no name for the error, which cannot hand anything on", () => {
    expect(lines("export async function f(go: () => Promise<void>) { try { await go(); } catch { /* nothing */ } }")).toEqual([1]);
  });

  it("sees a rethrow that does not come first, and one that hands on another error", () => {
    const late = `async function f(go: () => Promise<void>) { try { await go(); } catch (error) { report(error); unstable_rethrow(error); } }`;
    const other = `async function f(go: () => Promise<void>) { try { await go(); } catch (error) { unstable_rethrow(new Error("x")); } }`;

    expect(lines(late)).toEqual([1]);
    expect(lines(other)).toEqual([1]);
  });

  it("passes a catch that starts with the rethrow, whatever it does after", () => {
    const flow = `
export async function archiveFlow(archive: (id: string) => Promise<void>, id: string) {
  try {
    await archive(id);
  } catch (error) {
    unstable_rethrow(error);
    reportHandledError(error);
  }
}`;

    expect(lines(flow)).toEqual([]);
  });

  it("leaves alone a catch whose try waits for nothing, and a call that is chained with .catch(", () => {
    const sync = `export function f() { try { JSON.parse("{"); } catch (error) { report(error); } }`;
    const chained = `export async function g(go: () => Promise<void>) { await go().catch((error) => report(error)); }`;

    expect(lines(sync)).toEqual([]);
    // Not read, and the reason `CLAUDE.md` gives for awaiting the server inside a `try`
    expect(lines(chained)).toEqual([]);
  });

  it("passes the `if` that comes first only in a file that is allowed to have it", () => {
    const guarded = `async function f(go: () => Promise<void>) { try { await go(); } catch (error) { if (!isNotFound(error)) { unstable_rethrow(error); } report(error); } }`;

    expect(lines(guarded)).toEqual([1]);
    expect(lines(guarded, "src/shared/lib/safe-action.ts")).toEqual([]);
  });
});

// The lists are checked by functions of the files they are given, so that a case where a listed file is gone, or is a
// module of server actions, is read here on snippets, and not by taking a feature out of the tree.
describe("the check of the lists", () => {
  const waiting = "export async function f(go: () => Promise<void>) { try { await go(); } catch { /* nothing */ } }";
  const rethrowing = "export async function f(go: () => Promise<void>) { try { await go(); } catch (error) { unstable_rethrow(error); } }";

  it("forgives an entry whose file is gone, wherever it sat: it hides nothing", () => {
    const files = [sourceOf("src/app/api/kept/route.ts", waiting)];

    // A route, a handler of a feature that stays, and a file of a feature that is gone: none is there to hide a catch
    expect(staleEntries(["src/app/api/kept/route.ts", "src/app/api/upload/route.ts", "src/features/events/handlers/webhook.ts", "src/features/gone/x.ts"], files)).toEqual([]);
  });

  it("still says to take off an entry whose file exists and holds no catch that waits and hands nothing on", () => {
    const files = [sourceOf("src/features/a/rethrows.ts", rethrowing), sourceOf("src/features/a/nothing.ts", "export const x = 1;"), sourceOf("src/features/a/waits.ts", waiting)];

    expect(staleEntries(["src/features/a/rethrows.ts", "src/features/a/nothing.ts", "src/features/a/waits.ts", "src/features/a/gone.ts"], files)).toEqual([
      "src/features/a/rethrows.ts",
      "src/features/a/nothing.ts",
    ]);
  });

  it("reads the real file when an entry has a typo: the typo names nothing, and the catch it was meant to name is an offender", () => {
    const files = [sourceOf("src/features/a/real.ts", waiting)];
    const entries = ["src/features/a/rael.ts"];

    expect(staleEntries(entries, files)).toEqual([]);
    expect(offendersOf(files, (path) => entries.includes(path))).toEqual(["src/features/a/real.ts:1"]);
  });

  it("reads a file that a list names only when it is named: the others are all read", () => {
    const files = [sourceOf("src/features/a/named.ts", waiting), sourceOf("src/features/a/other.ts", waiting)];

    expect(offendersOf(files, (path) => path === "src/features/a/named.ts")).toEqual(["src/features/a/other.ts:1"]);
  });
});

// A module of server actions is where a guard sits in front of the work: the guard redirects when the session is gone,
// and a catch around it that answers `{ error }` turns that into a message in a form. No list may hold one.
describe("a module of server actions", () => {
  const ACTIONS = "src/features/settings/actions.ts";
  const actions = readFileSync(join(ROOT, ACTIONS), "utf8");

  // The probe: an action of the account page that swallows the redirect of its guard into an answer
  const PROBE = `

export async function probeAction() {
  try {
    await requireAuth();
    return { ok: true };
  } catch {
    return { error: "Failed" };
  }
}
`;

  it("is recognised by its directive, wherever the directive sits among the first lines", () => {
    expect(isServerActions(sourceOf("src/a/actions.ts", '"use server";\n\nexport async function f() {}'))).toBe(true);
    expect(isServerActions(sourceOf("src/a/actions.ts", "// a comment\n'use server';\nexport async function f() {}"))).toBe(true);
    expect(isServerActions(sourceOf("src/a/helper.ts", 'import { x } from "y";\n"use server";'))).toBe(false);
    expect(isServerActions(sourceOf("src/a/client.tsx", '"use client";\nexport const x = 1;'))).toBe(false);
  });

  it("has the file of the account actions among those it is read in: it begins with the directive", () => {
    expect(isServerActions(sourceOf(ACTIONS, actions))).toBe(true);
    expect(ACTIONS in NOT_HANDED_ON).toBe(false);
  });

  it("is named by the test when an action swallows the redirect of its guard: the copy of the account actions with the probe", () => {
    const withProbe = sourceOf(ACTIONS, actions + PROBE);
    const probeLine = (actions + PROBE).split("\n").findIndex((line, index, lines) => line === "  } catch {" && index > lines.length - 8) + 1;

    expect(swallowingCatches(withProbe)).toEqual([probeLine]);
    expect(offendersOf([withProbe], named)).toEqual([`${ACTIONS}:${probeLine}`]);
  });

  it("is refused by the list when it is named, whatever it waits for: the account actions put back on the list", () => {
    const withProbe = sourceOf(ACTIONS, actions + PROBE);

    expect(actionModulesNamed([ACTIONS, "src/features/gone/actions.ts"], [withProbe])).toEqual([ACTIONS]);
    expect(actionModulesNamed(["src/app/api/feedback/route.ts"], [sourceOf("src/app/api/feedback/route.ts", "export async function POST() {}")])).toEqual([]);
  });
});
