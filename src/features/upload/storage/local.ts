import type { StorageAdapter } from "./adapter";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const UPLOADS_DIR = join(process.cwd(), "uploads");

export class LocalStorageAdapter implements StorageAdapter {
  async put(key: string, buffer: Buffer, _mimetype: string): Promise<void> {
    const filePath = join(UPLOADS_DIR, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
  }

  async get(key: string): Promise<Buffer> {
    const filePath = join(UPLOADS_DIR, key);
    return readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = join(UPLOADS_DIR, key);
    await rm(filePath, { force: true });
  }
}
