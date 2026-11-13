import { describe, expect, it } from "vitest";
import { config } from "@/proxy";

/**
 * Which paths the proxy handles: the pages, so that each gets its Content-Security-Policy and its nonce. A path that
 * only holds a dot is a page like any other; Next.js internals and files served as they are are not.
 */

const [matcher = ""] = config.matcher;
const handled = (path: string) => new RegExp(`^${matcher}$`).test(path);

describe("what the proxy handles", () => {
  it.each(["/", "/en", "/en/sign-in", "/fr/dashboard", "/api/auth/get-session", "/en/waitlist/a.b", "/en/accept-invitation/x.y", "/en/blog/v1.2-release", "/en/waitlist/abc.def.ghi"])(
    "handles %s",
    (path) => {
      expect(handled(path)).toBe(true);
    },
  );

  it.each(["/_next/static/chunks/app.js", "/_next/image", "/favicon.ico", "/robots.txt", "/sitemap.xml", "/logo.svg", "/fonts/inter.woff2", "/blog/cover.webp", "/site.webmanifest"])(
    "leaves %s alone",
    (path) => {
      expect(handled(path)).toBe(false);
    },
  );
});
