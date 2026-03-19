import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { routing } from "@/shared/lib/i18n-routing";
import { getRateLimiter } from "@/shared/lib/rate-limit";

const intlMiddleware = createMiddleware(routing);
const LOCALE_PREFIX_RE = /^\/(en|fr)/;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rate limiting on API routes
  if (pathname.startsWith("/api/")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const limiter = await getRateLimiter();
    const result = await limiter.check(`ip:${ip}`, 100, 60);

    if (!result.allowed) {
      return NextResponse.json(
        { error: "Too many requests", code: "RATE_LIMIT", status: 429 },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": String(result.remaining),
            "X-RateLimit-Reset": String(result.resetAt),
          },
        },
      );
    }
    return NextResponse.next();
  }

  // 2. i18n (handles locale detection and redirection)
  const response = intlMiddleware(request);

  // 3. Auth guards — protect (app) and (admin) routes
  const sessionToken =
    request.cookies.get("better-auth.session_token")?.value;
  const localeMatch = pathname.match(LOCALE_PREFIX_RE);
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
