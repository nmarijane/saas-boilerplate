import type { Buffer } from "node:buffer";

export interface StorageAdapter {
  put: (key: string, buffer: Buffer, mimetype: string) => Promise<void>;
  get: (key: string) => Promise<Buffer>;
  delete: (key: string) => Promise<void>;
}

export async function getStorageAdapter(): Promise<StorageAdapter> {
  const adapter = process.env.STORAGE_ADAPTER ?? "local";

  switch (adapter) {
    case "s3": {
      const { S3StorageAdapter } = await import("./s3");
      return new S3StorageAdapter();
    }
    case "local":
    default: {
      const { LocalStorageAdapter } = await import("./local");
      return new LocalStorageAdapter();
    }
  }
}
