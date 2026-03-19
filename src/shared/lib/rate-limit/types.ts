export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimitAdapter {
  check: (key: string, limit: number, windowSeconds: number) => Promise<RateLimitResult>;
}
