import type { RateLimitAdapter, RateLimitResult } from "./types";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Upstash rate limiter — Edge Runtime compatible (HTTP-based).
 */
export class UpstashRateLimiter implements RateLimitAdapter {
  private limiters = new Map<string, Ratelimit>();

  constructor(
    private readonly restUrl: string,
    private readonly restToken: string,
  ) {}

  private getLimiter(limit: number, windowSeconds: number): Ratelimit {
    const cacheKey = `${limit}:${windowSeconds}`;
    let limiter = this.limiters.get(cacheKey);
    if (!limiter) {
      limiter = new Ratelimit({
        redis: new Redis({ url: this.restUrl, token: this.restToken }),
        limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      });
      this.limiters.set(cacheKey, limiter);
    }
    return limiter;
  }

  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const limiter = this.getLimiter(limit, windowSeconds);
    const result = await limiter.limit(key);
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
    };
  }
}
