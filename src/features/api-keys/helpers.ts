import { createHash, randomBytes } from "node:crypto";

const KEY_PREFIX_LIVE = "sk_live_";
const KEY_PREFIX_TEST = "sk_test_";
const KEY_BYTES = 32;

export function generateApiKey(isTest = false): { key: string; prefix: string; hash: string } {
  const raw = randomBytes(KEY_BYTES).toString("base64url");
  const prefix = isTest ? KEY_PREFIX_TEST : KEY_PREFIX_LIVE;
  const key = `${prefix}${raw}`;
  const hash = hashApiKey(key);
  const displayPrefix = key.slice(0, prefix.length + 4);

  return { key, prefix: displayPrefix, hash };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
