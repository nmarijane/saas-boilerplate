import { describe, expect, it } from "vitest";
import { listWindowOf, MAX_NOTIFICATIONS_LIMIT, MAX_NOTIFICATIONS_OFFSET } from "@/features/notifications/list-window";

describe("the window of the list of notifications", () => {
  it("is the first 20 when nothing is asked", () => {
    expect(listWindowOf(null, null)).toEqual({ limit: 20, offset: 0 });
    expect(listWindowOf(undefined, undefined)).toEqual({ limit: 20, offset: 0 });
  });

  it("is what is asked, within bounds", () => {
    expect(listWindowOf("10", "40")).toEqual({ limit: 10, offset: 40 });
    expect(listWindowOf("7.9", "3.2")).toEqual({ limit: 7, offset: 3 });
  });

  it("never exceeds the limits", () => {
    expect(listWindowOf("1000000000", "1000000000000")).toEqual({ limit: MAX_NOTIFICATIONS_LIMIT, offset: MAX_NOTIFICATIONS_OFFSET });
  });

  it("never goes below one item or the first position", () => {
    expect(listWindowOf("-5", "-5")).toEqual({ limit: 1, offset: 0 });
  });

  it("falls back to the default for what is not a number", () => {
    for (const asked of ["abc", "NaN", "Infinity", "", "0"]) {
      expect(listWindowOf(asked, asked), asked).toEqual({ limit: 20, offset: 0 });
    }
  });
});
