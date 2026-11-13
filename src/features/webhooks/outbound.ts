import type { LookupAddress } from "node:dns";
import type { ClientRequest, IncomingMessage } from "node:http";
import { Buffer } from "node:buffer";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import { unstable_rethrow } from "next/navigation";
import { isAllowedEndpointUrl } from "./endpoint-url";
import "server-only";

// The one door through which the app calls an address that a customer typed. An
// endpoint is chosen by whoever administers a workspace, so the server must not
// be made to call what only the server can reach: the cloud metadata service, a
// database on a private network, its own admin interface. Four rules:
//
// 1. https only (http://localhost in development): `endpoint-url.ts`.
// 2. The name is resolved here, every address it resolves to is checked, and the
//    connection is made to the address that was checked: a second resolution by
//    the HTTP client could answer differently (DNS rebinding).
// 3. A redirect is an answer, not an order: it is never followed.
// 4. The call has a deadline, for the whole of it (resolution, connection, answer: a
//    receiver that drips a byte at a time does not keep it open), and the answer a size limit.

// An IPv4 address written as IPv6 (`::ffff:127.0.0.1`) is checked against the IPv4 rules by `BlockList` itself
const BLOCKED = new BlockList();
const BLOCKED_V4 = [
  ["0.0.0.0", 8], // "this network"
  ["168.63.129.16", 32], // the internal endpoint of Azure
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // shared address space (carrier-grade NAT)
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, which holds the cloud metadata services
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, and the broadcast address
] as const;
// An IPv6 address is public only inside 2000::/3 (global unicast): everything else (loopback, IPv4-compatible and
// IPv4-translated forms, local NAT64, unique local, link-local, multicast) is outside it. The ranges below are
// the ones inside it that are not public either.
const GLOBAL_V6 = new BlockList();
GLOBAL_V6.addSubnet("2000::", 3, "ipv6");
const BLOCKED_V6 = [
  ["2001::", 32], // Teredo: tunnels IPv4
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4: embeds an IPv4 address
  ["fc00::", 7], // unique local (private)
  ["fe80::", 10], // link-local
  ["fec0::", 10], // site-local (deprecated, still private)
  ["ff00::", 8], // multicast
] as const;
for (const [network, prefix] of BLOCKED_V4) {
  BLOCKED.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of BLOCKED_V6) {
  BLOCKED.addSubnet(network, prefix, "ipv6");
}

/** Raised for an address that the server must not call. The delivery is refused and is not retried: it would be refused again. */
export class BlockedDestinationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedDestinationError";
  }
}

/** What the delivery log says, and the error says, for every refusal: one thing, so that it tells nothing of the network behind the server. */
const NOT_DELIVERED = "Not delivered";

/**
 * Whether an address is an IP literal that is not public (`https://10.0.0.1/`, `https://[::1]/`): checked when an
 * endpoint is made, without resolving anything. A name is checked when an event is delivered.
 */
export function isNonPublicAddressLiteral(address: string): boolean {
  try {
    const host = new URL(address).hostname.replace(/^\[|\]$/g, "");

    return isIP(host) !== 0 && isBlockedAddress(host);
  } catch {
    return false;
  }
}

/** Whether an IP address is one that the server must not call: private, loopback, link-local, metadata, reserved. */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) {
    return true;
  }

  if (family === 6 && !GLOBAL_V6.check(address, "ipv6")) {
    return true;
  }

  return BLOCKED.check(address, family === 4 ? "ipv4" : "ipv6");
}

export type Resolver = (hostname: string) => Promise<LookupAddress[]>;

const resolveWithDns: Resolver = (hostname) => lookup(hostname, { all: true, verbatim: true });

/** What a transport is asked to do: connect to `address` (already checked) and talk to `url` there. */
export interface Connection {
  url: URL;
  address: LookupAddress;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
  maxResponseBytes: number;
}
export interface Reply {
  status: number;
  body: string;
}
export type Transport = (connection: Connection) => Promise<Reply>;

interface Options {
  /** Development allows `http://localhost`, and then the loopback address it resolves to. */
  development?: boolean;
  resolver?: Resolver;
  transport?: Transport;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

/**
 * The real transport: node's own request, with the connection made to the address
 * that was checked (`lookup` answers with it, whatever is asked), the name kept for
 * the certificate (`servername`) and the `Host` header. It follows no redirect, gives
 * up `timeoutMs` after it started whatever has arrived, and stops reading after `maxResponseBytes`.
 */
const connectTo: Transport = ({ url, address, headers, body, timeoutMs, maxResponseBytes }) =>
  new Promise<Reply>((resolve, reject) => {
    // One deadline for the connection and the answer: a socket's own timeout is an idle one, which each byte starts again
    let request: ClientRequest | undefined;
    const deadline = setTimeout(() => request?.destroy(new Error(`The endpoint did not answer in ${timeoutMs} ms`)), timeoutMs);
    const settle = <T>(done: (value: T) => void) => (value: T) => {
      clearTimeout(deadline);
      done(value);
    };
    const send = url.protocol === "https:" ? httpsRequest : httpRequest;
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    request = send(
      {
        protocol: url.protocol,
        hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: { ...headers, Host: url.host, "Content-Length": Buffer.byteLength(body) },
        servername: isIP(hostname) === 0 ? hostname : undefined,
        lookup: (_name, options, callback) => {
          // Asked for every address (`all`), the client wants a list; otherwise the one
          if (options.all) {
            callback(null, [{ address: address.address, family: address.family }]);
          } else {
            callback(null, address.address, address.family);
          }
        },
      },
      (response: IncomingMessage) => {
        const chunks: Buffer[] = [];
        let received = 0;
        const finish = () => settle(resolve)({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") });
        response.on("data", (chunk: Buffer) => {
          received += chunk.length;
          chunks.push(chunk);
          if (received >= maxResponseBytes) {
            response.destroy();
            finish();
          }
        });
        response.on("end", finish);
        response.on("error", settle(reject));
      },
    );

    request.on("error", settle(reject));
    request.end(body);
  });

/** Resolves a name within the time given. A name that does not resolve is not delivered to, as one that is not public. */
async function resolveWithin(resolver: Resolver, host: string, timeoutMs: number): Promise<LookupAddress[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      resolver(host),
      new Promise<never>((_, reject) => {
        timer = setTimeout(reject, timeoutMs, new Error(`The endpoint did not answer in ${timeoutMs} ms`));
      }),
    ]);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Error && error.message.startsWith("The endpoint did not answer")) {
      throw error;
    }

    // An answer about the name (it does not exist, it has no address) is a refusal: no retry, one line, as for a
    // name that is not public. Any other failure says nothing about the name (a resolver that is down for a
    // while): an ordinary error, with the same words, so that the job runs again
    const code = (error as { code?: string } | null)?.code;
    if (code === "ENOTFOUND" || code === "ENODATA") {
      throw new BlockedDestinationError(NOT_DELIVERED);
    }
    throw new Error(NOT_DELIVERED, { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

const DELIVERY_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 16 * 1024;

/**
 * POSTs a JSON body to an address that a customer chose, under the rules above.
 * Throws `BlockedDestinationError` when the address is one the server must not
 * call, or when it is not one that an endpoint may have.
 */
export async function postJson(
  address: string,
  { headers, body }: { headers: Record<string, string>; body: string },
  {
    development = process.env.NODE_ENV === "development",
    resolver = resolveWithDns,
    transport = connectTo,
    timeoutMs = DELIVERY_TIMEOUT_MS,
    maxResponseBytes = MAX_RESPONSE_BYTES,
  }: Options = {},
): Promise<Reply> {
  if (!isAllowedEndpointUrl(address, development)) {
    throw new BlockedDestinationError(NOT_DELIVERED);
  }

  const url = new URL(address);
  // An IPv6 literal is written in brackets in an address, and not to resolve it
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const local = development && url.hostname === "localhost";

  // The deadline starts here: resolving the name is part of it
  const startedAt = Date.now();
  const resolved = isIP(host) === 0 ? await resolveWithin(resolver, host, timeoutMs) : [{ address: host, family: isIP(host) }];

  // Every address the name leads to has to be fine: the client may connect to any of them. A name that does not
  // resolve and one that is not public are told the same
  if (resolved.length === 0 || (!local && resolved.some(({ address: candidate }) => isBlockedAddress(candidate)))) {
    throw new BlockedDestinationError(NOT_DELIVERED);
  }

  const [target] = resolved;
  if (!target) {
    throw new BlockedDestinationError(NOT_DELIVERED);
  }

  return transport({ url, address: target, headers, body, timeoutMs: Math.max(1, timeoutMs - (Date.now() - startedAt)), maxResponseBytes });
}
