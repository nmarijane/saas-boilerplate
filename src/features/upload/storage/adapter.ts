export interface StorageAdapter {
  put: (key: string, buffer: Buffer, mimetype: string) => Promise<void>;
  get: (key: string) => Promise<Buffer>;
  delete: (key: string) => Promise<void>;
}

export function getStorageAdapter(): StorageAdapter {
  const adapter = process.env.STORAGE_ADAPTER ?? "local";

  switch (adapter) {
    case "s3": {
      // Dynamic import to avoid loading aws-sdk when not needed
      const { S3StorageAdapter } = require("./s3") as typeof import("./s3");
      return new S3StorageAdapter();
    }
    case "local":
    default: {
      const { LocalStorageAdapter } = require("./local") as typeof import("./local");
      return new LocalStorageAdapter();
    }
  }
}
