import type { Buffer } from "node:buffer";
import type { AddressInfo } from "node:net";
import dns from "node:dns";
import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isAllowedEndpointUrl } from "@/features/webhooks/endpoint-url";
import { BlockedDestinationError, isBlockedAddress, postJson } from "@/features/webhooks/outbound";

/**
 * Where the server may send what a customer asked it to send. An endpoint is typed by whoever
 * administers a workspace: it must not lead the server to what only the server can reach.
 * The name is resolved by a stub here, and the connection by another: no request leaves the test,
 * except those of the last group, which talk to a server on this machine.
 */

describe("the addresses that the server does not call", () => {
  it.each([
    "127.0.0.1",
    "127.255.255.254",
    "10.0.0.5",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.10",
    "169.254.169.254", // the metadata service of the cloud
    "169.254.0.1",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fe80::1",
    "fc00::1",
    "fd00:ec2::254", // the metadata service of AWS, over IPv6
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:169.254.169.254",
    "64:ff9b::a9fe:a9fe",
    "2002:7f00:1::1",
    "ff02::1",
    "::7f00:1", // IPv4-compatible
    "::127.0.0.1",
    "::ffff:0:127.0.0.1", // IPv4-translated
    "64:ff9b:1::1", // local NAT64
    "2001::1", // Teredo
    "168.63.129.16", // Azure's internal endpoint
    "not-an-address",
  ])("includes %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "172.15.255.255", "169.253.1.1", "100.63.255.255", "2606:4700:4700::1111", "2a00:1450:4007:80f::200e"])(
    "does not include the public address %s",
    (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    },
  );
});

describe("the addresses an endpoint may have", () => {
  it.each(["https://example.com", "https://example.com:8443/hooks?x=1", "HTTPS://EXAMPLE.COM/Hook"])("accepts %s", (url) => {
    expect(isAllowedEndpointUrl(url, false)).toBe(true);
  });

  it.each([
    "http://example.com/hook",
    "http://localhost:3000/hook",
    "https://user:pass@example.com/hook",
    "ftp://example.com",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "//example.com",
    "example.com",
    "",
  ])("refuses %s", (url) => {
    expect(isAllowedEndpointUrl(url, false)).toBe(false);
  });

  it("accepts http://localhost in development, and no other plain address", () => {
    expect(isAllowedEndpointUrl("http://localhost:3000/hook", true)).toBe(true);
    expect(isAllowedEndpointUrl("http://example.com/hook", true)).toBe(false);
    expect(isAllowedEndpointUrl("http://127.0.0.1:3000/hook", true)).toBe(false);
  });
});

const PUBLIC = { address: "93.184.216.34", family: 4 };
const request = { headers: { "Content-Type": "application/json" }, body: "{}" };
const ok = { status: 200, body: "ok" };

function wired(resolved: { address: string; family: number }[], reply = ok) {
  const resolver = vi.fn(async () => resolved);
  const transport = vi.fn(async () => reply);

  return { resolver, transport, options: { development: false, resolver, transport } };
}

describe("posting to an endpoint", () => {
  it("connects to the address that the name resolved to, and says which name it is for", async () => {
    const { options, transport } = wired([PUBLIC]);

    await expect(postJson("https://hooks.example.com/in?a=1", request, options)).resolves.toEqual(ok);

    expect(transport).toHaveBeenCalledOnce();
    const connection = transport.mock.calls[0] as unknown as [{ url: URL; address: typeof PUBLIC }];
    expect(connection[0].address).toEqual(PUBLIC);
    expect(connection[0].url.href).toBe("https://hooks.example.com/in?a=1");
  });

  // The name resolves to somewhere private: what a customer does to reach the network behind the server
  it.each([
    ["the metadata service", "169.254.169.254"],
    ["loopback", "127.0.0.1"],
    ["a private network", "10.1.2.3"],
    ["IPv6 loopback", "::1"],
    ["an IPv4 address wrapped in IPv6", "::ffff:10.0.0.1"],
  ])("refuses a name that resolves to %s, and connects to nothing", async (_, address) => {
    const { options, transport } = wired([{ address, family: address.includes(":") ? 6 : 4 }]);

    await expect(postJson("https://innocent.example.com/hook", request, options)).rejects.toBeInstanceOf(BlockedDestinationError);
    expect(transport).not.toHaveBeenCalled();
  });

  // The client may connect to any of the addresses: one private address among public ones is one too many
  it("refuses a name when any of its addresses is private", async () => {
    const { options, transport } = wired([PUBLIC, { address: "192.168.0.1", family: 4 }]);

    await expect(postJson("https://mixed.example.com/hook", request, options)).rejects.toBeInstanceOf(BlockedDestinationError);
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    "https://169.254.169.254/latest/meta-data/",
    "https://127.0.0.1/hook",
    "https://[::1]/hook",
    // Written in other ways, an address is still the same address once it is read
    "https://2130706433/hook",
    "https://0x7f.0.0.1/hook",
    "https://[::ffff:127.0.0.1]/hook",
  ])("refuses the address literal %s without asking a resolver", async (address) => {
    const { options, resolver, transport } = wired([PUBLIC]);

    await expect(postJson(address, request, options)).rejects.toBeInstanceOf(BlockedDestinationError);
    expect(resolver).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });

  // One answer for every refusal: the log must not tell a name that does not exist from one that is private
  it("says the same thing for a name that does not resolve, one that fails to, and one that is not public", async () => {
    const messages: string[] = [];
    for (const resolver of [async () => [], async () => Promise.reject(Object.assign(new Error("queryA ENOTFOUND x"), { code: "ENOTFOUND" })), async () => [{ address: "10.0.0.1", family: 4 }]]) {
      const error = await postJson("https://nowhere.example.com/hook", request, { development: false, resolver, transport: vi.fn() }).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(BlockedDestinationError);
      messages.push((error as Error).message);
    }

    expect(new Set(messages)).toEqual(new Set(["Not delivered"]));
  });

  // ENOTFOUND and ENODATA are an answer about the name. Anything else (a resolver that is down for a while) says
  // nothing about it: the same words, but an ordinary error, so that the job runs again
  it.each(["EAI_AGAIN", "ESERVFAIL", "ETIMEOUT", "ECONNREFUSED"])("fails with the same words but is not a refusal when the resolver fails with %s", async (code) => {
    const resolver = async () => Promise.reject(Object.assign(new Error(`lookup ${code}`), { code }));

    const error = await postJson("https://flaky.example.com/hook", request, { development: false, resolver, transport: vi.fn() }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(BlockedDestinationError);
    expect((error as Error).message).toBe("Not delivered");
  });

  it.each(["ENOTFOUND", "ENODATA"])("refuses, with no retry, a name that the resolver answers %s for", async (code) => {
    const resolver = async () => Promise.reject(Object.assign(new Error(code), { code }));

    await expect(postJson("https://gone.example.com/hook", request, { development: false, resolver, transport: vi.fn() })).rejects.toBeInstanceOf(BlockedDestinationError);
  });

  it("refuses a name that resolves to nothing", async () => {
    const { options, transport } = wired([]);

    await expect(postJson("https://nowhere.example.com/hook", request, options)).rejects.toBeInstanceOf(BlockedDestinationError);
    expect(transport).not.toHaveBeenCalled();
  });

  it.each(["http://hooks.example.com/hook", "ftp://hooks.example.com/hook", "https://user:pass@hooks.example.com/hook", "not a url"])(
    "refuses %s before resolving anything",
    async (address) => {
      const { options, resolver, transport } = wired([PUBLIC]);

      await expect(postJson(address, request, options)).rejects.toBeInstanceOf(BlockedDestinationError);
      expect(resolver).not.toHaveBeenCalled();
      expect(transport).not.toHaveBeenCalled();
    },
  );

  it("delivers to localhost in development only", async () => {
    const loopback = [{ address: "127.0.0.1", family: 4 }];
    const development = wired(loopback);
    await expect(postJson("http://localhost:3000/hook", request, { ...development.options, development: true })).resolves.toEqual(ok);

    const production = wired(loopback);
    await expect(postJson("http://localhost:3000/hook", request, production.options)).rejects.toBeInstanceOf(BlockedDestinationError);
    await expect(postJson("https://localhost/hook", request, production.options)).rejects.toBeInstanceOf(BlockedDestinationError);
    expect(production.transport).not.toHaveBeenCalled();
  });

  it("does not let development reach any other private address", async () => {
    const { options, transport } = wired([{ address: "10.0.0.1", family: 4 }]);

    await expect(postJson("https://internal.example.com/hook", request, { ...options, development: true })).rejects.toBeInstanceOf(
      BlockedDestinationError,
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it("hands the time and size limits to the transport", async () => {
    const { options, transport } = wired([PUBLIC]);

    await postJson("https://hooks.example.com/hook", request, { ...options, timeoutMs: 1234, maxResponseBytes: 99 });

    expect(transport.mock.calls[0]).toMatchObject([{ timeoutMs: 1234, maxResponseBytes: 99 }]);
  });
});

// The real transport, against servers on this machine (development lets `localhost` through)
describe("the connection itself", () => {
  const servers: ReturnType<typeof createServer>[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((done) => server.close(done).closeAllConnections())));
  });

  async function listen(handler: Parameters<typeof createServer>[1]) {
    const server = createServer(handler);
    servers.push(server);
    await new Promise<void>((ready) => server.listen(0, ready));

    return `http://localhost:${(server.address() as AddressInfo).port}`;
  }

  const local = { development: true };

  it("posts the body and the headers, and reads the answer", async () => {
    const seen: { method?: string; body: string; signature?: string; host?: string } = { body: "" };
    const origin = await listen((incoming, outgoing) => {
      seen.method = incoming.method;
      seen.signature = incoming.headers["x-webhook-signature"] as string;
      seen.host = incoming.headers.host;
      incoming.on("data", (chunk: Buffer) => (seen.body += chunk.toString()));
      incoming.on("end", () => outgoing.writeHead(200).end("received"));
    });

    const reply = await postJson(`${origin}/in`, { headers: { "X-Webhook-Signature": "abc" }, body: '{"a":1}' }, local);

    expect(reply).toEqual({ status: 200, body: "received" });
    expect(seen).toMatchObject({ method: "POST", body: '{"a":1}', signature: "abc", host: origin.replace("http://", "") });
  });

  // The address that was checked is the one connected to: a second resolution by the client could answer another
  // (DNS rebinding: a name that is public when it is checked and private when it is used)
  it("connects to the address that was checked, and does not ask the system to resolve the name again", async () => {
    const origin = await listen((_, outgoing) => outgoing.writeHead(200).end("pinned"));
    const system = vi.spyOn(dns, "lookup");

    const reply = await postJson(`${origin}/in`, request, local);

    expect(reply.body).toBe("pinned");
    expect(system).not.toHaveBeenCalled();
    system.mockRestore();
  });

  // A redirect is an answer: following it would send the request where the address was not checked
  it("does not follow a redirect", async () => {
    let reached = false;
    const target = await listen((_, outgoing) => {
      reached = true;
      outgoing.writeHead(200).end("secret");
    });
    const origin = await listen((_, outgoing) => outgoing.writeHead(302, { Location: `${target}/internal` }).end());

    const reply = await postJson(`${origin}/in`, request, local);

    expect(reply.status).toBe(302);
    expect(reached).toBe(false);
  });

  it("gives up on a receiver that does not answer", async () => {
    const origin = await listen(() => {});

    await expect(postJson(`${origin}/in`, request, { ...local, timeoutMs: 150 })).rejects.toThrow(/did not answer/);
  });

  // The limit is a deadline for the whole call: a receiver that sends a byte now and then keeps a socket "active"
  it("gives up on a receiver that drips a byte at a time, at the deadline and not when it stops", async () => {
    const origin = await listen((_, outgoing) => {
      outgoing.writeHead(200);
      const drip = setInterval(() => outgoing.write("x"), 50);
      outgoing.on("close", () => clearInterval(drip));
    });
    const startedAt = Date.now();

    await expect(postJson(`${origin}/in`, request, { ...local, timeoutMs: 400 })).rejects.toThrow(/did not answer/);

    expect(Date.now() - startedAt).toBeLessThan(1500);
  });

  it("counts the resolution of the name in the deadline", async () => {
    const slow = () => new Promise<never>(() => {});

    await expect(postJson("https://slow.example.com/hook", request, { development: false, resolver: slow, timeoutMs: 200, transport: vi.fn() })).rejects.toThrow(
      /did not answer/,
    );
  });

  it("stops reading a long answer", async () => {
    const origin = await listen((_, outgoing) => {
      outgoing.writeHead(200);
      outgoing.write("x".repeat(1_000_000));
      outgoing.end("x".repeat(1_000_000));
    });

    const reply = await postJson(`${origin}/in`, request, { ...local, maxResponseBytes: 1024 });

    expect(reply.status).toBe(200);
    // What came before the limit was noticed, and nowhere near the whole answer
    expect(reply.body.length).toBeLessThan(300_000);
  });
});
