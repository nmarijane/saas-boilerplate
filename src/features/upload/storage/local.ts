import type { Buffer } from "node:buffer";
import type { StorageAdapter } from "./adapter";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

const UPLOADS_DIR = resolve(process.cwd(), "uploads");

// Defense in depth: a key never resolves outside UPLOADS_DIR, whatever it contains.
function pathFor(key: string): string {
  const filePath = resolve(UPLOADS_DIR, key);
  if (!filePath.startsWith(UPLOADS_DIR + sep)) {
    throw new Error("Invalid storage key");
  }
  return filePath;
}

export class LocalStorageAdapter implements StorageAdapter {
  async put(key: string, buffer: Buffer, _mimetype: string): Promise<void> {
    const filePath = pathFor(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
  }

  async get(key: string): Promise<Buffer> {
    const filePath = pathFor(key);
    return readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = pathFor(key);
    await rm(filePath, { force: true });
  }
}
