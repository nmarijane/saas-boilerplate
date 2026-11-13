// The Content-Security-Policy of the pages, enforced. It is built per request
// (src/proxy.ts): the scripts that may run are the app's own (`'self'`) and those
// that carry the nonce of the request, which Next.js puts on its own scripts and which
// a script loaded by one of them inherits (`'strict-dynamic'`). An injected script has no
// nonce, so it does not run, whatever markup an attacker managed to get into a page.
//
// The nonce is drawn for each request, so a page cannot be built once and served to
// everyone: every page is rendered per request (the root layout asks for the headers).
// That is the price of a policy that is not `'unsafe-inline'`; docs/SETUP.md, "Content
// Security Policy", says how to trade it back if it is too dear.

interface PolicyOptions {
  nonce: string;
  /** The dev server needs `eval` (React rebuilds the stack of a server error in the browser) and a socket for hot reload. */
  development?: boolean;
}

/** The nonce of a request: 128 bits, unpredictable, base64. */
export function makeNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

export function contentSecurityPolicy({ nonce, development = false }: PolicyOptions): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      // Where `'strict-dynamic'` is not understood
      "https://js.stripe.com",
      "https://checkout.stripe.com",
      ...(development ? ["'unsafe-eval'"] : []),
    ],
    // The components set `style` attributes (Radix, the toasts), which a nonce does not allow: styles keep
    // `'unsafe-inline'`. Style can move things around; it cannot run code.
    "style-src": ["'self'", "'unsafe-inline'"],
    // A person's picture is an https address (src/shared/utils/avatar-url.ts)
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", "https://api.stripe.com", "https://checkout.stripe.com", "https://*.sentry.io", ...(development ? ["ws:", "wss:"] : [])],
    "frame-src": ["https://js.stripe.com", "https://*.js.stripe.com", "https://hooks.stripe.com", "https://checkout.stripe.com"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };

  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}
