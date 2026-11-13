import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/features/auth/auth";
import { CLIENT_IP_HEADER, clientIpOf } from "@/shared/lib/client-ip";

const handler = toNextJsHandler(auth);

/**
 * The request that Better Auth reads, with the address of the client in the one
 * header it is told to read (`advanced.ipAddress` in auth.ts). Whatever the
 * client sent in that header is dropped first: the address is the one
 * `TRUST_PROXY` allows, or none, and Better Auth's own limit by address then
 * shares one bucket instead of taking the client's word for who it is.
 */
function withClientIp(request: Request): Request {
  const headers = new Headers(request.headers);
  headers.delete(CLIENT_IP_HEADER);
  const address = clientIpOf(request.headers);
  if (address) {
    headers.set(CLIENT_IP_HEADER, address);
  }

  return new Request(request, { headers });
}

export const GET = (request: Request) => handler.GET(withClientIp(request));
export const POST = (request: Request) => handler.POST(withClientIp(request));
