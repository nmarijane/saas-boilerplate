import { isIP } from "node:net";

// Where the address of the client comes from. A request carries it in headers,
// and a client can write any header it likes: `X-Forwarded-For` is the client's
// own word until a proxy that the deployment trusts has overwritten or extended
// it. Next.js does not hand the route handlers and the proxy the socket, only
// the headers (and it fills `X-Forwarded-For` from the socket only when the
// request came without one), so the app reads an address from a header only
// when `TRUST_PROXY` says which one to believe (docs/SETUP.md, "Behind a proxy"):
//
// - `none` (or unset, in development): no header is believed. There is no address,
//   and what is limited by address shares ONE limit for every client at once: a
//   production server must choose it by name, and refuses to start with no choice
//   (production-config.ts). On Vercel (`VERCEL=1`) unset means `vercel`.
// - `vercel`: Vercel sets `x-vercel-forwarded-for` itself, whatever the client sent.
// - a whole number N: N reverse proxies stand in front of the app, and each one
//   appends the address it saw to `X-Forwarded-For`. The client is the Nth entry
//   from the right: whatever is further left is the client's own word.

/** The value of `TRUST_PROXY` that the schema of the environment accepts. */
export const TRUST_PROXY_PATTERN = /^(?:vercel|none|[1-9]\d?)$/;

/**
 * The setting as the app reads it: `TRUST_PROXY` trimmed and lower-cased, or `vercel` on Vercel (`VERCEL=1`) when it
 * is not set, or `undefined`.
 */
export function trustProxyOf(variables: Readonly<Record<string, string | undefined>> = process.env): string | undefined {
  const setting = variables.TRUST_PROXY?.trim().toLowerCase();

  return setting || (variables.VERCEL === "1" ? "vercel" : undefined);
}

/** The header that carries the address to the code that reads it (Better Auth reads it, see auth.ts). */
export const CLIENT_IP_HEADER = "x-app-client-ip";

interface HeaderSource {
  get: (name: string) => string | null;
}

/**
 * The address of the client of a request, as far as `trustProxy` allows it to
 * be believed, or `null` when it cannot be. An entry that is not an IP address
 * is never returned: it would be a bucket of the client's own choosing.
 */
export function clientIpOf(headers: HeaderSource, trustProxy = trustProxyOf()): string | null {
  const setting = trustProxy?.trim().toLowerCase();
  if (!setting || setting === "none") {
    return null;
  }

  if (setting === "vercel") {
    return validIp(headers.get("x-vercel-forwarded-for")?.split(",")[0]);
  }

  if (!TRUST_PROXY_PATTERN.test(setting)) {
    return null;
  }

  const entries = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return validIp(entries[entries.length - Number(setting)]);
}

function validIp(value: string | undefined): string | null {
  const address = value?.trim();

  return address && isIP(address) !== 0 ? address : null;
}

/** The key a limit by address uses: the address, or the one shared bucket when there is none. */
export function limitKeyOf(headers: HeaderSource): string {
  return clientIpOf(headers) ?? "unknown";
}
