import type { RateLimitAdapter, RateLimitResult } from "./types";

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();
let lastPrune = 0;
const PRUNE_INTERVAL = 60_000;

function prune(now: number) {
  if (now - lastPrune < PRUNE_INTERVAL) return;
  lastPrune = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

export class MemoryRateLimiter implements RateLimitAdapter {
  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      prune(now);
      return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    entry.count++;
    const allowed = entry.count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - entry.count),
      resetAt: entry.resetAt,
    };
  }
}
