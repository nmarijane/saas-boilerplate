import { getSessionCookie } from "better-auth/cookies";
import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse  } from "next/server";
import { RESET_TOKEN_COOKIE, resetTokenCookieOptions, resetTokenPath } from "@/features/auth/reset-token";
import { APP_PATH_PREFIXES } from "@/shared/config/app";
import { limitKeyOf } from "@/shared/lib/client-ip";
import { contentSecurityPolicy, makeNonce } from "@/shared/lib/csp";
import { routing } from "@/shared/lib/i18n-routing";
import { getRateLimiter } from "@/shared/lib/rate-limit";
import { isActivePath } from "@/shared/utils/paths";

const intlMiddleware = createMiddleware(routing);
const LOCALE_PREFIX_RE = /^\/(en|fr)/;

/** The page of the reset link, in any language: `/reset-password` or `/fr/reset-password`. */
function isResetPasswordPath(pathname: string): boolean {
  return pathname.replace(LOCALE_PREFIX_RE, "") === "/reset-password";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rate limiting on API routes
  if (pathname.startsWith("/api/")) {
    // The address comes from the header that TRUST_PROXY names, never from the
    // client's own X-Forwarded-For (src/shared/lib/client-ip.ts)
    const limiter = await getRateLimiter();
    const result = await limiter.check(`ip:${limitKeyOf(request.headers)}`, 100, 60);

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

  // 2. The link of the reset e-mail: its token is taken out of the address before any page is
  // drawn, and kept in an HttpOnly cookie that only the server reads (src/features/auth/reset-token.ts)
  const token = request.nextUrl.searchParams.get("token");
  if (token && isResetPasswordPath(pathname)) {
    // The cookie is for the reset page of one language: the address is given that language here if it had none
    const locale = LOCALE_PREFIX_RE.exec(pathname)?.[1] ?? routing.defaultLocale;
    const bare = request.nextUrl.clone();
    bare.pathname = resetTokenPath(locale);
    bare.searchParams.delete("token");
    const handedOver = NextResponse.redirect(bare);
    handedOver.cookies.set(RESET_TOKEN_COOKIE, token, resetTokenCookieOptions(locale));

    return handedOver;
  }

  // 3. i18n (handles locale detection and redirection), on a request that carries the nonce of
  // this one and its policy: Next.js reads them to put the nonce on its own scripts, and the root
  // layout reads the nonce for the ones it writes itself (src/shared/lib/csp.ts)
  const nonce = makeNonce();
  const policy = contentSecurityPolicy({ nonce, development: process.env.NODE_ENV === "development" });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", policy);
  const response = intlMiddleware(new NextRequest(request, { headers: requestHeaders }));
  response.headers.set("Content-Security-Policy", policy);

  // 4. Auth guard — the pages of the connected space need a session: a page is
  // one of APP_PATH_PREFIXES, or under one (whole segments, as everywhere in the app).
  // On https, Better Auth names its cookie `__Secure-better-auth.session_token`;
  // its helper reads that name and the plain one.
  const sessionToken = getSessionCookie(request);
  const localeMatch = pathname.match(LOCALE_PREFIX_RE);
  const pathWithoutLocale = localeMatch
    ? pathname.slice(localeMatch[0].length)
    : pathname;

  const needsSession = APP_PATH_PREFIXES.some((prefix) =>
    isActivePath(pathWithoutLocale, prefix),
  );

  if (needsSession && !sessionToken) {
    const locale = localeMatch?.[1] ?? routing.defaultLocale;
    const signInUrl = new URL(`/${locale}/sign-in`, request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Every pathname but Next.js internals and the files that are served as they are, by their extension.
    // A path that merely holds a dot (`/en/waitlist/a.b`) is a page like any other and gets the policy.
    // Next reads it at compile time: it has to be one literal string, not built from a list.
    "/((?!_next|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|avif|txt|xml|json|js|css|map|woff|woff2|ttf|otf|webmanifest|pdf|mp4|webm|mp3)$).*)",
  ],
};
