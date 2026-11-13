import { describe, expect, it } from "vitest";
import {
  getPasswordStrength,
  isPasswordStrong,
  PASSWORD_RULES,
} from "@/features/auth/password-rules";

// The five rules a new password has to meet, and what is made of them: how many
// it meets (the bars of the meter) and whether it meets them all (what sign-up,
// the reset and the change of password ask). They live in a plain module, so
// that a server module can import them as well as the meter does.

describe("the rules of a new password", () => {
  it("are five, in the order the meter lists them", () => {
    expect(PASSWORD_RULES.map(({ key }) => key)).toEqual([
      "minLength",
      "uppercase",
      "lowercase",
      "number",
      "special",
    ]);
  });

  it.each([
    ["", 0],
    ["abc", 1],
    ["abcdefgh", 2],
    ["Abcdefgh", 3],
    ["Abcdefg1", 4],
    ["Abcdefg1!", 5],
  ])("count the rules that %j meets: %i", (password, met) => {
    expect(getPasswordStrength(password)).toBe(met);
  });

  it.each([
    ["Abcdefg1!", true],
    ["Secret-123!", true],
    ["", false],
    ["abc", false],
    ["Abc1!", false],
    ["Abcdefg1", false],
    ["abcdefg1!", false],
    ["ABCDEFG1!", false],
    ["Abcdefgh!", false],
  ])("hold a password only when it meets all five: %j is %s", (password, strong) => {
    expect(isPasswordStrong(password)).toBe(strong);
  });

  it("count a password as strong exactly when every rule is met", () => {
    for (const password of ["", "a", "Ab1", "Abcdefg1", "Abcdefg1!", "ÉÀÈ-12-abcd"]) {
      expect(isPasswordStrong(password), password).toBe(getPasswordStrength(password) === PASSWORD_RULES.length);
    }
  });
});
