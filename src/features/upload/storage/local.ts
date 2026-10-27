import type { Buffer } from "node:buffer";
import type { StorageAdapter } from "./adapter";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

const UPLOADS_DIR = resolve(process.cwd(), "uploads");

function resolveStoragePath(key: string) {
  if (!key || isAbsolute(key) || key.includes("\0")) {
    throw new Error("Invalid storage key");
  }

  const filePath = resolve(UPLOADS_DIR, key);
  const relativePath = relative(UPLOADS_DIR, filePath);
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error("Storage key escapes the upload directory");
  }

  return filePath;
}

export class LocalStorageAdapter implements StorageAdapter {
  async put(key: string, buffer: Buffer, _mimetype: string): Promise<void> {
    const filePath = resolveStoragePath(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
  }

  async get(key: string): Promise<Buffer> {
    const filePath = resolveStoragePath(key);
    return readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = resolveStoragePath(key);
    await rm(filePath, { force: true });
  }
}
