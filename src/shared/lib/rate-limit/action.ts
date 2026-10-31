import { headers } from "next/headers";
import { getRateLimiter } from "./index";
import "server-only";

/**
 * Rate limiting for server actions. The proxy only limits /api/* routes,
 * and server actions are POSTs to page routes: public actions call this.
 */
export async function enforceActionRateLimit(key: string, limit: number, windowSeconds: number) {
  const limiter = await getRateLimiter();
  const result = await limiter.check(`action:${key}`, limit, windowSeconds);

  if (!result.allowed) {
    throw new Error("Too many requests");
  }
}

/** Client IP, resolved like the proxy: first x-forwarded-for entry. */
export async function getClientIp() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
