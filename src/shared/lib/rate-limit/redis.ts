import type { RateLimitAdapter, RateLimitResult } from "./types";

/**
 * Redis rate limiter using ioredis (sliding window).
 * Node.js runtime only — NOT compatible with Edge Runtime.
 */
export class RedisRateLimiter implements RateLimitAdapter {
  private redis: import("ioredis").default | null = null;

  constructor(private readonly redisUrl: string) {}

  private async getClient() {
    if (!this.redis) {
      const { default: Redis } = await import("ioredis");
      this.redis = new Redis(this.redisUrl);
    }
    return this.redis;
  }

  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const client = await this.getClient();
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;
    const redisKey = `rate_limit:${key}`;

    const multi = client.multi();
    multi.zremrangebyscore(redisKey, 0, windowStart);
    multi.zadd(redisKey, now.toString(), `${now}:${Math.random()}`);
    multi.zcard(redisKey);
    multi.expire(redisKey, windowSeconds);

    const results = await multi.exec();
    const count = (results?.[2]?.[1] as number) ?? 1;

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: now + windowMs,
    };
  }
}
