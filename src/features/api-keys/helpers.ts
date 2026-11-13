import { createHash, randomBytes } from "node:crypto";
import { SECRET_PREFIXES } from "@/shared/config/app";

const KEY_BYTES = 32;

export function generateApiKey(isTest = false): { key: string; prefix: string; hash: string } {
  const raw = randomBytes(KEY_BYTES).toString("base64url");
  const prefix = isTest ? SECRET_PREFIXES.apiKeyTest : SECRET_PREFIXES.apiKeyLive;
  const key = `${prefix}${raw}`;
  const hash = hashApiKey(key);
  const displayPrefix = key.slice(0, prefix.length + 4);

  return { key, prefix: displayPrefix, hash };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
