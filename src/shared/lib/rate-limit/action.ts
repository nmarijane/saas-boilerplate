import { headers } from "next/headers";
import { limitKeyOf } from "../client-ip";
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

/** Client IP, resolved like the proxy: from the header that `TRUST_PROXY` names, or "unknown" (one shared bucket). */
export async function getClientIp() {
  return limitKeyOf(await headers());
}
