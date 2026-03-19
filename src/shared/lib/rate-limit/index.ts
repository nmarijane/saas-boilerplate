import type { RateLimitAdapter } from "./types";

export type { RateLimitAdapter, RateLimitResult } from "./types";

let _rateLimiter: RateLimitAdapter | null = null;
let _edgeRateLimiter: RateLimitAdapter | null = null;

/**
 * Get rate limiter for API routes and server actions (Node.js runtime).
 * Supports all adapters: memory, redis, upstash.
 */
export async function getRateLimiter(): Promise<RateLimitAdapter> {
  if (_rateLimiter) return _rateLimiter;

  const adapter = process.env.RATE_LIMIT_ADAPTER ?? "memory";

  switch (adapter) {
    case "redis": {
      const url = process.env.REDIS_URL;
      if (!url) throw new Error("REDIS_URL required when RATE_LIMIT_ADAPTER=redis");
      const { RedisRateLimiter } = await import("./redis");
      _rateLimiter = new RedisRateLimiter(url);
      break;
    }
    case "upstash": {
      const restUrl = process.env.UPSTASH_REDIS_REST_URL;
      const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (!restUrl || !restToken)
        throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN required when RATE_LIMIT_ADAPTER=upstash");
      const { UpstashRateLimiter } = await import("./upstash");
      _rateLimiter = new UpstashRateLimiter(restUrl, restToken);
      break;
    }
    default: {
      const { MemoryRateLimiter } = await import("./memory");
      _rateLimiter = new MemoryRateLimiter();
    }
  }

  return _rateLimiter;
}

/**
 * Get rate limiter for Edge Runtime (middleware).
 * Only supports: memory, upstash. Throws if redis is configured.
 */
export async function getEdgeRateLimiter(): Promise<RateLimitAdapter> {
  if (_edgeRateLimiter) return _edgeRateLimiter;

  const adapter = process.env.RATE_LIMIT_ADAPTER ?? "memory";

  if (adapter === "redis") {
    throw new Error(
      "Redis rate limiter is not compatible with Edge Runtime. Use 'memory' or 'upstash' for middleware rate limiting.",
    );
  }

  if (adapter === "upstash") {
    const restUrl = process.env.UPSTASH_REDIS_REST_URL;
    const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!restUrl || !restToken)
      throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN required");
    const { UpstashRateLimiter } = await import("./upstash");
    _edgeRateLimiter = new UpstashRateLimiter(restUrl, restToken);
  } else {
    const { MemoryRateLimiter } = await import("./memory");
    _edgeRateLimiter = new MemoryRateLimiter();
  }

  return _edgeRateLimiter;
}
