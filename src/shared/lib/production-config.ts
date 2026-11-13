// What a production server refuses to start without: a database, the secret of
// Better Auth and a decision about which proxy to trust. The checks are of the running server, not of `next build` (a build
// runs with NODE_ENV=production and none of the secrets, and loads the pages
// without serving them): `NEXT_PHASE` tells the two apart.

import { TRUST_PROXY_PATTERN, trustProxyOf } from "./client-ip";

type Variables = Readonly<Record<string, string | undefined>>;

const BUILDING = "phase-production-build";

/** Whether this process is a production server, as opposed to a build, a script, the dev server or a test. */
function servesProduction(variables: Variables): boolean {
  return variables.NODE_ENV === "production" && variables.NEXT_PHASE !== BUILDING;
}

/** `DATABASE_URL` as the app reads it: a value of nothing but whitespace is nothing. */
function databaseUrlOf(variables: Variables): string {
  return variables.DATABASE_URL?.trim() ?? "";
}

const DATABASE_MESSAGE
  = "a production server does not fall back to the local database (PGlite): what it holds is lost with the "
  + "server's disk and not shared between instances. Set DATABASE_URL to a PostgreSQL database "
  + "(docs/SETUP.md, \"Required for production\").";

/**
 * Throws when a production server would run on the local database. With no
 * `DATABASE_URL` the app falls back to PGlite, a database in a directory of the
 * server: fine for development and tests, but in production it is lost with the
 * server's disk, and two instances would each have their own. It is never what a
 * deployment wants, so it is refused unless it is asked for by name
 * (`ALLOW_PGLITE_IN_PRODUCTION=1`, for the end-to-end tests and the screenshots,
 * which serve a production build over a throwaway database).
 */
export function assertDatabaseConfigured(variables: Variables = process.env): void {
  if (!servesProduction(variables) || databaseUrlOf(variables) || variables.ALLOW_PGLITE_IN_PRODUCTION === "1") {
    return;
  }

  throw new Error(`DATABASE_URL is not set${variables.DATABASE_URL ? " (it is only whitespace)" : ""}, and ${DATABASE_MESSAGE}`);
}

/**
 * What a production server is configured wrongly for, one sentence each: no database, a secret of Better Auth that
 * is missing or shorter than 32 characters once trimmed (Better Auth itself only warns under 32 and starts on a
 * value of a space), and no decision about the proxy. `TRUST_PROXY` is `vercel`, the number of reverse proxies in
 * front of the app, or `none`, which is the explicit choice of one rate limit for every client at once. On Vercel
 * (`VERCEL=1`) an unset value means `vercel`. Anything else, a typo included, is refused: a wrong value would
 * silently put every client in one bucket.
 */
export function productionProblems(variables: Variables = process.env): string[] {
  if (!servesProduction(variables)) {
    return [];
  }

  const problems: string[] = [];
  try {
    assertDatabaseConfigured(variables);
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }

  if ((variables.BETTER_AUTH_SECRET?.trim().length ?? 0) < 32) {
    problems.push(
      "BETTER_AUTH_SECRET is missing or shorter than 32 characters: generate one with `openssl rand -hex 32` "
      + "(docs/SETUP.md, \"Required for production\").",
    );
  }

  const proxy = trustProxyOf(variables);
  if (proxy === undefined) {
    problems.push(
      "TRUST_PROXY is not set: set it to `vercel`, to the number of reverse proxies in front of the app, or to `none` "
      + "to give every client one shared rate limit (docs/SETUP.md, \"Behind a proxy\").",
    );
  } else if (!TRUST_PROXY_PATTERN.test(proxy)) {
    problems.push(`TRUST_PROXY is \`${proxy}\`, which is not \`vercel\`, \`none\` or a number of proxies (docs/SETUP.md, "Behind a proxy").`);
  }

  return problems;
}

/**
 * What a production server does at start: the process ends with the problems when it has any. Next.js
 * logs an error of the instrumentation hook and then serves anyway (every request fails), which is not
 * a refusal to start.
 */
export function refuseToStartMisconfigured(variables: Variables = process.env): void {
  const problems = productionProblems(variables);
  if (problems.length > 0) {
    console.error(`The server does not start:\n${problems.map((problem) => `- ${problem}`).join("\n")}`);
    process.exit(1);
  }
}
