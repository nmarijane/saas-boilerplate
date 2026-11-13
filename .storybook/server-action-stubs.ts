import type { Plugin } from "vite";

// A story renders in the browser, where a server action is not what it is in
// the app. Next.js turns each export of a `"use server"` module into a call to
// the server; Storybook does not, so it would bundle the module itself, with
// the database, the auth server and every other server import it holds. The
// stubs below take its place: the same names, and nothing to import. A story
// that calls one gets a successful answer with no data, and no network call.

const SCRIPT_RE = /\.[cm]?[jt]sx?$/;

// The directive is the first statement of the module: only blank space and
// comments may come before it.
const USE_SERVER_RE =
  /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*["']use server["']/;
const EXPORTED_FUNCTION_RE = /\bexport\s+async\s+function\s+([\w$]+)/g;
const EXPORTED_CONST_RE = /\bexport\s+const\s+([\w$]+)\s*=/g;

/**
 * The source that takes the place of a `"use server"` module: each of its
 * `export async function x` and `export const x =` is re-exported as an
 * `async` function that answers `{ success: true, data: undefined }`, and it
 * imports nothing. Any other module gives `null`.
 */
export function stubServerModule(code: string): string | null {
  if (!USE_SERVER_RE.test(code)) {
    return null;
  }

  const names = new Set(
    [
      ...code.matchAll(EXPORTED_FUNCTION_RE),
      ...code.matchAll(EXPORTED_CONST_RE),
    ].map(([, name]) => name),
  );
  if (names.size === 0) {
    return "export {};\n";
  }

  return `${[...names]
    .map(
      (name) =>
        `export const ${name} = async () => ({ success: true, data: undefined });`,
    )
    .join("\n")}\n`;
}

/** The Vite plugin of Storybook that applies `stubServerModule` to the modules under `src/`. */
export function serverActionStubs(): Plugin {
  let sourceDir = "";

  return {
    name: "server-action-stubs",
    // Before the other plugins: they would read the server code first.
    enforce: "pre",
    configResolved(config) {
      sourceDir = `${config.root.replaceAll("\\", "/").replace(/\/$/, "")}/src/`;
    },
    transform(code, id) {
      // Vite adds a query to some module ids (`?v=...`, `?import`).
      const [path = ""] = id.split("?");
      if (!path.startsWith(sourceDir) || !SCRIPT_RE.test(path)) {
        return null;
      }

      const stub = stubServerModule(code);
      return stub === null ? null : { code: stub, map: null };
    },
  };
}
