import type { ChildProcess } from "node:child_process";
import { execFile, spawn } from "node:child_process";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

/**
 * Running the scripts of the repository as a developer does: `scripts/seed.ts`
 * under tsx, in a process of its own (it ends the process, so nothing here can
 * import it), from the folder a test chooses and with the environment it gives.
 */

export const ROOT = resolve(import.meta.dirname, "../..");
/** The loader of tsx, as an address: it is given to a process whose working directory has no node_modules. */
export const TSX = pathToFileURL(join(ROOT, "node_modules/tsx/dist/loader.mjs")).href;

const run = promisify(execFile);

/** The environment of the developer, with what these tests choose for themselves left out. */
export function baseEnv(env: Record<string, string>): NodeJS.ProcessEnv {
  const {
    DATABASE_URL: _url,
    PGLITE_DATA_DIR: _dir,
    SEED_DEMO: _demo,
    NODE_ENV: _mode,
    ...rest
  } = process.env;

  // The typing of ProcessEnv requires a NODE_ENV: every case gives its own
  return { ...rest, ...env } as NodeJS.ProcessEnv;
}

/** Runs the seed script from `cwd`: what it printed, and whether it ended well. */
export async function runSeed(cwd: string, env: Record<string, string>) {
  try {
    const { stdout, stderr } = await run(process.execPath, ["--import", TSX, join(ROOT, "scripts/seed.ts")], {
      cwd,
      env: baseEnv(env),
      timeout: 90_000,
    });

    return { stdout, stderr, ok: true };
  } catch (error) {
    const { stdout = "", stderr = "" } = error as { stdout?: string; stderr?: string };

    return { stdout, stderr, ok: false };
  }
}

/** How long a lock holder may take to say that it holds the lock: less than a test may take. */
const LOCK_HOLDER_TIMEOUT_MS = 10_000;

/**
 * Another process, started as `npm run <script>` is (`npm run dev` unless a test
 * names another), that takes the lock of a PGlite directory
 * (src/shared/lib/pglite-lock.ts), then waits or ends. It is returned once it
 * holds the lock, or once it has ended. One that waits is the test's to kill, and
 * it ends by itself when the test process goes away, since its stdin closes then.
 * One that does not say it holds the lock in time is killed, and nothing is returned.
 */
export async function lockHolder(dir: string, then: "waits" | "ends", script = "dev"): Promise<ChildProcess> {
  const lock = pathToFileURL(join(ROOT, "src/shared/lib/pglite-lock.ts")).href;
  const source = `
    import { lockPgliteDirectory } from ${JSON.stringify(lock)};
    lockPgliteDirectory(${JSON.stringify(dir)});
    console.log("locked");
    ${then === "waits" ? "process.stdin.on(\"end\", () => process.exit()).resume();" : ""}
  `;
  const holder = spawn(process.execPath, ["--import", TSX, "--input-type=module", "-e", source], {
    env: { ...process.env, npm_lifecycle_event: script },
    stdio: ["pipe", "pipe", "inherit"],
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const late = setTimeout(() => reject(new Error(`The lock holder did not lock ${dir} within ${LOCK_HOLDER_TIMEOUT_MS} ms`)), LOCK_HOLDER_TIMEOUT_MS);
      const settle = (done: () => void) => {
        clearTimeout(late);
        done();
      };
      holder.once("exit", (code) => settle(then === "ends" && code === 0 ? resolve : () => reject(new Error(`The lock holder ended with ${code}`))));
      if (then === "waits") {
        holder.stdout?.setEncoding("utf8").on("data", (text: string) => text.includes("locked") && settle(resolve));
      }
    });
  } catch (error) {
    holder.kill("SIGKILL");
    throw error;
  }

  return holder;
}

/** A port on this machine that nothing listens on: a connection to it is refused at once. */
export async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address() as { port: number };
  await new Promise<void>((done) => server.close(() => done()));

  return port;
}
