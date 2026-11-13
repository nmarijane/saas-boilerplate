import { describe, expect, it } from "vitest";
import { clientIpOf, limitKeyOf, trustProxyOf } from "@/shared/lib/client-ip";

/**
 * The address of the client is read from a header only when TRUST_PROXY says which
 * one to believe: `X-Forwarded-For` is whatever the client wrote in it until a proxy
 * of the deployment has overwritten or extended it.
 */

const headers = (values: Record<string, string>) => new Headers(values);

describe("the address of a client, with no trusted proxy", () => {
  it.each([undefined, "", "  "])("is unknown with TRUST_PROXY=%j, whatever the client wrote", (setting) => {
    const request = headers({ "x-forwarded-for": "203.0.113.7", "x-vercel-forwarded-for": "203.0.113.8", "x-real-ip": "203.0.113.9" });

    expect(clientIpOf(request, setting)).toBeNull();
    expect(limitKeyOf(request)).toBe("unknown");
  });
});

describe("the address of a client, when the one shared limit is chosen by name", () => {
  it("is unknown with TRUST_PROXY=none, whatever the client wrote", () => {
    expect(clientIpOf(headers({ "x-forwarded-for": "203.0.113.7", "x-vercel-forwarded-for": "198.51.100.4" }), "none")).toBeNull();
  });

  it("reads the setting from the environment: vercel on Vercel when it is not set", () => {
    expect(trustProxyOf({ VERCEL: "1" })).toBe("vercel");
    expect(trustProxyOf({ VERCEL: "1", TRUST_PROXY: "2" })).toBe("2");
    expect(trustProxyOf({ TRUST_PROXY: " None " })).toBe("none");
    expect(trustProxyOf({})).toBeUndefined();
  });
});

describe("the address of a client behind Vercel", () => {
  it("is the one Vercel sets, and not the X-Forwarded-For a client can write", () => {
    const request = headers({ "x-vercel-forwarded-for": "198.51.100.4", "x-forwarded-for": "6.6.6.6" });

    expect(clientIpOf(request, "vercel")).toBe("198.51.100.4");
  });

  it("is unknown when Vercel did not set it", () => {
    expect(clientIpOf(headers({ "x-forwarded-for": "6.6.6.6" }), "vercel")).toBeNull();
  });
});

describe("the address of a client behind reverse proxies", () => {
  it("is the entry that the one proxy appended, however many the client wrote before it", () => {
    const request = headers({ "x-forwarded-for": "6.6.6.6, 7.7.7.7, 203.0.113.7" });

    expect(clientIpOf(request, "1")).toBe("203.0.113.7");
  });

  it("counts proxies from the right: the Nth entry from the end", () => {
    const request = headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7, 10.0.0.2" });

    expect(clientIpOf(request, "2")).toBe("203.0.113.7");
    expect(clientIpOf(request, "1")).toBe("10.0.0.2");
  });

  // A client that writes nothing gets the address of its socket from Next, as the one entry
  it("reads the one entry of a request that came with none of its own", () => {
    expect(clientIpOf(headers({ "x-forwarded-for": "2001:db8::1" }), "1")).toBe("2001:db8::1");
  });

  it("is unknown when the chain is shorter than the number of proxies: someone skipped a proxy", () => {
    expect(clientIpOf(headers({ "x-forwarded-for": "203.0.113.7" }), "2")).toBeNull();
    expect(clientIpOf(headers({}), "1")).toBeNull();
  });

  it("is unknown when the entry is not an IP address: it would be a bucket of the client's own choosing", () => {
    expect(clientIpOf(headers({ "x-forwarded-for": "not-an-ip" }), "1")).toBeNull();
    expect(clientIpOf(headers({ "x-forwarded-for": "6.6.6.6, <script>" }), "1")).toBeNull();
  });

  it("is unknown for a setting that is not one", () => {
    expect(clientIpOf(headers({ "x-forwarded-for": "203.0.113.7" }), "true")).toBeNull();
    expect(clientIpOf(headers({ "x-forwarded-for": "203.0.113.7" }), "0")).toBeNull();
  });

  it("reads TRUST_PROXY from the environment when no setting is given", () => {
    const original = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = "1";
    try {
      expect(limitKeyOf(headers({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
    } finally {
      if (original === undefined) {
        delete process.env.TRUST_PROXY;
      } else {
        process.env.TRUST_PROXY = original;
      }
    }
  });
});
