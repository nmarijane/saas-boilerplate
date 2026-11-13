import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// One process at a time on a PGlite directory. PGlite runs PostgreSQL inside the
// process that opens the directory, alone, and its own lock (`postmaster.pid`)
// holds the same made-up pid in every process: nothing stops a second process.
// Two processes on one directory break it, for good: the next one to open it
// aborts. So a process that opens a directory first writes a lock of its own in
// it, `process-<pid>.lock`, then looks for the others. One whose process still
// runs means the directory is taken: this process removes its own and opens
// nothing. One whose process has ended (it was killed, so it could not remove
// it) is taken over. Two processes that lock at the same moment each see the
// other's lock, so at worst both are refused; never both let in.

const LOCK = /^process-(\d+)\.lock$/;

/** The locks of this process, removed when it exits. */
const held = new Set<string>();

function removeHeldLocks() {
  for (const lock of held) {
    rmSync(lock, { force: true });
  }
}

/** Whether a process runs: one of another user's is still running (EPERM). */
function running(pid: number): boolean {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** How this process was started, for the message another one prints: `npm run dev`, or its command. */
function startedAs(): string {
  const script = process.env.npm_lifecycle_event;

  return script && script !== "npx"
    ? `npm run ${script}`
    : [process.argv0, ...process.argv.slice(1)].join(" ");
}

/** What a lock says of its process, or nothing when it cannot be read. */
function holderOf(lock: string): string {
  try {
    return readFileSync(lock, "utf8").trim();
  } catch {
    return "";
  }
}

/**
 * What to do about the process that holds the directory. `npm run dev` holds it
 * until it is stopped; any other command, the seed, say, ends by itself.
 */
function whatToDo(holder: string): string {
  return holder === "npm run dev"
    ? "Stop `npm run dev` first, then run this command again: it holds the database for as long as it runs."
    : "Wait for that process to end, or stop it, then run this command again.";
}

function inUse(dir: string, pid: number, holder: string): string {
  return [
    `The local database ${dir} is open in another process: pid ${pid}${holder ? ` (${holder})` : ""}.`,
    "Two processes on one PGlite directory break it, so this one does not open it.",
    whatToDo(holder),
    "Or set PGLITE_DATA_DIR to give this process a directory of its own.",
    `If no process of yours has it open, the lock is left over: delete ${join(dir, `process-${pid}.lock`)}.`,
  ].join(" ");
}

/**
 * Takes the lock of a PGlite directory, before PGlite opens it, for as long as
 * this process runs. It throws, saying which process holds it and what to do,
 * while another process that holds it still runs. The directory is made when it
 * is missing: PGlite makes a new database in it all the same.
 */
export function lockPgliteDirectory(dir: string): void {
  mkdirSync(dir, { recursive: true });
  const own = join(dir, `process-${process.pid}.lock`);
  writeFileSync(own, `${startedAs()}\n`);

  for (const name of readdirSync(dir)) {
    const pid = Number(LOCK.exec(name)?.[1]);
    // A lock with this process's pid never refuses it. Either this process wrote
    // it, and a second open in the process is openPglite's to answer: it returns
    // the client it has. Or an ended process had the same pid, which happens when
    // a container starts its processes in the same order: refusing would keep out
    // a directory that nobody holds. Worker threads, which share the pid, never query.
    if (!pid || pid === process.pid) {
      continue;
    }

    const lock = join(dir, name);
    if (running(pid)) {
      rmSync(own, { force: true });
      throw new Error(inUse(dir, pid, holderOf(lock)));
    }
    rmSync(lock, { force: true });
  }

  if (held.size === 0) {
    process.once("exit", removeHeldLocks);
  }
  held.add(own);
}
