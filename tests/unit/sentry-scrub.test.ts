import { afterEach, describe, expect, it, vi } from "vitest";
import { scrubServerEvent, scrubTokens } from "@/shared/lib/sentry-scrub";

/**
 * The error reporter of the browser sends the address of the page with each
 * event and each breadcrumb. The link of the reset e-mail holds a token in its
 * address (`?token=`), which is a password for an hour: it is filtered out of
 * everything that is sent, whatever field the SDK puts the address in.
 */

describe("scrubbing the tokens out of what the reporter sends", () => {
  it("filters the token of an address, and keeps the rest of it", () => {
    expect(scrubTokens("https://app.example.com/en/reset-password?token=abc123&lang=fr#x")).toBe(
      "https://app.example.com/en/reset-password?token=[Filtered]&lang=fr#x",
    );
  });

  it("filters a token that starts a query string, as the reporter writes it in `query_string`", () => {
    expect(scrubTokens("token=abc123&x=1")).toBe("token=[Filtered]&x=1");
  });

  it("filters a token in a fragment, and every one of them", () => {
    expect(scrubTokens("/a#token=one&b=1")).toBe("/a#token=[Filtered]&b=1");
    expect(scrubTokens("/a?token=one&token=two")).toBe("/a?token=[Filtered]&token=[Filtered]");
  });

  it("leaves a parameter that only has token in its name, and a string with no token, as they are", () => {
    expect(scrubTokens("/a?csrf_token=keep&access_token_hint=keep")).toBe("/a?csrf_token=keep&access_token_hint=keep");
    expect(scrubTokens("Failed to fetch")).toBe("Failed to fetch");
  });

  it("filters the addresses in the fields of an event, however deep they are, and leaves its other values alone", () => {
    const event = {
      message: "boom",
      level: "error",
      request: {
        url: "https://app.example.com/en/reset-password?token=abc123",
        query_string: "token=abc123",
        headers: { Referer: "https://app.example.com/en/reset-password?token=abc123" },
      },
      breadcrumbs: [
        { category: "navigation", data: { from: "/en/sign-in", to: "/en/reset-password?token=abc123" } },
        { category: "fetch", data: { url: "/api/auth/reset-password?token=abc123", status_code: 400 } },
      ],
      tags: ["a", "b"],
      extra: { count: 3, ok: true, nothing: null },
    };

    expect(scrubTokens(event)).toEqual({
      message: "boom",
      level: "error",
      request: {
        url: "https://app.example.com/en/reset-password?token=[Filtered]",
        query_string: "token=[Filtered]",
        headers: { Referer: "https://app.example.com/en/reset-password?token=[Filtered]" },
      },
      breadcrumbs: [
        { category: "navigation", data: { from: "/en/sign-in", to: "/en/reset-password?token=[Filtered]" } },
        { category: "fetch", data: { url: "/api/auth/reset-password?token=[Filtered]", status_code: 400 } },
      ],
      tags: ["a", "b"],
      extra: { count: 3, ok: true, nothing: null },
    });
  });

  it("does not change what it was given", () => {
    const event = { request: { url: "/a?token=abc123" } };

    scrubTokens(event);

    expect(event.request.url).toBe("/a?token=abc123");
  });

  it("gives back what is not an object or a string as it was", () => {
    expect(scrubTokens(null)).toBeNull();
    expect(scrubTokens(undefined)).toBeUndefined();
    expect(scrubTokens(42)).toBe(42);
  });

  it("copes with an event that points to itself", () => {
    const event: Record<string, unknown> = { url: "/a?token=abc123" };
    event.self = event;

    const scrubbed = scrubTokens(event) as { url: string };

    expect(scrubbed.url).toBe("/a?token=[Filtered]");
  });
});

// The server of Better Auth meets the token in the path of its own address (`/api/auth/reset-password/<token>`), and
// a database error that carries its parameters says it as `reset-password:<token>`: they are filtered as the query is.
describe("scrubbing the token where it sits in a path", () => {
  it("filters the segment after /reset-password/, in a full address, a bare path, a fragment, a log line and JSON", () => {
    expect(scrubTokens("https://app.example.com/api/auth/reset-password/abc123XYZ?callbackURL=%2Fen%2Freset-password")).toBe(
      "https://app.example.com/api/auth/reset-password/[Filtered]?callbackURL=%2Fen%2Freset-password",
    );
    expect(scrubTokens("/api/auth/reset-password/abc123XYZ")).toBe("/api/auth/reset-password/[Filtered]");
    expect(scrubTokens("/en/reset-password/abc123XYZ#top")).toBe("/en/reset-password/[Filtered]#top");
    expect(scrubTokens("GET /api/auth/reset-password/abc123XYZ 302 in 12ms")).toBe("GET /api/auth/reset-password/[Filtered] 302 in 12ms");
    expect(scrubTokens('{"url":"/api/auth/reset-password/abc123XYZ","status":302}')).toBe('{"url":"/api/auth/reset-password/[Filtered]","status":302}');
  });

  it("filters the identifier the token is looked up by, as a database error carries it", () => {
    expect(scrubTokens("Failed query: select ... params: reset-password:abc123XYZ,1700000000")).toBe(
      "Failed query: select ... params: reset-password:[Filtered],1700000000",
    );
    expect(scrubTokens('"identifier":"reset-password:abc123XYZ"')).toBe('"identifier":"reset-password:[Filtered]"');
  });

  it("filters both forms, and the query form, when they are in one string", () => {
    expect(scrubTokens("/api/auth/reset-password/aaa111?token=bbb222 reset-password:ccc333")).toBe(
      "/api/auth/reset-password/[Filtered]?token=[Filtered] reset-password:[Filtered]",
    );
  });

  it("leaves the addresses that hold no token as they are", () => {
    for (const harmless of [
      "/en/reset-password",
      "/api/auth/reset-password",
      "/api/auth/reset-password/",
      "/api/auth/reset-password?x=1",
      "reset-password: expired",
      "the reset-password page",
    ]) {
      expect(scrubTokens(harmless), harmless).toBe(harmless);
    }
  });
});

// An address of the reset link can travel inside another one (a `callbackUrl`, a logged `encodeURIComponent(url)`): its
// separators are then percent-encoded, in either case of the hex digits
describe("scrubbing the token of an address that is encoded", () => {
  it.each([
    ["/api/auth/reset-password%2Fabc123XYZ", "/api/auth/reset-password%2F[Filtered]"],
    ["%2Fapi%2Fauth%2Freset-password%2Fabc123XYZ", "%2Fapi%2Fauth%2Freset-password%2F[Filtered]"],
    ["reset-password%3Aabc123XYZ", "reset-password%3A[Filtered]"],
    ["?callbackUrl=%2Fen%2Freset-password%3Ftoken%3Dabc123XYZ", "?callbackUrl=%2Fen%2Freset-password%3Ftoken%3D[Filtered]"],
  ])("filters the token of %s", (dirty, clean) => {
    expect(scrubTokens(dirty)).toBe(clean);
  });

  it("reads the hex digits in either case", () => {
    expect(scrubTokens("/api/auth/reset-password%2fabc123XYZ")).toBe("/api/auth/reset-password%2f[Filtered]");
    expect(scrubTokens("reset-password%3aabc123XYZ")).toBe("reset-password%3a[Filtered]");
    expect(scrubTokens("?next=%2Fen%2Freset-password%3Ftoken%3dabc123XYZ")).toBe("?next=%2Fen%2Freset-password%3Ftoken%3d[Filtered]");
  });

  it("stops the encoded token at the encoded & or #, and keeps what follows", () => {
    expect(scrubTokens("?next=%2Freset-password%3Ftoken%3Dabc123XYZ%26lang%3Dfr")).toBe(
      "?next=%2Freset-password%3Ftoken%3D[Filtered]%26lang%3Dfr",
    );
    expect(scrubTokens("/reset-password%2Fabc123XYZ%23top")).toBe("/reset-password%2F[Filtered]%23top");
  });

  it("leaves an encoded address with no token as it is", () => {
    for (const harmless of ["%2Fen%2Freset-password", "?callbackUrl=%2Fen%2Fdashboard", "reset-password%3A"]) {
      expect(scrubTokens(harmless), harmless).toBe(harmless);
    }
  });
});

// The body of the reset form is `{"newPassword": ..., "token": ...}`: whatever the SDK attaches of a request, the server
// reporter takes the secrets out of it, as an object or as the JSON it was sent in
describe("scrubbing a request body on the server", () => {
  const body = { token: "abc123XYZ", newPassword: "Secret-123!", password: "p", currentPassword: "c", name: "Camille" };
  const kept = { name: "Camille" };

  it.each([
    ["an object", body],
    ["a JSON string", JSON.stringify(body)],
  ])("removes the token and the passwords from %s, in an event and in a transaction", (_, data) => {
    for (const event of [{ message: "boom", request: { url: "/api/auth/reset-password", data } }, { type: "transaction", request: { data } }]) {
      const sent = scrubServerEvent(event) as { request: { data: unknown } };
      const left = typeof sent.request.data === "string" ? JSON.parse(sent.request.data) : sent.request.data;

      expect(left).toEqual(kept);
      expect(JSON.stringify(sent)).not.toMatch(/abc123XYZ|Secret-123|"password"/);
    }
  });

  it("removes them from a form-encoded body, and leaves a body that is neither alone", () => {
    const sent = scrubServerEvent({ request: { data: "token=abc123XYZ&password=p&name=Camille" } }) as { request: { data: string } };

    expect(sent.request.data).toBe("name=Camille");
    expect(scrubServerEvent({ request: { data: "plain words" } })).toEqual({ request: { data: "plain words" } });
    expect(scrubServerEvent({ request: { url: "/a" } })).toEqual({ request: { url: "/a" } });
  });

  it("drops a JSON body that was cut short and names a secret field, and keeps one that names none", () => {
    const cut = '{"token":"abc123XYZ","newPassword":"Secret-123","note":"trunc';

    expect(scrubServerEvent({ request: { data: cut } })).toEqual({ request: { data: "[Filtered]" } });
    expect(scrubServerEvent({ request: { data: '{"name":"Camille","note":"trunc' } })).toEqual({
      request: { data: '{"name":"Camille","note":"trunc' },
    });
  });

  // A server action's body is the list of its arguments: the reset form's and the account deletion's, as they are sent
  it.each([
    ["the reset form", [{ newPassword: "hunter2-new" }], "hunter2-new"],
    ["the reset form, as the JSON it is sent in", '[{"newPassword":"hunter2-new"}]', "hunter2-new"],
    ["the account deletion", [{ password: "hunter2-old" }], "hunter2-old"],
    ["the account deletion, as JSON", '[{"password":"hunter2-old"}]', "hunter2-old"],
    ["arguments nested in a list", [[{ currentPassword: "hunter2-old" }]], "hunter2-old"],
    ["an object nested in an argument", [{ input: { password: "p2-nested" } }], "p2-nested"],
    ["the same, as JSON", '[{"input":{"password":"p2-nested"}}]', "p2-nested"],
    ["objects nested deeper", { a: { b: [{ c: { newPassword: "p2-deep" } }] } }, "p2-deep"],
  ])("removes the password from the body of %s", (_, data, secret) => {
    const sent = scrubServerEvent({ message: "boom", request: { data } });

    expect(JSON.stringify(sent)).not.toContain(secret);
  });

  it("keeps the other arguments of an action", () => {
    const sent = scrubServerEvent({ request: { data: [{ name: "Camille", password: "p" }, "plain"] } }) as { request: { data: unknown } };

    expect(sent.request.data).toEqual([{ name: "Camille" }, "plain"]);
  });

  // The SDK attaches the cookies of the request to every event: the session's, and the token of a reset link while it waits
  it("drops the cookies of the request, parsed and as a header, whatever the case of the header", () => {
    const event = {
      message: "boom",
      request: {
        url: "/en/reset-password",
        cookies: { reset_token: "RESETTOKEN123", session: "s" },
        headers: { cookie: "reset_token=RESETTOKEN123; session=s", Cookie: "reset_token=RESETTOKEN123", "user-agent": "test" },
      },
    };

    const sent = scrubServerEvent(event) as { request: { headers: Record<string, string>; cookies?: unknown } };

    expect(JSON.stringify(sent)).not.toContain("RESETTOKEN123");
    expect(sent.request.cookies).toBeUndefined();
    expect(sent.request.headers).toEqual({ "user-agent": "test" });
    // What it was given is not changed
    expect(event.request.cookies.reset_token).toBe("RESETTOKEN123");
  });

  it("does not change what it was given", () => {
    const event = { request: { data: { ...body } } };

    scrubServerEvent(event);

    expect(event.request.data).toEqual(body);
  });
});

// The reporter is started from three files: the browser's (a page of the reset is read there) and the
// server's and the edge's, which see the same address when a request fails. They are started with the
// same three hooks, which are the scrubbing.
const CONFIGS = [
  ["the browser", "@/instrumentation-client", { NEXT_PUBLIC_SENTRY_DSN: "https://key@example.ingest.sentry.io/1" }],
  ["the server", "../../sentry.server.config", { SENTRY_DSN: "https://key@example.ingest.sentry.io/1" }],
  ["the edge", "../../sentry.edge.config", { SENTRY_DSN: "https://key@example.ingest.sentry.io/1" }],
] as const;

describe("the hooks the reporter is started with", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@sentry/nextjs");
    vi.resetModules();
  });

  async function startedWith(path: string, env: Record<string, string>) {
    vi.resetModules();
    for (const [name, value] of Object.entries(env)) {
      vi.stubEnv(name, value);
    }
    const init = vi.fn();
    vi.doMock("@sentry/nextjs", () => ({
      init,
      captureRouterTransitionStart: vi.fn(),
      httpIntegration: (options: unknown) => ({ name: "Http", options }),
    }));
    await import(/* @vite-ignore */ path);

    return init.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
  }

  // The SDK keeps up to 10 kB of the body of an incoming request and attaches it to events, whatever sendDefaultPii says
  it("starts the server with no incoming request body, and no span for each incoming request", async () => {
    const options = await startedWith("../../sentry.server.config", { SENTRY_DSN: "https://key@example.ingest.sentry.io/1" });

    expect(options?.integrations).toEqual([{ name: "Http", options: { disableIncomingRequestSpans: true, maxIncomingRequestBodySize: "none" } }]);
  });

  it.each(CONFIGS)("scrub the events, the transactions and the breadcrumbs sent from %s", async (_, path, env) => {
    const options = await startedWith(path, env);
    const dirty = { request: { url: "https://app.example.com/en/reset-password?token=abc123" } };
    const clean = { request: { url: "https://app.example.com/en/reset-password?token=[Filtered]" } };

    expect(options, "the reporter was not started").toBeDefined();
    for (const hook of ["beforeSend", "beforeSendTransaction", "beforeBreadcrumb"]) {
      const run = options?.[hook] as ((value: unknown) => unknown) | undefined;

      expect(run?.(dirty), `${hook} does not scrub`).toEqual(clean);
    }
  });

  it("start the browser's reporter without the replay rates: nothing records a replay, so they do nothing", async () => {
    const options = await startedWith("@/instrumentation-client", CONFIGS[0][2]);

    expect(options).not.toHaveProperty("replaysSessionSampleRate");
    expect(options).not.toHaveProperty("replaysOnErrorSampleRate");
  });

  it.each(CONFIGS)("scrub the token of a path in the events, the transactions and the breadcrumbs sent from %s", async (_, path, env) => {
    const options = await startedWith(path, env);
    const dirty = { request: { url: "https://app.example.com/api/auth/reset-password/abc123XYZ" }, message: "reset-password:abc123XYZ" };

    for (const hook of ["beforeSend", "beforeSendTransaction", "beforeBreadcrumb"]) {
      const run = options?.[hook] as ((value: unknown) => unknown) | undefined;

      expect(JSON.stringify(run?.(dirty)), `${hook} lets the token of a path through`).not.toContain("abc123XYZ");
    }
  });

  // Tracing is on (0.1 of the requests are sampled): a sampled request is sent as a transaction with its spans, which
  // name the address the request asked for and the one it called, and the trace context holds them too
  it("holds the token nowhere in a sampled transaction of the server, its spans, its trace context and its request included", async () => {
    const options = await startedWith("../../sentry.server.config", CONFIGS[1][2]);
    const token = "abc123XYZ";
    const transaction = {
      type: "transaction",
      transaction: `GET /api/auth/reset-password/${token}`,
      request: { url: `https://app.example.com/api/auth/reset-password/${token}?callbackURL=%2Fen%2Freset-password`, query_string: `token=${token}` },
      contexts: {
        trace: {
          op: "http.server",
          description: `GET /api/auth/reset-password/${token}`,
          data: { "url.path": `/api/auth/reset-password/${token}`, "http.target": `/api/auth/reset-password/${token}?token=${token}` },
        },
      },
      spans: [
        { op: "http.client", description: `GET https://app.example.com/api/auth/reset-password/${token}`, data: { "http.url": `https://app.example.com/api/auth/reset-password/${token}?token=${token}` } },
        { op: "db.query", description: "select * from verification where identifier = $1", data: { "db.params": `reset-password:${token}` } },
        { op: "function.nextjs", description: "resolve page components", data: {} },
      ],
    };

    const sent = (options?.beforeSendTransaction as (value: unknown) => unknown)(transaction);

    expect(JSON.stringify(sent)).not.toContain(token);
    // What is not a token is kept: the sampled request is still readable
    expect(sent).toMatchObject({
      transaction: "GET /api/auth/reset-password/[Filtered]",
      spans: [{ op: "http.client" }, { op: "db.query", data: { "db.params": "reset-password:[Filtered]" } }, { op: "function.nextjs", description: "resolve page components" }],
    });
  });

  it.each(CONFIGS.slice(1))("remove the secrets of the request body in the events and transactions sent from %s", async (_, path, env) => {
    const options = await startedWith(path, env);
    const dirty = { request: { data: JSON.stringify({ newPassword: "Secret-123!", token: "abc123XYZ" }) } };

    for (const hook of ["beforeSend", "beforeSendTransaction"]) {
      const run = options?.[hook] as ((value: unknown) => unknown) | undefined;

      expect(JSON.stringify(run?.(dirty)), `${hook} lets the body through`).not.toMatch(/abc123XYZ|Secret-123/);
    }
  });
});
