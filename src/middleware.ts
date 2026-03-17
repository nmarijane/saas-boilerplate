import type {NextRequest} from "next/server";
import createMiddleware from "next-intl/middleware";
import {  NextResponse } from "next/server";
import { routing } from "@/shared/lib/i18n-routing";

const intlMiddleware = createMiddleware(routing);

// In-memory rate limiting (effective for Docker/single-instance, not for serverless)
// For serverless (Vercel), use Upstash Redis or Vercel's native protections
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per window

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rate limiting on API routes
  if (pathname.startsWith("/api/")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    if (!rateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests", code: "RATE_LIMIT", status: 429 },
        { status: 429 },
      );
    }
    return NextResponse.next();
  }

  // 2. i18n middleware (handles locale detection and redirection)
  const response = intlMiddleware(request);

  // 3. Auth guards — protect (app) and (admin) routes
  // Check for session token in cookies
  const sessionToken =
    request.cookies.get("better-auth.session_token")?.value;
  const localeMatch = pathname.match(/^\/(en|fr)/);
  const pathWithoutLocale = localeMatch
    ? pathname.slice(localeMatch[0].length)
    : pathname;

  const isAppRoute = pathWithoutLocale.startsWith("/dashboard") ||
    pathWithoutLocale.startsWith("/settings") ||
    pathWithoutLocale.startsWith("/onboarding");
  const isAdminRoute = pathWithoutLocale.startsWith("/admin");

  if ((isAppRoute || isAdminRoute) && !sessionToken) {
    const locale = localeMatch?.[1] ?? routing.defaultLocale;
    const signInUrl = new URL(`/${locale}/sign-in`, request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all pathnames except static files and Next.js internals
    "/((?!_next|.*\\..*).*)",
  ],
};
