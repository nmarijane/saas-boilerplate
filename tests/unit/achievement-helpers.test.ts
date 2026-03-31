import { describe, expect, it } from "vitest";
import {
  computeStreak,
  getAchievementKeysForEvent,
} from "@/features/achievements/helpers";

describe("getAchievementKeysForEvent", () => {
  it("maps member.invited to team-builder", () => {
    expect(getAchievementKeysForEvent("member.invited")).toEqual(["team-builder"]);
  });

  it("maps feedback.created to feedback-giver", () => {
    expect(getAchievementKeysForEvent("feedback.created")).toEqual(["feedback-giver"]);
  });

  it("maps api_key.created to api-creator", () => {
    expect(getAchievementKeysForEvent("api_key.created")).toEqual(["api-creator"]);
  });

  it("maps presence.changed to streak achievements", () => {
    expect(getAchievementKeysForEvent("presence.changed")).toEqual([
      "streak-3",
      "streak-7",
      "streak-30",
    ]);
  });

  it("returns empty array for unmapped events", () => {
    expect(getAchievementKeysForEvent("organization.created")).toEqual([]);
  });
});

describe("computeStreak", () => {
  it("increments streak when last login was yesterday", () => {
    const today = new Date("2026-04-02");
    const result = computeStreak("2026-04-01", 5, today);
    expect(result).toEqual({ lastLoginDate: "2026-04-02", currentStreak: 6 });
  });

  it("keeps streak when last login is today", () => {
    const today = new Date("2026-04-02");
    const result = computeStreak("2026-04-02", 5, today);
    expect(result).toEqual({ lastLoginDate: "2026-04-02", currentStreak: 5 });
  });

  it("resets streak when last login was more than 1 day ago", () => {
    const today = new Date("2026-04-05");
    const result = computeStreak("2026-04-02", 5, today);
    expect(result).toEqual({ lastLoginDate: "2026-04-05", currentStreak: 1 });
  });

  it("handles first-time login (no previous date)", () => {
    const today = new Date("2026-04-01");
    const result = computeStreak(null, 0, today);
    expect(result).toEqual({ lastLoginDate: "2026-04-01", currentStreak: 1 });
  });
});
