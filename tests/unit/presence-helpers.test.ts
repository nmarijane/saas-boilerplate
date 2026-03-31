import { describe, expect, it } from "vitest";
import {
  computeStatus,
  diffPresence,
} from "@/features/presence/helpers";

describe("computeStatus", () => {
  it("returns online when lastSeenAt is within 60s", () => {
    const now = new Date();
    const lastSeen = new Date(now.getTime() - 30_000);
    expect(computeStatus(lastSeen, now)).toBe("online");
  });

  it("returns idle when lastSeenAt is between 60s and 120s", () => {
    const now = new Date();
    const lastSeen = new Date(now.getTime() - 90_000);
    expect(computeStatus(lastSeen, now)).toBe("idle");
  });

  it("returns offline when lastSeenAt is over 120s", () => {
    const now = new Date();
    const lastSeen = new Date(now.getTime() - 150_000);
    expect(computeStatus(lastSeen, now)).toBe("offline");
  });

  it("returns online at exactly 60s boundary", () => {
    const now = new Date();
    const lastSeen = new Date(now.getTime() - 60_000);
    expect(computeStatus(lastSeen, now)).toBe("online");
  });

  it("returns idle at exactly 120s boundary", () => {
    const now = new Date();
    const lastSeen = new Date(now.getTime() - 120_000);
    expect(computeStatus(lastSeen, now)).toBe("idle");
  });
});

describe("diffPresence", () => {
  it("detects new members", () => {
    const prev = [{ userId: "a", status: "online" as const, currentPage: "/" }];
    const next = [
      { userId: "a", status: "online" as const, currentPage: "/" },
      { userId: "b", status: "online" as const, currentPage: "/dashboard" },
    ];
    const diff = diffPresence(prev, next);
    expect(diff.changed).toEqual([
      { userId: "b", status: "online", currentPage: "/dashboard" },
    ]);
  });

  it("detects status changes", () => {
    const prev = [{ userId: "a", status: "online" as const, currentPage: "/" }];
    const next = [{ userId: "a", status: "idle" as const, currentPage: "/" }];
    const diff = diffPresence(prev, next);
    expect(diff.changed).toEqual([
      { userId: "a", status: "idle", currentPage: "/" },
    ]);
  });

  it("detects page changes", () => {
    const prev = [{ userId: "a", status: "online" as const, currentPage: "/" }];
    const next = [{ userId: "a", status: "online" as const, currentPage: "/settings" }];
    const diff = diffPresence(prev, next);
    expect(diff.changed).toEqual([
      { userId: "a", status: "online", currentPage: "/settings" },
    ]);
  });

  it("returns empty when nothing changed", () => {
    const data = [{ userId: "a", status: "online" as const, currentPage: "/" }];
    const diff = diffPresence(data, data);
    expect(diff.changed).toEqual([]);
  });

  it("detects removed members", () => {
    const prev = [
      { userId: "a", status: "online" as const, currentPage: "/" },
      { userId: "b", status: "online" as const, currentPage: "/" },
    ];
    const next = [{ userId: "a", status: "online" as const, currentPage: "/" }];
    const diff = diffPresence(prev, next);
    expect(diff.removed).toEqual(["b"]);
  });
});
