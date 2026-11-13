// Which database the seed writes to, and whether it may put accounts with a
// known password in it. The script itself ends the process, so the decisions
// live here, where a test can call them.

/** The hosts that are this machine, without the brackets of an IPv6 address. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

interface SeedTarget {
  /** What to print: the host of `DATABASE_URL` (never its user or password), or the PGlite directory. */
  label: string;
  /** Whether the database is this machine's own: PGlite, or PostgreSQL on localhost. */
  local: boolean;
}

/** Where `pg` connects for an address: a host (or the path of a socket, or nothing) and a port. */
interface Connection {
  host: string;
  port: string;
}

/**
 * Where `pg` connects for this `DATABASE_URL`, read as `pg-connection-string`
 * reads it, because the seed must name the machine that is written to and not
 * the one the address seems to name: a `host` parameter (the last one, if it is given
 * twice) replaces the host in front of it (`postgres://u@localhost/app?host=db.example.com` is
 * `db.example.com`), as a `port` one replaces the port; an empty parameter
 * replaces nothing; an address with credentials and no host (`user:secret@/app`)
 * is read although `URL` refuses it; `socket:` and a bare path name a socket.
 * Throws when the address cannot be read.
 */
function connectionOf(databaseUrl: string): Connection {
  if (databaseUrl.startsWith("/")) {
    return { host: databaseUrl.split(" ")[0] ?? "", port: "" };
  }

  let url: URL;
  let hostless = false;
  try {
    url = new URL(databaseUrl);
  } catch {
    // `pg` reads `user:secret@/app`, which `URL` refuses, as an address with no host
    url = new URL(databaseUrl.replace("@/", "@___DUMMY___/"));
    hostless = true;
  }

  if (url.protocol === "socket:") {
    return { host: decodeURI(url.pathname), port: "" };
  }

  // `pg` copies the parameters in order, so the last of a name wins; an empty one replaces nothing
  const last = (name: string) => url.searchParams.getAll(name).at(-1);

  return {
    host: last("host") || decodeURIComponent(hostless ? "" : url.hostname),
    port: last("port") || url.port,
  };
}

/** What is printed of a connection: the host and the port, the path of a socket, or `socket` when the address names no host. */
function labelOf({ host, port }: Connection): string {
  if (host === "") {
    return "socket";
  }
  if (host.startsWith("/")) {
    return host;
  }
  const shown = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;

  return port ? `${shown}:${port}` : shown;
}

/**
 * The database a seed run writes to: PostgreSQL when `DATABASE_URL` is set (a
 * value set to nothing is not), the local PGlite directory otherwise. A URL that
 * cannot be read is not guessed at: it is not local. Neither is an address that
 * names no host, or only the path of a socket: the machine behind it comes from
 * `PGHOST`, which the seed does not read.
 */
export function seedTarget(databaseUrl: string | undefined, pgliteDir: string): SeedTarget {
  if (!databaseUrl) {
    return { label: `local PGlite (${pgliteDir})`, local: true };
  }

  try {
    const connection = connectionOf(databaseUrl);
    const host = connection.host.replaceAll(/^\[|\]$/g, "").toLowerCase();

    return { label: labelOf(connection), local: LOCAL_HOSTS.has(host) };
  } catch {
    return { label: "an unreadable DATABASE_URL", local: false };
  }
}

type SeedPlan =
  | { accounts: true }
  | { accounts: false; reason: "production" | "remote" };

/**
 * Whether the seed creates the dev, admin and demo accounts. They all have the
 * password `admin123`, so never in production, and not on a database that is
 * not this machine's own unless `SEED_DEMO=1` says it is meant: a `DATABASE_URL`
 * left in a shell or in `.env.local` is not enough. The plans are seeded either way.
 */
export function seedPlan({
  nodeEnv,
  target,
  seedDemo,
}: {
  nodeEnv: string | undefined;
  target: SeedTarget;
  seedDemo: string | undefined;
}): SeedPlan {
  if (nodeEnv === "production") {
    return { accounts: false, reason: "production" };
  }

  return target.local || seedDemo === "1"
    ? { accounts: true }
    : { accounts: false, reason: "remote" };
}
