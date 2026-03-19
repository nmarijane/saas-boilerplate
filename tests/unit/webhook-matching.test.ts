import { describe, expect, it } from "vitest";
import { matchEvent } from "@/features/webhooks/matching";

describe("matchEvent", () => {
  it("matches exact event names", () => {
    expect(matchEvent("member.invited", ["member.invited"])).toBe(true);
    expect(matchEvent("member.invited", ["member.removed"])).toBe(false);
  });

  it("matches wildcard segments", () => {
    expect(matchEvent("subscription.created", ["subscription.*"])).toBe(true);
    expect(matchEvent("subscription.cancelled", ["subscription.*"])).toBe(true);
    expect(matchEvent("member.invited", ["subscription.*"])).toBe(false);
  });

  it("matches global wildcard", () => {
    expect(matchEvent("anything.here", ["**"])).toBe(true);
  });

  it("matches from a list of patterns", () => {
    expect(matchEvent("member.invited", ["subscription.*", "member.invited"])).toBe(true);
  });

  it("does not match different segment count", () => {
    expect(matchEvent("a.b.c", ["a.*"])).toBe(false);
  });
});
